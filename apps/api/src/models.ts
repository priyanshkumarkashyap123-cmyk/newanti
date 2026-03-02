/**
 * Mongoose Schemas for BeamLab Ultimate
 * User, Project, and Subscription models
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { logger } from './utils/logger.js';

// ============================================
// MASTER USER CONFIGURATION
// ============================================

/**
 * Master users have unrestricted access to all features
 * regardless of tier or subscription status.
 *
 * SECURITY: This is server-side only and never sent to the client.
 * Set MASTER_EMAILS env var as comma-separated email list to override defaults.
 */
export const MASTER_EMAILS: ReadonlyArray<string> = (
    process.env.MASTER_EMAILS
        ? process.env.MASTER_EMAILS.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
        : ['rakshittiwari048@gmail.com']
);

/**
 * Check if an email belongs to a master user
 */
export function isMasterUser(email: string | null | undefined): boolean {
    if (!email) return false;
    return MASTER_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Get effective tier for a user (master users get 'enterprise')
 */
export function getEffectiveTier(email: string | null | undefined, actualTier: 'free' | 'pro' | 'enterprise'): 'free' | 'pro' | 'enterprise' {
    if (isMasterUser(email)) {
        return 'enterprise';
    }
    return actualTier;
}

// ============================================
// USER SCHEMA
// ============================================

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
    // Activity tracking
    lastLogin: Date;
    lastActiveAt: Date;
    totalAnalysisRuns: number;
    totalExports: number;
    totalReportsGenerated: number;
    dailyAnalysisCount: number;
    lastAnalysisDate: Date;
    activityLog: IActivityLog[];
    // Device session tracking
    activeDevices: Types.ObjectId[];
    activeAnalysisDeviceId: string | null;
    maxConcurrentBrowseSessions: number;
    // Tier limits tracking
    nodeCount: number;
    memberCount: number;
    // Storage & usage
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
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    deviceId: {
        type: String,
        default: null
    }
}, { _id: false });

