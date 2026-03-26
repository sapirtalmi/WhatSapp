# Backend Dev Agent Memory

## Routers
- `auth` → /auth/register, /auth/token, /auth/login (login accepts JSON {email, password})
- `users` → /users/me, /users/search, /users/{id}/profile
- `collections` → /collections CRUD
- `places` → /collections/{id}/places CRUD, /places/nearby, /places/bbox, /places (global)
- `friends` → /friends CRUD + /friends/pending
- `feed` → /feed (paginated, type filter)
- `saved` → /collections/{id}/save, /collections/saved
- `uploads` → POST /uploads/photo (multipart, max 5 MB)
- `status` → /status CRUD + /status/feed + /status/my + /status/{id}/rsvp
- `broadcasts` → /broadcasts CRUD + /broadcasts/map (geo+visibility) + /broadcasts/my + /broadcasts/joined + /broadcasts/{id}/request + /broadcasts/{id}/requests + /broadcasts/{id}/requests/{rid}
- `chats` → /chats (list) + /chats/{id}/messages (GET, POST)
- `ws` → WS /ws/{user_id} (in-memory ConnectionManager; `manager` singleton importable from `app.routers.ws`)

## Key Patterns
- All routers use **sync** functions (not async). Only `ai.py`, `uploads.py`, `broadcasts.py` (update_request_status), and `chats.py` (send_message) use async (needed for WebSocket `await manager.send_to_user()`).
- DB session: `db: Session = Depends(get_db)`, execute with `db.execute(select(...)).scalars().all()`
- Auth: `current_user: User = Depends(get_current_user)` from `app.dependencies`
- PostGIS insert: `WKTElement(f"POINT({lng} {lat})", srid=4326)` — x=lng, y=lat
- PostGIS read: `from geoalchemy2.shape import to_shape; pt = to_shape(obj.location); lat=pt.y, lng=pt.x`
- Eager loading: `joinedload(Model.relationship)` chained with `.joinedload()` for nested
- After `joinedload` queries on one-to-many, call `.scalars().unique().all()` to deduplicate

## Alembic Gotchas
- `Base.metadata.create_all(bind=engine)` runs on every server start → tables may already exist before migration runs
- If tables exist but migration not stamped: `alembic stamp <rev_id>`
- Autogenerate always adds `op.drop_table('spatial_ref_sys')` — **always remove this line**
- PostGIS geometry columns may not autogenerate correctly — write DDL manually using `geoalchemy2.types.Geometry`
- For new Enum types in migrations: create them explicitly with `sa.Enum(...).create(op.get_bind(), checkfirst=True)`

## Model Locations
- `backend/app/models/user.py` — User
- `backend/app/models/map_collection.py` — MapCollection
- `backend/app/models/place.py` — Place, PlaceType enum
- `backend/app/models/friendship.py` — Friendship, FriendshipStatus enum
- `backend/app/models/saved_collection.py` — SavedCollection
- `backend/app/models/user_status.py` — UserStatus, StatusRSVP, StatusMode, ActivityType, RSVPResponse enums
- `backend/app/models/broadcast.py` — Broadcast, BroadcastRequest, Chat, Message, BroadcastType, BroadcastVisibility, RequestStatus enums

## Detailed Notes
See `patterns.md` for extended notes.
