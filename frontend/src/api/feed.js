import api from "./axios";

export const getFeed = (limit = 50, offset = 0) =>
  api.get("/feed", { params: { limit, offset } }).then((r) => r.data);
