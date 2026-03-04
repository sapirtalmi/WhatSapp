import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { login as apiLogin, register as apiRegister, getMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on app start
    SecureStore.getItemAsync("access_token")
      .then((token) => {
        if (token) return getMe();
        return null;
      })
      .then((me) => {
        if (me) setUser(me);
      })
      .catch(() => SecureStore.deleteItemAsync("access_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await apiLogin(email, password);
    await SecureStore.setItemAsync("access_token", data.access_token);
    const me = await getMe();
    setUser(me);
  }

  async function register(username, email, password) {
    await apiRegister(username, email, password);
    await login(email, password);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("access_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
