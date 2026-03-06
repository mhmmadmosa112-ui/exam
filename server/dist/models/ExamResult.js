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
exports.ExamResult = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ExamResultSchema = new mongoose_1.Schema({
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
            options: { type: [String], required: true }, // ✅ مصفوفة نصوص
            correctAnswer: { type: Number }, // ✅ فهرس الخيار الصحيح (0, 1, 2...)
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
exports.ExamResult = mongoose_1.default.models.ExamResult ||
    mongoose_1.default.model('ExamResult', ExamResultSchema);
