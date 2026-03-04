from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.friendship import Friendship, FriendshipStatus
from app.models.map_collection import MapCollection
from app.models.place import Place, PlaceType
from app.models.user import User
from app.schemas.place import PlaceOut
from app.routers.places import _place_to_out

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=list[PlaceOut])
def get_feed(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: PlaceType | None = Query(None, description="Filter by place type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns places from:
    1. The current user's own collections
    2. Public collections owned by accepted friends

    Ordered by most recently added. Supports pagination via limit/offset.
    """
    # Find all accepted friend IDs (bidirectional)
    friend_rows = db.execute(
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

    friend_ids = set()
    for f in friend_rows:
        other = f.addressee_id if f.requester_id == current_user.id else f.requester_id
        friend_ids.add(other)

    # Fetch places from own + friends' public collections
    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .where(
            or_(
                MapCollection.owner_id == current_user.id,
                and_(
                    MapCollection.owner_id.in_(friend_ids),
                    MapCollection.is_public == True,
                ),
            )
        )
        .order_by(Place.created_at.desc())
    )
    if type is not None:
        stmt = stmt.where(Place.type == type)

    stmt = stmt.limit(limit).offset(offset)
    places = db.execute(stmt).scalars().all()
    return [_place_to_out(p) for p in places]
