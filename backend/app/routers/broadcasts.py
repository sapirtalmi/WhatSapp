from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.broadcast import (
    Broadcast,
    BroadcastRequest,
    BroadcastType,
    BroadcastVisibility,
    Chat,
    RequestStatus,
)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.routers.ws import manager

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


# ── Pydantic Schemas ───────────────────────────────────────────────────────────


class BroadcastCreate(BaseModel):
    title: str
    type: BroadcastType
    description: Optional[str] = None
    lat: float
    lng: float
    location_name: Optional[str] = None
    event_datetime: Optional[datetime] = None
    is_flexible: bool = False
    visibility: BroadcastVisibility = BroadcastVisibility.public
    max_participants: Optional[int] = None
    # Supported shorthands: "tonight", "tomorrow", "1d", "3d", "1w"
    # or an ISO datetime string
    expires_at: str


class BroadcastOut(BaseModel):
    id: int
    creator_id: int
    creator_username: str
    creator_avatar_url: Optional[str]
    title: str
    type: str
    description: Optional[str]
    lat: float
    lng: float
    location_name: Optional[str]
    event_datetime: Optional[datetime]
    is_flexible: bool
    visibility: str
    max_participants: Optional[int]
    expires_at: datetime
    is_active: bool
    created_at: datetime
    participant_count: int
    my_request_status: Optional[str]

    model_config = {"from_attributes": True}


class BroadcastRequestOut(BaseModel):
    id: int
    broadcast_id: int
    requester_id: int
    requester_username: str
    requester_avatar_url: Optional[str]
    requester_bio: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RequestStatusUpdate(BaseModel):
    status: str  # "accepted" | "declined"


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_expires_at(value: str) -> datetime:
    """
    Parse expires_at shorthand or ISO string.

    Shorthands:
      "tonight"  → today at 23:59 UTC
      "tomorrow" → tomorrow at 23:59 UTC
      "1d"       → now + 1 day
      "3d"       → now + 3 days
      "1w"       → now + 7 days
    Anything else is parsed as ISO 8601.
    """
    now = datetime.now(tz=timezone.utc)
    today = date.today()

    if value == "tonight":
        return datetime(today.year, today.month, today.day, 23, 59, 0, tzinfo=timezone.utc)
    if value == "tomorrow":
        tomorrow = today + timedelta(days=1)
        return datetime(tomorrow.year, tomorrow.month, tomorrow.day, 23, 59, 0, tzinfo=timezone.utc)
    if value == "1d":
        return now + timedelta(days=1)
    if value == "3d":
        return now + timedelta(days=3)
    if value == "1w":
        return now + timedelta(weeks=1)

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _expire_old_broadcasts(db: Session) -> None:
    """Bulk-deactivate broadcasts whose expires_at has passed."""
    now = datetime.now(tz=timezone.utc)
    db.execute(
        update(Broadcast)
        .where(and_(Broadcast.expires_at < now, Broadcast.is_active == True))  # noqa: E712
        .values(is_active=False)
    )
    db.commit()


def _get_friend_ids(user_id: int, db: Session) -> set[int]:
    """Return set of accepted-friend user IDs for user_id."""
    rows = db.execute(
        select(Friendship).where(
            and_(
                or_(
                    Friendship.requester_id == user_id,
                    Friendship.addressee_id == user_id,
                ),
                Friendship.status == FriendshipStatus.accepted,
            )
        )
    ).scalars().all()
    ids: set[int] = set()
    for f in rows:
        other = f.addressee_id if f.requester_id == user_id else f.requester_id
        ids.add(other)
    return ids


def _get_friends_of_friends_ids(user_id: int, friend_ids: set[int], db: Session) -> set[int]:
    """
    Return the union of friend IDs of each friend (excluding user_id itself).
    Used to evaluate friends_of_friends visibility.
    """
    if not friend_ids:
        return set()
    rows = db.execute(
        select(Friendship).where(
            and_(
                or_(
                    Friendship.requester_id.in_(friend_ids),
                    Friendship.addressee_id.in_(friend_ids),
                ),
                Friendship.status == FriendshipStatus.accepted,
            )
        )
    ).scalars().all()
    fof: set[int] = set()
    for f in rows:
        for candidate in (f.requester_id, f.addressee_id):
            if candidate != user_id:
                fof.add(candidate)
    return fof


