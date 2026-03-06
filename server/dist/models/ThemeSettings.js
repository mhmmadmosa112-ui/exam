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
exports.ThemeSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ThemeSettingsSchema = new mongoose_1.Schema({
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
exports.ThemeSettings = mongoose_1.default.models.ThemeSettings || mongoose_1.default.model('ThemeSettings', ThemeSettingsSchema);
