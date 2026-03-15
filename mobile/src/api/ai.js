import api from "./axios";

export async function getLocationInfo(name, lat, lon) {
  const res = await api.post("/ai/location-info", { name, lat, lon });
  return res.data;
}

export async function generateCollectionDescription(collectionId, title) {
  const body = collectionId ? { collection_id: collectionId } : { title };
  const res = await api.post("/ai/collection-description", body);
  return res.data;
}

export async function naturalSearch(query, lat = null, lon = null, bbox = null) {
  const res = await api.post("/ai/natural-search", { query, lat, lon, bbox });
  return res.data;
}

export async function analyzePhoto(photoUrl) {
  const res = await api.post("/ai/analyze-photo", { photo_url: photoUrl });
  return res.data;
}

export async function getRecommendations() {
  const res = await api.post("/ai/recommendations", {});
  return res.data;
}

export async function getTravelGuide(collectionId) {
  const res = await api.post("/ai/travel-guide", { collection_id: collectionId });
  return res.data;
}
