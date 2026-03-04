import mongoose, { Schema } from "mongoose";
const MASTER_EMAILS = process.env.MASTER_EMAILS ? process.env.MASTER_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) : ["rakshittiwari048@gmail.com"];
function isMasterUser(email) {
  if (!email) return false;
  return MASTER_EMAILS.includes(email.toLowerCase().trim());
}
function getEffectiveTier(email, actualTier) {
  if (isMasterUser(email)) {
    return "enterprise";
  }
  return actualTier;
}
const ActivityLogSchema = new Schema({
  action: {
    type: String,
    enum: ["login", "analysis_run", "project_create", "project_save", "export_pdf", "template_use"],
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
const UserSchema = new Schema({
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
    enum: ["free", "pro", "enterprise"],
    default: "free"
  },
  projects: [{
    type: Schema.Types.ObjectId,
    ref: "Project"
  }],
  subscription: {
    type: Schema.Types.ObjectId,
    ref: "Subscription"
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
UserSchema.index({ tier: 1 });
UserSchema.index({ lastLogin: -1 });
const User = mongoose.model("User", UserSchema);
const ProjectSchema = new Schema({
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
    type: String,
    // URL to thumbnail image
    default: null
  },
  data: {
    type: Schema.Types.Mixed,
    required: true,
    default: {}
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  collaborators: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});
ProjectSchema.index({ owner: 1, createdAt: -1 });
ProjectSchema.index({ name: "text", description: "text" });
const Project = mongoose.model("Project", ProjectSchema);
const SubscriptionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
    enum: ["active", "canceled", "past_due", "trialing", "incomplete"],
    default: "incomplete"
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
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });
const Subscription = mongoose.model("Subscription", SubscriptionSchema);
const UserModelSchema = new Schema({
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
    required: true
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
    enum: ["user", "admin", "enterprise"],
    default: "user"
  },
  subscriptionTier: {
    type: String,
    enum: ["free", "pro", "enterprise"],
    default: "free"
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
const UserModel = mongoose.model("UserModel", UserModelSchema);
const RefreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "UserModel",
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
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const RefreshTokenModel = mongoose.model("RefreshToken", RefreshTokenSchema);
const VerificationCodeSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "UserModel",
    required: true,
    index: true
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["email", "password_reset", "two_factor"],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const VerificationCodeModel = mongoose.model("VerificationCode", VerificationCodeSchema);
const ConsentSchema = new Schema({
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
    default: "1.0"
  },
  acceptedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});
ConsentSchema.index({ userId: 1, consentType: 1 });
const Consent = mongoose.model("Consent", ConsentSchema);
const AISessionMessageSchema = new Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
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
const AISessionSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    enum: ["generate", "modify", "chat"],
    required: true
  },
  messages: {
    type: [AISessionMessageSchema],
    default: []
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
const AISession = mongoose.model("AISession", AISessionSchema);
async function connectDB(uri) {
  const connectionUri = uri ?? process.env["MONGODB_URI"] ?? "mongodb://localhost:27017/beamlab";
  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 3e4,
      connectTimeoutMS: 3e4,
      socketTimeoutMS: 45e3
    });
    console.log("\u2705 MongoDB connected successfully");
  } catch (error) {
    console.error("\u274C MongoDB connection error:", error);
    console.warn("\u26A0\uFE0F App will continue without database - some features may be unavailable");
  }
}
async function disconnectDB() {
  await mongoose.disconnect();
  console.log("\u{1F4E4} MongoDB disconnected");
}
var models_default = { User, Project, Subscription, UserModel, RefreshTokenModel, VerificationCodeModel, Consent, AISession, connectDB, disconnectDB };
export {
  AISession,
  Consent,
  MASTER_EMAILS,
  Project,
  RefreshTokenModel,
  Subscription,
  User,
  UserModel,
  VerificationCodeModel,
  connectDB,
  models_default as default,
  disconnectDB,
  getEffectiveTier,
  isMasterUser
};
//# sourceMappingURL=models.js.map
