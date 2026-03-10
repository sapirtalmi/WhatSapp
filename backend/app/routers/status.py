from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel
from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.models.user_status import ActivityType, RSVPResponse, StatusMode, StatusRSVP, UserStatus

router = APIRouter(prefix="/status", tags=["status"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────


class StatusCreate(BaseModel):
    mode: StatusMode
    activity_type: ActivityType
    message: Optional[str] = None
    lat: float
    lng: float
    location_name: Optional[str] = None
    # For live mode: "1h", "3h", "tonight"
    # For plan mode: ISO datetime string (e.g. "2026-03-10T20:00:00")
    expires_at: str
    visibility: str = "friends"


class StatusUpdate(BaseModel):
    is_active: Optional[bool] = None
    message: Optional[str] = None


class StatusOut(BaseModel):
    id: int
    user_id: int
    username: str
    mode: str
    activity_type: str
    message: Optional[str]
    lat: float
    lng: float
    location_name: Optional[str]
    expires_at: datetime
    created_at: datetime
    is_active: bool
    visibility: str
    rsvp_counts: dict
    my_rsvp: Optional[str]

    model_config = {"from_attributes": True}


class RSVPCreate(BaseModel):
    response: RSVPResponse


class RSVPOut(BaseModel):
    id: int
    user_id: int
    username: str
    response: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _parse_expires_at(expires_str: str) -> datetime:
    """
    Parse the expires_at field:
    - "1h"      → now + 1 hour
    - "3h"      → now + 3 hours
    - "tonight" → today at 23:59 UTC
    - otherwise → ISO 8601 datetime string
    """
    now = datetime.now(tz=timezone.utc)
    if expires_str == "1h":
        return now + timedelta(hours=1)
    if expires_str == "3h":
        return now + timedelta(hours=3)
    if expires_str == "tonight":
        today = date.today()
        return datetime(today.year, today.month, today.day, 23, 59, 0, tzinfo=timezone.utc)
    # ISO datetime — may or may not have timezone info
    parsed = datetime.fromisoformat(expires_str)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _expire_old_statuses(db: Session) -> None:
    """Mark any statuses whose expires_at has passed as inactive."""
    now = datetime.now(tz=timezone.utc)
    db.execute(
        update(UserStatus)
        .where(and_(UserStatus.expires_at < now, UserStatus.is_active == True))  # noqa: E712
        .values(is_active=False)
    )
    db.commit()


def _get_friend_ids(current_user_id: int, db: Session) -> set[int]:
    """Return the set of accepted-friend user IDs for current_user_id."""
    rows = db.execute(
        select(Friendship).where(
            and_(
                or_(
                    Friendship.requester_id == current_user_id,
                    Friendship.addressee_id == current_user_id,
                ),
                Friendship.status == FriendshipStatus.accepted,
            )
        )
    ).scalars().all()
    ids: set[int] = set()
    for f in rows:
        other = f.addressee_id if f.requester_id == current_user_id else f.requester_id
        ids.add(other)
    return ids


def _status_to_out(s: UserStatus, current_user_id: int) -> StatusOut:
    pt = to_shape(s.location)
    counts: dict[str, int] = {"going": 0, "maybe": 0, "no": 0}
    my_rsvp: Optional[str] = None
    for r in s.rsvps:
        counts[r.response.value] += 1
        if r.user_id == current_user_id:
            my_rsvp = r.response.value
    return StatusOut(
        id=s.id,
        user_id=s.user_id,
        username=s.user.username,
        mode=s.mode.value,
        activity_type=s.activity_type.value,
        message=s.message,
        lat=pt.y,
        lng=pt.x,
        location_name=s.location_name,
        expires_at=s.expires_at,
        created_at=s.created_at,
        is_active=s.is_active,
        visibility=s.visibility,
        rsvp_counts=counts,
        my_rsvp=my_rsvp,
    )


def _load_status_with_relations(status_id: int, db: Session) -> UserStatus | None:
    """Fetch a single UserStatus with user and rsvps eagerly loaded."""
    return db.execute(
        select(UserStatus)
        .options(
            joinedload(UserStatus.user),
            joinedload(UserStatus.rsvps).joinedload(StatusRSVP.user),
        )
        .where(UserStatus.id == status_id)
    ).scalar_one_or_none()


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("", response_model=StatusOut, status_code=status.HTTP_201_CREATED)
def create_status(
    body: StatusCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create (or replace) the current user's active status.
    Only one active status is allowed at a time — any existing active status
    is deactivated before the new one is created.
    """
    if body.visibility not in ("friends", "public"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="visibility must be 'friends' or 'public'",
        )

    try:
        expires_at = _parse_expires_at(body.expires_at)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expires_at value. Use '1h', '3h', 'tonight', or an ISO datetime string.",
        )

    now = datetime.now(tz=timezone.utc)
    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expires_at must be in the future",
        )

    # Deactivate any existing active status
    db.execute(
        update(UserStatus)
        .where(and_(UserStatus.user_id == current_user.id, UserStatus.is_active == True))  # noqa: E712
        .values(is_active=False)
    )
    db.commit()

    new_status = UserStatus(
        user_id=current_user.id,
        mode=body.mode,
        activity_type=body.activity_type,
        message=body.message,
        location=WKTElement(f"POINT({body.lng} {body.lat})", srid=4326),
        location_name=body.location_name,
        expires_at=expires_at,
        is_active=True,
        visibility=body.visibility,
    )
    db.add(new_status)
    db.commit()
    db.refresh(new_status)

    # Reload with relationships for the response
    loaded = _load_status_with_relations(new_status.id, db)
    return _status_to_out(loaded, current_user.id)


@router.get("/feed", response_model=list[StatusOut])
def get_status_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all active statuses visible to the current user:
    - Current user's own active status
    - Friends' active statuses (visibility='friends' or 'public')
    - Any status marked visibility='public'
    """
    _expire_old_statuses(db)

    friend_ids = _get_friend_ids(current_user.id, db)

    stmt = (
        select(UserStatus)
        .options(
            joinedload(UserStatus.user),
            joinedload(UserStatus.rsvps).joinedload(StatusRSVP.user),
        )
        .where(
            and_(
                UserStatus.is_active == True,  # noqa: E712
                or_(
                    UserStatus.user_id == current_user.id,
                    UserStatus.visibility == "public",
                    and_(
                        UserStatus.user_id.in_(friend_ids),
                        UserStatus.visibility == "friends",
                    ),
                ),
            )
        )
        .order_by(UserStatus.created_at.desc())
    )

    statuses = db.execute(stmt).scalars().unique().all()
    return [_status_to_out(s, current_user.id) for s in statuses]


@router.get("/my", response_model=Optional[StatusOut])
def get_my_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's active status, or null if none exists."""
    _expire_old_statuses(db)

    s = db.execute(
        select(UserStatus)
        .options(
            joinedload(UserStatus.user),
            joinedload(UserStatus.rsvps).joinedload(StatusRSVP.user),
        )
        .where(
            and_(
                UserStatus.user_id == current_user.id,
                UserStatus.is_active == True,  # noqa: E712
            )
        )
        .order_by(UserStatus.created_at.desc())
    ).scalar_one_or_none()

    if s is None:
        return None
    return _status_to_out(s, current_user.id)


@router.patch("/{status_id}", response_model=StatusOut)
def update_status(
    status_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update a status. Only the owner may modify it."""
    s = db.get(UserStatus, status_id)
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
    if s.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your status")

    if body.is_active is not None:
        s.is_active = body.is_active
    if body.message is not None:
        s.message = body.message

    db.commit()

    loaded = _load_status_with_relations(status_id, db)
    return _status_to_out(loaded, current_user.id)


@router.delete("/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status(
    status_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a status. Only the owner may delete it."""
    s = db.get(UserStatus, status_id)
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
    if s.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your status")
    db.delete(s)
    db.commit()


@router.post("/{status_id}/rsvp", response_model=RSVPOut, status_code=status.HTTP_201_CREATED)
def upsert_rsvp(
    status_id: int,
    body: RSVPCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create or update the current user's RSVP on a status.
    Only allowed on 'plan' mode statuses. Cannot RSVP your own status.
    """
    s = db.get(UserStatus, status_id)
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
    if s.mode != StatusMode.plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RSVPs are only allowed on plan-mode statuses",
        )
    if s.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot RSVP your own status",
        )

    # Upsert: delete existing RSVP if present, then create a fresh one
    existing = db.execute(
        select(StatusRSVP).where(
            and_(
                StatusRSVP.status_id == status_id,
                StatusRSVP.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.response = body.response
        db.commit()
        db.refresh(existing)
        rsvp = existing
    else:
        rsvp = StatusRSVP(
            status_id=status_id,
            user_id=current_user.id,
            response=body.response,
        )
        db.add(rsvp)
        db.commit()
        db.refresh(rsvp)

    # Reload with user relationship for response
    loaded_rsvp = db.execute(
        select(StatusRSVP)
        .options(joinedload(StatusRSVP.user))
        .where(StatusRSVP.id == rsvp.id)
    ).scalar_one()

    return RSVPOut(
        id=loaded_rsvp.id,
        user_id=loaded_rsvp.user_id,
        username=loaded_rsvp.user.username,
        response=loaded_rsvp.response.value,
        created_at=loaded_rsvp.created_at,
    )


@router.get("/{status_id}/rsvp", response_model=list[RSVPOut])
def list_rsvps(
    status_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # noqa: ARG001  — auth required
):
    """Return all RSVPs for a given status with user info."""
    s = db.get(UserStatus, status_id)
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")

    rsvps = db.execute(
        select(StatusRSVP)
        .options(joinedload(StatusRSVP.user))
        .where(StatusRSVP.status_id == status_id)
        .order_by(StatusRSVP.created_at.asc())
    ).scalars().all()

    return [
        RSVPOut(
            id=r.id,
            user_id=r.user_id,
            username=r.user.username,
            response=r.response.value,
            created_at=r.created_at,
        )
        for r in rsvps
    ]
