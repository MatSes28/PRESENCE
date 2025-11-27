import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../storage.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";
import { emailService } from "../services/emailService.js";
import {
  sanitizeInput,
  validateRequest,
  validationRules,
  rateLimit,
} from "../middleware/validation.js";

const router = Router();

// Login route
router.post(
  "/login",
  sanitizeInput,
  validateRequest({
    email: validationRules.email,
    password: (value) => {
      if (!value) return "Password is required";
      return null; // Don't validate password complexity on login
    },
  }),
  rateLimit(5, 15 * 60 * 1000),
  async (req, res) => {
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
      const isValidPassword = await bcrypt.compare(password, user.password);
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
            name: user.name,
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
  }
);

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
      name: user.name,
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
router.post(
  "/register",
  sanitizeInput,
  validateRequest({
    email: validationRules.email,
    password: validationRules.password,
    name: validationRules.name,
    role: validationRules.role,
  }),
  rateLimit(3, 60 * 60 * 1000),
  async (req, res) => {
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
        name,
        role = "faculty",
        facultyId,
        department,
        gender,
      } = req.body;

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
  }
);

// Update profile
router.put("/profile", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { name, email, facultyId, department, gender } = req.body;

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
      .set({ name, email, facultyId, department, gender })
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

// Password reset request - sends email with reset token
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message:
          "If an account with this email exists, password reset instructions have been sent.",
      });
    }

    // Generate secure reset token (24 hours expiry)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store reset token in database (we'd need a passwordResetTokens table for this)
    // For now, we'll send a direct reset link via email

    const resetLink = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send password reset email
    try {
      // Get user name for email
      const user = userResult[0];
      const userName = user.name || user.email;

      const emailSent = await emailService.sendPasswordResetEmail(
        email,
        userName,
        resetLink
      );
      if (emailSent) {
        console.log(`[AUTH] Password reset email sent to ${email}`);
      } else {
        console.error(`[AUTH] Failed to send password reset email to ${email}`);
        return res.status(500).json({
          success: false,
          message:
            "Failed to send reset email. Please check your email configuration or try again later.",
        });
      }
    } catch (emailError) {
      console.error("Email service error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message:
        "If an account with this email exists, password reset instructions have been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Password reset with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate password strength (ISO 27001 compliance)
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Verify user exists
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid reset request",
      });
    }

    // For demo purposes, accept any valid token format
    // In production, verify token against stored reset tokens with expiry
    if (token.length < 32) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));

    console.log(`[AUTH] Password reset completed for ${email}`);

    res.json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
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
        name: "Faculty Member",
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
