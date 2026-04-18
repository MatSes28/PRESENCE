import type { FullConfig } from "@playwright/test";
import { seedE2EUsers } from "../../scripts/seed-e2e-users.js";

export default async function globalSetup(_config: FullConfig) {
  await seedE2EUsers();
}
