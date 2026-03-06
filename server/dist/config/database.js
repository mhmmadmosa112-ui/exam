"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
        // Handle connection events
        mongoose_1.default.connection.on('error', err => {
            console.error('❌ MongoDB error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
