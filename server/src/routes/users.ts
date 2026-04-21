import { Router } from "express";
import { eq } from "drizzle-orm";
import db from "../storage.js";
import { users } from "../schema.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

const toSafeUser = (user: any) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

// GET /api/users - Get all users (admin only)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json({ success: true, data: allUsers.map(toSafeUser) });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get user by ID (admin only)
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: toSafeUser(user[0]) });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// POST /api/users - Create new user (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { email, name, role, password, facultyId, department, gender } =
      req.body;

    if (!email || !name || !role || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (!["admin", "faculty"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.default.hash(password, 12);

    const newUser = await db
      .insert(users)
      .values({
        email,
        name,
        role,
        password: hashedPassword,
        facultyId,
        department,
        gender,
      })
      .returning();

    // Remove password from response
    res.status(201).json({ success: true, data: toSafeUser(newUser[0]) });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { email, name, role, facultyId, department, gender } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, name, and role are required",
      });
    }

    if (!["admin", "faculty"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (existingUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if email is already taken by another user
    const emailCheck = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (emailCheck.length > 0 && emailCheck[0].id !== userId) {
      return res
        .status(409)
        .json({ success: false, message: "Email already taken" });
    }

    const updatedUser = await db
      .update(users)
      .set({
        email,
        name,
        role,
        facultyId,
        department,
        gender,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Remove password from response
    res.json({ success: true, data: toSafeUser(updatedUser[0]) });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting the current user
    if (req.session?.userId === userId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete your own account" });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (existingUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await db.delete(users).where(eq(users.id, userId));

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);

    if (error?.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this user because it is still linked to schedules, reports, or other records.",
      });
    }

    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export default router;
