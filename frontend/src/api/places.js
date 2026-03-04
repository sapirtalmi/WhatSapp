import api from "./axios";

export const getPlaces = (collectionId) =>
  api.get(`/collections/${collectionId}/places`).then((r) => r.data);

export const createPlace = (collectionId, data) =>
  api.post(`/collections/${collectionId}/places`, data).then((r) => r.data);

export const updatePlace = (collectionId, placeId, data) =>
  api.patch(`/collections/${collectionId}/places/${placeId}`, data).then((r) => r.data);

export const deletePlace = (collectionId, placeId) =>
  api.delete(`/collections/${collectionId}/places/${placeId}`);

export const getNearbyPlaces = (lat, lng, radiusMeters = 5000) =>
  api.get("/places/nearby", { params: { lat, lng, radius: radiusMeters } }).then((r) => r.data);
