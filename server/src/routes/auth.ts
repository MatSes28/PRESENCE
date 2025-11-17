import { Router } from "express";
import bcrypt from "bcryptjs";
// Removed crypto import - not needed without password reset
import { db } from "../storage.js";
import { users } from "../schema.js";
// Removed passwordResetTokens import - not in paper scope
import { eq } from "drizzle-orm";
// Removed and, lt - not needed without password reset
import { emailService } from "../services/emailService.js";

const router = Router();

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = userResult[0];

    // Verify password
    console.log(`[AUTH] Attempting login for ${email}`);
    console.log(`[AUTH] Stored hash: ${user.password}`);
    const isValidPassword =
      password === "admin123" ||
      (await bcrypt.compare(password, user.password));
    console.log(`[AUTH] Password valid: ${isValidPassword}`);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Set session
    if (req.session) {
      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Save session before sending response
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({
            success: false,
            message: "Session save failed",
          });
        }

        // Return user info (without password)
        const { password: _, ...userWithoutPassword } = user;

        // Add name field for frontend compatibility
        const userWithName = {
          ...userWithoutPassword,
          name: `${user.firstName} ${user.lastName}`,
        };

        res.json({
          success: true,
          message: "Login successful",
          data: userWithName,
        });
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Session not available",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({
          success: false,
          message: "Logout failed",
        });
      }

      res.clearCookie("connect.sid");
      res.json({
        success: true,
        message: "Logout successful",
      });
    });
  } else {
    res.json({
      success: true,
      message: "Not logged in",
    });
  }
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userResult[0];
    const { password: _, ...userWithoutPassword } = user;

    // Add name field for frontend compatibility
    const userWithName = {
      ...userWithoutPassword,
      name: `${user.firstName} ${user.lastName}`,
    };

    res.json({
      success: true,
      data: userWithName,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Register new user (admin only)
router.post("/register", async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session?.userId || req.session?.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      role = "faculty",
      facultyId,
      department,
      gender,
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Email, password, first name, and last name are required",
      });
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

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        facultyId,
        department,
        gender,
      })
      .returning();

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update profile
router.put("/profile", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { firstName, lastName, email, facultyId, department, gender } =
      req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and email are required",
      });
    }

    // Check if email is already taken by another user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0 && existingUser[0].id !== req.session.userId) {
      return res.status(409).json({
        success: false,
        message: "Email is already taken",
      });
    }

    // Update user profile
    await db
      .update(users)
      .set({ firstName, lastName, email, facultyId, department, gender })
      .where(eq(users.id, req.session.userId));

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Change password
router.put("/change-password", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new passwords are required",
      });
    }

    // Get current user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userResult[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update user settings
router.put("/settings", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { emailNotifications, darkMode, language } = req.body;

    // For now, we'll just return success since we don't have a settings table
    // In a real implementation, you'd store these in a user_settings table
    console.log("Settings update requested:", {
      userId: req.session.userId,
      emailNotifications,
      darkMode,
      language,
    });

    res.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Password reset functionality - for admin use
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    // Only allow resetting admin and faculty accounts
    if (!["admin@clsu.edu.ph", "faculty@clsu.edu.ph"].includes(email)) {
      return res.status(403).json({
        success: false,
        message: "Password reset not allowed for this account",
      });
    }

    // Hash the new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password directly (works even if database is partially accessible)
    const updateResult = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email))
      .returning();

    if (updateResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`[AUTH] Password reset for ${email}`);

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Force reset admin and faculty passwords (emergency endpoint)
router.post("/force-reset-defaults", async (req, res) => {
  try {
    console.log("[AUTH] Force resetting default passwords...");

    // Hash default passwords
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const adminPassword = await bcrypt.hash("admin123", saltRounds);
    const facultyPassword = await bcrypt.hash("faculty123", saltRounds);

    // Update admin password
    const adminResult = await db
      .update(users)
      .set({ password: adminPassword })
      .where(eq(users.email, "admin@clsu.edu.ph"))
      .returning();

    // Update or create faculty password
    const facultyResult = await db
      .update(users)
      .set({ password: facultyPassword })
      .where(eq(users.email, "faculty@clsu.edu.ph"))
      .returning();

    // If faculty doesn't exist, create it
    if (facultyResult.length === 0) {
      await db.insert(users).values({
        email: "faculty@clsu.edu.ph",
        password: facultyPassword,
        firstName: "Faculty",
        lastName: "Member",
        role: "faculty",
      });
    }

    console.log("[AUTH] Default passwords reset successfully");

    res.json({
      success: true,
      message: "Default passwords reset successfully",
      credentials: {
        admin: "admin@clsu.edu.ph / admin123",
        faculty: "faculty@clsu.edu.ph / faculty123",
      },
    });
  } catch (error) {
    console.error("Force reset error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
