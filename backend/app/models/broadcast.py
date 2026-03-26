from datetime import datetime
from enum import Enum as PyEnum

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class BroadcastType(str, PyEnum):
    trip = "trip"
    food = "food"
    drinks = "drinks"
    hangout = "hangout"
    sport = "sport"
    other = "other"


class BroadcastVisibility(str, PyEnum):
    friends = "friends"
    friends_of_friends = "friends_of_friends"
    public = "public"


class RequestStatus(str, PyEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[BroadcastType] = mapped_column(Enum(BroadcastType), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[object] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    event_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_flexible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    visibility: Mapped[BroadcastVisibility] = mapped_column(
        Enum(BroadcastVisibility), default=BroadcastVisibility.public, nullable=False
    )
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["User"] = relationship(foreign_keys=[creator_id], back_populates="broadcasts")  # type: ignore[name-defined]
    requests: Mapped[list["BroadcastRequest"]] = relationship(back_populates="broadcast", cascade="all, delete-orphan")
    chats: Mapped[list["Chat"]] = relationship(back_populates="broadcast", cascade="all, delete-orphan")


class BroadcastRequest(Base):
    __tablename__ = "broadcast_requests"
    __table_args__ = (UniqueConstraint("broadcast_id", "requester_id", name="uq_broadcast_request"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    broadcast_id: Mapped[int] = mapped_column(Integer, ForeignKey("broadcasts.id"), nullable=False, index=True)
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus), default=RequestStatus.pending, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    broadcast: Mapped["Broadcast"] = relationship(back_populates="requests")
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id], back_populates="broadcast_requests")  # type: ignore[name-defined]


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    broadcast_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("broadcasts.id"), nullable=True, index=True)
    participant_1_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    participant_2_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    broadcast: Mapped["Broadcast | None"] = relationship(back_populates="chats")
    participant_1: Mapped["User"] = relationship(foreign_keys=[participant_1_id], back_populates="chats_as_p1")  # type: ignore[name-defined]
    participant_2: Mapped["User"] = relationship(foreign_keys=[participant_2_id], back_populates="chats_as_p2")  # type: ignore[name-defined]
    messages: Mapped[list["Message"]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    chat: Mapped["Chat"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(foreign_keys=[sender_id], back_populates="sent_messages")  # type: ignore[name-defined]
