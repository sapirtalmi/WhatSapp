import api from "./axios";

export const getChats = () => api.get("/chats").then(r => r.data);
export const getMessages = (chatId, limit = 50, before = null) =>
  api.get(`/chats/${chatId}/messages`, { params: { limit, ...(before && { before }) } }).then(r => r.data);
export const sendMessage = (chatId, content) =>
  api.post(`/chats/${chatId}/messages`, { content }).then(r => r.data);
