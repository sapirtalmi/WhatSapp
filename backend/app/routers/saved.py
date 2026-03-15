from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.map_collection import MapCollection
from app.models.saved_collection import SavedCollection
from app.models.user import User
from app.schemas.collection import CollectionOut

router = APIRouter(prefix="/collections", tags=["saved"])


@router.post("/{collection_id}/save", status_code=status.HTTP_201_CREATED)
def save_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a public collection to the current user's saved list."""
    collection = db.get(MapCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    if not collection.is_public and collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collection is private")

    saved = SavedCollection(user_id=current_user.id, collection_id=collection_id)
    db.add(saved)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already saved")
    return {"saved": True}


@router.delete("/{collection_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a collection from the current user's saved list."""
    saved = db.execute(
        select(SavedCollection).where(
            SavedCollection.user_id == current_user.id,
            SavedCollection.collection_id == collection_id,
        )
    ).scalar_one_or_none()

    if not saved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not saved")

    db.delete(saved)
    db.commit()


@router.get("/saved", response_model=list[CollectionOut])
def list_saved_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all collections the current user has saved."""
    rows = db.execute(
        select(MapCollection)
        .join(SavedCollection, SavedCollection.collection_id == MapCollection.id)
        .where(SavedCollection.user_id == current_user.id)
        .order_by(SavedCollection.id.desc())
    ).scalars().all()
    return rows
