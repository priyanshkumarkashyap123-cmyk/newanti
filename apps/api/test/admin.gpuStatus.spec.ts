import express from "express";
import request from "supertest";
import adminGpuStatusRouter from "../src/routes/admin/gpuStatus.js";

describe("Admin GPU Status route", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    // mount the router under /api/admin
    app.use("/api/admin", adminGpuStatusRouter as any);
  });

  it("should return 401 when not authenticated and no admin token", async () => {
    const res = await request(app).get("/api/admin/gpu-status");
    expect(res.status).toBe(401);
  });

  it("should return 200 when ADMIN_STATUS_TOKEN header is provided", async () => {
    process.env["ADMIN_STATUS_TOKEN"] = "test-token-123";
    const res = await request(app).get("/api/admin/gpu-status").set("x-admin-token", "test-token-123");
    // should return JSON with minimal fields
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("autostartEligible");
    expect(res.body).toHaveProperty("telemetry");
  });
});
