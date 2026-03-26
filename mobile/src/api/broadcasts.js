import api from "./axios";

export const createBroadcast = (body) => api.post("/broadcasts", body).then(r => r.data);
export const getBroadcastsMap = (lat, lng, radius = 10000, type = null) =>
  api.get("/broadcasts/map", { params: { lat, lng, radius, ...(type && { type }) } }).then(r => r.data);
export const getBroadcast = (id) => api.get(`/broadcasts/${id}`).then(r => r.data);
export const deleteBroadcast = (id) => api.delete(`/broadcasts/${id}`);
export const requestToJoin = (id) => api.post(`/broadcasts/${id}/request`).then(r => r.data);
export const getBroadcastRequests = (id) => api.get(`/broadcasts/${id}/requests`).then(r => r.data);
export const updateRequest = (broadcastId, requestId, status) =>
  api.patch(`/broadcasts/${broadcastId}/requests/${requestId}`, { status }).then(r => r.data);
export const getMyBroadcasts = () => api.get("/broadcasts/my").then(r => r.data);
export const getJoinedBroadcasts = () => api.get("/broadcasts/joined").then(r => r.data);
