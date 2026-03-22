import mongoose, { Schema, type Document } from "mongoose";

export interface IGpuJobIdempotency extends Document {
  userId: string;
  idempotencyKey: string;
  requestHash: string;
  state: "processing" | "completed" | "failed";
  source?: "vm" | "python";
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GpuJobIdempotencySchema = new Schema<IGpuJobIdempotency>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    source: {
      type: String,
      enum: ["vm", "python"],
      default: null,
    },
    responsePayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "gpu_job_idempotency",
  },
);

GpuJobIdempotencySchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const IDEMPOTENCY_TTL_SECONDS = Number(process.env["GPU_JOB_IDEMPOTENCY_TTL_SECONDS"] ?? 24 * 60 * 60);
GpuJobIdempotencySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: Number.isFinite(IDEMPOTENCY_TTL_SECONDS) && IDEMPOTENCY_TTL_SECONDS > 0 ? IDEMPOTENCY_TTL_SECONDS : 24 * 60 * 60 },
);

export const GpuJobIdempotency = mongoose.model<IGpuJobIdempotency>(
  "GpuJobIdempotency",
  GpuJobIdempotencySchema,
);
