import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Axios must not force Content-Type on FormData or the multipart boundary breaks
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Content-Type', undefined);
    } else {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return Promise.reject(error);
      }
      try {
        refreshing =
          refreshing ||
          axios.post('/api/auth/refresh', { refreshToken }).then((r) => r.data);
        const data = await refreshing;
        refreshing = null;
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
