import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../storage.js";
import { users, passwordResetTokens } from "../schema.js";
import { eq, and, lt } from "drizzle-orm";
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
    const isValidPassword = await bcrypt.compare(password, user.password);
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
    }

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: "Login successful",
      user: userWithoutPassword,
    });
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

    res.json({
      success: true,
      user: userWithoutPassword,
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

    const { email, password, name, role = "faculty" } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required",
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
        name,
        role,
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

    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
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
      .set({ name, email })
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

// Forgot password route
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    const user = userResult[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token to database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Send reset email
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password?token=${resetToken}`;

    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl
    );

    if (!emailSent) {
      console.error("Failed to send password reset email");
      // Don't fail the request, just log the error
    }

    res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Reset password route
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    // Find valid token
    const tokenResult = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false)
        )
      )
      .limit(1);

    if (tokenResult.length === 0 || new Date() > tokenResult[0].expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const resetToken = tokenResult[0];

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetToken.id));

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
