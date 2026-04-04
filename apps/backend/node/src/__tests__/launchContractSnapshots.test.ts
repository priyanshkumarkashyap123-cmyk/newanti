import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { attachResponseHelpers } from "../middleware/response.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachResponseHelpers);

  // Launch-critical contract families
  app.post("/api/v1/analyze/mock", (_req, res) => {
    res.ok({ engine: "rust", result: { displacements: [] } });
  });

  app.post("/api/v1/design/mock", (_req, res) => {
    res.ok({ engine: "rust", result: { utilization: 0.82 } });
  });

  app.post("/api/v1/ai/mock", (_req, res) => {
    res.ok({ provider: "python", output: { summary: "ok" } });
  });

  app.post("/api/v1/billing/mock", (_req, res) => {
    res.ok({ provider: "phonepe", status: "created" });
  });

  app.post("/api/v1/analyze/error", (_req, res) => {
    res.fail("UPSTREAM_TIMEOUT", "Analysis upstream timeout", 504);
  });

  return app;
}

describe("Launch contract snapshots", () => {
  it("success envelope for launch-critical families is stable", async () => {
    const app = buildApp();

    const analyzeRes = await request(app).post("/api/v1/analyze/mock").send({});
    const designRes = await request(app).post("/api/v1/design/mock").send({});
    const aiRes = await request(app).post("/api/v1/ai/mock").send({});
    const billingRes = await request(app).post("/api/v1/billing/mock").send({});

    for (const res of [analyzeRes, designRes, aiRes, billingRes]) {
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("requestId");
      expect(res.body).toHaveProperty("ts");
    }

    expect(Object.keys(analyzeRes.body).sort()).toEqual([
      "data",
      "requestId",
      "success",
      "ts",
    ]);
  });

  it("error envelope for launch-critical families is stable", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/v1/analyze/error").send({});

    expect(res.status).toBe(504);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "UPSTREAM_TIMEOUT");
    expect(res.body.error).toHaveProperty("message", "Analysis upstream timeout");
    expect(res.body).toHaveProperty("requestId");
    expect(res.body).toHaveProperty("ts");
    expect(Object.keys(res.body).sort()).toEqual([
      "error",
      "requestId",
      "success",
      "ts",
    ]);
  });
});
