# Deployment Readiness Report (Hardening)

Date: 2026-02-26

## What changed (high-level)

1. **Server unit tests** fixed and now green.
2. **Password reset** upgraded from demo behavior to **hashed + expiry + single-use** tokens.
3. **Auth endpoint rate limiting** tightened for password reset endpoints.
4. **Production config hardening**:
   - fail-closed environment validation for secrets and CORS
   - removed fallback JWT/session secrets
   - CORS now rejects unknown origins in production
   - debug/maintenance endpoints are blocked in production unless explicitly enabled in non-production

## Password reset: security properties

- Token generation uses `crypto.randomBytes()` and is only sent via email.
- Server stores **SHA-256 hash** only (no plaintext tokens in DB).
- Token records include `expires_at`, `used_at` for single-use enforcement.
- Reset is applied transactionally (mark used + change password + invalidate sessions).

### Data model / migration

- New table: `password_reset_tokens`
- Migration: `server/drizzle/0009_password_reset_tokens.sql`

If you use SQLite bootstrap scripts, `apply-sqlite-migrations.js` now creates this table too.

## Environment hardening (fail-closed)

In production-like environments (`NODE_ENV=production` or Railway):

Required:

- `DATABASE_URL`
- `SESSION_SECRET` (>= 32 chars)
- `JWT_SECRET` (>= 32 chars)
- `JWT_REFRESH_SECRET` (>= 32 chars)

Also required for CORS:

- one of `ALLOWED_ORIGINS`, `FRONTEND_URL`, `CORS_ORIGIN`

If any of these are missing/weak, the server will exit at startup.

## Cookies / sessions

- Session secret is now required (no fallback).
- Session cookie settings in prod:
  - `secure=true`
  - `httpOnly=true`
  - `sameSite` configurable via `SESSION_COOKIE_SAMESITE`
  - `maxAge` configurable via `SESSION_MAX_AGE`

## CORS

In production:

- Requests with an `Origin` header must match the allowlist.
- Unknown origins receive **403**.

In development:

- `Access-Control-Allow-Origin: *` remains for convenience.

## npm audit status

Safe fixes were applied.

Remaining audit report:

- `esbuild` moderate advisory is still reported due to a nested `esbuild@0.18.x` under `drizzle-kit -> @esbuild-kit/*`.

Impact:

- This is in dev tooling (migration/generation tooling), not runtime server dependencies.

Mitigation plan:

- Keep `drizzle-kit` out of production images (multi-stage build / prune devDeps).
- Track upstream `@esbuild-kit/*` updates and validate when they move off `esbuild@0.18.x`.
- Re-run `npm audit` in CI and fail builds only on runtime vulnerabilities (policy decision).

## Operational checks before deploy

1. `npm run check --workspace=server`
2. `npm run test:unit --workspace=server`
3. Ensure DB migration path creates `password_reset_tokens`
4. Verify CORS allowlist matches your real frontend origin(s)
5. Verify secrets are >=32 chars and not defaults

## Known risky endpoints

These are blocked in production:

- `/api/auth/debug-session`
- `/api/admin/fix-session`
- `/api/auth/force-reset-defaults`

Only enable in non-production with explicit env flags.
