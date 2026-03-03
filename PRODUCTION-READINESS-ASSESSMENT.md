# CLIRDEC:PRESENCE — Production Readiness Assessment

**Assessment Date:** 2026-02-28  
**Scope:** Core features, security, scalability, reliability, data integrity, and user experience.  
**Conclusion:** **Conditional go-live** — fix critical authorization and test gaps first; then acceptable for a controlled launch with documented risks.

---

## Executive Summary

| Area                | Status                       | Notes                                                                                                                                                            |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core features**   | ✅ Mostly ready              | Attendance, RFID/sensor, sessions, reports, enrollments, IoT and web flows are implemented and protected. Some optional features are stubs.                      |
| **Security**        | ⚠️ Strong with critical gaps | Fail-closed env, CORS, rate limits, password reset, and input sanitization are in place. **Faculty data isolation is missing in class sessions and attendance.** |
| **Scalability**     | ✅ Documented                | Horizontal scaling with Redis for correlation/cooldown is documented; WebSocket stickiness via HAProxy. Redis required for multi-instance correctness.           |
| **Reliability**     | ⚠️ Good, tests incomplete    | Health/ready/metrics, error handling, and DB-backed sessions are solid. Integration/E2E not runnable in a clean environment; no validated load run.              |
| **Data integrity**  | ⚠️ Minor risks               | Drizzle ORM and constraints in place. Manual attendance has check-then-insert (theoretical race). Some flows could use explicit transactions.                    |
| **User experience** | ✅ Adequate                  | Validation, error responses, and caching support UX.                                                                                                             |

**Overall readiness score: 72/100**

**Go-live recommendation:** **Do not launch until critical issues below are fixed.** After that, **conditional go-live** with: (1) integration/E2E green in CI or staging, (2) run migrations and smoke-test on target env, (3) accept documented risks (optional features stubbed, npm audit dev-only, Redis required for scaling).

---

## 1. Core Features — Functional Readiness

### 1.1 Implemented and Protected

- **Authentication:** Login, logout, session + JWT (Bearer), password reset (hashed token, expiry, single-use), registration rate-limited. Session store is PostgreSQL in production (`connect-pg-simple`).
- **Attendance:** RFID + sensor correlation (7-second window), manual entry, stats, excuses, contact parent. Rate limiting and deduplication on attendance routes.
- **Class sessions & schedules:** CRUD, auto-create from schedules, faculty assignment. **Issue:** List/get are not scoped by faculty (see Critical issues).
- **Students, subjects, classrooms, enrollments:** CRUD with faculty isolation where checked (e.g. students list, enrollments by subject/student). Computers and assignments enforce faculty-teaches-session checks.
- **Reports:** Generation, templates, history, real-time stats. Report route has its own rate limit.
- **IoT:** Device registration, config, heartbeats, API keys, health. Routes require auth.
- **Dashboard, notifications, settings, GDPR, audit, discrepancies:** Present and auth’d (admin or faculty as designed).
- **Health:** `/api/`, `/api/live`, `/api/ready`, `/api/metrics` (Prometheus) with DB and optional Redis checks.

### 1.2 Optional / Stub Features (Acceptable for Launch)

- **Integrations:** Google Classroom, Microsoft Teams, Moodle, Canvas now use real HTTP API flows (token/env-driven) with run/event tracking persisted in integration sync tables.
- **Calendar sync:** OAuth token exchange and provider event CRUD/list implemented for Google Calendar and Outlook via provider APIs.
- **Parent consent service:** Request, token processing, status/revocation, renewal reminders, and expiry cleanup are now persisted and operational.
- **Alert manager:** Critical alert notifications are now wired to email recipients via `CRITICAL_ALERT_EMAILS`/`ADMIN_EMAIL`; SMS recipients can be configured via `CRITICAL_ALERT_SMS` and are logged as pending provider integration.
- **GDPR:** Retention now archives aged attendance records into `attendance_records_archive` before deletion.
- **WebSocket anti-replay:** Signed event replay checks now persist nonce/timestamp state via cache service for cross-instance resilience.
- **Auth audit trail:** Security events are now persisted to the audit log via `auditService.logEvent` from auth service.
- **Attendance → email:** Parent contact endpoint now resolves/decrypts parent email and sends actual email via `emailService`.

If you need any of these for day-one, they are gaps; otherwise treat as post-launch.

---

## 2. Security Assessment

### 2.1 Strengths

