import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICollaborationInvite extends Document {
	projectId: Types.ObjectId;
	inviterId: Types.ObjectId;
	inviterClerkId: string;
	inviteeId: Types.ObjectId;
	inviteeClerkId: string;
	inviteeEmail: string;
	status: 'pending' | 'accepted' | 'revoked';
	accessLevel: 'read' | 'write';
	createdAt: Date;
	updatedAt: Date;
}

const CollaborationInviteSchema = new Schema<ICollaborationInvite>({
	projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
	inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	inviterClerkId: { type: String, required: true },
	inviteeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	inviteeClerkId: { type: String, required: true },
	inviteeEmail: { type: String, required: true, lowercase: true, trim: true },
	status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
	accessLevel: { type: String, enum: ['read', 'write'], default: 'write' },
}, { timestamps: true });

CollaborationInviteSchema.index({ projectId: 1, inviteeId: 1 }, { unique: true });
CollaborationInviteSchema.index({ projectId: 1 });
CollaborationInviteSchema.index({ inviteeClerkId: 1, status: 1 });

export const CollaborationInvite = mongoose.model<ICollaborationInvite>('CollaborationInvite', CollaborationInviteSchema);
