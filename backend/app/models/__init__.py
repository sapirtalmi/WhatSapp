from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic / create_all can discover them
from app.models.user import User  # noqa: E402, F401
from app.models.map_collection import MapCollection  # noqa: E402, F401
from app.models.place import Place  # noqa: E402, F401
from app.models.friendship import Friendship  # noqa: E402, F401
from app.models.saved_collection import SavedCollection  # noqa: E402, F401
from app.models.user_status import UserStatus, StatusRSVP  # noqa: E402, F401
