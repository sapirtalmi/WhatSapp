from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.functions import ST_DWithin, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.map_collection import MapCollection
from app.models.place import Place, PlaceType
from app.models.user import User
from app.schemas.place import PlaceCreate, PlaceOut, PlaceUpdate

router = APIRouter(tags=["places"])


def _place_to_out(place: Place) -> PlaceOut:
    """Convert a Place ORM object to PlaceOut, extracting lat/lng from PostGIS geometry."""
    point = to_shape(place.location)
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
        created_at=place.created_at,
    )


def _get_collection_or_404(collection_id: int, db: Session) -> MapCollection:
    collection = db.get(MapCollection, collection_id)
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
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return _place_to_out(place)


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
    return [_place_to_out(p) for p in places]


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
    return _place_to_out(place)


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


# ── Geo queries ───────────────────────────────────────────────────────────────

@router.get("/places/nearby", response_model=list[PlaceOut])
def get_nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: float = Query(5000, gt=0, le=50000, description="Radius in metres"),
    type: PlaceType | None = Query(None, description="Filter by place type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return places within `radius` metres of the given point (public collections only)."""
    ref_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .where(
            MapCollection.is_public == True,
            ST_DWithin(
                func.cast(Place.location, type_=None),
                func.cast(ref_point, type_=None),
                radius,
                True,  # use_spheroid=True → accurate metre distances
            ),
        )
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)

    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p) for p in places]


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

    from geoalchemy2.functions import ST_Within
    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .where(
            MapCollection.is_public == True,
            ST_Within(func.cast(Place.location, type_=None), func.cast(envelope, type_=None)),
        )
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)

    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p) for p in places]
