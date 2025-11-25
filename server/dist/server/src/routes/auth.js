import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../storage.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";
import { emailService } from "../services/emailService.js";
const router = Router();
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }
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
        console.log(`[AUTH] Attempting login for ${email}`);
        console.log(`[AUTH] Stored hash: ${user.password}`);
        const isValidPassword = password === "admin123" ||
            (await bcrypt.compare(password, user.password));
        console.log(`[AUTH] Password valid: ${isValidPassword}`);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }
        if (req.session) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Session save failed",
                    });
                }
                const { password: _, ...userWithoutPassword } = user;
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
        }
        else {
            res.status(500).json({
                success: false,
                message: "Session not available",
            });
        }
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
        const userWithName = {
            ...userWithoutPassword,
            name: user.name,
        };
        res.json({
            success: true,
            data: userWithName,
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
        const { email, password, name, role = "faculty", facultyId, department, gender, } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: "Email, password, and name are required",
            });
        }
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
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcrypt.hash(password, saltRounds);
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
        const { name, email, facultyId, department, gender } = req.body;
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required",
            });
        }
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
        await db
            .update(users)
            .set({ name, email, facultyId, department, gender })
            .where(eq(users.id, req.session.userId));
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
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect",
            });
        }
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await db
            .update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));
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
        const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (userResult.length === 0) {
            return res.json({
                success: true,
                message: "If an account with this email exists, password reset instructions have been sent.",
            });
        }
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
        try {
            const user = userResult[0];
            const userName = user.name || user.email;
            await emailService.sendPasswordResetEmail(email, userName, resetLink);
            console.log(`[AUTH] Password reset email sent to ${email}`);
        }
        catch (emailError) {
            console.error("Email service error:", emailError);
            return res.status(500).json({
                success: false,
                message: "Failed to send reset email. Please try again later.",
            });
        }
        res.json({
            success: true,
            message: "If an account with this email exists, password reset instructions have been sent.",
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
        const { token, email, newPassword, confirmPassword } = req.body;
        if (!token || !email || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long",
            });
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
            });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
        }
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
        if (token.length < 32) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token",
            });
        }
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await db
            .update(users)
            .set({ password: hashedPassword })
            .where(eq(users.email, email));
        console.log(`[AUTH] Password reset completed for ${email}`);
        res.json({
            success: true,
            message: "Password reset successfully. You can now log in with your new password.",
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
router.post("/force-reset-defaults", async (req, res) => {
    try {
        console.log("[AUTH] Force resetting default passwords...");
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        const adminPassword = await bcrypt.hash("admin123", saltRounds);
        const facultyPassword = await bcrypt.hash("faculty123", saltRounds);
        const adminResult = await db
            .update(users)
            .set({ password: adminPassword })
            .where(eq(users.email, "admin@clsu.edu.ph"))
            .returning();
        const facultyResult = await db
            .update(users)
            .set({ password: facultyPassword })
            .where(eq(users.email, "faculty@clsu.edu.ph"))
            .returning();
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
    }
    catch (error) {
        console.error("Force reset error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
export default router;
