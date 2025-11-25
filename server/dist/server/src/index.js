import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { db } from "./storage.js";
import routes from "./routes.js";
import { setupWebSocket } from "./services/websocket.js";
import { sql } from "drizzle-orm";
import { users, students, classrooms, subjects, schedules, classSessions, attendanceRecords, computers, computerAssignments, iotDevices, enrollments, emailNotifications, } from "../../shared/schema.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Server is healthy",
    });
});
app.use(helmet());
app.use(cors({
    origin: true,
    credentials: true,
}));
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const PgSession = connectPgSimple(session);
app.use(session({
    store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "user_sessions",
        createTableIfMissing: true,
    }),
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
const publicPath = path.join(__dirname, "../../public");
console.log("Serving static files from:", publicPath);
if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
    console.log("Created public directory:", publicPath);
}
app.use(express.static(publicPath));
app.use("/api", routes);
app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});
setupWebSocket(wss);
let isDatabaseAvailable = false;
async function checkDatabaseConnection() {
    try {
        await db.execute(sql `SELECT 1`);
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
        { name: "users", table: users },
        { name: "students", table: students },
        { name: "classrooms", table: classrooms },
        { name: "subjects", table: subjects },
        { name: "schedules", table: schedules },
        { name: "class_sessions", table: classSessions },
        { name: "attendance_records", table: attendanceRecords },
        { name: "computers", table: computers },
        { name: "computer_assignments", table: computerAssignments },
        { name: "iot_devices", table: iotDevices },
        { name: "enrollments", table: enrollments },
        { name: "email_notifications", table: emailNotifications },
    ];
    for (const { name, table } of tables) {
        try {
            const result = await db
                .select({ count: sql `count(*)` })
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
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 WebSocket server ready`);
    console.log("Server started successfully");
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
