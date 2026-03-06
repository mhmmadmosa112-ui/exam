import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Exam System API is running'
  });
});
// Subject routes
import { subjectRoutes } from './routes/subjects';
app.use('/api/subjects', subjectRoutes);
// Student exam routes (للطلاب)
import { examRoutes as studentExamRoutes } from './routes/student-exams';
app.use('/api/exams', studentExamRoutes);  

// Admin exam management routes (للأدمن) 
import { examRoutes as adminExamRoutes } from './routes/admin-exams';
app.use('/api/exams', adminExamRoutes);  
import { adminUsersRoutes } from './routes/admin-users';
app.use('/api/admin-users', adminUsersRoutes);
import { adminProfileRoutes } from './routes/admin-profile';
app.use('/api/admin-profile', adminProfileRoutes);
import { adminSettingsRoutes } from './routes/admin-settings';
app.use('/api/admin-settings', adminSettingsRoutes);
import { adminStudentsRoutes } from './routes/admin-students';
app.use('/api/admin-students', adminStudentsRoutes);
export { app };
