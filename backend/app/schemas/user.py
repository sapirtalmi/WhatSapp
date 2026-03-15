from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    # Profile fields
    avatar_url: str | None = None
    bio: str | None = None
    age: int | None = None
    hobbies: list[str] | None = None
    study: str | None = None
    work: str | None = None
    living: str | None = None
    preferred_types: list[str] | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    avatar_url: str | None = None
    bio: str | None = None
    age: int | None = None
    hobbies: list[str] | None = None
    study: str | None = None
    work: str | None = None
    living: str | None = None
    preferred_types: list[str] | None = None
