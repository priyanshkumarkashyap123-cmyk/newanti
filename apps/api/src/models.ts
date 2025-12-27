/**
 * Mongoose Schemas for BeamLab Ultimate
 * User, Project, and Subscription models
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

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
        default: []
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

// Indexes for efficient queries
UserSchema.index({ email: 1 });
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
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
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
    stripeCustomerId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    stripeSubscriptionId: {
        type: String,
        sparse: true,
        index: true
    },
    stripePriceId: {
        type: String
    },
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
// DATABASE CONNECTION
// ============================================

export async function connectDB(uri?: string): Promise<void> {
    const connectionUri = uri ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/beamlab';

    try {
        await mongoose.connect(connectionUri);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.disconnect();
    console.log('📤 MongoDB disconnected');
}

export default { User, Project, Subscription, connectDB, disconnectDB };
