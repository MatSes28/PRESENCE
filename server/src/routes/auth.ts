import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "../storage.js";
import { users, passwordResetTokens, userSessions } from "../schema.js";
import { and, eq, gt, isNull } from "drizzle-orm";
import { emailService } from "../services/emailService.js";
import { auditService } from "../services/auditService.js";
import { authService } from "../services/authService.js";
import rateLimit from "express-rate-limit";
import {
  sanitizeInput,
  validateRequest,
  validationRules,
} from "../middleware/validation.js";
import { isProductionLike } from "../config/env.js";

const router = Router();

// Specific rate limiters for auth endpoints
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const meRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 status checks per window (more generous)
  message: {
    success: false,
    message: "Too many requests, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: {
    success: false,
    message: "Too many registration attempts, please try again later.",
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many password reset requests, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many password reset attempts, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login route
router.post(
  "/login",
  loginRateLimit,
  sanitizeInput,
  validateRequest({
    email: validationRules.email,
    password: (value) => {
      if (!value) return "Password is required";
      return null; // Don't validate password complexity on login
    },
  }),
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
        // Log failed login attempt for non-existent user
        await auditService.logFailedLoginAttempt(
          null,
          req.ip || req.connection.remoteAddress || "unknown",
          req.get("User-Agent") || "unknown",
          "User not found",
        );

        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const user = userResult[0];

      // Verify password
      if (process.env.LOG_AUTH_DEBUG === "true") {
        console.log(`[AUTH] Attempting login for ${email}`);
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (process.env.LOG_AUTH_DEBUG === "true") {
        console.log(`[AUTH] Password valid: ${isValidPassword}`);
      }
      if (!isValidPassword) {
        // Log failed login attempt for invalid password
        await auditService.logFailedLoginAttempt(
          user.id,
          req.ip || req.connection.remoteAddress || "unknown",
          req.get("User-Agent") || "unknown",
          "Invalid password",
        );

        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Session fixation protection: rotate session ID on login
      if (req.session) {
        await new Promise<void>((resolve, reject) => {
          req.session!.regenerate((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        req.session.userId = user.id;
        req.session.userRole = user.role;

        // Save session explicitly before sending response
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Log successful login
        await auditService.logUserLogin(
          user.id,
          req.ip || req.connection.remoteAddress || "unknown",
          req.get("User-Agent") || "unknown",
          req.sessionID || "unknown",
          true,
        );

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
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

// Logout route
router.post("/logout", async (req, res) => {
  const userId = req.session?.userId;
  const sessionId = req.sessionID;

  if (req.session) {
    req.session.destroy(async (err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({
          success: false,
          message: "Logout failed",
        });
      }

      // Log logout event
      if (userId) {
        await auditService.logUserLogout(
          userId,
          req.ip || req.connection.remoteAddress || "unknown",
          req.get("User-Agent") || "unknown",
          sessionId || "unknown",
        );
      }

      res.clearCookie("presence.sid");
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

// Debug session endpoint
router.get("/debug-session", (req, res) => {
  // Never allow this endpoint in production-like environments.
  if (isProductionLike()) {
    return res.status(404).json({
      success: false,
      message: "Not found",
    });
  }

  // Disabled by default even in dev.
  if (process.env.ALLOW_DEBUG_SESSION !== "true") {
    return res.status(403).json({
      success: false,
      message:
        "debug-session is disabled (set ALLOW_DEBUG_SESSION=true to enable in non-production)",
    });
  }

  res.json({
    sessionID: req.sessionID,
    session: req.session,
    userId: req.session?.userId,
    userRole: req.session?.userRole,
  });
});

// Get current user (more generous rate limiting since this is just a status check)
router.get("/me", meRateLimit, async (req, res) => {
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
  registerRateLimit,
  sanitizeInput,
  validateRequest({
    email: validationRules.email,
    password: validationRules.password,
    name: validationRules.name,
    role: validationRules.role,
  }),
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

      // Log user creation
      await auditService.logResourceCreate(
        req.session.userId,
        "user",
        newUser.id,
        { email, name, role, facultyId, department, gender },
        req.ip || req.connection.remoteAddress || "unknown",
        req.get("User-Agent") || "unknown",
        req.sessionID || "unknown",
      );

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
  },
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
      user.password,
    );
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password + invalidate sessions
    // NOTE: this will invalidate the current session as well.
    await authService.updatePassword(user.id, newPassword);

    // Log password change
    await auditService.logPasswordChange(
      user.id,
      req.ip || req.connection.remoteAddress || "unknown",
      req.get("User-Agent") || "unknown",
      req.sessionID || "unknown",
    );

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
router.post(
  "/forgot-password",
  forgotPasswordRateLimit,
  sanitizeInput,
  validateRequest({ email: validationRules.email }),
  async (req, res) => {
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

      // Generate secure reset token (hashed in DB; raw token only sent via email)
      const resetToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      const ttlMinutes = parseInt(
        process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "15",
      );
      const resetTokenExpiry = new Date(Date.now() + ttlMinutes * 60 * 1000);

      // Clean up prior unused tokens for this user (best-effort)
      try {
        await db
          .delete(passwordResetTokens)
          .where(
            and(
              eq(passwordResetTokens.userId, userResult[0].id),
              isNull(passwordResetTokens.usedAt),
            ),
          );
      } catch (cleanupErr) {
        console.warn("[AUTH] Failed cleaning up old reset tokens:", cleanupErr);
      }

      // Store token hash server-side
      await db.insert(passwordResetTokens).values({
        userId: userResult[0].id,
        tokenHash,
        expiresAt: resetTokenExpiry,
        requestedIp: req.ip || req.connection.remoteAddress || null,
        requestedUserAgent: req.get("User-Agent") || null,
      });

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
          resetLink,
        );
        if (emailSent) {
          console.log(`[AUTH] Password reset email sent to ${email}`);
        } else {
          console.error(
            `[AUTH] Failed to send password reset email to ${email}`,
          );
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
  },
);

// Password reset with token
router.post(
  "/reset-password",
  resetPasswordRateLimit,
  sanitizeInput,
  validateRequest({
    email: validationRules.email,
    token: (value) => {
      if (!value) return "Token is required";
      if (typeof value !== "string") return "Invalid token";
      if (value.length < 32) return "Invalid token";
      if (value.length > 512) return "Invalid token";
      return null;
    },
    newPassword: validationRules.password,
    confirmPassword: (value) => {
      if (!value) return "Confirm password is required";
      return null;
    },
  }),
  async (req, res) => {
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

      // Verify token against stored reset tokens with expiry + single-use
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const now = new Date();

      const matchingTokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, userResult[0].id),
            eq(passwordResetTokens.tokenHash, tokenHash),
            gt(passwordResetTokens.expiresAt, now),
            isNull(passwordResetTokens.usedAt),
          ),
        )
        .limit(1);

      if (!matchingTokens.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      // Transactionally mark token used + update password + invalidate sessions
      await db.transaction(async (tx) => {
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: now })
          .where(eq(passwordResetTokens.id, matchingTokens[0].id));

        const hashedPassword = await authService.hashPassword(newPassword);

        await tx
          .update(users)
          .set({ password: hashedPassword, updatedAt: now })
          .where(eq(users.id, userResult[0].id));

        // Invalidate all existing sessions for security
        await tx
          .update(userSessions)
          .set({ isActive: false })
          .where(
            and(
              eq(userSessions.userId, userResult[0].id),
              eq(userSessions.isActive, true),
            ),
          );
      });

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
  },
);

// Force reset admin and faculty passwords (emergency endpoint)
router.post("/force-reset-defaults", async (req, res) => {
  try {
    // SECURITY: This endpoint is dangerous for real deployments.
    // It is disabled by default and MUST NOT be enabled in production.
    if (isProductionLike() || process.env.NODE_ENV === "test") {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (process.env.ALLOW_FORCE_RESET_DEFAULTS !== "true") {
      return res.status(403).json({
        success: false,
        message:
          "force-reset-defaults is disabled (set ALLOW_FORCE_RESET_DEFAULTS=true to enable in non-production)",
      });
    }

    // Require an authenticated admin session even in non-production.
    if (!req.session?.userId || req.session?.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const adminEmail =
      process.env.FORCE_RESET_ADMIN_EMAIL || "admin@clsu.edu.ph";
    const facultyEmail =
      process.env.FORCE_RESET_FACULTY_EMAIL || "faculty@clsu.edu.ph";

    const adminPasswordPlain = process.env.FORCE_RESET_ADMIN_PASSWORD;
    const facultyPasswordPlain = process.env.FORCE_RESET_FACULTY_PASSWORD;

    if (!adminPasswordPlain || adminPasswordPlain.length < 12) {
      return res.status(400).json({
        success: false,
        message:
          "FORCE_RESET_ADMIN_PASSWORD is required and must be at least 12 characters",
      });
    }
    if (!facultyPasswordPlain || facultyPasswordPlain.length < 12) {
      return res.status(400).json({
        success: false,
        message:
          "FORCE_RESET_FACULTY_PASSWORD is required and must be at least 12 characters",
      });
    }

    console.log("[AUTH] Force resetting default passwords...");

    // Hash default passwords
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const adminPassword = await bcrypt.hash(adminPasswordPlain, saltRounds);
    const facultyPassword = await bcrypt.hash(facultyPasswordPlain, saltRounds);

    // Update admin password
    const adminResult = await db
      .update(users)
      .set({ password: adminPassword })
      .where(eq(users.email, adminEmail))
      .returning();

    // Update or create faculty password
    const facultyResult = await db
      .update(users)
      .set({ password: facultyPassword })
      .where(eq(users.email, facultyEmail))
      .returning();

    // If faculty doesn't exist, create it
    if (facultyResult.length === 0) {
      await db.insert(users).values({
        email: facultyEmail,
        password: facultyPassword,
        name: "Faculty Member",
        role: "faculty",
      });
    }

    // Add a security audit entry
    await auditService.logEvent({
      userId: req.session.userId,
      action: "FORCE_RESET_DEFAULTS",
      resource: "auth",
      resourceId: null,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "",
      sessionId: req.sessionID,
      success: true,
      metadata: {
        adminEmail,
        facultyEmail,
        adminUpdated: adminResult.length > 0,
        facultyUpdated: facultyResult.length > 0,
        facultyCreated: facultyResult.length === 0,
      },
    });

    console.log("[AUTH] Default passwords reset successfully");

    res.json({
      success: true,
      message: "Passwords reset successfully",
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
