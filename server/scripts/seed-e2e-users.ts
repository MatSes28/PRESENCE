#!/usr/bin/env tsx

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { isProductionLike } from "../src/config/env.js";
import { users } from "../src/schema.js";
import db from "../src/storage.js";

const E2E_ADMIN_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || "admin@clirdec.edu";
const E2E_ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_TEST_PASSWORD || "admin123";
const E2E_FACULTY_EMAIL =
  process.env.PLAYWRIGHT_FACULTY_EMAIL || "faculty@clirdec.edu";
const E2E_FACULTY_PASSWORD =
  process.env.PLAYWRIGHT_FACULTY_PASSWORD || "faculty123";
const BCRYPT_ROUNDS = 12;

const ensureUser = async ({
  email,
  password,
  name,
  role,
  facultyId,
}: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "faculty";
  facultyId: string;
}) => {
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        name,
        role,
        facultyId,
        department: "E2E Testing",
        isActive: true,
      })
      .where(eq(users.id, existingUser.id));
    return;
  }

  await db.insert(users).values({
    email,
    password: hashedPassword,
    name,
    role,
    facultyId,
    department: "E2E Testing",
    gender: role === "admin" ? "male" : "female",
    isActive: true,
  });
};

export const seedE2EUsers = async () => {
  if (isProductionLike()) {
    throw new Error("Refusing to seed E2E users in a production-like environment");
  }

  await ensureUser({
    email: E2E_ADMIN_EMAIL,
    password: E2E_ADMIN_PASSWORD,
    name: "E2E Admin",
    role: "admin",
    facultyId: "E2E-ADMIN",
  });

  await ensureUser({
    email: E2E_FACULTY_EMAIL,
    password: E2E_FACULTY_PASSWORD,
    name: "E2E Faculty",
    role: "faculty",
    facultyId: "E2E-FACULTY",
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  seedE2EUsers()
    .then(() => {
      console.log(
        `Seeded deterministic E2E users: ${E2E_ADMIN_EMAIL}, ${E2E_FACULTY_EMAIL}`,
      );
    })
    .catch((error) => {
      console.error("Failed to seed deterministic E2E users:", error);
      process.exit(1);
    });
}