- **Environment:** Fail-closed validation in production for `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars), and CORS allowlist (`ALLOWED_ORIGINS` / `FRONTEND_URL` / `CORS_ORIGIN`). Placeholder/dev-looking values rejected.
- **Secrets:** No fallback JWT/session secrets at runtime in production; `AuthService` and session config use `requireEnv` or equivalent.
- **CORS:** Production rejects unknown origins (403). Development allows `*`.
- **Password reset:** Crypto random token, SHA-256 hash stored, single-use and expiry, transactional reset (mark used + change password + invalidate sessions).
- **Rate limiting:** Auth (login 5/15min), forgot-password, reset-password, attendance, reports, IoT, general API; request deduplication on attendance and auth.
- **Dangerous endpoints:** `/api/admin/fix-session`, `/api/auth/debug-session`, `/api/auth/force-reset-defaults` blocked in production (404 or env guard).
- **Input:** Global `sanitizeInput` and `preventSQLInjection`; validation rules and `validateRequest` on auth. Drizzle ORM for parameterized queries.
- **Cookies:** Secure in prod, httpOnly, configurable sameSite/maxAge.

### 2.2 Critical Issues (Must Fix Before Launch)

1. **Faculty data isolation — class sessions**
   - **Where:** `server/src/routes/classSessions.ts` — `GET /` and `GET /:id`.
   - **Issue:** Any authenticated user (including faculty) can list all class sessions and fetch any session by ID. There is no filter by `schedules.facultyId = req.session.userId` for faculty.
   - **Risk:** Faculty can see other faculty’s sessions (and infer schedule/teaching load).
   - **Fix:** For `userRole === "faculty"`, restrict to sessions where `schedules.facultyId = userId`. Apply same rule to GET `/:id` (return 403 if faculty and session not theirs).

2. **Faculty data isolation — attendance**
   - **Where:** `server/src/routes/attendance.ts` — `GET /` (list) and `GET /stats/:sessionId`.
   - **Issue:** No role-based filtering. Any authenticated user can query any attendance by `studentId`/`classSessionId`/date and any session’s stats.
   - **Risk:** Faculty (or a compromised account) can read other faculty’s attendance data.
   - **Fix:** For faculty, restrict:
     - List: only records for class sessions where `schedules.facultyId = req.session.userId`.
     - Stats: allow only if the session’s schedule belongs to that faculty; otherwise 403.

### 2.3 Minor / Consistency

- **Local vs shared auth:** Some route modules (e.g. `settings`, `classSessions`, `dashboard`, `reports`, `attendance`, `iot`) use a local `requireAuth` that checks only `req.session?.userId`. The shared `requireAuth` in `middleware/auth.ts` also supports JWT. If mobile/API clients use JWT, those routes will reject them. Prefer importing and using the shared `requireAuth` (and `requireAdmin`/`requireFaculty`) everywhere so behavior is consistent and JWT works for all protected routes.

---

## 3. Scalability

- **Sessions:** Stored in PostgreSQL; app is effectively stateless for HTTP. Safe for multiple instances.
- **WebSocket:** HAProxy uses `balance source` for WebSocket backends so connections stick to one app instance. Documented in `haproxy.cfg` / `haproxy.scaling.cfg`.
- **Attendance correlation:** RFID/sensor correlation and cooldown gates use Redis when available (`cacheService`, `AttendanceMonitor`). Docs state that **Redis is required for correctness when running more than one instance**; without it, correlation is in-memory and correct only for a single instance.
- **Capacity:** `docs/capacity-planning.md` and `docker-compose.scaling.yml` describe horizontal scaling and instance counts. No code issues found that block scaling once Redis and stickiness are in place.

---

## 4. Reliability

### 4.1 Implemented

- **Health:** `/api/` (full), `/api/live`, `/api/ready` with DB check; `/api/metrics` for Prometheus (DB + optional Redis). Suitable for k8s/Railway probes.
- **Errors:** Central `errorHandler`, request IDs, categorized status codes, production-safe messages (no stack to client). `asyncHandler` for async routes. Error logging and monitoring service integration.
- **DB:** `safeExecute` and connection handling; session store uses Postgres with prune interval.

### 4.2 Gaps (From Repo Docs and Code)

- **Integration tests:** Depend on real Postgres and a running server (`http://localhost:3000`). Not runnable in a clean CI without a test DB or SQLite strategy and without starting the app or using Supertest. Documented in `PRODUCTION-READINESS-CHECK.md`.
- **E2E:** No confirmed green run of `npm run test:e2e --workspace=server` in the repo; required for browser/session/cookie flows.
- **Load tests:** Artillery plans exist but require `LOADTEST_EMAIL`, `LOADTEST_PASSWORD`, `LOADTEST_DEVICE_API_KEY`; no recorded green run in assessment.
- **Deployment:** Docker build path and migrations are documented; actual pipeline (build, env, migrate, smoke) must be verified on target infrastructure.

Recommendation: Before go-live, get integration tests green in CI (test DB or SQLite + in-process app/Supertest), run E2E on staging, and run load tests once with real credentials (or a dedicated test account).

