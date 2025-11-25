"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_session_1 = __importDefault(require("express-session"));
const http_1 = require("http");
const ws_1 = require("ws");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const storage_js_1 = require("./storage.js");
const routes_js_1 = __importDefault(require("./routes.js"));
const websocket_js_1 = require("./services/websocket.js");
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../../shared/schema.js");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
    },
}));
app.use(express_1.default.static("/app/server/public"));
app.use("/api", routes_js_1.default);
app.get("*", (req, res) => {
    res.sendFile("/app/server/public/index.html");
});
app.get("/health", async (req, res) => {
    const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: isDatabaseAvailable ? "connected" : "disconnected",
        emailService: process.env.BREVO_API_KEY ? "configured" : "not_configured",
    };
    if (isDatabaseAvailable) {
        try {
            await storage_js_1.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        }
        catch (error) {
            isDatabaseAvailable = false;
            healthStatus.database = "disconnected";
            healthStatus.database_error =
                error instanceof Error ? error.message : "Unknown error";
        }
    }
    if (process.env.BREVO_API_KEY) {
        try {
            const { emailService } = await Promise.resolve().then(() => __importStar(require("./services/emailService.js")));
            healthStatus.emailService = "initialized";
        }
        catch (error) {
            healthStatus.emailService = "error";
            healthStatus.emailService_error =
                error instanceof Error ? error.message : "Unknown error";
        }
    }
    const isHealthy = healthStatus.database === "connected" &&
        healthStatus.emailService !== "error";
    healthStatus.status = isHealthy ? "ok" : "degraded";
    res.status(isHealthy ? 200 : 503).json(healthStatus);
});
(0, websocket_js_1.setupWebSocket)(wss);
let isDatabaseAvailable = false;
async function checkDatabaseConnection() {
    try {
        await storage_js_1.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        isDatabaseAvailable = true;
        console.log(`✅ Database connected successfully`);
        return true;
    }
    catch (error) {
        isDatabaseAvailable = false;
        console.error(`❌ Database connection failed:`, error);
        return false;
    }
}
async function logTableCounts() {
    if (!isDatabaseAvailable) {
        console.log("⚠️  Skipping table count logging due to database unavailability");
        return;
    }
    console.log("📊 Checking database table counts...");
    const tables = [
        { name: "users", table: schema_js_1.users },
        { name: "students", table: schema_js_1.students },
        { name: "classrooms", table: schema_js_1.classrooms },
        { name: "subjects", table: schema_js_1.subjects },
        { name: "schedules", table: schema_js_1.schedules },
        { name: "class_sessions", table: schema_js_1.classSessions },
        { name: "attendance_records", table: schema_js_1.attendanceRecords },
        { name: "computers", table: schema_js_1.computers },
        { name: "computer_assignments", table: schema_js_1.computerAssignments },
        { name: "iot_devices", table: schema_js_1.iotDevices },
        { name: "enrollments", table: schema_js_1.enrollments },
        { name: "email_notifications", table: schema_js_1.emailNotifications },
    ];
    for (const { name, table } of tables) {
        try {
            const result = await storage_js_1.db
                .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
                .from(table);
            const count = result[0]?.count || 0;
            console.log(`  ${name}: ${count} records`);
        }
        catch (error) {
            console.log(`  ${name}: ERROR - ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
}
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 WebSocket server ready`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    await checkDatabaseConnection();
    await logTableCounts();
});
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
        console.log("Process terminated");
    });
});
process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    server.close(() => {
        console.log("Process terminated");
    });
});
