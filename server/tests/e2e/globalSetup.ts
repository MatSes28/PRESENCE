import type { FullConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { seedE2EUsers } from "../../scripts/seed-e2e-users.js";

const LOCAL_E2E_ENCRYPTION_MASTER_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  const targetsLocalServer =
    !baseURL || /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(baseURL);

  process.env.ENCRYPTION_MASTER_KEY ??= LOCAL_E2E_ENCRYPTION_MASTER_KEY;

  if (targetsLocalServer && process.env.USE_SQLITE !== "true") {
    const seedScript = resolve(process.cwd(), "..", "scripts", "seed-dev-sqlite.mjs");
    if (existsSync(seedScript)) {
      execFileSync(process.execPath, [seedScript], {
        cwd: resolve(process.cwd(), ".."),
        env: {
          ...process.env,
          ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
        },
        stdio: "inherit",
      });
    }
  }

  await seedE2EUsers();
}
