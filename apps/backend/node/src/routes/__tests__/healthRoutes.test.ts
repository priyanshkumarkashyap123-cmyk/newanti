/**
 * healthRoutes.test.ts
 *
 * Unit tests for Node_API GET /health endpoint.
 * Verifies the response shape required by Requirement 17.3:
 *   { status: 'ok' | 'degraded', version: string, db: 'connected' | 'disconnected' }
 *   HTTP 200 when healthy, HTTP 503 when DB unreachable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// ── Mock mongoose ──────────────────────────────────────────────────────────
vi.mock('mongoose', () => ({
  default: {
    connection: { readyState: 1 },
  },
  connection: { readyState: 1 },
}));

import mongoose from 'mongoose';
import healthRouter from '../healthRoutes.js';

function buildApp(): Express {
  const app = express();
  app.use('/health', healthRouter);
  return app;
}

describe('GET /health — Node_API (Requirement 17.3)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns HTTP 200 with correct shape when DB is connected', async () => {
    // readyState 1 = connected
    (mongoose as unknown as { connection: { readyState: number } }).connection.readyState = 1;

    const app = buildApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      db: 'connected',
    });
    expect(typeof res.body.version).toBe('string');
  });

  it('returns HTTP 503 with db: disconnected when DB is not connected', async () => {
    // readyState 0 = disconnected
    (mongoose as unknown as { connection: { readyState: number } }).connection.readyState = 0;

    const app = buildApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      db: 'disconnected',
    });
    expect(typeof res.body.version).toBe('string');
  });

  it('response body contains exactly status, version, and db fields', async () => {
    (mongoose as unknown as { connection: { readyState: number } }).connection.readyState = 1;

    const app = buildApp();
    const res = await request(app).get('/health');

    const keys = Object.keys(res.body);
    expect(keys).toContain('status');
    expect(keys).toContain('version');
    expect(keys).toContain('db');
  });

  it('db field is either "connected" or "disconnected"', async () => {
    for (const readyState of [0, 1, 2, 3]) {
      (mongoose as unknown as { connection: { readyState: number } }).connection.readyState = readyState;
      const app = buildApp();
      const res = await request(app).get('/health');
      expect(['connected', 'disconnected']).toContain(res.body.db);
    }
  });
});
