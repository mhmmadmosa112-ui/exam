import mongoose, { Schema, Document } from 'mongoose';

export interface IRetakeRequest extends Document {
  examId: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'denied';
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RetakeRequestSchema = new Schema({
  examId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  reason: String
}, { timestamps: true });

RetakeRequestSchema.index({ examId: 1, userId: 1 }, { unique: true });

export const RetakeRequest = mongoose.models.RetakeRequest || mongoose.model<IRetakeRequest>('RetakeRequest', RetakeRequestSchema);
