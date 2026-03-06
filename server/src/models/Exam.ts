import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType = 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay' | 'conditional';

export interface IOption {
  id: string;
  text: { ar: string; en: string };
  isCorrect?: boolean;
}

export interface IQuestion {
  id: string;
  type: QuestionType;
  text: { ar: string; en: string };
  options?: IOption[];
  correctAnswer?: { ar: string; en: string };
  points: number;
  explanation?: { ar: string; en: string };
  keywords?: string[];
  condition?: { groupId: string; required: number };
}

export interface IExam extends Document {
  title: { ar: string; en: string };
  subjectId: mongoose.Types.ObjectId;
  type: 'daily' | 'monthly' | 'midterm' | 'final' | 'custom';
  description?: { ar: string; en: string };
  settings: {
    duration: number;
    totalPoints: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: 'immediate' | 'after-publish' | 'never';
    allowReview: boolean;
    allowRetake?: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  questions: IQuestion[];
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  createdBy: string;
  aiGenerated?: boolean;
  sourcePdf?: string;
  availability?: {
    startDate?: Date;
    endDate?: Date;
    assignedTo: 'all' | 'specific';
    classIds?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// ✅ Schema للأسئلة - الحقول الإنجليزية اختيارية
const QuestionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['multiple-choice', 'true-false', 'fill-blank', 'essay', 'conditional'] },
  text: {
    ar: { type: String, required: true },
    en: { type: String, default: '', trim: true }  // ✅ اختياري
  },
  options: [{
    id: String,
    text: { 
      ar: { type: String, default: '' }, 
      en: { type: String, default: '' }  // ✅ اختياري
    },
    isCorrect: Boolean
  }],
  correctAnswer: { 
    ar: { type: String, default: '' }, 
    en: { type: String, default: '' }  // ✅ اختياري
  },
  points: { type: Number, required: true, default: 1 },
  explanation: { 
    ar: { type: String, default: '' }, 
    en: { type: String, default: '' }  // ✅ اختياري
  },
  keywords: [String],
  condition: { groupId: String, required: Number }
}, { _id: false });

// ✅ Schema للامتحان - الحقول الإنجليزية اختيارية
const ExamSchema = new Schema({
  title: {
    ar: { type: String, required: true, trim: true },  // ✅ العربي مطلوب فقط
    en: { type: String, default: '', trim: true }       // ✅ الإنجليزي اختياري
  },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  type: { type: String, required: true, enum: ['daily', 'monthly', 'midterm', 'final', 'custom'], default: 'custom' },
  description: {
    ar: { type: String, trim: true },
    en: { type: String, default: '', trim: true }  // ✅ اختياري
  },
  settings: {
    duration: { type: Number, required: true, default: 30 },
    totalPoints: { type: Number, required: true, default: 100 },
    passingScore: { type: Number, default: 50 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: true },
    showResults: { type: String, enum: ['immediate', 'after-publish', 'never'], default: 'after-publish' },
    allowReview: { type: Boolean, default: true },
    allowRetake: { type: Boolean, default: false },
    startDate: Date,
    endDate: Date
  },
  questions: [QuestionSchema],
  status: { type: String, enum: ['draft', 'scheduled', 'active', 'closed', 'published'], default: 'draft', index: true },
  createdBy: { type: String, required: true, index: true },
  aiGenerated: { type: Boolean, default: false },
  sourcePdf: String,
  availability: {
    startDate: Date,
    endDate: Date,
    assignedTo: { type: String, enum: ['all', 'specific'], default: 'all' },
    classIds: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ExamSchema.index({ 'title.ar': 'text', 'title.en': 'text' });
ExamSchema.index({ subjectId: 1, status: 1 });
ExamSchema.index({ createdBy: 1, createdAt: -1 });

export const Exam = mongoose.model<IExam>('Exam', ExamSchema);
