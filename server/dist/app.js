"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Exam System API is running'
    });
});
// Subject routes
const subjects_1 = require("./routes/subjects");
app.use('/api/subjects', subjects_1.subjectRoutes);
// Student exam routes (للطلاب)
const student_exams_1 = require("./routes/student-exams");
app.use('/api/exams', student_exams_1.examRoutes);
// Admin exam management routes (للأدمن) 
const admin_exams_1 = require("./routes/admin-exams");
app.use('/api/exams', admin_exams_1.examRoutes);
const admin_users_1 = require("./routes/admin-users");
app.use('/api/admin-users', admin_users_1.adminUsersRoutes);
const admin_profile_1 = require("./routes/admin-profile");
app.use('/api/admin-profile', admin_profile_1.adminProfileRoutes);
const admin_settings_1 = require("./routes/admin-settings");
app.use('/api/admin-settings', admin_settings_1.adminSettingsRoutes);
const admin_students_1 = require("./routes/admin-students");
app.use('/api/admin-students', admin_students_1.adminStudentsRoutes);
