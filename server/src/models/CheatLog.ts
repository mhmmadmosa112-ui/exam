import mongoose, { Schema, Document } from 'mongoose';

export interface ICheatLog extends Document {
  examId: string;
  userId: string;
  userEmail: string;
  event: 'visibilitychange' | 'blur' | 'focus';
  details?: string;
  createdAt: Date;
}

const CheatLogSchema = new Schema({
  examId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true },
  event: { type: String, enum: ['visibilitychange', 'blur', 'focus'], required: true },
  details: String
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

CheatLogSchema.index({ examId: 1, userId: 1, createdAt: -1 });

export const CheatLog = mongoose.models.CheatLog || mongoose.model<ICheatLog>('CheatLog', CheatLogSchema);
