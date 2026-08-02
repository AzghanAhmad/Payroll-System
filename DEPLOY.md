# Deploy: Railway + MongoDB Atlas

Step-by-step guide to put **Alpha Group Payroll** on the internet.

Architecture: **one Railway web service** (API + built React app) + **MongoDB Atlas** (cloud database).

---

## 1. MongoDB Atlas (cloud database)

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free account.
2. **Create a cluster** — choose the free **M0** tier and a region close to you.
3. **Database Access** → **Add New Database User**
   - Authentication: Password
   - Save the username and password (you will need them in the URI).
4. **Network Access** → **Add IP Address**
   - For Railway, choose **Allow Access from Anywhere** (`0.0.0.0/0`).
   - (You can tighten this later.)
5. **Database** → **Connect** → **Drivers** → copy the connection string.

Example shape:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/payroll_system?retryWrites=true&w=majority
```

- Replace `USER` / `PASSWORD` with your DB user.
- Put your database name in the path (`payroll_system` above).
- URL-encode special characters in the password (e.g. `@` → `%40`).

Keep this URI private — you will paste it into Railway as `MONGODB_URI`.

---

## 2. GitHub

1. Create a new GitHub repository (public or private).
2. From this project folder:

```bash
git init
git add .
git commit -m "Prepare Alpha Group payroll for Railway deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

**Do not commit** `backend/.env` or any real secrets. `.gitignore` already excludes `.env` files.

This repo includes an **MIT** [`LICENSE`](LICENSE).

---

## 3. Railway

1. Go to [https://railway.app](https://railway.app) and sign in (GitHub is easiest).
2. **New Project** → **Deploy from GitHub repo** → select this repository.
3. Open the service → **Settings**:
   - Root directory: leave empty (repo root).
   - Build / start are defined in [`railway.toml`](railway.toml) (`npm run build` / `npm start`).
4. **Variables** → add:

| Variable | Example / notes |
|----------|-----------------|
| `MONGODB_URI` | Your Atlas `mongodb+srv://...` URI |
| `JWT_ACCESS_SECRET` | Long random string (e.g. 32+ chars) |
| `JWT_REFRESH_SECRET` | Different long random string |
| `JWT_ACCESS_EXPIRES` | `8h` |
| `JWT_REFRESH_EXPIRES` | `7d` |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Your public HTTPS URL (see next step) |
| `EMAIL_FROM` | Optional, e.g. `noreply@yourdomain.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional (needed for real forgot-password email) |

Generate secrets locally if you want:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. **Networking** → **Generate Domain** → copy the URL, e.g. `https://alpha-group-payroll-production.up.railway.app`.
6. Set `CLIENT_URL` to that exact URL (no trailing slash) and redeploy if the first deploy used a placeholder.
7. Wait for the deploy to go green. Open `/api/health` — you should see `{ "status": "ok", ... }`.
8. Open the root URL — you should see the login page.

---

## 4. Seed admin users (first time)

From your laptop (with Atlas URI in `backend/.env`):

```bash
cd backend
# Set MONGODB_URI in .env to the Atlas URI
npm run seed
```

Or use Railway’s shell / one-off command:

```bash
cd backend && npm run seed
```

Default logins after seed:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin123@gmail.com` | `admin123` |
| HR | `hr@alphagroup.local` | `hr12345` |

**Change these passwords immediately** after first login (or create a new admin and disable the seed accounts).

---

## 5. Checklist after go-live

- [ ] `/api/health` returns OK  
- [ ] Sign in works against Atlas data  
- [ ] `CLIENT_URL` matches the Railway HTTPS domain  
- [ ] Seed passwords changed  
- [ ] (Optional) SMTP configured for password reset emails  

---

## Notes & limits

### Uploads are ephemeral

Employee photos and company logos are stored on the Railway container disk. **They are wiped on redeploy** unless you attach a [Railway Volume](https://docs.railway.app/reference/volumes) to `backend/uploads` or move files to S3/R2 later.

### Local vs production

| | Local | Railway |
|--|--------|---------|
| Frontend | `npm run dev` in `frontend` (Vite) | Built into `frontend/dist`, served by Express |
| API | `npm run dev` in `backend` | Same process as SPA |
| DB | Local MongoDB or Atlas | Atlas |

### Same-origin API

The frontend calls `/api` by default. On Railway, the SPA and API share one domain, so you usually **leave `VITE_API_URL` empty**.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Build fails | Confirm Node 20+; check Railway build logs for `frontend` Vite errors |
| App crashes on boot | Check `MONGODB_URI` (Atlas user, password encoding, Network Access `0.0.0.0/0`) |
| Login CORS / cookie issues | Set `CLIENT_URL` to the exact Railway HTTPS origin |
| Blank page | Confirm `npm run build` produced `frontend/dist/index.html` in the build log |
| Healthcheck failing | Ensure `/api/health` is reachable; increase healthcheck timeout in `railway.toml` |
