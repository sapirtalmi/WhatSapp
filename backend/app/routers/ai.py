import json
from pathlib import Path

from google import genai
from google.genai import types
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..dependencies import get_current_user
from ..config import settings
from ..database import get_db
from ..models.map_collection import MapCollection
from ..models.place import Place, PlaceType

router = APIRouter(prefix="/ai", tags=["ai"])

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
MODEL = "gemini-2.0-flash"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_key():
    if not settings.gemini_api_key or settings.gemini_api_key.startswith("your-"):
        raise HTTPException(status_code=503, detail="AI service not configured. Add GEMINI_API_KEY to .env")


def _client():
    return genai.Client(api_key=settings.gemini_api_key)


def _generate(prompt: str) -> str:
    response = _client().models.generate_content(model=MODEL, contents=prompt)
    return response.text


def _parse_json(text: str):
    """Strip markdown fences and parse JSON."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(text.strip())


# ── 1. Location Info ──────────────────────────────────────────────────────────

class LocationInfoRequest(BaseModel):
    name: str
    lat: float
    lon: float


class LocationInfoResponse(BaseModel):
    description: str
    best_time: str
    what_to_do: str
    tips: str


@router.post("/location-info", response_model=LocationInfoResponse)
async def get_location_info(req: LocationInfoRequest, _=Depends(get_current_user)):
    _require_key()
    prompt = f"""Give me brief, practical travel info about: {req.name} (lat: {req.lat:.4f}, lon: {req.lon:.4f}).

Respond in JSON with exactly these keys:
- "description": 2-3 sentence overview
- "best_time": when to visit (1-2 sentences)
- "what_to_do": top 2-3 activities or highlights (1-2 sentences)
- "tips": 1-2 practical local tips

Return ONLY valid JSON, no markdown fences."""
    try:
        data = _parse_json(_generate(prompt))
        return LocationInfoResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


# ── 2. Auto-generate Collection Description ───────────────────────────────────

class CollectionDescRequest(BaseModel):
    collection_id: int | None = None
    title: str | None = None


class CollectionDescResponse(BaseModel):
    description: str


@router.post("/collection-description", response_model=CollectionDescResponse)
async def generate_collection_description(
    req: CollectionDescRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_key()

    title = req.title or ""
    place_list = ""

    if req.collection_id:
        col = db.execute(
            select(MapCollection)
            .where(MapCollection.id == req.collection_id, MapCollection.owner_id == current_user.id)
            .options(joinedload(MapCollection.places))
        ).scalar_one_or_none()
        if not col:
            raise HTTPException(status_code=404, detail="Collection not found.")
        title = title or col.title
        place_list = ", ".join(
            f"{p.name} ({p.type.value if p.type else 'place'})" for p in col.places[:25]
        )

    if not title:
        raise HTTPException(status_code=400, detail="Provide collection_id or title.")

    context = f" It contains: {place_list}." if place_list else ""
    prompt = f"""Write a short, engaging 2-sentence description for a travel collection called "{title}".{context}
Return ONLY the description text, no JSON, no quotes."""

    try:
        return CollectionDescResponse(description=_generate(prompt).strip())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


# ── 3. Natural Language Search ────────────────────────────────────────────────

class NaturalSearchRequest(BaseModel):
    query: str
    lat: float | None = None
    lon: float | None = None


class NaturalSearchPlace(BaseModel):
    id: int
    name: str
    address: str | None
    type: str | None
    collection_title: str | None
    lat: float
    lng: float


@router.post("/natural-search", response_model=list[NaturalSearchPlace])
async def natural_search(
    req: NaturalSearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_key()

    parse_prompt = f"""Convert this place search query to JSON filters: "{req.query}"
