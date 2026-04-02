import {
	User,
	UserModel,
	RefreshTokenModel,
	VerificationCodeModel,
	Consent,
	MASTER_EMAILS,
	isMasterUser,
	getEffectiveTier,
} from './user.js';
import { Project } from './project.js';
import {
	Subscription,
	SubscriptionLedger,
	PaymentWebhookEvent,
	UsageCounter,
	LegacyPaymentData,
	TierChangeLog,
} from './subscription.js';
import {
	AISession,
	AnalysisJob,
	AnalysisResult,
	ReportGeneration,
} from './analysis.js';
import { DeviceSession } from './deviceSession.js';
import { UsageLog } from './usageLog.js';
import { QuotaRecord } from './quotaRecord.js';
import { CollaborationInvite } from './collaborationInvite.js';
import { connectDB, disconnectDB } from './db.js';

export {
	User,
	UserModel,
	RefreshTokenModel,
	VerificationCodeModel,
	Consent,
	MASTER_EMAILS,
	isMasterUser,
	getEffectiveTier,
	Project,
	Subscription,
	SubscriptionLedger,
	PaymentWebhookEvent,
	UsageCounter,
	LegacyPaymentData,
	TierChangeLog,
	AISession,
	AnalysisJob,
	AnalysisResult,
	ReportGeneration,
	DeviceSession,
	UsageLog,
	QuotaRecord,
	CollaborationInvite,
	connectDB,
	disconnectDB,
};

export type { IUser, IUserModel } from './user.js';
export type { IProject } from './project.js';
export type {
	ISubscription,
	ISubscriptionLedger,
	IPaymentWebhookEvent,
	IUsageCounter,
	ILegacyPaymentData,
	ITierChangeLog,
} from './subscription.js';
export type {
	IAISession,
	IAnalysisJob,
	IAnalysisResult,
	IReportGeneration,
} from './analysis.js';
export type { IDeviceSession } from './deviceSession.js';
export type { IUsageLog } from './usageLog.js';
export type { IQuotaRecord } from './quotaRecord.js';

const models = {
	User,
	UserModel,
	RefreshTokenModel,
	VerificationCodeModel,
	Consent,
	MASTER_EMAILS,
	isMasterUser,
	getEffectiveTier,
	Project,
	Subscription,
	SubscriptionLedger,
	PaymentWebhookEvent,
	UsageCounter,
	LegacyPaymentData,
	TierChangeLog,
	AISession,
	AnalysisJob,
	AnalysisResult,
	ReportGeneration,
	DeviceSession,
	UsageLog,
	QuotaRecord,
	CollaborationInvite,
	connectDB,
	disconnectDB,
};

export default models;
