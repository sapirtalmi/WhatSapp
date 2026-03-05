from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.friendship import Friendship
from app.models.map_collection import MapCollection
from app.models.user import User
from app.schemas.collection import CollectionOut
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


class UserProfile(BaseModel):
    user: UserOut
    public_collections: list[CollectionOut]


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/search", response_model=list[UserOut])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search users by username (case-insensitive, excludes self and existing friends/requests)."""
    # IDs of users already in any friendship with current user
    existing = db.execute(
        select(Friendship).where(
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            )
        )
    ).scalars().all()
    excluded_ids = set()
    for f in existing:
        excluded_ids.add(f.requester_id)
        excluded_ids.add(f.addressee_id)
    excluded_ids.discard(current_user.id)

    results = db.execute(
        select(User).where(
            User.username.ilike(f"%{q}%"),
            User.id != current_user.id,
            User.id.not_in(excluded_ids) if excluded_ids else True,
            User.is_active.is_not(False),
        ).limit(20)
    ).scalars().all()
    return results


@router.get("/{user_id}/profile", response_model=UserProfile)
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a user's public profile and their public collections."""
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    public_collections = db.execute(
        select(MapCollection).where(
            MapCollection.owner_id == user_id,
            MapCollection.is_public == True,
        )
    ).scalars().all()

    return UserProfile(
        user=UserOut.model_validate(user),
        public_collections=[CollectionOut.model_validate(c) for c in public_collections],
    )
