"use strict";
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
const path_1 = __importDefault(require("path"));
const storage_js_1 = require("./storage.js");
const routes_js_1 = __importDefault(require("./routes.js"));
const websocket_js_1 = require("./services/websocket.js");
const drizzle_orm_1 = require("drizzle-orm");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === "production"
        ? ["https://your-domain.com"]
        : ["http://localhost:5173"],
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
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    },
}));
app.use(express_1.default.static(path_1.default.join(process.cwd(), "server/public")));
app.use("/api", routes_js_1.default);
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(process.cwd(), "server/public/index.html"));
});
app.get("/health", async (req, res) => {
    try {
        await storage_js_1.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            database: "connected",
        });
    }
    catch (error) {
        console.error("Health check failed:", error);
        res.status(500).json({
            status: "error",
            timestamp: new Date().toISOString(),
            database: "disconnected",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
(0, websocket_js_1.setupWebSocket)(wss);
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 WebSocket server ready`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    try {
        await storage_js_1.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        console.log(`✅ Database connected successfully`);
    }
    catch (error) {
        console.error(`❌ Database connection failed:`, error);
        process.exit(1);
    }
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
