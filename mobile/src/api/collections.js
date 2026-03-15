import api from "./axios";

export const getCollections = () =>
  api.get("/collections").then((r) => r.data);

export const createCollection = (data) =>
  api.post("/collections", data).then((r) => r.data);

export const updateCollection = (id, data) =>
  api.patch(`/collections/${id}`, data).then((r) => r.data);

export const deleteCollection = (id) =>
  api.delete(`/collections/${id}`);

export const getSavedCollections = () =>
  api.get("/collections/saved").then((r) => r.data);

export const saveCollection = (id) =>
  api.post(`/collections/${id}/save`).then((r) => r.data);

export const unsaveCollection = (id) =>
  api.delete(`/collections/${id}/save`);