const UserSchema = new Schema<IUser>({
    clerkId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    firstName: {
        type: String,
        trim: true,
        default: null
    },
    lastName: {
        type: String,
        trim: true,
        default: null
    },
    avatarUrl: {
        type: String,
        default: null
    },
    tier: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    },
    projects: [{
        type: Schema.Types.ObjectId,
        ref: 'Project'
    }],
    subscription: {
        type: Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    // Activity tracking fields
    lastLogin: {
        type: Date,
        default: Date.now
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    },
    totalAnalysisRuns: {
        type: Number,
        default: 0
    },
    totalExports: {
        type: Number,
        default: 0
    },
    totalReportsGenerated: {
        type: Number,
        default: 0
    },
    dailyAnalysisCount: {
        type: Number,
        default: 0
    },
    lastAnalysisDate: {
        type: Date,
        default: null
    },
    activityLog: {
        type: [ActivityLogSchema],
        default: [],
        validate: {
            validator: (arr: unknown[]) => arr.length <= 500,
            message: 'Activity log cannot exceed 500 entries'
        }
    },
    // Device session tracking
    activeDevices: [{
        type: Schema.Types.ObjectId,
        ref: 'DeviceSession'
    }],
    activeAnalysisDeviceId: {
        type: String,
        default: null
    },
    maxConcurrentBrowseSessions: {
        type: Number,
        default: 5
    },
    // Tier usage tracking
    nodeCount: {
        type: Number,
        default: 0
    },
    memberCount: {
        type: Number,
        default: 0
    },
    // Storage & usage
    storageUsedBytes: {
        type: Number,
        default: 0
    },
    totalProjectsCreated: {
        type: Number,
        default: 0
    },
    totalLoginCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for efficient queries (email already indexed via field definition with index: true)
UserSchema.index({ tier: 1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ 'activityLog.timestamp': -1 });

export const User = mongoose.model<IUser>('User', UserSchema);

// ============================================
// PROJECT SCHEMA
// ============================================

export interface IProject extends Document {
    name: string;
    description?: string;
    thumbnail?: string;
    data: Record<string, unknown>;  // JSON structural model data
    owner: Types.ObjectId;
    collaborators?: Types.ObjectId[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    thumbnail: {
        type: String,  // URL to thumbnail image
        default: null
    },
    data: {
        type: Schema.Types.Mixed,
        required: true,
        default: {}
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    collaborators: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
ProjectSchema.index({ owner: 1, createdAt: -1 });
ProjectSchema.index({ name: 'text', description: 'text' });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);

// ============================================
// SUBSCRIPTION SCHEMA
// ============================================

export interface ISubscription extends Document {
    user: Types.ObjectId;
    phonepeTransactionId: string;
    phonepeMerchantTransactionId?: string;
    planType?: string;
    /** @deprecated Legacy Stripe field. Kept for data migration compatibility. */
    stripeCustomerId?: string;
    /** @deprecated Legacy Stripe field. */
    stripeSubscriptionId?: string;
    /** @deprecated Legacy Stripe field. */
    stripePriceId?: string;
    /** @deprecated Legacy Razorpay field. Kept for data migration. */
    razorpayPaymentId?: string;
    /** @deprecated Legacy Razorpay field. */
    razorpayOrderId?: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'expired';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    phonepeTransactionId: {
        type: String,
        sparse: true,
        index: true
    },
    phonepeMerchantTransactionId: {
        type: String,
        sparse: true,
        index: true
    },
    planType: {
        type: String
    },
    // Deprecated legacy fields — kept for data migration
    stripeCustomerId: { type: String, sparse: true, index: true },
    stripeSubscriptionId: { type: String, sparse: true },
    stripePriceId: { type: String },
    razorpayPaymentId: { type: String, sparse: true },
    razorpayOrderId: { type: String, sparse: true },
    status: {
        type: String,
        enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'expired'],
        default: 'incomplete'
    },
    currentPeriodStart: {
        type: Date
    },
    currentPeriodEnd: {
        type: Date
    },
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

// ============================================
// IN-HOUSE AUTH: USER MODEL
// ============================================

export interface IUserModel extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    emailVerified: boolean;
    role: 'user' | 'admin' | 'enterprise';
    subscriptionTier: 'free' | 'pro' | 'enterprise';
    /** Alias kept in sync with subscriptionTier for billing compat */
    tier: 'free' | 'pro' | 'enterprise';
    company?: string;
    phone?: string;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserModelSchema = new Schema<IUserModel>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    avatarUrl: {
        type: String,
        default: null
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'enterprise'],
        default: 'user'
    },
    subscriptionTier: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    },
    company: {
        type: String,
        trim: true,
        default: null
    },
    phone: {
        type: String,
        trim: true,
        default: null
    },
    lastLoginAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual alias: tier → subscriptionTier (billing compat with Clerk User model)
UserModelSchema.virtual('tier')
    .get(function (this: IUserModel) { return this.subscriptionTier; })
    .set(function (this: IUserModel, val: string) { this.subscriptionTier = val as IUserModel['subscriptionTier']; });

export const UserModel = mongoose.model<IUserModel>('UserModel', UserModelSchema);

// ============================================
// IN-HOUSE AUTH: REFRESH TOKEN MODEL
// ============================================

export interface IRefreshToken extends Document {
    userId: Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'UserModel',
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Auto-delete expired tokens (TTL index)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

// ============================================
// IN-HOUSE AUTH: VERIFICATION CODE MODEL
// ============================================

export interface IVerificationCode extends Document {
    userId: Types.ObjectId;
    code: string;
    type: 'email' | 'password_reset' | 'two_factor';
    expiresAt: Date;
    createdAt: Date;
}

const VerificationCodeSchema = new Schema<IVerificationCode>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'UserModel',
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['email', 'password_reset', 'two_factor'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Auto-delete expired codes (TTL index)
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationCodeModel = mongoose.model<IVerificationCode>('VerificationCode', VerificationCodeSchema);

// ============================================
// CONSENT SCHEMA
// ============================================

export interface IConsent extends Document {
    userId: string;
    consentType: string;
    ipAddress?: string;
    userAgent?: string;
    termsVersion?: string;
    acceptedAt: Date;
}

const ConsentSchema = new Schema<IConsent>({
    userId: {
        type: String,
        required: true,
        index: true
    },
    consentType: {
        type: String,
        required: true,
        index: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    termsVersion: {
        type: String,
        default: '1.0'
    },
    acceptedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

ConsentSchema.index({ userId: 1, consentType: 1 });

export const Consent = mongoose.model<IConsent>('Consent', ConsentSchema);


// ============================================
// AI SESSION SCHEMA
// ============================================

interface IAISessionMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export interface IAISession extends Document {
    name: string;
    type: 'generate' | 'modify' | 'chat';
    messages: IAISessionMessage[];
    owner: Types.ObjectId;
    projectSnapshot?: Record<string, unknown>;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AISessionMessageSchema = new Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const AISessionSchema = new Schema<IAISession>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    type: {
        type: String,
        enum: ['generate', 'modify', 'chat'],
        required: true
    },
    messages: {
        type: [AISessionMessageSchema],
        default: []
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    projectSnapshot: {
        type: Schema.Types.Mixed,
        default: null
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

AISessionSchema.index({ owner: 1, updatedAt: -1 });
AISessionSchema.index({ owner: 1, type: 1 });

export const AISession = mongoose.model<IAISession>('AISession', AISessionSchema);

// ============================================
// ANALYSIS JOB SCHEMA
// ============================================

export interface IAnalysisJob extends Document {
    jobId: string;
    userId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    analysisModel: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
    errorCode?: string;
    errorDetails?: Array<{
        type: string;
        message: string;
        elementIds?: string[];
    }>;
    nodeCount: number;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

const AnalysisJobSchema = new Schema<IAnalysisJob>({
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending',
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    analysisModel: {
        type: Schema.Types.Mixed,
        required: true,
    },
    result: {
        type: Schema.Types.Mixed,
        default: null,
    },
    error: {
        type: String,
        default: null,
    },
    errorCode: {
        type: String,
        default: null,
    },
    errorDetails: [{
        type: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        elementIds: {
            type: [String],
            default: [],
        },
    }],
    nodeCount: {
        type: Number,
        default: 0,
    },
    memberCount: {
        type: Number,
        default: 0,
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// TTL index: auto-delete completed/failed jobs after 24 hours
AnalysisJobSchema.index({ completedAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { completedAt: { $exists: true } } });
AnalysisJobSchema.index({ userId: 1, status: 1 });
AnalysisJobSchema.index({ status: 1, createdAt: -1 });

export const AnalysisJob = mongoose.model<IAnalysisJob>('AnalysisJob', AnalysisJobSchema);


// ============================================
// DEVICE SESSION SCHEMA
// ============================================
// Tracks every active device/browser session for each user.
// Enforces: browse on multiple devices, but analyze from only ONE.

export interface IDeviceSession extends Document {
    userId: Types.ObjectId;
    clerkId: string;
    clerkSessionId: string;
    deviceId: string;           // fingerprint or UUID generated client-side
    deviceName: string;         // e.g. "Chrome on MacOS", "Safari on iPhone"
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    isAnalysisLocked: boolean;  // true = this device holds the analysis lock
    lastHeartbeat: Date;
    loginAt: Date;
    logoutAt?: Date;
    expiresAt: Date;            // auto-expire stale sessions
    createdAt: Date;
    updatedAt: Date;
}

const DeviceSessionSchema = new Schema<IDeviceSession>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clerkId: {
        type: String,
        required: true,
        index: true
    },
    clerkSessionId: {
        type: String,
        required: true
    },
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    deviceName: {
        type: String,
        default: 'Unknown Device'
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isAnalysisLocked: {
        type: Boolean,
        default: false,
        index: true
    },
    lastHeartbeat: {
        type: Date,
        default: Date.now
    },
    loginAt: {
        type: Date,
        default: Date.now
    },
    logoutAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
}, {
    timestamps: true
});

// Compound indexes
DeviceSessionSchema.index({ clerkId: 1, isActive: 1 });
DeviceSessionSchema.index({ clerkId: 1, deviceId: 1 });
DeviceSessionSchema.index({ clerkId: 1, isAnalysisLocked: 1 });
// TTL: auto-clean expired sessions
DeviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// TTL: auto-clean sessions with no heartbeat for 24h
DeviceSessionSchema.index({ lastHeartbeat: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { isActive: true } });

export const DeviceSession = mongoose.model<IDeviceSession>('DeviceSession', DeviceSessionSchema);


// ============================================
// ANALYSIS RESULT SCHEMA (PERSISTENT)
// ============================================
// Unlike AnalysisJob (which is ephemeral/TTL), this stores
// permanent analysis results tied to projects and users.

export interface IAnalysisResult extends Document {
    userId: Types.ObjectId;
    clerkId: string;
    projectId: Types.ObjectId;
    analysisType: 'linear_static' | 'buckling' | 'modal' | 'p_delta' | 'seismic' | 'time_history' | 'cable' | 'pinn' | 'nonlinear' | 'other';
    analysisName: string;
    status: 'completed' | 'failed';
    // Input summary
    inputSummary: {
        nodeCount: number;
        memberCount: number;
        loadCases: number;
        supports: number;
    };
    // Result data
    resultData: Record<string, unknown>;
    resultSummary: string;
    // Performance
    computeTimeMs: number;
    solverUsed: 'wasm' | 'rust_api' | 'python';
    deviceId?: string;
    // Metadata
    tags?: string[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AnalysisResultSchema = new Schema<IAnalysisResult>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clerkId: {
        type: String,
        required: true,
        index: true
    },
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    analysisType: {
        type: String,
        enum: ['linear_static', 'buckling', 'modal', 'p_delta', 'seismic', 'time_history', 'cable', 'pinn', 'nonlinear', 'other'],
        required: true,
        index: true
    },
    analysisName: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['completed', 'failed'],
        required: true
    },
    inputSummary: {
        nodeCount: { type: Number, default: 0 },
        memberCount: { type: Number, default: 0 },
        loadCases: { type: Number, default: 0 },
        supports: { type: Number, default: 0 }
    },
    resultData: {
        type: Schema.Types.Mixed,
        default: {}
    },
    resultSummary: {
        type: String,
        default: ''
    },
    computeTimeMs: {
        type: Number,
        default: 0
    },
    solverUsed: {
        type: String,
        enum: ['wasm', 'rust_api', 'python'],
        default: 'wasm'
    },
    deviceId: {
        type: String,
        default: null
    },
    tags: [{
        type: String,
        trim: true
    }],
    notes: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

AnalysisResultSchema.index({ clerkId: 1, createdAt: -1 });
AnalysisResultSchema.index({ projectId: 1, analysisType: 1 });
AnalysisResultSchema.index({ clerkId: 1, analysisType: 1, createdAt: -1 });

export const AnalysisResult = mongoose.model<IAnalysisResult>('AnalysisResult', AnalysisResultSchema);


// ============================================
// REPORT GENERATION SCHEMA
// ============================================
// Tracks every report generated (PDF, CSV, DXF, etc.)

export interface IReportGeneration extends Document {
    userId: Types.ObjectId;
    clerkId: string;
    projectId?: Types.ObjectId;
    analysisResultId?: Types.ObjectId;
    reportType: 'structural_analysis' | 'design_check' | 'load_summary' | 'member_forces' | 'deflection' | 'buckling' | 'modal' | 'seismic' | 'complete' | 'custom';
    format: 'pdf' | 'csv' | 'dxf' | 'json' | 'xlsx';
    reportName: string;
    fileSizeBytes: number;
    // Generation metadata
    generationTimeMs: number;
    pageCount?: number;
    templateUsed?: string;
    parameters?: Record<string, unknown>;
    // Download tracking
    downloadCount: number;
    lastDownloadAt?: Date;
    // Status
    status: 'generating' | 'completed' | 'failed';
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ReportGenerationSchema = new Schema<IReportGeneration>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clerkId: {
        type: String,
        required: true,
        index: true
    },
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    analysisResultId: {
        type: Schema.Types.ObjectId,
        ref: 'AnalysisResult',
        default: null
    },
    reportType: {
        type: String,
        enum: ['structural_analysis', 'design_check', 'load_summary', 'member_forces', 'deflection', 'buckling', 'modal', 'seismic', 'complete', 'custom'],
        required: true
    },
    format: {
        type: String,
        enum: ['pdf', 'csv', 'dxf', 'json', 'xlsx'],
        required: true
    },
    reportName: {
        type: String,
        required: true,
        trim: true
    },
    fileSizeBytes: {
        type: Number,
        default: 0
    },
    generationTimeMs: {
        type: Number,
        default: 0
    },
    pageCount: {
        type: Number,
        default: null
    },
    templateUsed: {
        type: String,
        default: null
    },
    parameters: {
        type: Schema.Types.Mixed,
        default: {}
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    lastDownloadAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['generating', 'completed', 'failed'],
        default: 'generating'
    },
    errorMessage: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

ReportGenerationSchema.index({ clerkId: 1, createdAt: -1 });
ReportGenerationSchema.index({ projectId: 1 });
ReportGenerationSchema.index({ reportType: 1, format: 1 });

export const ReportGeneration = mongoose.model<IReportGeneration>('ReportGeneration', ReportGenerationSchema);


// ============================================
// USAGE LOG SCHEMA
// ============================================
// High-frequency, append-only log for admin monitoring.
// Captures every significant user action for analytics & billing.

export interface IUsageLog extends Document {
    userId: Types.ObjectId;
    clerkId: string;
    email: string;
    action: string;
    category: 'auth' | 'analysis' | 'project' | 'export' | 'report' | 'ai' | 'billing' | 'admin' | 'system';
    // Request context
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    // Action details
    details?: Record<string, unknown>;
    // Resource tracking
    resourceType?: string;
    resourceId?: string;
    // Duration/cost tracking
    durationMs?: number;
    computeCreditsUsed?: number;
    // Result
    success: boolean;
    errorMessage?: string;
    createdAt: Date;
}

const UsageLogSchema = new Schema<IUsageLog>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    clerkId: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: ['auth', 'analysis', 'project', 'export', 'report', 'ai', 'billing', 'admin', 'system'],
        required: true,
        index: true
    },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    deviceId: { type: String, default: null },
    details: {
        type: Schema.Types.Mixed,
        default: {}
    },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    durationMs: { type: Number, default: null },
    computeCreditsUsed: { type: Number, default: null },
    success: {
        type: Boolean,
        default: true
    },
    errorMessage: { type: String, default: null }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

// Time-series style indexes for admin dashboards
UsageLogSchema.index({ createdAt: -1 });
UsageLogSchema.index({ clerkId: 1, createdAt: -1 });
UsageLogSchema.index({ category: 1, createdAt: -1 });
UsageLogSchema.index({ action: 1, createdAt: -1 });
UsageLogSchema.index({ email: 1, createdAt: -1 });
// TTL: auto-purge logs older than 90 days (configurable)
UsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', UsageLogSchema);


// ============================================
// DATABASE CONNECTION
// ============================================

export async function connectDB(uri?: string): Promise<void> {
    const connectionUri = uri ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/beamlab';

    try {
        await mongoose.connect(connectionUri, {
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error({ err: error }, 'MongoDB connection error');
        // Don't throw - let the app continue without DB if needed
        logger.warn('App will continue without database - some features may be unavailable');
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
}

export default {
    User, Project, Subscription, UserModel, RefreshTokenModel, VerificationCodeModel,
    Consent, AISession, AnalysisJob,
    DeviceSession, AnalysisResult, ReportGeneration, UsageLog,
    connectDB, disconnectDB
};
