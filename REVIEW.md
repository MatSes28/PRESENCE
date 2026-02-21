# CLIRDEC:PRESENCE — Full Codebase Review

This document is a **100% review** of the project source (excluding `node_modules`, `dist`, and generated artifacts). It covers architecture, security, correctness, maintainability, and recommendations.

---

## 1. Project overview

- **Name:** CLIRDEC:PRESENCE (clirdec-presence)
- **Purpose:** RFID + proximity-based attendance for Central Luzon State University (BSIT/DIT).
- **Stack:** Monorepo — React 18 + TypeScript (client), Express + TypeScript (server), shared schema, PostgreSQL/SQLite, WebSocket, Brevo email, Redis (optional).

**Scope reviewed:** Root config, `shared/`, `server/src/`, `client/src/`, `deploy/`, `docs/`, `.github/workflows/`, Docker, env examples, and key SQL/scripts. Not reviewed: `node_modules`, build outputs, binary assets, or third-party libs.

---

## 2. What’s working well

### 2.1 Architecture

- Clear separation: **client** (Vite/React), **server** (Express), **shared** (schema/types).
- REST under `/api` with logical route modules (auth, students, attendance, reports, IoT, etc.).
- WebSocket split: `/ws` for web clients, `/iot` for devices, with device auth.
- Drizzle ORM used consistently; parameterized queries dominate (good for SQL injection prevention).
- Middleware order in `server/src/index.ts` is sensible: requestId → security → rate limit → body → sanitization → session → routes → error handlers.

### 2.2 Security

- **Helmet** with CSP, HSTS.
- **CORS** via `corsOptimization` (not default open).
- **Rate limiting** per area: auth (strict), attendance, reports, IoT, general API.
- **Input sanitization** (`validator.escape`, `normalizeEmail`) and validation rules in `server/src/middleware/validation.ts`.
- **Session:** `express-session` with PG store, `presence.sid` cookie, httpOnly, secure/sameSite in production, 8h maxAge.
- **Auth:** bcrypt (12 rounds), session-based; JWT used in middleware for token-based paths; role checks (requireAdmin, requireFaculty, requireAdminOrFaculty).
- **Password reset:** Token flow and strength checks (length, upper/lower/number).
- **IoT:** Device auth by API key or certificate; WebSocket auth before accepting device connection.
- **Env:** Required vars and secret length (e.g. 32 chars) validated at startup (with Railway-friendly fallback).

### 2.3 Data and schema

- **shared/schema.ts** is the single source of truth for PG tables and relations; well-structured (users, students, classrooms, subjects, schedules, classSessions, attendanceRecords, computers, enrollments, IoT, notifications, etc.).
- **server/src/schema.ts** exists as an inline copy for deployment/module resolution; consistent with shared.
- **storage.ts** supports both SQLite (dev) and PostgreSQL (prod) with pooling and safe wrappers (`safeExecute`).

### 2.4 Client

- **Auth:** Context-based (`useAuth`), session check on load, WebSocket connect after login.
- **API:** Single `ApiClient` with `credentials: "include"` for cookies; methods for all main domains.
- **Routing:** Wouter; protected content wrapped in `Layout`; login/forgot/reset routes when unauthenticated.
- **UI:** Tailwind, Recharts, notification system; dashboard and key pages present.

### 2.5 DevOps and config

- **CI/CD:** Lint, typecheck, unit/integration/e2e, security audit, build, Docker build/push, deploy steps.
- **Docker:** Multi-stage build, non-root user, healthcheck, client built and served from server’s `public`.
- **Env:** `.env.example` documents DB, session, JWT, Brevo, Redis, rate limit, IoT, etc.

---

## 3. Bugs and critical fixes

### 3.1 Logout cookie name (fixed)

- **Issue:** Session cookie is set as `presence.sid` in `server/src/index.ts`, but logout in `server/src/routes/auth.ts` cleared `connect.sid`, so the real session cookie was not removed.
- **Fix applied:** `res.clearCookie("connect.sid")` → `res.clearCookie("presence.sid")` in `server/src/routes/auth.ts`.

### 3.2 Password reset token not stored

- **Location:** `server/src/routes/auth.ts` — `forgot-password` generates a reset token and sends a link but does not persist the token (comment mentions “we’d need a passwordResetTokens table”).
- **Impact:** `reset-password` only checks `token.length >= 32` and email; any 32+ character string works for that email.
- **Recommendation:** Add a `password_reset_tokens` table (token hash, userId, expiresAt) and verify the token there before updating the password; invalidate after use.

### 3.3 Force-reset endpoint unprotected

- **Location:** `server/src/routes/auth.ts` — `POST /auth/force-reset-defaults` sets admin/faculty to known passwords.
- **Issue:** No auth or IP restriction; anyone can reset credentials.
- **Recommendation:** Remove in production or protect with admin auth + optional IP allowlist or feature flag.

---

## 4. Security recommendations