def _participant_count(broadcast_id: int, db: Session) -> int:
    """Count accepted BroadcastRequests for a broadcast."""
    result = db.execute(
        select(func.count(BroadcastRequest.id)).where(
            and_(
                BroadcastRequest.broadcast_id == broadcast_id,
                BroadcastRequest.status == RequestStatus.accepted,
            )
        )
    ).scalar_one()
    return result or 0


def _my_request_status(broadcast_id: int, user_id: int, db: Session) -> Optional[str]:
    """Return the current user's request status string for a broadcast, or None."""
    req = db.execute(
        select(BroadcastRequest).where(
            and_(
                BroadcastRequest.broadcast_id == broadcast_id,
                BroadcastRequest.requester_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if req is None:
        return None
    return req.status.value


def _broadcast_to_out(b: Broadcast, current_user_id: int, db: Session) -> BroadcastOut:
    pt = to_shape(b.location)
    return BroadcastOut(
        id=b.id,
        creator_id=b.creator_id,
        creator_username=b.creator.username,
        creator_avatar_url=b.creator.avatar_url,
        title=b.title,
        type=b.type.value,
        description=b.description,
        lat=pt.y,
        lng=pt.x,
        location_name=b.location_name,
        event_datetime=b.event_datetime,
        is_flexible=b.is_flexible,
        visibility=b.visibility.value,
        max_participants=b.max_participants,
        expires_at=b.expires_at,
        is_active=b.is_active,
        created_at=b.created_at,
        participant_count=_participant_count(b.id, db),
        my_request_status=_my_request_status(b.id, current_user_id, db),
    )


def _load_broadcast(broadcast_id: int, db: Session) -> Broadcast | None:
    """Load a broadcast with its creator eagerly loaded."""
    return db.execute(
        select(Broadcast)
        .options(joinedload(Broadcast.creator))
        .where(Broadcast.id == broadcast_id)
    ).unique().scalar_one_or_none()


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.post("", response_model=BroadcastOut, status_code=status.HTTP_201_CREATED)
def create_broadcast(
    body: BroadcastCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BroadcastOut:
    """Create a new broadcast."""
    try:
        expires_at = _parse_expires_at(body.expires_at)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expires_at value. Use 'tonight', 'tomorrow', '1d', '3d', '1w', or an ISO datetime string.",
        )

    now = datetime.now(tz=timezone.utc)
    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expires_at must be in the future",
        )

    broadcast = Broadcast(
        creator_id=current_user.id,
        title=body.title,
        type=body.type,
        description=body.description,
        location=WKTElement(f"POINT({body.lng} {body.lat})", srid=4326),
        location_name=body.location_name,
        event_datetime=body.event_datetime,
        is_flexible=body.is_flexible,
        visibility=body.visibility,
        max_participants=body.max_participants,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    loaded = _load_broadcast(broadcast.id, db)
    return _broadcast_to_out(loaded, current_user.id, db)


@router.get("/my", response_model=list[BroadcastOut])
def get_my_broadcasts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BroadcastOut]:
    """Get current user's own active broadcasts."""
    _expire_old_broadcasts(db)

    broadcasts = db.execute(
        select(Broadcast)
        .options(joinedload(Broadcast.creator))
        .where(
            and_(
                Broadcast.creator_id == current_user.id,
                Broadcast.is_active == True,  # noqa: E712
            )
        )
        .order_by(Broadcast.created_at.desc())
    ).unique().scalars().all()

    return [_broadcast_to_out(b, current_user.id, db) for b in broadcasts]


@router.get("/joined", response_model=list[BroadcastOut])
def get_joined_broadcasts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BroadcastOut]:
    """Get broadcasts the current user has been accepted into."""
    _expire_old_broadcasts(db)

    accepted_requests = db.execute(
        select(BroadcastRequest.broadcast_id).where(
            and_(
                BroadcastRequest.requester_id == current_user.id,
                BroadcastRequest.status == RequestStatus.accepted,
            )
        )
    ).scalars().all()

    if not accepted_requests:
        return []

    broadcasts = db.execute(
        select(Broadcast)
        .options(joinedload(Broadcast.creator))
        .where(
            and_(
                Broadcast.id.in_(accepted_requests),
                Broadcast.is_active == True,  # noqa: E712
            )
        )
        .order_by(Broadcast.created_at.desc())
    ).unique().scalars().all()

    return [_broadcast_to_out(b, current_user.id, db) for b in broadcasts]


@router.get("/map", response_model=list[BroadcastOut])
def get_map_broadcasts(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius: float = Query(10000, ge=1, le=50000, description="Radius in meters"),
    type: Optional[BroadcastType] = Query(None, description="Filter by broadcast type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BroadcastOut]:
    """
    Get broadcasts visible to the current user within a given radius.

    Visibility rules:
    - public: always shown
    - friends: only shown if current user is an accepted friend of the creator
    - friends_of_friends: shown if current user is a friend or friend-of-friend of the creator
    """
    _expire_old_broadcasts(db)

    friend_ids = _get_friend_ids(current_user.id, db)
    fof_ids = _get_friends_of_friends_ids(current_user.id, friend_ids, db)
    # fof_ids already includes friend_ids by construction (friends of friends includes the friends themselves)
    visible_creator_ids = friend_ids | fof_ids

    now = datetime.now(tz=timezone.utc)
    reference_point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)

    stmt = (
        select(Broadcast)
        .options(joinedload(Broadcast.creator))
        .where(
            and_(
                Broadcast.is_active == True,  # noqa: E712
                Broadcast.expires_at > now,
                func.ST_DWithin(
                    func.ST_Transform(Broadcast.location, 3857),
                    func.ST_Transform(reference_point, 3857),
                    radius,
                ),
                or_(
                    Broadcast.visibility == BroadcastVisibility.public,
                    Broadcast.creator_id == current_user.id,
                    and_(
                        Broadcast.visibility == BroadcastVisibility.friends,
                        Broadcast.creator_id.in_(friend_ids),
                    ),
                    and_(
                        Broadcast.visibility == BroadcastVisibility.friends_of_friends,
                        Broadcast.creator_id.in_(visible_creator_ids),
                    ),
                ),
            )
        )
        .order_by(Broadcast.created_at.desc())
    )

    if type is not None:
        stmt = stmt.where(Broadcast.type == type)

    broadcasts = db.execute(stmt).unique().scalars().all()
    return [_broadcast_to_out(b, current_user.id, db) for b in broadcasts]


@router.get("/{broadcast_id}", response_model=BroadcastOut)
def get_broadcast(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BroadcastOut:
    """Get a single broadcast by ID."""
    b = _load_broadcast(broadcast_id, db)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast not found")
    return _broadcast_to_out(b, current_user.id, db)


@router.delete("/{broadcast_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_broadcast(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft-delete (deactivate) a broadcast. Only the creator may do this."""
    b = db.get(Broadcast, broadcast_id)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast not found")
    if b.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your broadcast")
    b.is_active = False
    db.commit()


@router.post("/{broadcast_id}/request", response_model=BroadcastRequestOut, status_code=status.HTTP_201_CREATED)
def request_to_join(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BroadcastRequestOut:
    """Request to join a broadcast."""
    b = db.get(Broadcast, broadcast_id)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast not found")
    if not b.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broadcast is no longer active")
    if b.creator_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request to join your own broadcast",
        )

    existing = db.execute(
        select(BroadcastRequest).where(
            and_(
                BroadcastRequest.broadcast_id == broadcast_id,
                BroadcastRequest.requester_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing is not None and existing.status in (RequestStatus.pending, RequestStatus.accepted):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You already have a {existing.status.value} request for this broadcast",
        )

    # If a declined request exists, allow re-requesting by updating it to pending
    if existing is not None:
        existing.status = RequestStatus.pending
        db.commit()
        db.refresh(existing)
        req = existing
    else:
        req = BroadcastRequest(
            broadcast_id=broadcast_id,
            requester_id=current_user.id,
            status=RequestStatus.pending,
        )
        db.add(req)
        db.commit()
        db.refresh(req)

    loaded = db.execute(
        select(BroadcastRequest)
        .options(joinedload(BroadcastRequest.requester))
        .where(BroadcastRequest.id == req.id)
    ).unique().scalar_one()

    return BroadcastRequestOut(
        id=loaded.id,
        broadcast_id=loaded.broadcast_id,
        requester_id=loaded.requester_id,
        requester_username=loaded.requester.username,
        requester_avatar_url=loaded.requester.avatar_url,
        requester_bio=loaded.requester.bio,
        status=loaded.status.value,
        created_at=loaded.created_at,
    )


@router.get("/{broadcast_id}/requests", response_model=list[BroadcastRequestOut])
def list_join_requests(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BroadcastRequestOut]:
    """List all join requests for a broadcast. Only the creator may view these."""
    b = db.get(Broadcast, broadcast_id)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast not found")
    if b.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your broadcast")

    requests = db.execute(
        select(BroadcastRequest)
        .options(joinedload(BroadcastRequest.requester))
        .where(BroadcastRequest.broadcast_id == broadcast_id)
        .order_by(BroadcastRequest.created_at.asc())
    ).scalars().all()

    return [
        BroadcastRequestOut(
            id=r.id,
            broadcast_id=r.broadcast_id,
            requester_id=r.requester_id,
            requester_username=r.requester.username,
            requester_avatar_url=r.requester.avatar_url,
            requester_bio=r.requester.bio,
            status=r.status.value,
            created_at=r.created_at,
        )
        for r in requests
    ]


@router.patch("/{broadcast_id}/requests/{request_id}", response_model=BroadcastRequestOut)
async def update_request_status(
    broadcast_id: int,
    request_id: int,
    body: RequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BroadcastRequestOut:
    """
    Accept or decline a join request. Only the broadcast creator may do this.
    Accepting a request automatically creates a Chat between creator and requester
    (if one does not already exist for this broadcast).
    """
    if body.status not in ("accepted", "declined"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'accepted' or 'declined'",
        )

    b = db.get(Broadcast, broadcast_id)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast not found")
    if b.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your broadcast")

    req = db.get(BroadcastRequest, request_id)
    if req is None or req.broadcast_id != broadcast_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if body.status == "accepted":
        # Enforce max_participants cap
        if b.max_participants is not None:
            current_count = _participant_count(broadcast_id, db)
            if current_count >= b.max_participants:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Broadcast is full ({b.max_participants} participants max)",
                )

        req.status = RequestStatus.accepted
        db.commit()

        # Create chat if one doesn't already exist
        existing_chat = db.execute(
            select(Chat).where(
                and_(
                    Chat.broadcast_id == broadcast_id,
                    or_(
                        and_(
                            Chat.participant_1_id == current_user.id,
                            Chat.participant_2_id == req.requester_id,
                        ),
                        and_(
                            Chat.participant_1_id == req.requester_id,
                            Chat.participant_2_id == current_user.id,
                        ),
                    ),
                )
            )
        ).scalar_one_or_none()

        if existing_chat is None:
            chat = Chat(
                broadcast_id=broadcast_id,
                participant_1_id=current_user.id,
                participant_2_id=req.requester_id,
                is_active=True,
            )
            db.add(chat)
            db.commit()
            db.refresh(chat)
            chat_id = chat.id
        else:
            chat_id = existing_chat.id

        # Notify requester via WebSocket
        await manager.send_to_user(
            req.requester_id,
            {
                "type": "request_accepted",
                "chat_id": chat_id,
                "broadcast_title": b.title,
            },
        )
    else:
        req.status = RequestStatus.declined
        db.commit()

    loaded = db.execute(
        select(BroadcastRequest)
        .options(joinedload(BroadcastRequest.requester))
        .where(BroadcastRequest.id == request_id)
    ).unique().scalar_one()

    return BroadcastRequestOut(
        id=loaded.id,
        broadcast_id=loaded.broadcast_id,
        requester_id=loaded.requester_id,
        requester_username=loaded.requester.username,
        requester_avatar_url=loaded.requester.avatar_url,
        requester_bio=loaded.requester.bio,
        status=loaded.status.value,
        created_at=loaded.created_at,
    )
