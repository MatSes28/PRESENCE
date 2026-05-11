# Production Readiness Check

Date: 2026-05-11

This is a repo/workspace readiness snapshot for CLIRDEC:PRESENCE. It reflects what was validated locally on this machine after refreshing stale E2E coverage and smoke-test behavior.

## Verdict

**Codebase status: ready for client turnover review.**

**Production go-live status: conditionally ready.** The code passed the local readiness gate and Chromium E2E flow, but final go-live still requires deployment-environment verification and physical IoT hardware validation.

## Validated Locally

The following checks passed on 2026-05-11:

- `npm run verify:local`
  - `npm run security:secrets`
  - `npm run check`
  - `npm run build`
  - `npm audit --audit-level=moderate --workspaces`
  - `npm run test:local`
- `npm run test:security --workspace=server`
- `..\node_modules\.bin\playwright.cmd test --project=chromium --workers=1`
  - 19 passed
  - 4 skipped for optional UI paths not exposed in the current app
- Local live smoke test
  - `GET /health` returned 200
  - `GET /api/health` returned 200
  - `GET /api/ready` returned `status: ready`
  - Vite frontend served the app successfully on its assigned dev port

## Fixes Included In This Readiness Pass

- Updated stale Playwright E2E tests to match the current app routes:
  - `/`
  - `/attendance`
  - `/iot`
  - `/reports`
- Added shared E2E login/navigation helpers.
- Refreshed attendance, device registration, print preview, and reporting workflow browser tests.
- Fixed `scripts/smoke-test.mjs` so successful smoke runs exit cleanly on modern Node versions.

## Production Verification Still Required

These items require the real deployment environment, secrets, database, or hardware:

- Deploy to the target host using the production runtime, preferably Node 20 or the Docker image.
- Set production environment variables from `.env.production.example`, especially:
  - `DATABASE_URL`
  - `SESSION_SECRET`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `ENCRYPTION_MASTER_KEY`
  - `FRONTEND_URL`, `ALLOWED_ORIGINS`, or `CORS_ORIGIN`
  - `BREVO_API_KEY` and `FROM_EMAIL` if email notifications are required
  - `REDIS_URL` with `REDIS_ENABLED=true` when Redis is used
  - backup settings if production backups are enabled
- Run production schema verification:

```bash
DATABASE_URL=postgresql://... node server/scripts/verify-schema.mjs
```

- Run deployment smoke test:

```bash
API_BASE_URL=https://your-api.example.com SMOKE_ORIGIN=https://your-app.example.com node scripts/smoke-test.mjs
```

- Confirm the deployed browser app can:
  - log in with the production admin account
  - load dashboard, attendance, IoT device, report, student, schedule, and settings pages
  - generate/export reports
  - send email notifications if enabled

## IoT Hardware Turnover Checklist

Before final client sign-off, validate with the actual ESP32/RFID/proximity hardware:

- Register at least one real IoT device in the production or staging system.
- Confirm the device heartbeat changes the device status to online.
- Scan a real RFID card and confirm the attendance event is recorded.
- Trigger entry and exit proximity sensors and confirm the expected attendance behavior.
- Restart/unplug the device and confirm reconnect behavior.
- Confirm invalid/unknown RFID events are rejected or logged as expected.

## Known Caveats

- Local validation was run on Node 24, while Docker/CI targets Node 20. Final deployment should be verified in the target runtime.
- Email service was disabled in local dev because production Brevo credentials were not present.
- Physical IoT device testing was not possible from this workspace.
- Cross-browser Playwright coverage beyond Chromium was not rerun in this pass.

## Final Turnover Recommendation

Proceed with client turnover review after committing the source changes. For production launch, require one successful staging deployment, one production smoke test, and one physical hardware walkthrough.
