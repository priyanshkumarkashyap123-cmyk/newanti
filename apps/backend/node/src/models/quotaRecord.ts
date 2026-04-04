import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IQuotaRecord extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	windowDate: string;
	projectsCreated: number;
	computeUnitsUsed: number;
	createdAt: Date;
	updatedAt: Date;
}

const QuotaRecordSchema = new Schema<IQuotaRecord>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	clerkId: { type: String, required: true },
	windowDate: { type: String, required: true },
	projectsCreated: { type: Number, default: 0 },
	computeUnitsUsed: { type: Number, default: 0 },
}, { timestamps: true });

QuotaRecordSchema.index({ clerkId: 1, windowDate: 1 }, { unique: true });
QuotaRecordSchema.index({ userId: 1, windowDate: 1 });

export const QuotaRecord = mongoose.model<IQuotaRecord>('QuotaRecord', QuotaRecordSchema);
