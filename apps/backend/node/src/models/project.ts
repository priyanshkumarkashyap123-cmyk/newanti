import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProject extends Document {
	name: string;
	description?: string;
	thumbnail?: string;
	data: Record<string, unknown>;
	owner: Types.ObjectId;
	collaborators?: Types.ObjectId[];
	isPublic: boolean;
	isFavorited: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>({
	name: { type: String, required: true, trim: true, maxlength: 100 },
	description: { type: String, trim: true, maxlength: 500 },
	thumbnail: { type: String, default: null },
	data: { type: Schema.Types.Mixed, required: true, default: {} },
	owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
	isPublic: { type: Boolean, default: false },
	isFavorited: { type: Boolean, default: false },
	deletedAt: { type: Date, default: null }
}, { timestamps: true });

ProjectSchema.index({ owner: 1, createdAt: -1 });
ProjectSchema.index({ owner: 1, deletedAt: 1 });
ProjectSchema.index({ name: 'text', description: 'text' });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
