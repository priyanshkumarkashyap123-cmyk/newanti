import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rustProxyMock, pythonProxyMock } = vi.hoisted(() => ({
  rustProxyMock: vi.fn(),
  pythonProxyMock: vi.fn(),
}));

vi.mock('../src/services/serviceProxy.js', () => ({
  rustProxy: rustProxyMock,
  pythonProxy: pythonProxyMock,
}));

vi.mock('../src/utils/logger.js', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
  return { default: logger, logger };
});

import designRouter from '../src/routes/design/index.js';

import logger from '../src/utils/logger.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/design', designRouter);
  return app;
}

const validSteelPayload = {
  code: 'IS800',
  section: {
    name: 'ISHB 300',
    area: 58.5e-4,
    depth: 300,
    width: 250,
    webThickness: 7.6,
    flangeThickness: 10.6,
    Iy: 12545e-8,
    Iz: 2194e-8,
    ry: 127.7,
    rz: 53.1,
  },
  geometry: { length: 6000, effectiveLengthY: 6000 },
  forces: { N: -500000, Vy: 20000, Vz: 0, My: 150e6, Mz: 0 },
  material: { fy: 250, fu: 410 },
};

const validConcreteBeamPayload = {
  section: { width: 300, depth: 500, effectiveDepth: 450 },
  forces: { Mu: 200e6, Vu: 100e3 },
  material: { fck: 30, fy: 500 },
};

const validConcreteColumnPayload = {
  section: { width: 400, depth: 400 },
  forces: { Pu: 2000e3, Mux: 150e6, Muy: 100e6 },
  geometry: { unsupportedLength: 3500 },
  material: { fck: 40, fy: 500 },
};

describe('Design core gateway routes (Rust + Python fallback)', () => {
  beforeEach(() => {
    rustProxyMock.mockReset();
    pythonProxyMock.mockReset();

    rustProxyMock.mockResolvedValue({
      success: true,
      status: 200,
      data: { passed: true, utilization: 0.5, message: 'rust ok' },
      service: 'rust',
      latencyMs: 1,
    });

    pythonProxyMock.mockResolvedValue({
      success: true,
      status: 200,
      data: { passed: true, utilization: 0.6, message: 'python ok' },
      service: 'python',
      latencyMs: 2,
    });
  });

  it('forwards /steel to IS800 rust route by default', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/design/steel').send(validSteelPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.engine).toBe('rust');

    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/is800/auto-select',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
  });

  it('forwards /steel to AISC rust route when code=AISC360', async () => {
    const app = makeApp();
    const response = await request(app)
      .post('/api/design/steel')
      .send({ ...validSteelPayload, code: 'AISC360' });

    expect(response.status).toBe(200);
    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/aisc360/bending',
      expect.objectContaining({ code: 'AISC360' }),
      undefined,
      30000,
      undefined,
    );
  });

  it('falls back to Python when Rust fails on /steel', async () => {
    rustProxyMock.mockResolvedValueOnce({
      success: false,
      status: 503,
      error: 'rust unavailable',
      service: 'rust',
      latencyMs: 2,
    });

    const app = makeApp();
    const response = await request(app).post('/api/design/steel').send(validSteelPayload);

    expect(response.status).toBe(200);
    expect(response.body.engine).toBe('python');

    expect(rustProxyMock).toHaveBeenCalledTimes(1);
    expect(pythonProxyMock).toHaveBeenCalledTimes(1);
    expect(pythonProxyMock).toHaveBeenCalledWith(
      'POST',
      '/design/steel/check',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
  });

  it('routes /concrete/beam and /concrete/column to corresponding Rust checks', async () => {
    const app = makeApp();

    await request(app).post('/api/design/concrete/beam').send(validConcreteBeamPayload);
    await request(app).post('/api/design/concrete/column').send(validConcreteColumnPayload);

    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/is456/flexural-capacity',
      expect.objectContaining({ element_type: 'beam', code: 'IS456' }),
      undefined,
      30000,
      undefined,
    );

    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/is456/biaxial-column',
      expect.objectContaining({ element_type: 'column', code: 'IS456' }),
      undefined,
      30000,
      undefined,
    );
  });

  it('maps /connection types to correct Rust target paths', async () => {
    const app = makeApp();

    await request(app).post('/api/design/connection').send({
      type: 'welded',
      forces: { shear: 100e3 },
      weld: { size: 6, length: 120, type: 'fillet' },
    });

    await request(app).post('/api/design/connection').send({
      type: 'base_plate',
      forces: { axial: 500e3 },
      plate: { thickness: 20, fy: 250 },
    });

    await request(app).post('/api/design/connection').send({
      type: 'bolted_shear',
      forces: { shear: 100e3 },
      bolt: { diameter: 20, grade: '8.8' },
    });

    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/is800/fillet-weld',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/base-plate',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/design/is800/bolt-bearing',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
  });

  it('uses Python-only flow for /foundation', async () => {
    const app = makeApp();
    const response = await request(app)
      .post('/api/design/foundation')
      .send({
        type: 'isolated',
        loads: [{ P: 500e3 }],
        columnSize: { width: 400, depth: 400 },
        soil: { bearingCapacity: 200 },
        material: { fck: 25, fy: 500 },
      });

    expect(response.status).toBe(200);
    expect(response.body.engine).toBe('python');
    expect(rustProxyMock).not.toHaveBeenCalled();
    expect(pythonProxyMock).toHaveBeenCalledWith(
      'POST',
      '/design/foundation/check',
      expect.any(Object),
      undefined,
      30000,
      undefined,
    );
  });

  it('supports alias routes /aisc, /is800, /steel/check, and /concrete/check', async () => {
    const app = makeApp();

    await request(app).post('/api/design/aisc').send({ foo: 'bar' });
    await request(app).post('/api/design/is800').send({ foo: 'bar' });
    await request(app).post('/api/design/steel/check').send({ code: 'AISC360' });
    await request(app).post('/api/design/concrete/check').send({ element_type: 'column' });

    expect(rustProxyMock).toHaveBeenCalledWith('POST', '/api/design/aisc360/bending', expect.any(Object), undefined, 30000, undefined);
    expect(rustProxyMock).toHaveBeenCalledWith('POST', '/api/design/is800/auto-select', expect.any(Object), undefined, 30000, undefined);
    expect(rustProxyMock).toHaveBeenCalledWith('POST', '/api/design/is456/biaxial-column', expect.any(Object), undefined, 30000, undefined);
  });

  it('uses 60s timeout for /optimize route forwarding', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/design/optimize').send({ demand: 'high' });

    expect(response.status).toBe(200);
    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      '/api/optimization/auto-select',
      expect.any(Object),
      undefined,
      60000,
      undefined,
    );
  });

  it('rejects invalid /steel payload at validation layer without backend call', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/design/steel').send({ code: 'IS800' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.fields)).toBe(true);
    expect(rustProxyMock).not.toHaveBeenCalled();
    expect(pythonProxyMock).not.toHaveBeenCalled();
  });

  it('returns 502 when upstream design payload violates contract', async () => {
    rustProxyMock.mockResolvedValueOnce({
      success: true,
      status: 200,
      data: { foo: 'bar' },
      service: 'rust',
      latencyMs: 2,
    });

    const app = makeApp();
    const response = await request(app).post('/api/design/steel').send(validSteelPayload);

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('UPSTREAM_CONTRACT_ERROR');
  });
});
