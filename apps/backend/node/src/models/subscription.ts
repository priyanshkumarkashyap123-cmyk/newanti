import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
	user: Types.ObjectId;
	phonepeTransactionId?: string;
	phonepeMerchantTransactionId?: string;
	planType?: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	stripePriceId?: string;
	razorpayPaymentId?: string;
	razorpayOrderId?: string;
	status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'expired';
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
	phonepeTransactionId: { type: String, sparse: true, unique: true, index: true },
	phonepeMerchantTransactionId: { type: String, sparse: true, unique: true, index: true },
	planType: { type: String },
	stripeCustomerId: { type: String, sparse: true, index: true },
	stripeSubscriptionId: { type: String, sparse: true },
	stripePriceId: { type: String },
	razorpayPaymentId: { type: String, sparse: true, unique: true },
	razorpayOrderId: { type: String, sparse: true, unique: true },
	status: { type: String, enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'expired'], default: 'incomplete' },
	currentPeriodStart: { type: Date },
	currentPeriodEnd: { type: Date },
	cancelAtPeriodEnd: { type: Boolean, default: false }
}, { timestamps: true });

SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export interface ISubscriptionLedger extends Document {
	user: Types.ObjectId;
	provider: 'phonepe' | 'razorpay' | 'stripe' | 'manual' | 'system';
	planId?: string;
	tier: 'free' | 'pro' | 'enterprise';
	status: 'created' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'expired' | 'refunded' | 'failed';
	periodStart?: Date;
	periodEnd?: Date;
	eventId?: string;
	eventType?: string;
	amount?: number;
	currency?: string;
	seats?: number;
	cancelAtPeriodEnd?: boolean;
	rawPayload?: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

const SubscriptionLedgerSchema = new Schema<ISubscriptionLedger>({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	provider: { type: String, enum: ['phonepe', 'razorpay', 'stripe', 'manual', 'system'], required: true, index: true },
	planId: { type: String, default: null },
	tier: { type: String, enum: ['free', 'pro', 'enterprise'], required: true, index: true },
	status: { type: String, enum: ['created', 'active', 'canceled', 'past_due', 'trialing', 'incomplete', 'expired', 'refunded', 'failed'], required: true, index: true },
	periodStart: { type: Date, default: null },
	periodEnd: { type: Date, default: null },
	eventId: { type: String, default: null, index: true },
	eventType: { type: String, default: null },
	amount: { type: Number, default: null },
	currency: { type: String, default: null },
	seats: { type: Number, default: null },
	cancelAtPeriodEnd: { type: Boolean, default: false },
	rawPayload: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

SubscriptionLedgerSchema.index({ user: 1, createdAt: -1 });
SubscriptionLedgerSchema.index({ provider: 1, status: 1, createdAt: -1 });
SubscriptionLedgerSchema.index({ eventId: 1 }, { unique: true, sparse: true });

export const SubscriptionLedger = mongoose.model<ISubscriptionLedger>('SubscriptionLedger', SubscriptionLedgerSchema);

export interface IPaymentWebhookEvent extends Document {
	gateway: 'phonepe' | 'razorpay';
	eventKey: string;
	status: 'processing' | 'processed' | 'failed';
	metadata?: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

const PaymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>({
	gateway: { type: String, enum: ['phonepe', 'razorpay'], required: true, index: true },
	eventKey: { type: String, required: true, index: true },
	status: { type: String, enum: ['processing', 'processed', 'failed'], default: 'processing', index: true },
	metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

PaymentWebhookEventSchema.index({ gateway: 1, eventKey: 1 }, { unique: true });

export const PaymentWebhookEvent = mongoose.model<IPaymentWebhookEvent>('PaymentWebhookEvent', PaymentWebhookEventSchema);

export interface IUsageCounter extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	email?: string;
	date: string;
	projectsCreated: number;
	analysesRun: number;
	exports: number;
	computeUnitsUsed: number;
	storageBytesUsed: number;
	distinctDevices: number;
	devicesSeen: string[];
	createdAt: Date;
	updatedAt: Date;
}

const UsageCounterSchema = new Schema<IUsageCounter>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	clerkId: { type: String, required: true, index: true },
	email: { type: String, default: null },
	date: { type: String, required: true, index: true },
	projectsCreated: { type: Number, default: 0 },
	analysesRun: { type: Number, default: 0 },
	exports: { type: Number, default: 0 },
	computeUnitsUsed: { type: Number, default: 0 },
	storageBytesUsed: { type: Number, default: 0 },
	distinctDevices: { type: Number, default: 0 },
	devicesSeen: { type: [String], default: [] },
}, { timestamps: true });

UsageCounterSchema.index({ clerkId: 1, date: 1 }, { unique: true });
UsageCounterSchema.index({ userId: 1, date: 1 });

export const UsageCounter = mongoose.model<IUsageCounter>('UsageCounter', UsageCounterSchema);

export interface ILegacyPaymentData extends Document {
	originalSubscriptionId: Types.ObjectId;
	userId: Types.ObjectId;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	stripePriceId?: string;
	razorpayPaymentId?: string;
	razorpayOrderId?: string;
	migratedAt: Date;
}

const LegacyPaymentDataSchema = new Schema<ILegacyPaymentData>({
	originalSubscriptionId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	stripeCustomerId: { type: String, sparse: true },
	stripeSubscriptionId: { type: String, sparse: true },
	stripePriceId: { type: String },
	razorpayPaymentId: { type: String, sparse: true },
	razorpayOrderId: { type: String, sparse: true },
	migratedAt: { type: Date, default: Date.now },
}, { timestamps: false, collection: 'legacypaymentdata' });

export const LegacyPaymentData = mongoose.model<ILegacyPaymentData>('LegacyPaymentData', LegacyPaymentDataSchema);

export interface ITierChangeLog extends Document {
	userId: Types.ObjectId;
	fromTier: 'free' | 'pro' | 'enterprise';
	toTier: 'free' | 'pro' | 'enterprise';
	reason: 'phonepe_webhook' | 'admin' | 'expiry' | 'manual';
	timestamp: Date;
	transactionId?: string;
}

const TierChangeLogSchema = new Schema<ITierChangeLog>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	fromTier: { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
	toTier: { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
	reason: { type: String, enum: ['phonepe_webhook', 'admin', 'expiry', 'manual'], required: true },
	timestamp: { type: Date, default: Date.now, required: true },
	transactionId: { type: String, sparse: true },
}, { timestamps: false });

TierChangeLogSchema.index({ userId: 1, timestamp: -1 });

export const TierChangeLog = mongoose.model<ITierChangeLog>('TierChangeLog', TierChangeLogSchema);
