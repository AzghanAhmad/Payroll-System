# Payroll System

Full-stack payroll application for Pacific (Samoa / WST) workflows — employees, Fri–Thu timesheets, payroll costing (NPF/ACC/PAYE/Tea Fund/IOU), payslips, reports, and settings.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, TanStack Query/Table, RHF, Zod, Recharts, Axios, Framer Motion, React Hot Toast |
| Backend | Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Multer, PDFKit, ExcelJS, Nodemailer, Helmet, Morgan, Cors |

## Quick start

### Prerequisites

- Node.js 20+
- MongoDB running locally (`mongodb://127.0.0.1:27017`)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### Default logins (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@payroll.local | admin123 |
| HR | hr@payroll.local | hr12345 |

## Modules

1. **Dashboard** — KPI cards, charts, quick actions, upcoming payroll  
2. **Employees** — CRUD, search/filter/sort, Excel import/export, PDF export, photo upload  
3. **Timesheets** — Month → Weeks 1–5 → Fri–Thu days; auto hours = out − in − break  
4. **Payroll** — Weekly/monthly generate; normal (≤40), OT, double-time; NPF/ACC/tax/tea/IOU; employer cost; Excel-style summary  
5. **Payslips** — PDF download / email / print; QR + digital signature fields  
6. **IOU / Loans** — Installments, history, auto-deduct on payroll  
7. **Reports** — Weekly/monthly/yearly/department/IOU + Excel/PDF export  
8. **Settings** — Company, logo, multipliers, rates, week start, departments  
9. **Auth** — JWT access + refresh, roles (admin/manager/hr/employee), forgot/reset password  

## API prefix

All routes under `/api` — see `backend/routes/`.

## Phase status

All planned phases (0–6) are implemented in this codebase.
