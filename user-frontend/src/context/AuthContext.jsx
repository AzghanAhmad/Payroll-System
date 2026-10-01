import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '@/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('user_accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('user_accessToken');
        localStorage.removeItem('user_refreshToken');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem('user_accessToken', data.accessToken);
    localStorage.setItem('user_refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const register = async ({ name, email, password }) => {
    const data = await authApi.register({ name, email, password });
    localStorage.setItem('user_accessToken', data.accessToken);
    localStorage.setItem('user_refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('user_accessToken');
    localStorage.removeItem('user_refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
