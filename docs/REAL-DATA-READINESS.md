# Real Data Only — No Mock Data in Production

This project is configured so **production uses only real data**. No sample, demo, or mock data is seeded or hardcoded for production.

## What’s in place

### 1. No mock data in production

- **Seed scripts**
  - **`server/scripts/seed-test-data.ts`** — Creates sample users, students, subjects, etc. **Blocked in production:** exits with an error if `NODE_ENV=production` or Railway. For local/dev only.
  - **`server/scripts/seed-production.ts`** — Creates **one admin user only**, using env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, etc.). No sample students, subjects, or attendance. Run explicitly with `SEED_CONFIRMATION=I_UNDERSTAND` when bootstrapping a new production DB.
- **Deploy**
  - **`deploy/production-deploy.sh`** runs test seed only when `ENVIRONMENT != "production"` **and** `NODE_ENV != "production"`. Production deploy never runs `seed-test-data.ts`.
- **SQL setup**
  - **`simple-setup.sql`** and **`database_setup.sql`** — Schema only; no `INSERT` statements. Note in `simple-setup.sql`: “Sample/mock data intentionally removed.”
- **`insert-admin.sql`** — Template only; no real credentials committed.

### 2. No hardcoded recipient emails

- **Report scheduler** (`server/src/services/reportScheduler.ts`)  
  Report recipients come **only from env**:
  - `REPORT_RECIPIENTS` — comma-separated emails (e.g. `admin@yourdomain.com,ops@yourdomain.com`), or
  - `ADMIN_EMAIL` — single email.  
  If neither is set, default report schedules are not created (no fake addresses).
- **Alerting** (`server/src/services/alertingService.ts`)  
  Critical/high alert recipients use **only** `ADMIN_EMAIL` (and optional `ADMIN_NAME`). No fallback to a default domain; if `ADMIN_EMAIL` is unset, no alerts are sent.

### 3. Auth / force-reset

- Endpoints that could reset passwords (e.g. force-reset) are **disabled in production** via env checks and are not callable in production. Any fallback emails in that code path are for non-production use only.

## Env vars for real data and recipients

Set these in production so the app uses only real identities and addresses:

| Variable | Purpose |
|----------|--------|
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Used only when you run production seed once to create the first admin (no mock data). |
| `ADMIN_EMAIL` | Alert recipients; report recipients if `REPORT_RECIPIENTS` is not set. |
| `REPORT_RECIPIENTS` | Optional; comma-separated emails for scheduled report delivery. |
| `ADMIN_NAME` | Optional; display name for alert recipient. |

## Before first production deploy

1. **Do not** run `seed-test-data.ts` in production (deploy script already skips it when `ENVIRONMENT=production` or `NODE_ENV=production`).
2. To create the first admin, either:
   - Run **production seed** once with `SEED_CONFIRMATION=I_UNDERSTAND` and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` set, or
   - Use your own bootstrap (e.g. `create-admin.js` or DB insert) with real credentials.
3. Set **`ADMIN_EMAIL`** (and optionally **`REPORT_RECIPIENTS`**) so reports and alerts go to real addresses.

## Attendance duplicate check and migration 0012

Before applying the unique constraint on `(student_id, class_session_id)`:

- **Postgres:** run  
  `DATABASE_URL=postgresql://... node scripts/check-attendance-duplicates.js`  
  (checks for duplicates and, if none, applies migration 0012).
- **SQLite:** the unique index is applied by `apply-sqlite-migrations.js`; no separate step.

This keeps production ready for **real data only** and avoids mock or default recipient addresses.
