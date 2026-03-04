from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.place import PlaceType


class PlaceCreate(BaseModel):
    name: str
    description: str | None = None
    address: str | None = None
    lat: float
    lng: float
    google_place_id: str | None = None
    type: PlaceType | None = None

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v


class PlaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    type: PlaceType | None = None


class PlaceOut(BaseModel):
    id: int
    collection_id: int
    name: str
    description: str | None
    address: str | None
    lat: float
    lng: float
    google_place_id: str | None
    type: PlaceType | None
    created_at: datetime

    model_config = {"from_attributes": True}
