from datetime import datetime

from pydantic import BaseModel

from app.models.friendship import FriendshipStatus


class FriendshipOut(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: FriendshipStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class FriendUserOut(BaseModel):
    """A user summary returned alongside a friendship record."""
    id: int
    username: str

    model_config = {"from_attributes": True}


class FriendshipWithUserOut(BaseModel):
    id: int
    status: FriendshipStatus
    created_at: datetime
    # The other user in the relationship (not the caller)
    user: FriendUserOut

    model_config = {"from_attributes": True}
