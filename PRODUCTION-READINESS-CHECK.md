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
- Monitoring metrics endpoint exports non-mock metrics and matches Prometheus scrape path:
  - [`/api/metrics`](server/src/routes/health.ts:93)
  - Prometheus scrape config uses `metrics_path: "/api/metrics"`: [`monitoring/prometheus.yml`](monitoring/prometheus.yml:18)
- Production hardening changes are present:
  - Fail-closed env validation: [`validateEnvironmentOrThrow()`](server/src/config/env.ts:41)
  - No fallback JWT/session secrets in runtime paths: [`AuthService.constructor()`](server/src/services/authService.ts:43), session config in [`server/src/index.ts`](server/src/index.ts:366)
  - CORS fails closed in prod: [`corsOptimization()`](server/src/middleware/rateLimit.ts:243)
  - Password reset uses hashed + expiry + single-use tokens: migration [`server/drizzle/0009_password_reset_tokens.sql`](server/drizzle/0009_password_reset_tokens.sql) + endpoints in [`server/src/routes/auth.ts`](server/src/routes/auth.ts:555)

## ❌ Blockers (must fix/validate before claiming “ready”)

### 1) Integration tests must still be validated in this workspace run

The repo is now configured so the integration suites are runnable against the imported Express app instance and no longer skip automatically when SQLite is enabled.

Required validation:

- Run [`npm run test:integration --workspace=server`](server/package.json:17) in a clean environment and confirm green.
- Keep one reproducible CI lane:
  - SQLite for deterministic repo-level validation, or
  - ephemeral PostgreSQL for production-like validation.

### 2) E2E suite still requires environment-backed validation

[`npm run test:e2e --workspace=server`](server/package.json:18) no longer forces a SQLite no-op path, but a green run is still required in a real target environment because browser tests depend on valid accounts, routes, and fixture data.

### 3) Load tests require explicit credentials and device API key

Load tests are intentionally gated to avoid fake credentials/tokens.

Required env/secrets:

- `LOADTEST_EMAIL`
- `LOADTEST_PASSWORD`
- `LOADTEST_DEVICE_API_KEY` (for IoT plan)

Files:

- API plan: [`server/tests/load/artillery-api.yml`](server/tests/load/artillery-api.yml:1)
- IoT plan: [`server/tests/load/artillery-iot.yml`](server/tests/load/artillery-iot.yml:1)

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
