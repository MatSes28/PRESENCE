# Production Readiness Check (Repo State)

Date: 2026-02-26

This is a **pass/fail** readiness snapshot based on what can be validated inside the repo/workspace.

## Verdict

**NOT 100% production-ready yet**.

Reason: there are still **blocking gaps in system-level validation** (integration/e2e) and a few **known operational risks** that must be explicitly accepted/mitigated.

## ✅ Verified in this workspace

- Typecheck passes:
  - [`npm run check`](package.json:10)
  - [`npm run check --workspace=server`](server/package.json:12)
- Server build passes:
  - [`npm run build --workspace=server`](server/package.json:8)
- Server unit tests pass:
  - [`npm run test:unit --workspace=server`](server/package.json:16)
- Production hardening changes are present:
  - Fail-closed env validation: [`validateEnvironmentOrThrow()`](server/src/config/env.ts:41)
  - No fallback JWT/session secrets in runtime paths: [`AuthService.constructor()`](server/src/services/authService.ts:43), session config in [`server/src/index.ts`](server/src/index.ts:366)
  - CORS fails closed in prod: [`corsOptimization()`](server/src/middleware/rateLimit.ts:243)
  - Password reset uses hashed + expiry + single-use tokens: migration [`server/drizzle/0009_password_reset_tokens.sql`](server/drizzle/0009_password_reset_tokens.sql) + endpoints in [`server/src/routes/auth.ts`](server/src/routes/auth.ts:555)

## ❌ Blockers (must fix/validate before claiming “ready”)

### 1) Integration tests are not currently runnable in a clean environment

Running [`npm run test:integration --workspace=server`](server/package.json:17) fails because tests attempt real DB operations, but the test environment defaults to a Postgres URL with placeholder credentials.

Evidence:

- Postgres auth errors: `password authentication failed for user "test"`.

Required resolution:

- Either provision a real CI test Postgres (recommended) and set `DATABASE_URL` to it, **or** force SQLite for integration runs via `USE_SQLITE=true` and update tests accordingly.
- Additionally, current integration tests use `request("http://localhost:3000")` (see [`server/tests/integration/api-endpoints.test.ts`](server/tests/integration/api-endpoints.test.ts:1)), which implies a server must already be running. For reliability, these tests should either:
  - start/stop the server in `beforeAll/afterAll`, or
  - use Supertest against an Express app instance rather than an external URL.

### 2) E2E suite not validated here

No green run of [`npm run test:e2e --workspace=server`](server/package.json:18) is recorded in this session. E2E is required to claim readiness because it covers real auth/session/cookie flows in a browser.

## ⚠️ Known risks / explicit acceptance required

### 1) `npm audit` remaining findings (dev tooling)

`npm audit` still reports 4 moderate vulnerabilities due to nested `esbuild@0.18.x` under `drizzle-kit -> @esbuild-kit/*`.

Impact:

- Primarily affects **dev tooling**, not runtime dependencies.

Mitigation:

- Ensure production images omit devDependencies (runtime stages do this): [`Dockerfile`](Dockerfile:45), [`Dockerfile.production`](Dockerfile.production:1)
- Track upstream and upgrade when `@esbuild-kit/*` moves off `esbuild@0.18.x`.

### 2) Deployment process correctness

Docker build path and VPS deployment script were adjusted, but you still must verify your real pipeline:

- Build Docker image and boot it with production env vars
- Run DB migrations
- Validate `/health` and core flows

## Go/No-Go checklist (minimum)

1. ✅ `npm run build` (root)
2. ✅ `npm run test:unit --workspace=server`
3. ✅ Integration tests green in a reproducible environment (CI Postgres or SQLite strategy)
4. ✅ E2E tests green on staging
5. ✅ Run migrations including `0009_password_reset_tokens.sql`
6. ✅ Confirm env vars in production satisfy fail-closed requirements (`SESSION_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, CORS allowlist)

## Reference

- Hardening summary: [`DEPLOYMENT-READINESS-REPORT.md`](DEPLOYMENT-READINESS-REPORT.md)
