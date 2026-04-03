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

// Admin GPU status routes toggle remains inside createApp via getRoutes

httpServer.listen(PORT, HOST, () => {
  console.log("[STARTUP] ✅ Server listening successfully!");
  logger.info(`BeamLab Ultimate API running on http://${HOST}:${PORT}`);
  logger.info(`WebSocket server ready for real-time collaboration`);
  logger.info(`Security middleware active: helmet, rate limiting, logging`);

  const connectWithRetry = (attempt = 1, maxAttempts = 5) => {
    logger.info(`[CONNECT] Attempting MongoDB connection (attempt ${attempt}/${maxAttempts})`);
    connectDB()
      .then(() => {
        setDbReady(true);
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
        logger.error({ err, attempt }, `[CONNECT] ❌ MongoDB connection failed (attempt ${attempt}/${maxAttempts})`);
        if (attempt < maxAttempts) {
          const delay = Math.min(attempt * 2000, 10000);
          logger.info(`[CONNECT] ⏳ Retrying in ${delay}ms... (${maxAttempts - attempt} attempts remaining)`);
          setTimeout(() => connectWithRetry(attempt + 1, maxAttempts), delay);
        } else {
          logger.error("[CONNECT] ❌ All MongoDB connection attempts exhausted (5/5). API will remain partially available while DB-dependent routes return 503.");
          logger.warn("[CONNECT] Check MongoDB Atlas connection string, firewall rules, and network connectivity from Azure App Service.");
          if (process.env['NODE_ENV'] === 'production') {
            logger.error("[CONNECT] Production startup aborted: exiting process after MongoDB retry exhaustion.");
            process.exit(1);
          }
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
