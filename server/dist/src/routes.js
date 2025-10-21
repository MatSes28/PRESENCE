"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const students_js_1 = __importDefault(require("./routes/students.js"));
const attendance_js_1 = __importDefault(require("./routes/attendance.js"));
const classrooms_js_1 = __importDefault(require("./routes/classrooms.js"));
const schedules_js_1 = __importDefault(require("./routes/schedules.js"));
const reports_js_1 = __importDefault(require("./routes/reports.js"));
const iot_js_1 = __importDefault(require("./routes/iot.js"));
const router = (0, express_1.Router)();
router.use('/auth', auth_js_1.default);
router.use('/students', students_js_1.default);
router.use('/attendance', attendance_js_1.default);
router.use('/classrooms', classrooms_js_1.default);
router.use('/schedules', schedules_js_1.default);
router.use('/reports', reports_js_1.default);
router.use('/iot', iot_js_1.default);
exports.default = router;
//# sourceMappingURL=routes.js.map