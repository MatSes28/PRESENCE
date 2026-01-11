import { Router } from "express";
import { eq } from "drizzle-orm";
import db from "../storage.js";
import { users } from "../schema.js";

const router = Router();

// GET /api/users - Get all users (admin only)
router.get("/", async (req, res) => {
  // Check if user is admin
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  try {
    const allUsers = await db.select().from(users);
    res.json({ success: true, data: allUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get user by ID (admin only)
router.get("/:id", async (req, res) => {
  // Check if user is admin
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
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

    res.json({ success: true, data: user[0] });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// POST /api/users - Create new user (admin only)
router.post("/", async (req, res) => {
  // Check if user is admin
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
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
    const { password: _, ...userWithoutPassword } = newUser[0];

    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put("/:id", async (req, res) => {
  // Check if user is admin
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
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
    const { password: _, ...userWithoutPassword } = updatedUser[0];

    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", async (req, res) => {
  // Check if user is admin
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

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
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export default router;
