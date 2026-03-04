from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.map_collection import MapCollection
from app.models.user import User
from app.schemas.collection import CollectionOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


class UserProfile(BaseModel):
    user: UserOut
    public_collections: list[CollectionOut]


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/search", response_model=list[UserOut])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search users by username (case-insensitive, excludes self)."""
    results = db.execute(
        select(User).where(
            User.username.ilike(f"%{q}%"),
            User.id != current_user.id,
            User.is_active == True,
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
