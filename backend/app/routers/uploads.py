import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/photo")
async def upload_photo(file: UploadFile):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are accepted")

    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 5 MB limit")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    (UPLOAD_DIR / filename).write_bytes(data)

    return {"url": f"/uploads/{filename}"}
