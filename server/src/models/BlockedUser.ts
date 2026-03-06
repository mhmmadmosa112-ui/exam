import mongoose, { Schema, Document } from 'mongoose';

export interface IBlockedUser extends Document {
  userId: string;
  userEmail: string;
  reason?: string;
  createdAt: Date;
}

const BlockedUserSchema = new Schema({
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  reason: String
}, { timestamps: { createdAt: true, updatedAt: false } });

BlockedUserSchema.index({ userId: 1, userEmail: 1 }, { unique: true });

export const BlockedUser = mongoose.models.BlockedUser || mongoose.model<IBlockedUser>('BlockedUser', BlockedUserSchema);
