import mongoose, { Schema, Document, Types } from 'mongoose';

// Master user utilities
export const MASTER_EMAILS: ReadonlyArray<string> = (
	process.env.MASTER_EMAILS
		? process.env.MASTER_EMAILS.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
		: ['rakshittiwari048@gmail.com']
);

export function isMasterUser(email: string | null | undefined): boolean {
	if (!email) return false;
	return MASTER_EMAILS.includes(email.toLowerCase().trim());
}

export function getEffectiveTier(
	email: string | null | undefined,
	actualTier: 'free' | 'pro' | 'enterprise'
): 'free' | 'pro' | 'enterprise' {
	return isMasterUser(email) ? 'enterprise' : actualTier;
}

// Activity log entry subdocument
interface IActivityLog {
	action: 'login' | 'logout' | 'analysis_run' | 'analysis_complete' | 'analysis_failed' |
		'project_create' | 'project_save' | 'project_delete' | 'project_open' |
		'export_pdf' | 'export_csv' | 'export_dxf' |
		'report_generate' | 'report_download' |
		'template_use' | 'ai_session' |
		'session_start' | 'session_end' | 'device_registered' | 'device_revoked';
	timestamp: Date;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
	deviceId?: string;
}

export interface IUser extends Document {
	clerkId: string;
	email: string;
	firstName?: string;
	lastName?: string;
	avatarUrl?: string;
	tier: 'free' | 'pro' | 'enterprise';
	projects: Types.ObjectId[];
	subscription?: Types.ObjectId;
	lastLogin: Date;
	lastActiveAt: Date;
	totalAnalysisRuns: number;
	totalExports: number;
	totalReportsGenerated: number;
	dailyAnalysisCount: number;
	lastAnalysisDate: Date;
	activityLog: IActivityLog[];
	activeDevices: Types.ObjectId[];
	activeAnalysisDeviceId: string | null;
	maxConcurrentBrowseSessions: number;
	nodeCount: number;
	memberCount: number;
	storageUsedBytes: number;
	totalProjectsCreated: number;
	totalLoginCount: number;
	createdAt: Date;
	updatedAt: Date;
}

const ActivityLogSchema = new Schema({
	action: {
		type: String,
		enum: [
			'login', 'logout', 'analysis_run', 'analysis_complete', 'analysis_failed',
			'project_create', 'project_save', 'project_delete', 'project_open',
			'export_pdf', 'export_csv', 'export_dxf',
			'report_generate', 'report_download',
			'template_use', 'ai_session',
			'session_start', 'session_end', 'device_registered', 'device_revoked'
		],
		required: true
	},
	timestamp: { type: Date, default: Date.now },
	metadata: { type: Schema.Types.Mixed, default: {} },
	ipAddress: { type: String, default: null },
	userAgent: { type: String, default: null },
	deviceId: { type: String, default: null }
}, { _id: false });

const UserSchema = new Schema<IUser>({
	clerkId: { type: String, required: true, unique: true, index: true },
	email: { type: String, required: true, unique: true, lowercase: true, trim: true },
	firstName: { type: String, trim: true, default: null },
	lastName: { type: String, trim: true, default: null },
	avatarUrl: { type: String, default: null },
	tier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
	projects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
	subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
	lastLogin: { type: Date, default: Date.now },
	lastActiveAt: { type: Date, default: Date.now },
	totalAnalysisRuns: { type: Number, default: 0 },
	totalExports: { type: Number, default: 0 },
	totalReportsGenerated: { type: Number, default: 0 },
	dailyAnalysisCount: { type: Number, default: 0 },
	lastAnalysisDate: { type: Date, default: null },
	activityLog: {
		type: [ActivityLogSchema],
		default: [],
		validate: { validator: (arr: unknown[]) => arr.length <= 500, message: 'Activity log cannot exceed 500 entries' }
	},
	activeDevices: [{ type: Schema.Types.ObjectId, ref: 'DeviceSession' }],
	activeAnalysisDeviceId: { type: String, default: null },
	maxConcurrentBrowseSessions: { type: Number, default: 5 },
	nodeCount: { type: Number, default: 0 },
	memberCount: { type: Number, default: 0 },
	storageUsedBytes: { type: Number, default: 0 },
	totalProjectsCreated: { type: Number, default: 0 },
	totalLoginCount: { type: Number, default: 0 }
}, { timestamps: true });

UserSchema.index({ tier: 1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ 'activityLog.timestamp': -1 });

export const User = mongoose.model<IUser>('User', UserSchema);

// In-house auth user model
export interface IUserModel extends Document {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	avatarUrl?: string;
	emailVerified: boolean;
	role: 'user' | 'admin' | 'enterprise';
	subscriptionTier: 'free' | 'pro' | 'enterprise';
	tier: 'free' | 'pro' | 'enterprise';
	company?: string;
	phone?: string;
	lastLoginAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const UserModelSchema = new Schema<IUserModel>({
	email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
	password: { type: String, required: true, select: false },
	firstName: { type: String, required: true, trim: true },
	lastName: { type: String, required: true, trim: true },
	avatarUrl: { type: String, default: null },
	emailVerified: { type: Boolean, default: false },
	role: { type: String, enum: ['user', 'admin', 'enterprise'], default: 'user' },
	subscriptionTier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
	company: { type: String, trim: true, default: null },
	phone: { type: String, trim: true, default: null },
	lastLoginAt: { type: Date, default: null }
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

UserModelSchema.virtual('tier')
	.get(function (this: IUserModel) { return this.subscriptionTier; })
	.set(function (this: IUserModel, val: string) { this.subscriptionTier = val as IUserModel['subscriptionTier']; });

export const UserModel = mongoose.model<IUserModel>('UserModel', UserModelSchema);

export interface IRefreshToken extends Document {
	userId: Types.ObjectId;
	token: string;
	expiresAt: Date;
	createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
	userId: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true, index: true },
	token: { type: String, required: true, unique: true, index: true },
	expiresAt: { type: Date, required: true }
}, { timestamps: true });

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

export interface IVerificationCode extends Document {
	userId: Types.ObjectId;
	code: string;
	type: 'email' | 'password_reset' | 'two_factor';
	expiresAt: Date;
	createdAt: Date;
}

const VerificationCodeSchema = new Schema<IVerificationCode>({
	userId: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true, index: true },
	code: { type: String, required: true },
	type: { type: String, enum: ['email', 'password_reset', 'two_factor'], required: true },
	expiresAt: { type: Date, required: true }
}, { timestamps: true });

VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationCodeModel = mongoose.model<IVerificationCode>('VerificationCode', VerificationCodeSchema);

export interface IConsent extends Document {
	userId: string;
	consentType: string;
	ipAddress?: string;
	userAgent?: string;
	termsVersion?: string;
	acceptedAt: Date;
}

const ConsentSchema = new Schema<IConsent>({
	userId: { type: String, required: true, index: true },
	consentType: { type: String, required: true, index: true },
	ipAddress: { type: String },
	userAgent: { type: String },
	termsVersion: { type: String, default: '1.0' },
	acceptedAt: { type: Date, default: Date.now }
}, { timestamps: true });

ConsentSchema.index({ userId: 1, consentType: 1 });

export const Consent = mongoose.model<IConsent>('Consent', ConsentSchema);
