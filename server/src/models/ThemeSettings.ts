import mongoose, { Schema, Document } from 'mongoose';

export interface IThemeSettings extends Document {
  colors: {
    text: string;
    background: string;
    primary: string;
    sidebar: string;
  };
  typography: {
    headerSize: number;
    bodySize: number;
    inputSize: number;
    fontWeight: 'normal' | 'bold';
  };
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
  };
  updatedAt: Date;
  createdAt: Date;
}

const ThemeSettingsSchema = new Schema({
  colors: {
    text: { type: String, default: '#000000' },
    background: { type: String, default: '#ffffff' },
    primary: { type: String, default: '#4f46e5' },
    sidebar: { type: String, default: '#0f172a' }
  },
  typography: {
    headerSize: { type: Number, default: 18 },
    bodySize: { type: Number, default: 14 },
    inputSize: { type: Number, default: 14 },
    fontWeight: { type: String, enum: ['normal', 'bold'], default: 'bold' }
  },
  branding: {
    logoUrl: String,
    faviconUrl: String
  }
}, { timestamps: true });

export const ThemeSettings = mongoose.models.ThemeSettings || mongoose.model<IThemeSettings>('ThemeSettings', ThemeSettingsSchema);
