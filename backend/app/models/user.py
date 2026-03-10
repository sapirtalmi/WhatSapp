from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Profile fields
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hobbies: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    study: Mapped[str | None] = mapped_column(String(120), nullable=True)
    work: Mapped[str | None] = mapped_column(String(120), nullable=True)
    living: Mapped[str | None] = mapped_column(String(120), nullable=True)
    preferred_types: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    collections: Mapped[list["MapCollection"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    sent_requests: Mapped[list["Friendship"]] = relationship(
        foreign_keys="Friendship.requester_id", back_populates="requester"
    )
    received_requests: Mapped[list["Friendship"]] = relationship(
        foreign_keys="Friendship.addressee_id", back_populates="addressee"
    )
    saved_collections: Mapped[list["SavedCollection"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    statuses: Mapped[list["UserStatus"]] = relationship(back_populates="user", cascade="all, delete-orphan")
