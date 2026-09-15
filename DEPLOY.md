# Deploying Hybrid LMS (persistent, free-tier)

Code is already pushed to GitHub: **https://github.com/chatcharinpalm/hybrid-lms**
(private repo). This guide gets it live on a real URL that stays up even when
your computer is off, using three free services. Each step needs *your* login
(I can't create accounts or click through OAuth for you) — where I can run a
command on your behalf once you give me a value (e.g. a connection string),
I've said so.

Stack: **Neon** (Postgres, free forever, no expiry) + **Render** (Node/Express
backend, free web service) + **Vercel** (Next.js frontend, free).

## 1. Database — Neon

1. Go to https://neon.tech → Sign up with GitHub (one click, same account).
2. Create a project, name it `hybrid-lms`.
3. On the project dashboard, copy the **connection string** (it looks like
   `postgresql://user:pass@ep-xxxx.aws.neon.tech/neondb?sslmode=require`).
4. Send me that string when you're ready — I'll run the schema push and seed
   the demo accounts against it directly (I don't need dashboard access, just
   the connection string).

## 2. Backend — Render

1. Go to https://render.com → Sign up with GitHub.
2. **New +** → **Web Service** → connect the `hybrid-lms` repo (Render will
   ask to install its GitHub App — grant it access to this one repo).
3. Fill in:
   - **Root Directory:** leave blank (repo root)
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build -w apps/api`
   - **Start Command:** `npm run start -w apps/api`
   - **Instance Type:** Free
4. **Environment variables** (Add Environment Variable, one at a time):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `JWT_ACCESS_SECRET` | any long random string (e.g. mash the keyboard, 32+ chars) |
   | `JWT_REFRESH_SECRET` | a *different* long random string |
   | `CORS_ORIGIN` | `http://localhost:3000` for now — update after step 3 |
   | `UPLOAD_DIR` | `uploads` |
   | `NODE_ENV` | `production` |
5. **Create Web Service** and wait for the build to finish. Note the URL it
   gives you, e.g. `https://hybrid-lms-api.onrender.com`.
6. Confirm it's alive: open `https://hybrid-lms-api.onrender.com/health` in a
   browser — should show `{"ok":true}`.
7. Once you've sent me the Neon connection string (step 1) and this Render
   URL, I'll push the schema and seed the demo accounts for you.

**Known limitation:** Render's free tier spins the service down after ~15
minutes idle; the next request wakes it up but takes 30–50 seconds. The first
login of a demo session will feel slow — that's expected, not broken. Also,
uploaded course materials live on the container's local disk, which is wiped
on every redeploy — fine for a demo, not for real long-term file storage
(would need S3-compatible storage added later for that).

## 3. Frontend — Vercel

1. Go to https://vercel.com → Sign up with GitHub.
2. **Add New** → **Project** → import the `hybrid-lms` repo.
3. **Root Directory:** `apps/web` (Vercel auto-detects Next.js once you set this).
4. **Environment Variables:**
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Render URL from step 2 (e.g. `https://hybrid-lms-api.onrender.com`) |
5. **Deploy.** Note the resulting URL, e.g. `https://hybrid-lms.vercel.app`.

## 4. Close the loop: point the backend's CORS at the real frontend URL

Back in Render → your service → **Environment** → edit `CORS_ORIGIN`:

```
https://hybrid-lms.vercel.app,http://localhost:3000
```

(comma-separated so your local dev server also still works). Save — Render
redeploys automatically on env var changes.

## 5. Test it

Open your Vercel URL and log in with the seeded accounts (same as local):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@netsechub.dev` | `Password123!` |
| Teacher | `teacher@netsechub.dev` | `Password123!` |
| Student | `student@netsechub.dev` | `Password123!` |

## What I can finish for you once you're back with the Neon URL + Render URL

- Run `prisma db push` against the production database (creates all tables)
- Run the seed script (creates the three demo accounts + a sample course/exam)
- Double-check CORS and the cross-origin login/cookie flow actually works end to end via direct API calls, the same way I verified the local version

## Updating the deployed app later

Both Render and Vercel auto-deploy on every push to `main`. From now on, once
you're happy with a change locally:

```bash
git add -A
git commit -m "describe the change"
git push
```

...and both services rebuild automatically within a minute or two.
