/**
 * Mongoose Schemas for BeamLab Ultimate
 * User, Project, and Subscription models
 */
import mongoose, { Document, Types } from 'mongoose';
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
    lastLogin: Date;
    totalAnalysisRuns: number;
    totalExports: number;
    dailyAnalysisCount: number;
    lastAnalysisDate: Date;
    activityLog: IActivityLog[];
    nodeCount: number;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, IUser>;
export interface IProject extends Document {
    name: string;
    description?: string;
    thumbnail?: string;
    data: Record<string, unknown>;
    owner: Types.ObjectId;
    collaborators?: Types.ObjectId[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Project: mongoose.Model<IProject, {}, {}, {}, mongoose.Document<unknown, {}, IProject, {}, mongoose.DefaultSchemaOptions> & IProject & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, IProject>;
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
export declare const Subscription: mongoose.Model<ISubscription, {}, {}, {}, mongoose.Document<unknown, {}, ISubscription, {}, mongoose.DefaultSchemaOptions> & ISubscription & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, ISubscription>;
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
export declare const UserModel: mongoose.Model<IUserModel, {}, {}, {}, mongoose.Document<unknown, {}, IUserModel, {}, mongoose.DefaultSchemaOptions> & IUserModel & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, IUserModel>;
export interface IRefreshToken extends Document {
    userId: Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}
export declare const RefreshTokenModel: mongoose.Model<IRefreshToken, {}, {}, {}, mongoose.Document<unknown, {}, IRefreshToken, {}, mongoose.DefaultSchemaOptions> & IRefreshToken & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, IRefreshToken>;
export interface IVerificationCode extends Document {
    userId: Types.ObjectId;
    code: string;
    type: 'email' | 'password_reset' | 'two_factor';
    expiresAt: Date;
    createdAt: Date;
}
export declare const VerificationCodeModel: mongoose.Model<IVerificationCode, {}, {}, {}, mongoose.Document<unknown, {}, IVerificationCode, {}, mongoose.DefaultSchemaOptions> & IVerificationCode & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any, IVerificationCode>;
export declare function connectDB(uri?: string): Promise<void>;
export declare function disconnectDB(): Promise<void>;
declare const _default: {
    User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, IUser>;
    Project: mongoose.Model<IProject, {}, {}, {}, mongoose.Document<unknown, {}, IProject, {}, mongoose.DefaultSchemaOptions> & IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, IProject>;
    Subscription: mongoose.Model<ISubscription, {}, {}, {}, mongoose.Document<unknown, {}, ISubscription, {}, mongoose.DefaultSchemaOptions> & ISubscription & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, ISubscription>;
    UserModel: mongoose.Model<IUserModel, {}, {}, {}, mongoose.Document<unknown, {}, IUserModel, {}, mongoose.DefaultSchemaOptions> & IUserModel & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, IUserModel>;
    RefreshTokenModel: mongoose.Model<IRefreshToken, {}, {}, {}, mongoose.Document<unknown, {}, IRefreshToken, {}, mongoose.DefaultSchemaOptions> & IRefreshToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, IRefreshToken>;
    VerificationCodeModel: mongoose.Model<IVerificationCode, {}, {}, {}, mongoose.Document<unknown, {}, IVerificationCode, {}, mongoose.DefaultSchemaOptions> & IVerificationCode & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, any, IVerificationCode>;
    connectDB: typeof connectDB;
    disconnectDB: typeof disconnectDB;
};
export default _default;
//# sourceMappingURL=models.d.ts.map