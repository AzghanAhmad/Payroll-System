import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
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
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
const serveSpa = fs.existsSync(path.join(clientDist, 'index.html'));

await connectDB();

app.set('etag', false);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / non-browser / configured client
      if (!origin || origin === clientUrl || serveSpa) return cb(null, true);
      return cb(null, origin === clientUrl);
    },
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve employee photos from disk, or restore from DB photoData if the file is missing
app.get('/uploads/photos/:filename', async (req, res, next) => {
  try {
    const filePath = path.join(uploadRoot, 'photos', req.params.filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const Employee = (await import('./models/Employee.js')).default;
    const photoPath = `/uploads/photos/${req.params.filename}`;
    const emp = await Employee.findOne({ photo: photoPath }).select('+photoData');
    if (emp?.photoData?.startsWith('data:')) {
      const m = emp.photoData.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        // Restore file for next request
        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, Buffer.from(m[2], 'base64'));
        } catch {
          /* ignore restore errors */
        }
        res.type(m[1]);
        return res.send(Buffer.from(m[2], 'base64'));
      }
    }
    return res.status(404).json({ message: 'Photo not found' });
  } catch (err) {
    return next(err);
  }
});

app.use('/uploads', express.static(uploadRoot));

// Do not cache dynamic API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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

if (serveSpa) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Alpha Group Payroll API running on port ${PORT}${serveSpa ? ' (serving SPA)' : ''}`);
});