Return ONLY JSON with:
- "type": one of "food", "travel", "exercise", "shop", "hangout" or null
- "keywords": 1-3 key search words as a string, or null"""

    ai_type = None
    keywords = req.query
    try:
        filters = _parse_json(_generate(parse_prompt))
        ai_type = filters.get("type")
        keywords = filters.get("keywords") or req.query
    except Exception:
        pass

    stmt = (
        select(Place)
        .join(MapCollection, Place.collection_id == MapCollection.id)
        .where(
            or_(
                MapCollection.owner_id == current_user.id,
                MapCollection.is_public == True,
            )
        )
        .options(joinedload(Place.collection))
    )

    valid_types = [t.value for t in PlaceType]
    if ai_type and ai_type in valid_types:
        stmt = stmt.where(Place.type == PlaceType(ai_type))

    if keywords:
        stmt = stmt.where(
            or_(
                Place.name.ilike(f"%{keywords}%"),
                Place.address.ilike(f"%{keywords}%"),
                Place.description.ilike(f"%{keywords}%"),
            )
        )

    places = db.execute(stmt.limit(20)).scalars().all()

    from geoalchemy2.shape import to_shape
    results = []
    for p in places:
        pt = to_shape(p.location)
        results.append(NaturalSearchPlace(
            id=p.id,
            name=p.name,
            address=p.address,
            type=p.type.value if p.type else None,
            collection_title=p.collection.title if p.collection else None,
            lat=pt.y,
            lng=pt.x,
        ))
    return results


# ── 4. Analyze Photo (Vision) ──────────────────────────────────────────────────

class AnalyzePhotoRequest(BaseModel):
    photo_url: str


class AnalyzePhotoResponse(BaseModel):
    type: str | None
    name_suggestion: str | None
    confidence: str


@router.post("/analyze-photo", response_model=AnalyzePhotoResponse)
async def analyze_photo(req: AnalyzePhotoRequest, _=Depends(get_current_user)):
    _require_key()

    filename = Path(req.photo_url).name
    image_path = UPLOAD_DIR / filename
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found.")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    ext = image_path.suffix.lower()
    mime_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")

    prompt = """Analyze this photo of a place.
Return ONLY JSON with:
- "type": one of "food", "travel", "exercise", "shop", "hangout" or null if unclear
- "name_suggestion": a short possible name (e.g. "Coffee shop", "Hiking trail") or null
- "confidence": "high", "medium", or "low" """

    try:
        response = _client().models.generate_content(
            model=MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
        )
        data = _parse_json(response.text)
        return AnalyzePhotoResponse(
            type=data.get("type"),
            name_suggestion=data.get("name_suggestion"),
            confidence=data.get("confidence", "low"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


# ── 5. Smart Place Recommendations ────────────────────────────────────────────

class RecommendationItem(BaseModel):
    name: str
    type: str
    why: str
    address_hint: str | None = None


class RecommendationsResponse(BaseModel):
    recommendations: list[RecommendationItem]


@router.post("/recommendations", response_model=RecommendationsResponse)
async def get_recommendations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_key()

    places = db.execute(
        select(Place)
        .join(MapCollection)
        .where(MapCollection.owner_id == current_user.id)
        .order_by(Place.created_at.desc())
        .limit(30)
    ).scalars().all()

    if not places:
        summary = "This user has no saved places yet."
    else:
        from geoalchemy2.shape import to_shape
        lines = []
        for p in places[:20]:
            pt = to_shape(p.location)
            lines.append(f"- {p.name} ({p.type.value if p.type else 'place'}) · {p.address or f'{pt.y:.3f},{pt.x:.3f}'}")
        summary = "\n".join(lines)

    prompt = f"""Based on these saved places a person loves:
{summary}

Suggest 5 specific new places they should visit. Return ONLY a JSON array of 5 objects:
[{{"name": "...", "type": "food|travel|exercise|shop|hangout", "why": "one sentence", "address_hint": "city/area or null"}}]"""

    try:
        raw = _parse_json(_generate(prompt))
        items = raw if isinstance(raw, list) else raw.get("recommendations", [])
        return RecommendationsResponse(recommendations=[RecommendationItem(**i) for i in items[:5]])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


# ── 6. AI Travel Guide ────────────────────────────────────────────────────────

class TravelGuideRequest(BaseModel):
    collection_id: int


class TravelGuideResponse(BaseModel):
    title: str
    guide: str


@router.post("/travel-guide", response_model=TravelGuideResponse)
async def generate_travel_guide(
    req: TravelGuideRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_key()

    col = db.execute(
        select(MapCollection)
        .where(
            MapCollection.id == req.collection_id,
            or_(MapCollection.owner_id == current_user.id, MapCollection.is_public == True),
        )
        .options(joinedload(MapCollection.places))
    ).scalar_one_or_none()

    if not col:
        raise HTTPException(status_code=404, detail="Collection not found.")

    place_lines = "\n".join(
        f"- {p.name} ({p.type.value if p.type else 'place'}){': ' + p.address if p.address else ''}"
        for p in col.places[:30]
    ) or "- No places added yet"

    prompt = f"""Write a short, inspiring travel guide (3-4 paragraphs) for a collection called "{col.title}".
Places:
{place_lines}

Write it like a personal travel blog — warm, practical, and vivid. Mention the place names naturally.
Return ONLY the guide text, no JSON, no title."""

    try:
        return TravelGuideResponse(
            title=f"✈️ {col.title}",
            guide=_generate(prompt).strip(),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
