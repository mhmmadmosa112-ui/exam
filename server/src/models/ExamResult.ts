import mongoose, { Schema, Document } from 'mongoose';

export interface IExamResult extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  examId?: string; 
  examTopic: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    points?: number;
    type?: string;
  }>;
  answers: number[];
  essayAnswers?: string[];
  score: number;
  duration: number;
  timeSpent: number;
  submittedAt: Date;
  isReviewed: boolean;
  adminNotes?: string;
  perQuestionOverrides?: Array<{ id: string; isCorrect?: boolean; awardedPoints?: number }>;
  isPublished?: boolean;
}

const ExamResultSchema = new Schema({
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  
  examId: {
    type: String,
    ref: 'Exam',
    required: false
  },

  examTopic: { type: String, required: true },
  
  // ✅ تعريف الأسئلة بشكل صحيح
  questions: [{
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },  // ✅ مصفوفة نصوص
    correctAnswer: { type: Number },  // ✅ فهرس الخيار الصحيح (0, 1, 2...)
    points: { type: Number, default: 10 },
    type: { type: String, default: 'multiple-choice' }
  }],
  
  // ✅ إجابات الطالب: مصفوفة أرقام بسيطة ← هذا هو الإصلاح الرئيسي!
  answers: { type: [Number], default: [] },
  
  // ✅ إجابات الأسئلة الإنشائية (اختياري)
  essayAnswers: { type: [String], default: [] },
  
  score: { type: Number, required: true, min: 0, max: 100 },
  duration: { type: Number, required: true },
  timeSpent: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now },
  isReviewed: { type: Boolean, default: false },
  adminNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ فهارس لتحسين أداء الاستعلامات
ExamResultSchema.index({ userId: 1, submittedAt: -1 });
ExamResultSchema.index({ examTopic: 1, score: -1 });
ExamResultSchema.index({ examId: 1 });

// ✅ تصدير الموديل مع التحقق من وجوده مسبقاً
export const ExamResult = mongoose.models.ExamResult || 
  mongoose.model<IExamResult>('ExamResult', ExamResultSchema);
