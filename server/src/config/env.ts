type EnvOptions = {
  minLength?: number;
  allowEmpty?: boolean;
};

export function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT
  );
}

export function getEnv(
  name: string,
  options: EnvOptions = {},
): string | undefined {
  const raw = process.env[name];

  if (raw === undefined) return undefined;
  if (!options.allowEmpty && raw.trim() === "") return undefined;

  if (options.minLength !== undefined && raw.length < options.minLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${options.minLength} characters long`,
    );
  }

  return raw;
}

export function requireEnv(name: string, options: EnvOptions = {}): string {
  const value = getEnv(name, options);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Fail-closed environment validation.
 *
 * - In production-like environments (NODE_ENV=production or Railway), missing/weak secrets are fatal.
 * - In test environments, callers can set env vars in jest setup.
 */
export function validateEnvironmentOrThrow(): void {
  const prod = isProductionLike();

  // Always require these in prod; in dev/test, only validate if provided.
  const requiredInProd: Array<{ name: string; minLength?: number }> = [
    { name: "DATABASE_URL" },
    { name: "SESSION_SECRET", minLength: 32 },
    { name: "JWT_SECRET", minLength: 32 },
    { name: "JWT_REFRESH_SECRET", minLength: 32 },
  ];

  if (prod) {
    for (const req of requiredInProd) {
      requireEnv(req.name, req.minLength ? { minLength: req.minLength } : {});
    }

    // CORS should be explicitly configured in prod.
    // Require at least one origin source of truth.
    const hasCorsConfig =
      !!getEnv("ALLOWED_ORIGINS") ||
      !!getEnv("FRONTEND_URL") ||
      !!getEnv("CORS_ORIGIN");
    if (!hasCorsConfig) {
      throw new Error(
        "Missing CORS configuration: set ALLOWED_ORIGINS, FRONTEND_URL, or CORS_ORIGIN",
      );
    }
  } else {
    // Validate provided secrets (useful to catch too-short local values).
    for (const req of requiredInProd) {
      if (process.env[req.name] !== undefined) {
        getEnv(req.name, req.minLength ? { minLength: req.minLength } : {});
      }
    }
  }
}
