from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.broadcast import Broadcast, Chat, Message
from app.models.user import User
from app.routers.ws import manager

router = APIRouter(prefix="/chats", tags=["chats"])


# ── Pydantic Schemas ───────────────────────────────────────────────────────────


class ChatOut(BaseModel):
    id: int
    broadcast_id: Optional[int]
    broadcast_title: Optional[str]
    broadcast_type: Optional[str]
    other_user_id: int
    other_username: str
    other_avatar_url: Optional[str]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    unread_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    sender_username: str
    content: str
    sent_at: datetime
    is_read: bool

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str


# ── Helpers ────────────────────────────────────────────────────────────────────


def _is_participant(chat: Chat, user_id: int) -> bool:
    return chat.participant_1_id == user_id or chat.participant_2_id == user_id


def _other_user_id(chat: Chat, current_user_id: int) -> int:
    return chat.participant_2_id if chat.participant_1_id == current_user_id else chat.participant_1_id


def _chat_to_out(chat: Chat, current_user_id: int, db: Session) -> ChatOut:
    other_id = _other_user_id(chat, current_user_id)
    other_user = db.get(User, other_id)

    # Last message
    last_msg = db.execute(
        select(Message)
        .where(Message.chat_id == chat.id)
        .order_by(Message.sent_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    # Unread count: messages sent by the other user that the current user hasn't read
    unread_count = db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.chat_id == chat.id,
                Message.sender_id != current_user_id,
                Message.is_read == False,  # noqa: E712
            )
        )
    ).scalar_one() or 0

    # Broadcast info
    broadcast_title: Optional[str] = None
    broadcast_type: Optional[str] = None
    if chat.broadcast_id is not None and chat.broadcast is not None:
        broadcast_title = chat.broadcast.title
        broadcast_type = chat.broadcast.type.value

    return ChatOut(
        id=chat.id,
        broadcast_id=chat.broadcast_id,
        broadcast_title=broadcast_title,
        broadcast_type=broadcast_type,
        other_user_id=other_id,
        other_username=other_user.username if other_user else "Unknown",
        other_avatar_url=other_user.avatar_url if other_user else None,
        last_message=last_msg.content if last_msg else None,
        last_message_at=last_msg.sent_at if last_msg else None,
        unread_count=unread_count,
        created_at=chat.created_at,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[ChatOut])
def list_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatOut]:
    """
    List all chats the current user participates in, ordered by last message time
    (chats with no messages are ordered by creation time).
    """
    chats = db.execute(
        select(Chat)
        .options(joinedload(Chat.broadcast))
        .where(
            and_(
                Chat.is_active == True,  # noqa: E712
                or_(
                    Chat.participant_1_id == current_user.id,
                    Chat.participant_2_id == current_user.id,
                ),
            )
        )
    ).unique().scalars().all()

    # Build ChatOut objects and sort by last_message_at descending (nulls last)
    out_list = [_chat_to_out(c, current_user.id, db) for c in chats]
    out_list.sort(
        key=lambda c: c.last_message_at or c.created_at,
        reverse=True,
    )
    return out_list


@router.get("/{chat_id}/messages", response_model=list[MessageOut])
def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[datetime] = Query(None, description="Cursor: return messages sent before this datetime"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageOut]:
    """
    Retrieve messages in a chat (oldest-first within the page).
    Marks all unread messages from the other participant as read.
    """
    chat = db.get(Chat, chat_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    if not _is_participant(chat, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this chat")

    stmt = select(Message).where(Message.chat_id == chat_id)
    if before is not None:
        stmt = stmt.where(Message.sent_at < before)
    stmt = stmt.order_by(Message.sent_at.desc()).limit(limit)

    messages = db.execute(stmt).scalars().all()
    # Return in ascending order (oldest first)
    messages = list(reversed(messages))

    # Mark messages from the other user as read
    db.execute(
        update(Message)
        .where(
            and_(
                Message.chat_id == chat_id,
                Message.sender_id != current_user.id,
                Message.is_read == False,  # noqa: E712
            )
        )
        .values(is_read=True)
    )
    db.commit()

    # Load sender usernames
    sender_ids = {m.sender_id for m in messages}
    senders = {u.id: u for u in db.execute(select(User).where(User.id.in_(sender_ids))).scalars().all()}

    return [
        MessageOut(
            id=m.id,
            chat_id=m.chat_id,
            sender_id=m.sender_id,
            sender_username=senders[m.sender_id].username if m.sender_id in senders else "Unknown",
            content=m.content,
            sent_at=m.sent_at,
            is_read=m.is_read,
        )
        for m in messages
    ]


@router.post("/{chat_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    chat_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    """
    Send a message in a chat. Also pushes a WebSocket notification to the other participant.
    """
    if not body.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content cannot be empty")

    chat = db.get(Chat, chat_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    if not _is_participant(chat, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this chat")

    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=body.content.strip(),
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    other_user_id = _other_user_id(chat, current_user.id)

    msg_out = MessageOut(
        id=msg.id,
        chat_id=msg.chat_id,
        sender_id=msg.sender_id,
        sender_username=current_user.username,
        content=msg.content,
        sent_at=msg.sent_at,
        is_read=msg.is_read,
    )

    # Notify other participant via WebSocket
    await manager.send_to_user(
        other_user_id,
        {
            "type": "new_message",
            "chat_id": chat_id,
            "message": {
                "id": msg_out.id,
                "chat_id": msg_out.chat_id,
                "sender_id": msg_out.sender_id,
                "sender_username": msg_out.sender_username,
                "content": msg_out.content,
                "sent_at": msg_out.sent_at.isoformat(),
                "is_read": msg_out.is_read,
            },
        },
    )

    return msg_out
