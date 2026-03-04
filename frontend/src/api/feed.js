import api from "./axios";

export const getFeed = (limit = 50, offset = 0, type = null) =>
  api.get("/feed", { params: { limit, offset, ...(type ? { type } : {}) } }).then((r) => r.data);
