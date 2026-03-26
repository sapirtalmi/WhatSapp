"""
WebSocket endpoint and in-memory connection manager.

Usage from other routers:
    from app.routers.ws import manager
    await manager.send_to_user(user_id, {"type": "...", ...})
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self.active[user_id] = ws

    def disconnect(self, user_id: int) -> None:
        self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, data: dict) -> None:
        ws = self.active.get(user_id)
        if ws is not None:
            try:
                await ws.send_json(data)
            except Exception:
                # If the socket is dead, silently discard
                self.disconnect(user_id)


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int) -> None:
    """
    Persistent WebSocket connection keyed by user_id.

    The client must connect immediately after receiving a JWT token.
    user_id in the path is trusted here for simplicity; for production,
    validate a token passed as a query parameter.
    """
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection alive; clients may send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
