import api from "./axios";

export const getPlaces = (collectionId, type) =>
  api
    .get(`/collections/${collectionId}/places`, { params: type ? { type } : {} })
    .then((r) => r.data);

export const createPlace = (collectionId, data) =>
  api.post(`/collections/${collectionId}/places`, data).then((r) => r.data);

export const deletePlace = (collectionId, placeId) =>
  api.delete(`/collections/${collectionId}/places/${placeId}`);

export const getNearbyPlaces = (lat, lng, radius = 5000, type) =>
  api
    .get("/places/nearby", { params: { lat, lng, radius, ...(type && { type }) } })
    .then((r) => r.data);

export const getPlacesInBbox = (minLng, minLat, maxLng, maxLat, type) =>
  api
    .get("/places/bbox", {
      params: { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat, ...(type && { type }) },
    })
    .then((r) => r.data);
