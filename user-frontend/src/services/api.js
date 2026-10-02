import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('user_accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('user_refreshToken');
        if (refreshToken) {
          const refreshUrl = API_BASE_URL ? `${API_BASE_URL}/api/auth/refresh` : '/api/auth/refresh';
          const res = await axios.post(refreshUrl, { refreshToken });
          localStorage.setItem('user_accessToken', res.data.accessToken);
          localStorage.setItem('user_refreshToken', res.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(originalRequest);
        }
      } catch (e) {
        localStorage.removeItem('user_accessToken');
        localStorage.removeItem('user_refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
