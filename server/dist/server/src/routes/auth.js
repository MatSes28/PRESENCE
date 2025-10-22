"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const emailService_js_1 = require("../services/emailService.js");
const router = (0, express_1.Router)();
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }
        const userResult = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email))
            .limit(1);
        if (userResult.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }
        const user = userResult[0];
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }
        if (req.session) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: "Login successful",
            user: userWithoutPassword,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
    }
    else {
        res.json({
            success: true,
            message: "Not logged in",
        });
    }
});
router.get("/me", async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }
        const userResult = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, req.session.userId))
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
    }
    catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/register", async (req, res) => {
    try {
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
        const existingUser = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email))
            .limit(1);
        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists",
            });
        }
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        const [newUser] = await storage_js_1.db
            .insert(schema_js_1.users)
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
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
        const existingUser = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email))
            .limit(1);
        if (existingUser.length > 0 && existingUser[0].id !== req.session.userId) {
            return res.status(409).json({
                success: false,
                message: "Email is already taken",
            });
        }
        await storage_js_1.db
            .update(schema_js_1.users)
            .set({ name, email })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, req.session.userId));
        res.json({
            success: true,
            message: "Profile updated successfully",
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
        const userResult = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, req.session.userId))
            .limit(1);
        if (userResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const user = userResult[0];
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect",
            });
        }
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, saltRounds);
        await storage_js_1.db
            .update(schema_js_1.users)
            .set({ password: hashedPassword })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
        res.json({
            success: true,
            message: "Password changed successfully",
        });
    }
    catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.put("/settings", async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }
        const { emailNotifications, darkMode, language } = req.body;
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
    }
    catch (error) {
        console.error("Update settings error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }
        const userResult = await storage_js_1.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email))
            .limit(1);
        if (userResult.length === 0) {
            return res.json({
                success: true,
                message: "If an account with that email exists, a password reset link has been sent.",
            });
        }
        const user = userResult[0];
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await storage_js_1.db.insert(schema_js_1.passwordResetTokens).values({
            userId: user.id,
            token: resetToken,
            expiresAt,
        });
        const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
        const emailSent = await emailService_js_1.emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
        if (!emailSent) {
            console.error("Failed to send password reset email");
        }
        res.json({
            success: true,
            message: "If an account with that email exists, a password reset link has been sent.",
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Token and new password are required",
            });
        }
        const tokenResult = await storage_js_1.db
            .select()
            .from(schema_js_1.passwordResetTokens)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.passwordResetTokens.token, token), (0, drizzle_orm_1.eq)(schema_js_1.passwordResetTokens.used, false)))
            .limit(1);
        if (tokenResult.length === 0 || new Date() > tokenResult[0].expiresAt) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token",
            });
        }
        const resetToken = tokenResult[0];
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, saltRounds);
        await storage_js_1.db
            .update(schema_js_1.users)
            .set({ password: hashedPassword })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, resetToken.userId));
        await storage_js_1.db
            .update(schema_js_1.passwordResetTokens)
            .set({ used: true })
            .where((0, drizzle_orm_1.eq)(schema_js_1.passwordResetTokens.id, resetToken.id));
        res.json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.default = router;
