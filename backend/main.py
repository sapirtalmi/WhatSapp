import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import engine
from app.models import Base
from app.routers import ai, auth, broadcasts, chats, collections, feed, friends, places, saved, status, uploads, users, ws

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Enable PostGIS and create tables — retry up to 10x with backoff for Cloud SQL cold starts
for attempt in range(10):
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        break
    except OperationalError:
        if attempt == 9:
            raise
        time.sleep(2 ** attempt)  # 1s, 2s, 4s, 8s …

app = FastAPI(title="WhatSapp API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(collections.router)
app.include_router(places.router)
app.include_router(friends.router)
app.include_router(feed.router)
app.include_router(status.router)
app.include_router(saved.router)
app.include_router(uploads.router)
app.include_router(broadcasts.router)
app.include_router(chats.router)
app.include_router(ws.router)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
