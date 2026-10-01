import api from './api';

export const authApi = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data) => api.post('/auth/reset-password', data).then((r) => r.data),
  changePassword: (data) => api.put('/auth/change-password', data).then((r) => r.data),
};

export const stockApi = {
  listProducts: (params) => api.get('/stock/products', { params }).then((r) => r.data),
  listCategories: () => api.get('/stock/categories').then((r) => r.data),
  adjustStock: (data) => api.post('/stock/adjust', data).then((r) => r.data),
  movements: (params) => api.get('/stock/movements', { params }).then((r) => r.data),
};

export const stockSalesApi = {
  create: (data) => api.post('/stock-sales', data).then((r) => r.data),
  list: (params) => api.get('/stock-sales', { params }).then((r) => r.data),
};

export const employeeApi = {
  list: (params) => api.get('/employees', { params }).then((r) => r.data),
};
