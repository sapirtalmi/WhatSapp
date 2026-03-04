import api from "./axios";

export const getFeed = (limit = 20, offset = 0, type) =>
  api
    .get("/feed", { params: { limit, offset, ...(type && { type }) } })
    .then((r) => r.data);
