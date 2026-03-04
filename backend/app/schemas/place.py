from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.models.place import PlaceType


# ── Type-specific extra data models ──────────────────────────────────────────

class FoodExtra(BaseModel):
    photos: list[str] = []
    recommended_dishes: list[str] = []
    best_time_to_visit: str | None = None
    price_range: Literal["₪", "₪₪", "₪₪₪", "₪₪₪₪"] | None = None
    is_kosher: bool | None = None
    comments: str | None = None


class TravelExtra(BaseModel):
    photos: list[str] = []
    subtype: Literal["hike", "viewpoint", "picnic", "beach", "waterfall", "landmark"] | None = None
    duration_minutes: int | None = None
    difficulty: Literal["easy", "moderate", "hard", "extreme"] | None = None
    equipment: list[str] = []
    guide_required: bool | None = None
    trail_length_km: float | None = None
    comments: str | None = None


class ExerciseExtra(BaseModel):
    photos: list[str] = []
    subtype: Literal["gym", "outdoor", "pool", "yoga_studio", "crossfit", "sports_court", "martial_arts"] | None = None
    price_type: Literal["free", "paid", "membership"] | None = None
    price_monthly: float | None = None
    exercise_types: list[str] = []
    has_showers: bool | None = None
    equipment_provided: bool | None = None
    comments: str | None = None


class ShopExtra(BaseModel):
    photos: list[str] = []
    shop_type: str | None = None
    price_range: Literal["₪", "₪₪", "₪₪₪", "₪₪₪₪"] | None = None
    comments: str | None = None


class HangoutExtra(BaseModel):
    photos: list[str] = []
    hangout_type: str | None = None
    price_range: Literal["₪", "₪₪", "₪₪₪", "₪₪₪₪"] | None = None
    best_time_to_visit: str | None = None
    comments: str | None = None


_EXTRA_MODEL_MAP: dict[PlaceType, type[BaseModel]] = {
    PlaceType.food: FoodExtra,
    PlaceType.travel: TravelExtra,
    PlaceType.exercise: ExerciseExtra,
    PlaceType.shop: ShopExtra,
    PlaceType.hangout: HangoutExtra,
}


class PlaceCreate(BaseModel):
    name: str
    description: str | None = None
    address: str | None = None
    lat: float
    lng: float
    google_place_id: str | None = None
    type: PlaceType | None = None
    extra_data: dict | None = None

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

    @model_validator(mode="after")
    def validate_extra_data(self) -> "PlaceCreate":
        if self.type is not None and self.extra_data is not None:
            extra_model = _EXTRA_MODEL_MAP.get(self.type)
            if extra_model:
                validated = extra_model.model_validate(self.extra_data)
                self.extra_data = validated.model_dump()
        return self


class PlaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    type: PlaceType | None = None
    extra_data: dict | None = None


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
    extra_data: dict | None = None
    created_at: datetime
    collection_title: str | None = None
    owner_id: int | None = None
    owner_username: str | None = None

    model_config = {"from_attributes": True}
