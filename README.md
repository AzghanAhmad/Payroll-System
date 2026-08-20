# Alpha Group — Payroll System

Full-stack payroll application for Pacific (Samoa / WST) workflows — employees, Fri–Thu timesheets, payroll costing (NPF/ACC/PAYE/Tea Fund/IOU), payslips, reports, and settings.

Licensed under the [MIT License](LICENSE).

## Stack


| Layer    | Tech                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, TanStack Query/Table, RHF, Zod, Recharts, Axios, Framer Motion, React Hot Toast |
| Backend  | Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Multer, PDFKit, ExcelJS, Nodemailer, Helmet, Morgan, Cors                    |




## Quick start (local)



### Prerequisites

- Node.js 20+
- MongoDB locally **or** a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) URI



### Backend

```bash
cd backend
cp .env.example .env
# Edit MONGODB_URI and JWT secrets
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173` (Vite proxies `/api` and `/uploads` to the backend)

### Default logins (after seed)


| Role  | Email                                                 | Password            |
| ----- | ----------------------------------------------------- | ------------------- |
| Admin | [alphacc2018@gmail.com](mailto:alphacc2018@gmail.com) | AlphaCC@Pay2018!xK9 |
| HR    | [hr@alphagroup.local](mailto:hr@alphagroup.local)     | hr12345             |




## Deploy (Railway + Atlas)

Production runs as **one Railway service** (Express serves the API and the built React app) with **MongoDB Atlas** for the database.

See the full walkthrough: **[DEPLOY.md](DEPLOY.md)**

Short version:

1. Create an Atlas cluster and copy `MONGODB_URI`
2. Push this repo to GitHub
3. Create a Railway project from the repo (uses `[railway.toml](railway.toml)`)
4. Set env vars: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV=production`
5. Generate a Railway domain, set `CLIENT_URL` to that HTTPS URL
6. Seed the database once (`npm run seed` against Atlas)

Root scripts used by Railway:

```bash
npm run build   # install backend + frontend, build Vite app
npm start       # node backend/server.js (serves API + frontend/dist)
```



## Modules

1. **Dashboard** — KPI cards, charts, quick actions, upcoming payroll
2. **Employees** — CRUD, search/filter/sort, Excel import/export, PDF export, photo upload
3. **Timesheets** — Month → Weeks 1–5 → Fri–Thu days; auto hours = out − in − break
4. **Payroll** — Weekly/monthly generate; normal / OT / double-time; NPF/ACC/tax/tea/IOU
5. **Payslips** — PDF download / email / print
6. **IOU Tracker** — Spreadsheet-style IOU issue & weekly repayments
7. **Leave / Calendar / Statutory / Month control / Schedule**
8. **Reports** — Weekly/monthly/yearly/department/IOU + exports
9. **Settings** — Company, logo, payroll rules, leave, statutory, departments
10. **Auth** — JWT access + refresh, roles, sign up / sign in, forgot/reset password



## API prefix

All routes under `/api` — health check: `GET /api/health`.

## Production notes

- **Uploads** (photos/logos) on Railway’s disk are **ephemeral** unless you add a volume or object storage.
- Never commit `.env` files; use Railway Variables for secrets.
- Change seed passwords after the first deploy.

