# Secrets management & rotation (Production)

This project is **fail-closed** in production-like environments via [`validateEnvironmentOrThrow()`](server/src/config/env.ts:44). That means missing/weak secrets must stop startup.

## Required secrets

- `SESSION_SECRET` (>= 32 chars)
- `JWT_SECRET` (>= 32 chars)
- `JWT_REFRESH_SECRET` (>= 32 chars)

## Recommended storage

Use a managed secret store (Railway variables, GitHub Actions secrets, AWS Secrets Manager, GCP Secret Manager, Vault). Do **not** commit secrets into files.

## Rotation plan (minimum)

### Session secret rotation (`SESSION_SECRET`)

Effect: **all existing sessions become invalid**.

Steps:

1. Generate a new secret.
2. Deploy with the new `SESSION_SECRET`.
3. Monitor authentication errors and support re-login.

### JWT secret rotation (`JWT_SECRET` / `JWT_REFRESH_SECRET`)

If you later introduce JWT auth for APIs, rotate secrets using a staged approach:

1. Add support for verifying with **both** old+new secrets for a transition window.
2. Start signing new tokens with the new secret.
3. After the window, remove the old secret.

## Emergency rotation

If compromise is suspected:

1. Rotate `SESSION_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET` immediately.
2. Revoke/rotate any IoT device API keys.
3. Audit logs for suspicious activity.
