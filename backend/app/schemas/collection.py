from datetime import datetime

from pydantic import BaseModel


class CollectionCreate(BaseModel):
    title: str
    description: str | None = None
    is_public: bool = False


class CollectionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_public: bool | None = None


class CollectionOut(BaseModel):
    id: int
    owner_id: int
    title: str
    description: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
