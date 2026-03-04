from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.map_collection import MapCollection
from app.models.place import Place
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionOut, CollectionUpdate

router = APIRouter(prefix="/collections", tags=["collections"])


def _collection_to_out(collection: MapCollection, db: Session) -> CollectionOut:
    place_count = db.execute(
        select(func.count()).where(Place.collection_id == collection.id)
    ).scalar_one()
    return CollectionOut(
        id=collection.id,
        owner_id=collection.owner_id,
        title=collection.title,
        description=collection.description,
        is_public=collection.is_public,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        place_count=place_count,
        owner_username=collection.owner.username if collection.owner else None,
    )


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(
    body: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = MapCollection(**body.model_dump(), owner_id=current_user.id)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    collection = db.execute(
        select(MapCollection).options(joinedload(MapCollection.owner)).where(MapCollection.id == collection.id)
    ).scalar_one()
    return _collection_to_out(collection, db)


@router.get("", response_model=list[CollectionOut])
def list_collections(
    search: str | None = Query(None, description="Filter by title"),
    owner_id: int | None = Query(None, description="Filter by owner"),
    mine_only: bool = Query(False, description="Only return current user's collections"),
    sort: str = Query("recent", pattern="^(recent|name)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(MapCollection)
        .options(joinedload(MapCollection.owner))
        .where(
            or_(
                MapCollection.owner_id == current_user.id,
                MapCollection.is_public == True,
            )
        )
    )
    if mine_only:
        stmt = stmt.where(MapCollection.owner_id == current_user.id)
    if owner_id is not None:
        stmt = stmt.where(MapCollection.owner_id == owner_id)
    if search:
        stmt = stmt.where(MapCollection.title.ilike(f"%{search}%"))
    if sort == "name":
        stmt = stmt.order_by(MapCollection.title.asc())
    else:
        stmt = stmt.order_by(MapCollection.updated_at.desc())

    collections = db.execute(stmt).scalars().all()
    return [_collection_to_out(c, db) for c in collections]


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.execute(
        select(MapCollection).options(joinedload(MapCollection.owner)).where(MapCollection.id == collection_id)
    ).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    if not collection.is_public and collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return _collection_to_out(collection, db)


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.execute(
        select(MapCollection).options(joinedload(MapCollection.owner)).where(MapCollection.id == collection_id)
    ).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your collection")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(collection, field, value)
    db.commit()
    db.refresh(collection)
    return _collection_to_out(collection, db)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.get(MapCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your collection")
    db.delete(collection)
    db.commit()
