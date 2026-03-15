import api from "./axios";

export const login = (email, password) =>
  api.post("/auth/login", { email, password }).then((r) => r.data);

export const register = (username, email, password) =>
  api.post("/auth/register", { username, email, password }).then((r) => r.data);

export const getMe = () => api.get("/users/me").then((r) => r.data);
