"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
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
                    name: `${user.firstName} ${user.lastName}`,
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
        const userWithName = {
            ...userWithoutPassword,
            name: `${user.firstName} ${user.lastName}`,
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
        const { email, password, firstName, lastName, role = "faculty", facultyId, department, gender, } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: "Email, password, first name, and last name are required",
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
        const { firstName, lastName, email, facultyId, department, gender } = req.body;
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: "First name, last name, and email are required",
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
            .set({ firstName, lastName, email, facultyId, department, gender })
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
exports.default = router;
