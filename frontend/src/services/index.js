import api from './api';

export const authApi = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data) => api.post('/auth/reset-password', data).then((r) => r.data),
};

export const employeeApi = {
  list: (params) => api.get('/employees', { params }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data) =>
    api
      .post('/employees', data, data instanceof FormData ? { headers: { 'Content-Type': undefined } } : undefined)
      .then((r) => r.data),
  update: (id, data) =>
    api
      .put(
        `/employees/${id}`,
        data,
        data instanceof FormData ? { headers: { 'Content-Type': undefined } } : undefined
      )
      .then((r) => r.data),
  remove: (id) => api.delete(`/employees/${id}`).then((r) => r.data),
  exportExcel: () => api.get('/employees/export/excel', { responseType: 'blob' }),
  exportPdf: () => api.get('/employees/export/pdf', { responseType: 'blob' }),
  importExcel: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/employees/import/excel', fd, { headers: { 'Content-Type': undefined } })
      .then((r) => r.data);
  },
};

export const departmentApi = {
  list: () => api.get('/departments').then((r) => r.data),
  create: (data) => api.post('/departments', data).then((r) => r.data),
  update: (id, data) => api.put(`/departments/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/departments/${id}`).then((r) => r.data),
};

export const timesheetApi = {
  list: (params) => api.get('/timesheets', { params }).then((r) => r.data),
  getMonth: (year, month) => api.get(`/timesheets/${year}/${month}`).then((r) => r.data),
  update: (id, data) => api.put(`/timesheets/${id}`, data).then((r) => r.data),
  updateDay: (year, month, week, employeeId, payload) =>
    api.patch(`/timesheets/${year}/${month}/${week}/${employeeId}/day`, payload).then((r) => r.data),
};

export const payrollApi = {
  list: (params) => api.get('/payroll', { params }).then((r) => r.data),
  summary: (params) => api.get('/payroll/summary', { params }).then((r) => r.data),
  generateWeekly: (data) => api.post('/payroll/generate-weekly', data).then((r) => r.data),
  generateMonthly: (data) => api.post('/payroll/generate-monthly', data).then((r) => r.data),
  byWeek: (week, params) => api.get(`/payroll/week/${week}`, { params }).then((r) => r.data),
  byMonth: (month, params) => api.get(`/payroll/month/${month}`, { params }).then((r) => r.data),
};

export const payslipApi = {
  list: (params) => api.get('/payslips', { params }).then((r) => r.data),
  get: (id) => api.get(`/payslips/${id}`).then((r) => r.data),
  download: (id) => api.get(`/payslips/download/${id}`, { responseType: 'blob' }),
  downloadPack: (params) => api.get('/payslips/download-pack', { params, responseType: 'blob' }),
  remove: (id) => api.delete(`/payslips/${id}`).then((r) => r.data),
  removePeriod: (params) => api.delete('/payslips/period', { params }).then((r) => r.data),
  email: (id) => api.post(`/payslips/email/${id}`).then((r) => r.data),
  generate: (ids) => api.post('/payslips/generate', { ids }).then((r) => r.data),
};

export const loanApi = {
  list: (params) => api.get('/loans', { params }).then((r) => r.data),
  summary: () => api.get('/loans/summary/stats').then((r) => r.data),
  create: (data) => api.post('/loans', data).then((r) => r.data),
  update: (id, data) => api.put(`/loans/${id}`, data).then((r) => r.data),
  setWeekPayment: (id, data) => api.put(`/loans/${id}/week-payment`, data).then((r) => r.data),
  addPayment: (id, data) => api.post(`/loans/${id}/payments`, data).then((r) => r.data),
  remove: (id) => api.delete(`/loans/${id}`).then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (data) => {
    // Let the browser set multipart boundary — never force Content-Type on FormData
    if (data instanceof FormData) {
      return api.put('/settings', data, { headers: { 'Content-Type': undefined } }).then((r) => r.data);
    }
    return api.put('/settings', data).then((r) => r.data);
  },
};

export const reportApi = {
  weekly: (params) => api.get('/reports/weekly', { params }).then((r) => r.data),
  monthly: (params) => api.get('/reports/monthly', { params }).then((r) => r.data),
  yearly: (params) => api.get('/reports/yearly', { params }).then((r) => r.data),
  department: (params) => api.get('/reports/department', { params }).then((r) => r.data),
  attendance: (params) => api.get('/reports/attendance', { params }).then((r) => r.data),
  iou: () => api.get('/reports/iou').then((r) => r.data),
  exportExcel: (params) => api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportPdf: (params) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
};

export const dashboardApi = {
  get: () => api.get('/dashboard').then((r) => r.data),
};

export const leaveApi = {
  dashboard: (params) => api.get('/leave/dashboard', { params }).then((r) => r.data),
  staffSheets: (params) => api.get('/leave/staff-sheets', { params }).then((r) => r.data),
  entitlements: () => api.get('/leave/entitlements').then((r) => r.data),
  list: (params) => api.get('/leave', { params }).then((r) => r.data),
  create: (data) => api.post('/leave', data).then((r) => r.data),
  update: (id, data) => api.put(`/leave/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/leave/${id}`).then((r) => r.data),
  emailBalance: (data) => api.post('/leave/email-balance', data).then((r) => r.data),
};

export const calendarApi = {
  month: (params) => api.get('/calendar/month', { params }).then((r) => r.data),
  list: (params) => api.get('/calendar', { params }).then((r) => r.data),
  create: (data) => api.post('/calendar', data).then((r) => r.data),
  update: (id, data) => api.put(`/calendar/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/calendar/${id}`).then((r) => r.data),
};

export const opsApi = {
  schedule: (params) => api.get('/ops/schedule', { params }).then((r) => r.data),
  monthControl: () => api.get('/ops/month-control').then((r) => r.data),
  createNextMonth: () => api.post('/ops/month-control/create-next').then((r) => r.data),
  setCurrentMonth: (data) => api.put('/ops/month-control/current', data).then((r) => r.data),
  exportMonthPdfs: (params) =>
    api.get('/ops/month-control/export-pdfs', { params, responseType: 'blob' }),
  importAttendance: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/ops/attendance/import', fd, { headers: { 'Content-Type': undefined } })
      .then((r) => r.data);
  },
};

export const statutoryApi = {
  sheets: (params) => api.get('/statutory/sheets', { params }).then((r) => r.data),
  saveSheets: (data) => api.put('/statutory/sheets', data).then((r) => r.data),
  iouTracker: (params) => api.get('/statutory/iou-tracker', { params }).then((r) => r.data),
};
