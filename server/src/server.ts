// ✅ في أعلى الملف مع الـ imports:
import { adminStatsRoutes } from './routes/admin-stats';
import { app } from './app';
import { connectDB } from './config/database';
import http from 'http';
import { Server } from 'socket.io';
import { examRoutes as studentExamRoutes } from './routes/student-exams';
import { examRoutes } from './routes/admin-exams';
import { subjectRoutes } from './routes/subjects';  // ✅ تأكد من وجود هذا
const PORT = process.env.PORT || 3001;

const start = async () => {
  // 1. Connect to database
  await connectDB();
  // ✅ أضف هذا السطر قبل app.listen:
app.use('/api/admin', adminStatsRoutes);
  app.use('/api/student-exams', studentExamRoutes);
  app.use('/api/exams', examRoutes);
app.use('/api/subjects', subjectRoutes);  // ✅ هذا ضروري لجلب المواد
  // 2. Create HTTP server
  const server = http.createServer(app);
  
  // 3. Setup Socket.io for real-time features
  const io = new Server(server, {
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