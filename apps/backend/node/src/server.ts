import { createServer as createHttpServer } from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { SocketServer } from "./SocketServer.js";
import { initializeRedisClient, disconnectRedisClient } from "./cache/index.js";
import { connectDB } from "./models/index.js";
import { startQuotaResetCron } from "./jobs/quotaResetCron.js";
import { createGpuAutoScaleMetricsRouter } from "./routes/metrics/gpuAutoScale.js";
export function startServer() {
  const PORT = env.PORT;
  const HOST = process.env["HOST"] || "0.0.0.0";

  const httpServer = createHttpServer();
  const socketServer = new SocketServer(httpServer);
  const gpuAutoscaleMetricsRouter = createGpuAutoScaleMetricsRouter({
    getRealtimeMetrics: () => socketServer.getRealtimeMetrics(),
  });

  const { app, setDbReady } = createApp({
    gpuAutoscaleMetricsRouter,
    getProjectUsers: (projectId: string) => socketServer.getProjectUsers(projectId),
  });

  httpServer.on("request", app);

  // Lightweight liveness probe (no DB)
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  // Readiness probe with DB awareness (setDbReady toggled after successful Mongo connect)
  app.get("/readyz", (_req, res) => {
    if (app.get("dbReady")) {
      return res.status(200).json({ ok: true, db: true });
    }
    return res.status(503).json({ ok: false, db: false });
  });

// Admin GPU status routes toggle remains inside createApp via getRoutes

httpServer.listen(PORT, HOST, () => {
  console.log("[STARTUP] ✅ Server listening successfully!");
  logger.info(`BeamLab Ultimate API running on http://${HOST}:${PORT}`);
  logger.info(`WebSocket server ready for real-time collaboration`);
  logger.info(`Security middleware active: helmet, rate limiting, logging`);

  const connectWithRetry = (attempt = 1) => {
    const MAX_RETRY_MINUTES = 6; // tolerate slow DB startup
    const MAX_ATTEMPTS = Math.ceil((MAX_RETRY_MINUTES * 60_000) / 5_000); // 5s base

    logger.info(`[CONNECT] Attempting MongoDB connection (attempt ${attempt}/${MAX_ATTEMPTS})`);

    connectDB()
      .then(() => {
        setDbReady(true);
        app.set("dbReady", true);
        logger.info("[CONNECT] ✅ MongoDB connected successfully — API routes are now live");

        initializeRedisClient()
          .then((client) => {
            if (client && client.isOpen) {
              logger.info("[CACHE] ✅ Redis cache initialized successfully");
            } else {
              logger.warn("[CACHE] ⚠️ Redis cache unavailable — API will operate without caching");
            }
          })
          .catch((err) => {
            logger.warn("[CACHE] ⚠️ Failed to initialize Redis cache:", err);
            logger.warn("[CACHE] Continuing without caching layer — performance may be reduced");
          });

        startQuotaResetCron();
      })
      .catch((err) => {
        logger.error({ err, attempt }, `[CONNECT] ❌ MongoDB connection failed (attempt ${attempt}/${MAX_ATTEMPTS})`);

        if (attempt < MAX_ATTEMPTS) {
          const backoff = Math.min(5_000 + attempt * 1_000, 15_000); // 5–15s
          logger.info(`[CONNECT] ⏳ Retrying in ${backoff}ms... (${MAX_ATTEMPTS - attempt} attempts remaining)`);
          setTimeout(() => connectWithRetry(attempt + 1), backoff);
        } else {
          logger.error("[CONNECT] ❌ All MongoDB connection attempts exhausted. Keeping server up; /readyz will stay 503 until DB is reachable.");
          logger.warn("[CONNECT] Check MongoDB Atlas connection string, firewall rules, and network connectivity from Azure App Service.");
          // Do NOT exit; keep liveness healthy so platform doesn’t recycle the container.
        }
      });
  };
  connectWithRetry();

  const SHUTDOWN_TIMEOUT_MS = 15_000;
  let isShuttingDown = false;
  const activeConnections = new Set<import("net").Socket>();
  httpServer.on("connection", (socket) => {
    activeConnections.add(socket);
    socket.on("close", () => activeConnections.delete(socket));
  });

  app.use((_req, res, next) => {
    if (isShuttingDown) {
      res.setHeader("Connection", "close");
      res.status(503).json({ success: false, error: "Server is shutting down" });
      return;
    }
    next();
  });

  function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    httpServer.close(() => {
      logger.info("HTTP server closed — all in-flight requests drained.");
    });

    socketServer.close();
    logger.info("WebSocket server closed.");

    for (const socket of activeConnections) {
      if (!socket.writableLength) {
        socket.destroy();
      } else {
        socket.end();
      }
    }
    logger.info(`${activeConnections.size} idle connections closed.`);

    disconnectRedisClient()
      .then(() => {
        logger.info("Redis connection closed.");
        import("mongoose")
          .then((mongoose) => {
            mongoose.default.connection.close(false).then(() => {
              logger.info("MongoDB connection closed.");
              process.exit(0);
            });
          })
          .catch(() => process.exit(0));
      })
      .catch((err) => {
        logger.warn("Error closing Redis:", err);
        import("mongoose")
          .then((mongoose) => {
            mongoose.default.connection.close(false).then(() => {
              logger.info("MongoDB connection closed.");
              process.exit(0);
            });
          })
          .catch(() => process.exit(0));
      });

    setTimeout(() => {
      logger.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});

  return { httpServer, socketServer, app };
}
