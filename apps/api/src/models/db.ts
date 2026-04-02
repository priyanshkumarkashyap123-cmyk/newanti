import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDB(uri?: string): Promise<void> {
	const connectionUri = uri ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/beamlab';
	logger.info({ uri: connectionUri.replace(/:[^:]*@/, ':***@'), timestamp: new Date().toISOString() }, '[DB] Starting MongoDB connection attempt');
	try {
		const startTime = Date.now();
		await mongoose.connect(connectionUri, {
			maxPoolSize: 50,
			minPoolSize: 10,
			maxIdleTimeMS: 30000,
			serverSelectionTimeoutMS: 30000,
			connectTimeoutMS: 30000,
			socketTimeoutMS: 45000,
			retryWrites: true,
			retryReads: true,
			compressors: ['zstd', 'snappy'],
		});
		const connectTime = Date.now() - startTime;
		logger.info(`[DB] ✅ MongoDB connected successfully (${connectTime}ms)`);
	} catch (error: unknown) {
		logger.error({ err: error, code: error?.code, message: error?.message, address: error?.address, port: error?.port }, '[DB] ❌ MongoDB connection failed');
		logger.warn('[DB] App will continue without database - some features may be unavailable');
	}
}

export async function disconnectDB(): Promise<void> {
	await mongoose.disconnect();
	logger.info('MongoDB disconnected');
}
