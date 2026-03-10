from datetime import datetime
from enum import Enum as PyEnum

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class StatusMode(str, PyEnum):
    live = "live"
    plan = "plan"


class ActivityType(str, PyEnum):
    coffee = "coffee"
    drinks = "drinks"
    study = "study"
    hike = "hike"
    food = "food"
    event = "event"
    hangout = "hangout"
    work = "work"
    other = "other"


class RSVPResponse(str, PyEnum):
    going = "going"
    maybe = "maybe"
    no = "no"


class UserStatus(Base):
    __tablename__ = "user_statuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mode: Mapped[StatusMode] = mapped_column(Enum(StatusMode, name="statusmode"), nullable=False)
    activity_type: Mapped[ActivityType] = mapped_column(Enum(ActivityType, name="activitytype"), nullable=False)
    message: Mapped[str | None] = mapped_column(String(280), nullable=True)
    location: Mapped[object] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # "friends" or "public"
    visibility: Mapped[str] = mapped_column(String(20), default="friends", nullable=False)

    user: Mapped["User"] = relationship(back_populates="statuses")
    rsvps: Mapped[list["StatusRSVP"]] = relationship(back_populates="status", cascade="all, delete-orphan")


class StatusRSVP(Base):
    __tablename__ = "status_rsvps"
    __table_args__ = (UniqueConstraint("status_id", "user_id", name="uq_rsvp_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    status_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_statuses.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    response: Mapped[RSVPResponse] = mapped_column(Enum(RSVPResponse, name="rsvpresponse"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    status: Mapped["UserStatus"] = relationship(back_populates="rsvps")
    user: Mapped["User"] = relationship()
