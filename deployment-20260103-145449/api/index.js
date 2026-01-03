import express from "express";
import cors from "cors";
import { createServer } from "http";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { SocketServer } from "./SocketServer.js";
import analysisRouter from "./routes/analysis/index.js";
import designRouter from "./routes/design/index.js";
import advancedRouter from "./routes/advanced/index.js";
import interopRouter from "./routes/interop/index.js";
import authRouter from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { razorpayRouter } from "./razorpay.js";
import { connectDB } from "./models.js";
import { authMiddleware as inHouseAuthMiddleware, isUsingClerk } from "./middleware/authMiddleware.js";
import {
  securityHeaders,
  generalRateLimit,
  analysisRateLimit,
  billingRateLimit,
  requestLogger,
  secureErrorHandler
} from "./middleware/security.js";
const app = express();
const PORT = process.env["PORT"] ?? 3001;
const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer);
app.use(securityHeaders);
app.use(requestLogger);
app.use(generalRateLimit);
const ALLOWED_ORIGINS = [
  process.env["FRONTEND_URL"] || "http://localhost:5173",
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
  "http://localhost:5173",
  "http://localhost:3000"
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10mb" }));
if (isUsingClerk()) {
  console.log("\u{1F510} Using Clerk authentication");
  app.use(clerkMiddleware());
} else {
  console.log("\u{1F510} Using in-house JWT authentication");
  app.use(inHouseAuthMiddleware);
}
if (!isUsingClerk()) {
  app.use("/api/auth", authRouter);
}
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "BeamLab Ultimate API",
    websocket: true,
    authProvider: isUsingClerk() ? "clerk" : "inhouse"
  });
});
app.use("/api/analyze", analysisRateLimit, analysisRouter);
app.use("/api/analysis", analysisRateLimit, analysisRouter);
app.use("/api/design", analysisRateLimit, designRouter);
app.use("/api/advanced", analysisRateLimit, advancedRouter);
app.use("/api/interop", analysisRateLimit, interopRouter);
app.use("/api/user", userRoutes);
app.use("/api/billing", billingRateLimit, razorpayRouter);
const authRequired = requireAuth();
app.get("/api/project", authRequired, (req, res) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  res.json({
    success: true,
    userId,
    projects: []
  });
});
app.post("/api/project", authRequired, (req, res) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  const { name, description } = req.body;
  res.json({
    success: true,
    project: {
      id: `proj_${Date.now()}`,
      userId,
      name,
      description,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
app.get("/api/project/:id", authRequired, (req, res) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  const projectId = req.params["id"];
  res.json({
    success: true,
    project: { id: projectId, userId }
  });
});
app.put("/api/project/:id", authRequired, (req, res) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  const projectId = req.params["id"];
  const { name, data } = req.body;
  res.json({
    success: true,
    project: { id: projectId, userId, name, data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  });
});
app.delete("/api/project/:id", authRequired, (req, res) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  const projectId = req.params["id"];
  res.json({
    success: true,
    deleted: { id: projectId, userId }
  });
});
app.get("/api/project/:id/users", (req, res) => {
  const projectId = req.params["id"] ?? "";
  const users = socketServer.getProjectUsers(projectId);
  res.json({
    success: true,
    projectId,
    users: users.map((u) => ({ id: u.id, name: u.name, color: u.color }))
  });
});
httpServer.listen(PORT, () => {
  console.log(`\u{1F680} BeamLab Ultimate API running on http://localhost:${PORT}`);
  console.log(`\u{1F50C} WebSocket server ready for real-time collaboration`);
  console.log(`\u{1F512} Security middleware active: helmet, rate limiting, logging`);
  connectDB().then(() => {
    console.log("\u2705 MongoDB connected successfully");
  }).catch((err) => {
    console.error("\u274C Failed to connect to MongoDB:", err);
  });
});
app.use(secureErrorHandler);
//# sourceMappingURL=index.js.map
