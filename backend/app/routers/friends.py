from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.schemas.friendship import FriendshipOut, FriendshipWithUserOut, FriendUserOut

router = APIRouter(prefix="/friends", tags=["friends"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_friendship(friendship_id: int, db: Session) -> Friendship:
    f = db.get(Friendship, friendship_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friendship not found")
    return f


def _existing_friendship(user_a: int, user_b: int, db: Session) -> Friendship | None:
    return db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user_a, Friendship.addressee_id == user_b),
                and_(Friendship.requester_id == user_b, Friendship.addressee_id == user_a),
            )
        )
    ).scalar_one_or_none()


def _to_friendship_with_user(f: Friendship, current_user_id: int) -> FriendshipWithUserOut:
    other = f.addressee if f.requester_id == current_user_id else f.requester
    return FriendshipWithUserOut(
        id=f.id,
        status=f.status,
        created_at=f.created_at,
        user=FriendUserOut(id=other.id, username=other.username),
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/request/{addressee_id}", response_model=FriendshipOut, status_code=status.HTTP_201_CREATED)
def send_request(
    addressee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if addressee_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add yourself")

    addressee = db.get(User, addressee_id)
    if not addressee or not addressee.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = _existing_friendship(current_user.id, addressee_id, db)
    if existing:
        if existing.status == FriendshipStatus.blocked:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Friendship already exists")

    friendship = Friendship(requester_id=current_user.id, addressee_id=addressee_id)
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    return friendship


@router.put("/{friendship_id}/accept", response_model=FriendshipOut)
def accept_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = _get_friendship(friendship_id, db)
    if f.addressee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request to accept")
    if f.status != FriendshipStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")
    f.status = FriendshipStatus.accepted
    db.commit()
    db.refresh(f)
    return f


@router.put("/{friendship_id}/reject", response_model=FriendshipOut)
def reject_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = _get_friendship(friendship_id, db)
    if f.addressee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request to reject")
    if f.status != FriendshipStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")
    db.delete(f)
    db.commit()


@router.put("/{friendship_id}/block", response_model=FriendshipOut)
def block_user(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = _get_friendship(friendship_id, db)
    if current_user.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your friendship")
    f.status = FriendshipStatus.blocked
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = _get_friendship(friendship_id, db)
    if current_user.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your friendship")
    db.delete(f)
    db.commit()


@router.get("", response_model=list[FriendshipWithUserOut])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all accepted friendships with the other user's info."""
    friendships = db.execute(
        select(Friendship).where(
            and_(
                or_(
                    Friendship.requester_id == current_user.id,
                    Friendship.addressee_id == current_user.id,
                ),
                Friendship.status == FriendshipStatus.accepted,
            )
        )
    ).scalars().all()
    return [_to_friendship_with_user(f, current_user.id) for f in friendships]


@router.get("/pending", response_model=list[FriendshipWithUserOut])
def list_pending(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return incoming pending friend requests."""
    friendships = db.execute(
        select(Friendship).where(
            and_(
                Friendship.addressee_id == current_user.id,
                Friendship.status == FriendshipStatus.pending,
            )
        )
    ).scalars().all()
    return [_to_friendship_with_user(f, current_user.id) for f in friendships]
