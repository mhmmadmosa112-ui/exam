import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminPermissions {
  canManageSubjects: boolean;
  canManageExams: boolean;
  canViewResults: boolean;
  canManageAdmins: boolean;
  canGradeEssays: boolean;
}

export interface IAdminProfile {
  fullName?: string;
  birthdate?: Date;
  imageUrl?: string;
  specialization?: string;
  bio?: string;
  username?: string;
}

export interface IAdminUser extends Document {
  email: string;
  role: 'super' | 'sub';
  permissions: IAdminPermissions;
  profile: IAdminProfile;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema({
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ['super', 'sub'], required: true, default: 'sub' },
  permissions: {
    canManageSubjects: { type: Boolean, default: false },
    canManageExams: { type: Boolean, default: false },
    canViewResults: { type: Boolean, default: true },
    canManageAdmins: { type: Boolean, default: false },
    canGradeEssays: { type: Boolean, default: false }
  },
  profile: {
    fullName: String,
    birthdate: Date,
    imageUrl: String,
    specialization: String,
    bio: String,
    username: { type: String, index: true }
  }
}, {
  timestamps: true
});

export const AdminUser = mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
