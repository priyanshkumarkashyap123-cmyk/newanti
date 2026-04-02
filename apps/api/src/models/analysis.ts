import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAISessionMessage {
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
	role: { type: String, enum: ['user', 'assistant'], required: true },
	content: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	metadata: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const AISessionSchema = new Schema<IAISession>({
	name: { type: String, required: true, trim: true, maxlength: 200 },
	type: { type: String, enum: ['generate', 'modify', 'chat'], required: true },
	messages: { type: [AISessionMessageSchema], default: [] },
	owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	projectSnapshot: { type: Schema.Types.Mixed, default: null },
	isArchived: { type: Boolean, default: false }
}, { timestamps: true });

AISessionSchema.index({ owner: 1, updatedAt: -1 });
AISessionSchema.index({ owner: 1, type: 1 });

export const AISession = mongoose.model<IAISession>('AISession', AISessionSchema);

export interface IAnalysisJob extends Document {
	jobId: string;
	userId: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	progress: number;
	analysisModel: Record<string, unknown>;
	result?: Record<string, unknown>;
	error?: string;
	errorCode?: string;
	errorDetails?: Array<{ type: string; message: string; elementIds?: string[]; }>;
	nodeCount: number;
	memberCount: number;
	createdAt: Date;
	updatedAt: Date;
	completedAt?: Date;
}

const AnalysisJobSchema = new Schema<IAnalysisJob>({
	jobId: { type: String, required: true, unique: true, index: true },
	userId: { type: String, required: true, index: true },
	status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
	progress: { type: Number, default: 0, min: 0, max: 100 },
	analysisModel: { type: Schema.Types.Mixed, required: true },
	result: { type: Schema.Types.Mixed, default: null },
	error: { type: String, default: null },
	errorCode: { type: String, default: null },
	errorDetails: [{
		type: { type: String, required: true },
		message: { type: String, required: true },
		elementIds: { type: [String], default: [] },
	}],
	nodeCount: { type: Number, default: 0 },
	memberCount: { type: Number, default: 0 },
	completedAt: { type: Date, default: null },
}, { timestamps: true });

AnalysisJobSchema.index({ completedAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { completedAt: { $exists: true } } });
AnalysisJobSchema.index({ userId: 1, status: 1 });
AnalysisJobSchema.index({ status: 1, createdAt: -1 });

export const AnalysisJob = mongoose.model<IAnalysisJob>('AnalysisJob', AnalysisJobSchema);

export interface IAnalysisResult extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	projectId: Types.ObjectId;
	analysisType: 'linear_static' | 'buckling' | 'modal' | 'p_delta' | 'seismic' | 'time_history' | 'cable' | 'pinn' | 'nonlinear' | 'other';
	analysisName: string;
	status: 'completed' | 'failed';
	inputSummary: { nodeCount: number; memberCount: number; loadCases: number; supports: number; };
	resultData: Record<string, unknown>;
	resultSummary: string;
	computeTimeMs: number;
	solverUsed: 'wasm' | 'rust_api' | 'python';
	deviceId?: string;
	tags?: string[];
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

const AnalysisResultSchema = new Schema<IAnalysisResult>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	clerkId: { type: String, required: true, index: true },
	projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
	analysisType: { type: String, enum: ['linear_static', 'buckling', 'modal', 'p_delta', 'seismic', 'time_history', 'cable', 'pinn', 'nonlinear', 'other'], required: true, index: true },
	analysisName: { type: String, required: true, trim: true },
	status: { type: String, enum: ['completed', 'failed'], required: true },
	inputSummary: {
		nodeCount: { type: Number, default: 0 },
		memberCount: { type: Number, default: 0 },
		loadCases: { type: Number, default: 0 },
		supports: { type: Number, default: 0 }
	},
	resultData: { type: Schema.Types.Mixed, default: {} },
	resultSummary: { type: String, default: '' },
	computeTimeMs: { type: Number, default: 0 },
	solverUsed: { type: String, enum: ['wasm', 'rust_api', 'python'], default: 'wasm' },
	deviceId: { type: String, default: null },
	tags: [{ type: String, trim: true }],
	notes: { type: String, default: null }
}, { timestamps: true });

AnalysisResultSchema.index({ clerkId: 1, createdAt: -1 });
AnalysisResultSchema.index({ projectId: 1, analysisType: 1 });
AnalysisResultSchema.index({ clerkId: 1, analysisType: 1, createdAt: -1 });

export const AnalysisResult = mongoose.model<IAnalysisResult>('AnalysisResult', AnalysisResultSchema);

export interface IReportGeneration extends Document {
	userId: Types.ObjectId;
	clerkId: string;
	projectId?: Types.ObjectId;
	analysisResultId?: Types.ObjectId;
	reportType: 'structural_analysis' | 'design_check' | 'load_summary' | 'member_forces' | 'deflection' | 'buckling' | 'modal' | 'seismic' | 'complete' | 'custom';
	format: 'pdf' | 'csv' | 'dxf' | 'json' | 'xlsx';
	reportName: string;
	fileSizeBytes: number;
	generationTimeMs: number;
	pageCount?: number;
	templateUsed?: string;
	parameters?: Record<string, unknown>;
	downloadCount: number;
	lastDownloadAt?: Date;
	status: 'generating' | 'completed' | 'failed';
	errorMessage?: string;
	createdAt: Date;
	updatedAt: Date;
}

const ReportGenerationSchema = new Schema<IReportGeneration>({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	clerkId: { type: String, required: true, index: true },
	projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
	analysisResultId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', default: null },
	reportType: { type: String, enum: ['structural_analysis', 'design_check', 'load_summary', 'member_forces', 'deflection', 'buckling', 'modal', 'seismic', 'complete', 'custom'], required: true },
	format: { type: String, enum: ['pdf', 'csv', 'dxf', 'json', 'xlsx'], required: true },
	reportName: { type: String, required: true, trim: true },
	fileSizeBytes: { type: Number, default: 0 },
	generationTimeMs: { type: Number, default: 0 },
	pageCount: { type: Number, default: null },
	templateUsed: { type: String, default: null },
	parameters: { type: Schema.Types.Mixed, default: {} },
	downloadCount: { type: Number, default: 0 },
	lastDownloadAt: { type: Date, default: null },
	status: { type: String, enum: ['generating', 'completed', 'failed'], default: 'generating' },
	errorMessage: { type: String, default: null }
}, { timestamps: true });

ReportGenerationSchema.index({ clerkId: 1, createdAt: -1 });
ReportGenerationSchema.index({ projectId: 1 });
ReportGenerationSchema.index({ reportType: 1, format: 1 });

export const ReportGeneration = mongoose.model<IReportGeneration>('ReportGeneration', ReportGenerationSchema);
