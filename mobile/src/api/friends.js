import api from "./axios";

export const getFriends = () =>
  api.get("/friends").then((r) => r.data);

export const getPendingRequests = () =>
  api.get("/friends/pending").then((r) => r.data);

export const sendFriendRequest = (userId) =>
  api.post(`/friends/request/${userId}`).then((r) => r.data);

export const acceptFriendRequest = (friendshipId) =>
  api.put(`/friends/${friendshipId}/accept`).then((r) => r.data);

export const rejectFriendRequest = (friendshipId) =>
  api.put(`/friends/${friendshipId}/reject`).then((r) => r.data);

export const removeFriend = (friendshipId) =>
  api.delete(`/friends/${friendshipId}`);

export const searchUsers = (q) =>
  api.get("/users/search", { params: { q } }).then((r) => r.data);

export const getUserProfile = (userId) =>
  api.get(`/users/${userId}/profile`).then((r) => r.data);
