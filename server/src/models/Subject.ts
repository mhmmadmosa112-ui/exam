import mongoose, { Schema, Document } from 'mongoose';

export interface ISubject extends Document {
  name: { ar: string; en: string };  // دعم ثنائي اللغة
  description?: { ar: string; en: string };
  code?: string;  // رمز المادة (مثال: CS101)
  createdBy: string;  // userId للأدمن
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema({
  name: {
    ar: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true }
  },
  description: {
    ar: { type: String, trim: true },
    en: { type: String, trim: true }
  },
  code: { type: String, trim: true, uppercase: true, index: true },
  createdBy: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
SubjectSchema.index({ 'name.ar': 'text', 'name.en': 'text', code: 'text' });

export const Subject = mongoose.model<ISubject>('Subject', SubjectSchema);