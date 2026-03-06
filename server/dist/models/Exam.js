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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Exam = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// ✅ Schema للأسئلة - الحقول الإنجليزية اختيارية
const QuestionSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true, enum: ['multiple-choice', 'true-false', 'fill-blank', 'essay', 'conditional'] },
    text: {
        ar: { type: String, required: true },
        en: { type: String, default: '', trim: true } // ✅ اختياري
    },
    options: [{
            id: String,
            text: {
                ar: { type: String, default: '' },
                en: { type: String, default: '' } // ✅ اختياري
            },
            isCorrect: Boolean
        }],
    correctAnswer: {
        ar: { type: String, default: '' },
        en: { type: String, default: '' } // ✅ اختياري
    },
    points: { type: Number, required: true, default: 1 },
    explanation: {
        ar: { type: String, default: '' },
        en: { type: String, default: '' } // ✅ اختياري
    },
    keywords: [String],
    condition: { groupId: String, required: Number }
}, { _id: false });
// ✅ Schema للامتحان - الحقول الإنجليزية اختيارية
const ExamSchema = new mongoose_1.Schema({
    title: {
        ar: { type: String, required: true, trim: true }, // ✅ العربي مطلوب فقط
        en: { type: String, default: '', trim: true } // ✅ الإنجليزي اختياري
    },
    subjectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    type: { type: String, required: true, enum: ['daily', 'monthly', 'midterm', 'final', 'custom'], default: 'custom' },
    description: {
        ar: { type: String, trim: true },
        en: { type: String, default: '', trim: true } // ✅ اختياري
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
exports.Exam = mongoose_1.default.model('Exam', ExamSchema);
