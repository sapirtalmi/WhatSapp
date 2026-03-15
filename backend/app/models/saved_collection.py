from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class SavedCollection(Base):
    __tablename__ = "saved_collections"
    __table_args__ = (UniqueConstraint("user_id", "collection_id", name="uq_saved_collection"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("map_collections.id"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="saved_collections")
    collection: Mapped["MapCollection"] = relationship(back_populates="saved_by")
