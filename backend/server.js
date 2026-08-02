import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { uploadRoot } from './middleware/upload.js';

import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import timesheetRoutes from './routes/timesheetRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import payslipRoutes from './routes/payslipRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import payrollOpsRoutes from './routes/payrollOpsRoutes.js';
import statutoryRoutes from './routes/statutoryRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

await connectDB();

// Avoid stale 304 responses for dynamic payroll data
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadRoot));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ops', payrollOpsRoutes);
app.use('/api/statutory', statutoryRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Payroll API running on port ${PORT}`));
