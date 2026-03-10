import api from "./axios";

export const createStatus = (body) => api.post("/status", body).then(r => r.data);
export const getStatusFeed = () => api.get("/status/feed").then(r => r.data);
export const getMyStatus = () => api.get("/status/my").then(r => r.data);
export const updateStatus = (id, body) => api.patch(`/status/${id}`, body).then(r => r.data);
export const deleteStatus = (id) => api.delete(`/status/${id}`).then(r => r.data);
export const rsvpStatus = (id, response) => api.post(`/status/${id}/rsvp`, { response }).then(r => r.data);
export const getStatusRsvps = (id) => api.get(`/status/${id}/rsvp`).then(r => r.data);