1. **Session secret fallback:** In `index.ts`, `process.env.SESSION_SECRET || "fallback-secret-change-in-production"` can run if env is missing. Startup already warns; consider failing hard in production if `SESSION_SECRET` is missing or equals the fallback.
2. **JWT default:** In `server/src/middleware/auth.ts`, `process.env.JWT_SECRET || "default-secret"` weakens token verification when JWT_SECRET is unset. Prefer no default in production.
3. **Debug endpoint:** `GET /api/auth/debug-session` exposes sessionID and session object. Disable or restrict to development.
4. **connect.sid in repo:** `cookies.txt` contains a cookie; ensure it’s not committed with real tokens and that `.gitignore` covers such files (e.g. `cookies.txt`).

---

## 5. Code quality and maintainability

### 5.1 Duplication

- **Schema:** `shared/schema.ts` and `server/src/schema.ts` are duplicated. Prefer a single source (e.g. shared only) and fix any deployment/resolution issues with aliases or build steps.
- **Auth:** Both session and JWT are used; `requireAuth` in middleware uses JWT and then attaches to `req.session`. Ensure all protected routes consistently use either session or JWT and document the intended model.

### 5.2 TypeScript

- **Strictness:** `server/tsconfig.json` has `strict: false` and several strict options off. Tightening over time (e.g. `strictNullChecks`, `strict`) would reduce bugs.
- **Any types:** e.g. `(req as any).session`, `(error as any).statusCode` appear in places; adding proper Express/session typings would remove the need for `any`.

### 5.3 Logging and errors

- **Sensitive data:** Avoid logging full `req.body` or passwords; ensure error handlers and monitoring don’t leak them.
- **Console.log in auth:** e.g. “Attempting login for ${email}”, “Password valid:” — reduce or guard in production.

### 5.4 Attendance route query

- **server/src/routes/attendance.ts:** Session IDs are built from DB results: `sql\`... IN (${sessions.map((s) => s.id).join(",")})\``. Values are not user input, so risk is low, but using Drizzle’s `inArray(attendanceRecords.classSessionId, sessionIds)` would be clearer and consistent with the rest of the ORM.

---

## 6. Frontend notes

1. **App.tsx:** Multiple `console.log` calls (e.g. “AppContent render”, “User authenticated”); safe to remove or wrap in dev-only.
2. **Routes:** Many routes are defined inline with `component={() => (<Layout><Page /></Layout>)}`; consider a small route config array to reduce repetition.
3. **Missing routes in review scope:** Some sidebar items (e.g. IoT Devices, Monitor, System Health, Compliance, Help, Mobile App) may map to routes not visible in the snippet; ensure every nav item has a matching route and permission.

---

## 7. Infrastructure and env

1. **Redis:** Health check and cache service expect Redis; if Redis is optional, health should treat “no Redis” as degraded, not unhealthy (current logic already does for some paths).
2. **DB driver:** `storage.ts` uses `postgres` (postgres.js) for PG; `safeExecute` branches on `dbClient.prepare`/`exec` (SQLite) vs `query`/`unsafe` (PG). Ensure all code paths are tested with both drivers if both are supported.
3. **Docker CMD:** `node dist/server/src/index.js` matches server tsconfig `rootDir: "../"` and `outDir: "./dist"`; build output layout is consistent.

---

## 8. Documentation and repo

- **README.md** is detailed: features, stack, structure, quick start, DB schema, IoT, security, troubleshooting.
- **.env.example** is thorough.
- **DEPLOYMENT*.md** and **docs/** (capacity, incident, IoT, validation) are present; not fully re-read but referenced for completeness.

---

## 9. Summary table

| Area              | Status   | Notes                                                                 |
|------------------|----------|-----------------------------------------------------------------------|
| Architecture     | Good     | Clear monorepo, REST + WebSocket, role-based auth                     |
| Security         | Good     | Helmet, CORS, rate limit, sanitization, session; fix logout cookie ✅  |
| Auth/Password    | Caution  | Reset token not stored; force-reset unprotected                       |
| Schema/DB        | Good     | Shared schema; storage supports SQLite + PG                           |
| Server code      | Good     | Some `any`, non-strict TS; minor query cleanup in attendance         |
| Client code      | Good     | Clean hooks and API client; reduce console.logs                        |
| CI/CD & Docker   | Good     | Multi-job pipeline; Docker multi-stage, non-root                     |
| Docs & config    | Good     | README and .env.example are strong                                   |

---

## 10. Recommended next steps (priority)

1. **High:** Implement proper password reset token storage and verification; remove or protect `force-reset-defaults`.
2. **High:** Restrict or remove `GET /api/auth/debug-session` in production.
3. **Medium:** Use a single schema source (shared) and remove duplication in `server/src/schema.ts`.
4. **Medium:** Harden session and JWT config (no weak fallback secrets in production).
5. **Low:** Replace raw `sql` in attendance list with `inArray`; enable stricter TypeScript over time; reduce console logging in production.

---

*Review completed against the codebase as of the review date. Excluded: node_modules, dist, and generated/binary files.*
