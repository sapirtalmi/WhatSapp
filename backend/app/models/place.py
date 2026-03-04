import enum
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class PlaceType(str, enum.Enum):
    food = "food"
    travel = "travel"
    shop = "shop"
    hangout = "hangout"


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("map_collections.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    # PostGIS Point geometry (SRID 4326 = WGS84)
    location: Mapped[object] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    google_place_id: Mapped[str | None] = mapped_column(String(255))
    type: Mapped[PlaceType | None] = mapped_column(Enum(PlaceType, name="placetype"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    collection: Mapped["MapCollection"] = relationship(back_populates="places")
