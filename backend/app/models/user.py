from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
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
