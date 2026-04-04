import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUsageLog extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	email: string;
	action: string;
	category: 'auth' | 'analysis' | 'design' | 'project' | 'export' | 'report' | 'ai' | 'billing' | 'admin' | 'system';
	ipAddress?: string;
	userAgent?: string;
	deviceId?: string;
	details?: Record<string, unknown>;
	resourceType?: string;
	resourceId?: string;
	durationMs?: number;
	computeCreditsUsed?: number;
	success: boolean;
	errorMessage?: string;
	createdAt: Date;
}

const UsageLogSchema = new Schema<IUsageLog>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
	clerkId: { type: String, required: true, index: true },
	email: { type: String, required: true },
	action: { type: String, required: true, index: true },
	category: { type: String, enum: ['auth', 'analysis', 'design', 'project', 'export', 'report', 'ai', 'billing', 'admin', 'system'], required: true, index: true },
	ipAddress: { type: String, default: null },
	userAgent: { type: String, default: null },
	deviceId: { type: String, default: null },
	details: { type: Schema.Types.Mixed, default: {} },
	resourceType: { type: String, default: null },
	resourceId: { type: String, default: null },
	durationMs: { type: Number, default: null },
	computeCreditsUsed: { type: Number, default: null },
	success: { type: Boolean, default: true },
	errorMessage: { type: String, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

UsageLogSchema.index({ createdAt: -1 });
UsageLogSchema.index({ clerkId: 1, createdAt: -1 });
UsageLogSchema.index({ category: 1, createdAt: -1 });
UsageLogSchema.index({ action: 1, createdAt: -1 });
UsageLogSchema.index({ email: 1, createdAt: -1 });
UsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', UsageLogSchema);
