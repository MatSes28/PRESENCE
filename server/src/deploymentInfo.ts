const commitEnvKeys = [
  "RAILWAY_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "COMMIT_SHA",
  "SOURCE_VERSION",
  "VERCEL_GIT_COMMIT_SHA",
] as const;

export function getDeploymentInfo() {
  const commitSha =
    commitEnvKeys
      .map((key) => process.env[key])
      .find((value): value is string => Boolean(value && value.trim())) || null;

  return {
    nodeVersion: process.version,
    appVersion: process.env.APP_VERSION || "1.0.0",
    commit: commitSha ? commitSha.slice(0, 7) : null,
    commitSha,
    environment: process.env.NODE_ENV || null,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT || null,
  };
}
