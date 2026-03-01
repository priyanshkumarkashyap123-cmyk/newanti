/**
 * Mongoose Schemas for BeamLab Ultimate
 * User, Project, and Subscription models
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

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
    action: 'login' | 'analysis_run' | 'project_create' | 'project_save' | 'export_pdf' | 'template_use';
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export interface IUser extends Document {
    clerkId: string;
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
    projects: Types.ObjectId[];
    subscription?: Types.ObjectId;
    // Activity tracking
    lastLogin: Date;
    totalAnalysisRuns: number;
    totalExports: number;
    dailyAnalysisCount: number;
    lastAnalysisDate: Date;
    activityLog: IActivityLog[];
    // Tier limits tracking
    nodeCount: number;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ActivityLogSchema = new Schema({
    action: {
        type: String,
        enum: ['login', 'analysis_run', 'project_create', 'project_save', 'export_pdf', 'template_use'],
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
    totalAnalysisRuns: {
        type: Number,
        default: 0
    },
    totalExports: {
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
            validator: (arr: unknown[]) => arr.length <= 200,
            message: 'Activity log cannot exceed 200 entries'
        }
    },
    // Tier usage tracking
    nodeCount: {
        type: Number,
        default: 0
    },
    memberCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for efficient queries (email already indexed via field definition with index: true)
UserSchema.index({ tier: 1 });
UserSchema.index({ lastLogin: -1 });

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
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    planType?: string;
    /** @deprecated Use razorpayPaymentId. Kept for data migration compatibility. */
    stripeCustomerId?: string;
    /** @deprecated Use razorpayOrderId. */
    stripeSubscriptionId?: string;
    /** @deprecated Use planType. */
    stripePriceId?: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
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
    razorpayPaymentId: {
        type: String,
        required: true,
        index: true
    },
    razorpayOrderId: {
        type: String,
        sparse: true,
        index: true
    },
    planType: {
        type: String
    },
    // Deprecated Stripe fields — kept for data migration
    stripeCustomerId: { type: String, sparse: true, index: true },
    stripeSubscriptionId: { type: String, sparse: true },
    stripePriceId: { type: String },
    status: {
        type: String,
        enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete'],
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
    timestamps: true
});

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
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        // Don't throw - let the app continue without DB if needed
        console.warn('⚠️ App will continue without database - some features may be unavailable');
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.disconnect();
    console.log('📤 MongoDB disconnected');
}

export default { User, Project, Subscription, UserModel, RefreshTokenModel, VerificationCodeModel, Consent, AISession, AnalysisJob, connectDB, disconnectDB };
