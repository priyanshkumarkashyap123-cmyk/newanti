import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeviceSession extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	clerkSessionId: string;
	deviceId: string;
	deviceName: string;
	ipAddress: string;
	ipHash?: string;
	userAgent: string;
	isActive: boolean;
	isAnalysisLocked: boolean;
	lastHeartbeat: Date;
	loginAt: Date;
	logoutAt?: Date;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const DeviceSessionSchema = new Schema<IDeviceSession>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	clerkId: { type: String, required: true, index: true },
	clerkSessionId: { type: String, required: true },
	deviceId: { type: String, required: true, index: true },
	deviceName: { type: String, default: 'Unknown Device' },
	ipAddress: { type: String, default: '' },
	ipHash: { type: String, default: '' },
	userAgent: { type: String, default: '' },
	isActive: { type: Boolean, default: true, index: true },
	isAnalysisLocked: { type: Boolean, default: false, index: true },
	lastHeartbeat: { type: Date, default: Date.now },
	loginAt: { type: Date, default: Date.now },
	logoutAt: { type: Date, default: null },
	expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
}, { timestamps: true });

DeviceSessionSchema.index({ clerkId: 1, isActive: 1 });
DeviceSessionSchema.index({ clerkId: 1, deviceId: 1 });
DeviceSessionSchema.index({ clerkId: 1, isAnalysisLocked: 1 });
DeviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DeviceSessionSchema.index({ lastHeartbeat: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { isActive: true } });

export const DeviceSession = mongoose.model<IDeviceSession>('DeviceSession', DeviceSessionSchema);
