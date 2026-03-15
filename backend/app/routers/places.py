from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.functions import ST_DWithin, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID, ST_Within
from geoalchemy2.shape import to_shape
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.friendship import Friendship, FriendshipStatus
from app.models.map_collection import MapCollection
from app.models.place import Place, PlaceType
from app.models.user import User
from app.schemas.place import PlaceCreate, PlaceOut, PlaceUpdate

router = APIRouter(tags=["places"])


def _place_to_out(place: Place, collection: MapCollection | None = None) -> PlaceOut:
    """Convert a Place ORM object to PlaceOut, extracting lat/lng from PostGIS geometry."""
    point = to_shape(place.location)
    col = collection or getattr(place, "collection", None)
    return PlaceOut(
        id=place.id,
        collection_id=place.collection_id,
        name=place.name,
        description=place.description,
        address=place.address,
        lat=point.y,
        lng=point.x,
        google_place_id=place.google_place_id,
        type=place.type,
        extra_data=place.extra_data,
        created_at=place.created_at,
        collection_title=col.title if col else None,
        owner_id=col.owner_id if col else None,
        owner_username=col.owner.username if col and col.owner else None,
    )


def _get_collection_or_404(collection_id: int, db: Session) -> MapCollection:
    collection = db.execute(
        select(MapCollection)
        .options(joinedload(MapCollection.owner))
        .where(MapCollection.id == collection_id)
    ).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


# ── Collection-scoped place routes ──────────────────────────────────────────

@router.post(
    "/collections/{collection_id}/places",
    response_model=PlaceOut,
    status_code=status.HTTP_201_CREATED,
)
def create_place(
    collection_id: int,
    body: PlaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your collection")

    place = Place(
        collection_id=collection_id,
        name=body.name,
        description=body.description,
        address=body.address,
        location=f"SRID=4326;POINT({body.lng} {body.lat})",
        google_place_id=body.google_place_id,
        type=body.type,
        extra_data=body.extra_data,
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return _place_to_out(place, collection)


@router.get("/collections/{collection_id}/places", response_model=list[PlaceOut])
def list_places(
    collection_id: int,
    type: PlaceType | None = Query(None, description="Filter by place type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = _get_collection_or_404(collection_id, db)
    if not collection.is_public and collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = select(Place).where(Place.collection_id == collection_id)
    if type is not None:
        stmt = stmt.where(Place.type == type)

    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p, collection) for p in places]


@router.patch("/collections/{collection_id}/places/{place_id}", response_model=PlaceOut)
def update_place(
    collection_id: int,
    place_id: int,
    body: PlaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your collection")

    place = db.get(Place, place_id)
    if not place or place.collection_id != collection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(place, field, value)
    db.commit()
    db.refresh(place)
    return _place_to_out(place, collection)


@router.delete(
    "/collections/{collection_id}/places/{place_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_place(
    collection_id: int,
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your collection")

    place = db.get(Place, place_id)
    if not place or place.collection_id != collection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")

    db.delete(place)
    db.commit()


# ── Global places endpoint ────────────────────────────────────────────────────

@router.get("/places", response_model=list[PlaceOut])
def list_places_global(
    type: PlaceType | None = Query(None, description="Filter by place type"),
    q: str | None = Query(None, description="Search by name or address"),
    collection_id: int | None = Query(None),
    owner_id: int | None = Query(None, description="Places from this user's collections"),
    source: str | None = Query(None, pattern="^(mine|friends)$", description="'mine' = own places, 'friends' = places from accepted friends"),
    sort: str = Query("recent", pattern="^(recent|name)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Global places search — returns places from public collections or current user's own."""
    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .options(joinedload(Place.collection).joinedload(MapCollection.owner))
        .where(
            or_(
                MapCollection.is_public == True,
                MapCollection.owner_id == current_user.id,
            )
        )
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)
    if q:
        q_like = f"%{q}%"
        stmt = stmt.where(or_(Place.name.ilike(q_like), Place.address.ilike(q_like)))
    if collection_id is not None:
        stmt = stmt.where(Place.collection_id == collection_id)

    # owner_id takes precedence over source
    if owner_id is not None:
        stmt = stmt.where(MapCollection.owner_id == owner_id)
    elif source == "mine":
        stmt = stmt.where(MapCollection.owner_id == current_user.id)
    elif source == "friends":
        friendships = db.execute(
            select(Friendship).where(
                or_(
                    Friendship.requester_id == current_user.id,
                    Friendship.addressee_id == current_user.id,
                ),
                Friendship.status == FriendshipStatus.accepted,
            )
        ).scalars().all()
        friend_ids = set()
        for f in friendships:
            friend_ids.add(f.requester_id if f.requester_id != current_user.id else f.addressee_id)
        if not friend_ids:
            return []
        stmt = stmt.where(MapCollection.owner_id.in_(friend_ids))

    if sort == "name":
        stmt = stmt.order_by(Place.name.asc())
    else:
        stmt = stmt.order_by(Place.created_at.desc())

    stmt = stmt.limit(limit).offset(offset)
    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p, p.collection) for p in places]


# ── Geo queries ───────────────────────────────────────────────────────────────

@router.get("/places/nearby", response_model=list[PlaceOut])
def get_nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: float = Query(5000, gt=0, le=50000, description="Radius in metres"),
    type: PlaceType | None = Query(None, description="Filter by place type"),
    q: str | None = Query(None, description="Search by name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return places within `radius` metres of the given point (public collections only)."""
    ref_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .options(joinedload(Place.collection).joinedload(MapCollection.owner))
        .where(
            MapCollection.is_public == True,
            ST_DWithin(
                func.cast(Place.location, type_=None),
                func.cast(ref_point, type_=None),
                radius,
                True,
            ),
        )
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)
    if q:
        stmt = stmt.where(Place.name.ilike(f"%{q}%"))

    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p, p.collection) for p in places]


@router.get("/places/bbox", response_model=list[PlaceOut])
def get_places_in_bbox(
    min_lng: float = Query(..., ge=-180, le=180),
    min_lat: float = Query(..., ge=-90, le=90),
    max_lng: float = Query(..., ge=-180, le=180),
    max_lat: float = Query(..., ge=-90, le=90),
    type: PlaceType | None = Query(None, description="Filter by place type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return places inside a bounding box (public collections only)."""
    envelope = ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)

    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .options(joinedload(Place.collection).joinedload(MapCollection.owner))
        .where(
            MapCollection.is_public == True,
            ST_Within(func.cast(Place.location, type_=None), func.cast(envelope, type_=None)),
        )
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)

    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p, p.collection) for p in places]
