// Production seed script for initial data population.
//
// Production readiness notes:
// - This script is intentionally **admin-only** (no sample/mock domain data).
// - It is fail-closed and requires explicit confirmation + explicit credentials via env.
// - Safe to keep in repo, but should be removed from deployed images if your policy requires.

import db from "../storage.js";
import { users } from "../schema.js";
import bcrypt from "bcryptjs";
import { isProductionLike, requireEnv } from "../config/env.js";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12");

function requireSeedConfirmation(): void {
  // Extra guardrail: avoid accidental execution.
  // Require explicit confirmation string in prod-like environments.
  if (isProductionLike()) {
    const confirm = process.env.SEED_CONFIRMATION;
    if (confirm !== "I_UNDERSTAND") {
      throw new Error(
        "Refusing to run production seed: set SEED_CONFIRMATION=I_UNDERSTAND to proceed",
      );
    }
  }
}

async function seed() {
  console.log("Starting production seed (admin-only)...");

  try {
    requireSeedConfirmation();

    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("Data already exists. Skipping seed.");
      return;
    }

    // Create initial admin user (credentials MUST come from env)
    const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
    const adminPasswordRaw = requireEnv("SEED_ADMIN_PASSWORD", {
      minLength: 12,
    });
    const adminName =
      process.env.SEED_ADMIN_NAME?.trim() || "System Administrator";
    const adminFacultyId = process.env.SEED_ADMIN_FACULTY_ID || "ADMIN001";
    const adminDepartment =
      process.env.SEED_ADMIN_DEPARTMENT || "Administration";

    const adminPassword = await bcrypt.hash(adminPasswordRaw, BCRYPT_ROUNDS);
    await db.insert(users).values({
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: "admin",
      facultyId: adminFacultyId,
      department: adminDepartment,
      isActive: true,
    });
    console.log("Production seed completed successfully.");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

// Run if called directly
seed().catch(console.error);