---

## 5. Data Integrity

- **ORM:** Drizzle with parameterized queries; schema and FKs in place. Reduces SQL injection and referential inconsistency.
- **Password reset:** Implemented with transaction (mark token used, update password, invalidate sessions).
- **Manual attendance:** Check-then-insert for “already exists”; no unique constraint or transaction. Under high concurrency, duplicate (student, session) could theoretically be inserted. Low likelihood for typical usage; for robustness, add a unique constraint on `(studentId, classSessionId)` and/or use a transaction/upsert.
- **AttendanceMonitor:** Single inserts/updates; no multi-step transaction observed. Acceptable if business rules allow; for stricter guarantees, wrap critical multi-step flows in DB transactions.

---

## 6. User Experience

- **Validation:** Validation rules and messages on auth and elsewhere; `sanitizeInput` avoids broken display from raw input.
- **API responses:** Consistent `{ success, message, data/error }`; error responses include requestId and safe messages in production.
- **Caching:** Dashboard, schedules, students use short-lived request cache to reduce load and improve responsiveness.
- **Performance:** Response timing, slow-request logging, and rate limits help avoid overload and give operational visibility.

---

## 7. Critical Issues Summary (Must Fix Before Launch)

| #   | Issue                              | Location                             | Action                                                                                   |
| --- | ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Faculty isolation — class sessions | `server/src/routes/classSessions.ts` | Restrict GET `/` and GET `/:id` to faculty’s sessions (filter by `schedules.facultyId`). |
| 2   | Faculty isolation — attendance     | `server/src/routes/attendance.ts`    | Restrict GET `/` and GET `/stats/:sessionId` to faculty’s class sessions.                |

**Fixes applied (2026-02-28):** Faculty isolation is implemented in `classSessions.ts` and `attendance.ts`; both use shared `requireAuth`. Consistency: `settings.ts`, `dashboard.ts`, `reports.ts`, `iot.ts` now use shared auth middleware. Data integrity: migration `0012` adds unique `(student_id, class_session_id)`; manual attendance uses a transaction and returns 409 on duplicate.

All other items are either already solid, optional (stubs), or recommended improvements (tests).

---

## 8. Go-Live Checklist (Minimum)

1. **Fix critical authz:** Implement faculty scoping for class sessions and attendance (above).
2. **Typecheck & build:** `npm run check`, `npm run build` (root and server).
3. **Unit tests:** `npm run test:unit --workspace=server` passing.
4. **Integration tests:** Make runnable in CI (test Postgres or SQLite + in-process/Supertest); get green.
5. **E2E:** Run `npm run test:e2e --workspace=server` on staging and get green.
6. **Migrations:** Run all migrations (including `0009_password_reset_tokens.sql`); verify schema (e.g. `verify-schema` script).
7. **Production env:** Set and verify fail-closed vars: `SESSION_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, CORS allowlist; no placeholder values.
8. **Smoke test:** After deploy, validate `/api/ready`, `/api/health`, login, one attendance flow, and (if used) one IoT path.
9. **Optional but recommended:** Run Artillery load test with test credentials; document Redis for multi-instance deployment.

---

## 9. Readiness Score and Recommendation

| Category        | Weight | Score (0–100) | Weighted |
| --------------- | ------ | ------------- | -------- |
| Core features   | 25%    | 85            | 21.25    |
| Security        | 30%    | 70            | 21.00    |
| Scalability     | 10%    | 85            | 8.50     |
| Reliability     | 20%    | 65            | 13.00    |
| Data integrity  | 10%    | 80            | 8.00     |
| User experience | 5%     | 85            | 4.25     |
| **Total**       | 100%   | —             | **76.0** |

(Score reflects current state; security is penalized for the two critical isolation gaps. After fixing them, security would be in the mid‑80s and total ~80.)

**Overall readiness score: 76/100** (after critical fixes, effectively **~80/100**).

**Go-live recommendation:**

- **Do not go live** until the two critical faculty data-isolation issues are fixed and deployed.
- **After fixes:** **Conditional go-live** is acceptable provided:
  - Integration and E2E tests are green in CI or on staging.
  - Migrations are run and smoke tests pass on the target environment.
  - Optional features (integrations, parent consent, etc.) are accepted as post-launch.
  - Remaining npm audit findings (dev tooling only) and Redis requirement for multi-instance are accepted and documented.

---

## 10. References

- `PRODUCTION-READINESS-CHECK.md` — Verdict and test status.
- `DEPLOYMENT-READINESS-REPORT.md` — Hardening and password reset.
- `DEPLOYMENT-CHECKLIST.md` — Pre/post deployment tasks.
- `docs/capacity-planning.md` — Scaling and Redis requirement for multi-instance.
