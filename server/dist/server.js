"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ✅ في أعلى الملف مع الـ imports:
const admin_stats_1 = require("./routes/admin-stats");
const app_1 = require("./app");
const database_1 = require("./config/database");
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const student_exams_1 = require("./routes/student-exams");
const admin_exams_1 = require("./routes/admin-exams");
const subjects_1 = require("./routes/subjects"); // ✅ تأكد من وجود هذا
const PORT = process.env.PORT || 3001;
const start = async () => {
    // 1. Connect to database
    await (0, database_1.connectDB)();
    // ✅ أضف هذا السطر قبل app.listen:
    app_1.app.use('/api/admin', admin_stats_1.adminStatsRoutes);
    app_1.app.use('/api/student-exams', student_exams_1.examRoutes);
    app_1.app.use('/api/exams', admin_exams_1.examRoutes);
    app_1.app.use('/api/subjects', subjects_1.subjectRoutes); // ✅ هذا ضروري لجلب المواد
    // 2. Create HTTP server
    const server = http_1.default.createServer(app_1.app);
    // 3. Setup Socket.io for real-time features
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    // 4. Socket.io connection handler
    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });
    });
    // 5. Start server
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Socket.io ready for real-time connections`);
        console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    });
};
start();
