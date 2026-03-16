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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/design', designRouter);
  return app;
}

describe('Design geotechnical gateway routes (Rust-first)', () => {
  beforeEach(() => {
    rustProxyMock.mockReset();
    pythonProxyMock.mockReset();
    rustProxyMock.mockResolvedValue({
      success: true,
      status: 200,
      data: {
        passed: true,
        utilization: 0.42,
        message: 'ok',
      },
      service: 'rust',
      latencyMs: 2,
    });
  });

  const geotechCases = [
    {
      route: '/geotech/spt-correlation',
      rustPath: '/api/design/geotech/spt-correlation',
      payload: { n60: 20, fines_percent: 10, groundwater_depth_m: 2.0 },
    },
    {
      route: '/geotech/slope/infinite',
      rustPath: '/api/design/geotech/slope/infinite',
      payload: {
        slope_angle_deg: 26,
        friction_angle_deg: 34,
        cohesion_kpa: 8,
        unit_weight_kn_m3: 19,
        depth_m: 2.5,
      },
    },
    {
      route: '/geotech/foundation/bearing-capacity',
      rustPath: '/api/design/geotech/foundation/bearing-capacity',
      payload: {
        cohesion_kpa: 0,
        friction_angle_deg: 32,
        unit_weight_kn_m3: 18,
        footing_width_m: 2,
        embedment_depth_m: 1.5,
        applied_pressure_kpa: 220,
      },
    },
    {
      route: '/geotech/retaining-wall/stability',
      rustPath: '/api/design/geotech/retaining-wall/stability',
      payload: {
        wall_height_m: 5,
        backfill_unit_weight_kn_m3: 18,
        backfill_friction_angle_deg: 32,
        base_width_m: 3.5,
        total_vertical_load_kn_per_m: 320,
        stabilizing_moment_knm_per_m: 430,
        base_friction_coeff: 0.55,
        allowable_bearing_kpa: 260,
      },
    },
    {
      route: '/geotech/settlement/consolidation',
      rustPath: '/api/design/geotech/settlement/consolidation',
      payload: {
        layer_thickness_m: 4,
        initial_void_ratio: 0.9,
        compression_index: 0.28,
        initial_effective_stress_kpa: 100,
        stress_increment_kpa: 60,
        drainage_path_m: 2,
        cv_m2_per_year: 1.2,
        time_years: 2,
      },
    },
    {
      route: '/geotech/liquefaction/screening',
      rustPath: '/api/design/geotech/liquefaction/screening',
      payload: {
        pga_g: 0.2,
        depth_m: 7,
        total_stress_kpa: 130,
        effective_stress_kpa: 75,
        n1_60cs: 16,
      },
    },
    {
      route: '/geotech/foundation/pile-axial-capacity',
      rustPath: '/api/design/geotech/foundation/pile-axial-capacity',
      payload: {
        diameter_m: 0.6,
        length_m: 18,
        unit_skin_friction_kpa: 55,
        unit_end_bearing_kpa: 1800,
        applied_load_kn: 900,
      },
    },
    {
      route: '/geotech/earth-pressure/rankine',
      rustPath: '/api/design/geotech/earth-pressure/rankine',
      payload: {
        friction_angle_deg: 30,
        unit_weight_kn_m3: 18,
        retained_height_m: 5,
      },
    },
    {
      route: '/geotech/earth-pressure/seismic',
      rustPath: '/api/design/geotech/earth-pressure/seismic',
      payload: {
        unit_weight_kn_m3: 18,
        retained_height_m: 6,
        kh: 0.15,
        static_active_thrust_kn_per_m: 120,
      },
    },
  ] as const;

  it.each(geotechCases)('forwards $route payload to Rust backend', async ({ route, rustPath, payload }) => {
    const app = makeApp();
    const response = await request(app).post(`/api/design${route}`).send(payload);

    expect(response.body.success).toBe(true);
    expect(response.body.engine).toBe('rust');
    expect(rustProxyMock).toHaveBeenCalledWith(
      'POST',
      rustPath,
      payload,
      undefined,
      30000,
      undefined,
    );
    expect(pythonProxyMock).not.toHaveBeenCalled();
  });

  const invalidPayloadCases = [
    { route: '/geotech/spt-correlation', payload: { n60: -1 } },
    {
      route: '/geotech/slope/infinite',
      payload: {
        slope_angle_deg: 91,
        friction_angle_deg: 34,
        cohesion_kpa: 8,
        unit_weight_kn_m3: 19,
        depth_m: 2.5,
      },
    },
    {
      route: '/geotech/foundation/bearing-capacity',
      payload: {
        cohesion_kpa: 0,
        friction_angle_deg: 32,
        unit_weight_kn_m3: 18,
        footing_width_m: 0,
        embedment_depth_m: 1.5,
        applied_pressure_kpa: 220,
      },
    },
    {
      route: '/geotech/retaining-wall/stability',
      payload: {
        wall_height_m: 5,
        backfill_unit_weight_kn_m3: 18,
        backfill_friction_angle_deg: 32,
        base_width_m: 3.5,
        total_vertical_load_kn_per_m: 320,
        stabilizing_moment_knm_per_m: 430,
        base_friction_coeff: 0.55,
        allowable_bearing_kpa: -10,
      },
    },
    {
      route: '/geotech/settlement/consolidation',
      payload: {
        layer_thickness_m: 4,
        initial_void_ratio: 0.9,
        compression_index: 0.28,
        initial_effective_stress_kpa: 100,
        stress_increment_kpa: 0,
        drainage_path_m: 2,
        cv_m2_per_year: 1.2,
        time_years: 2,
      },
    },
    {
      route: '/geotech/liquefaction/screening',
      payload: {
        pga_g: 0.2,
        depth_m: 7,
        total_stress_kpa: 60,
        effective_stress_kpa: 90,
        n1_60cs: 16,
      },
    },
    {
      route: '/geotech/foundation/pile-axial-capacity',
      payload: {
        diameter_m: 0,
        length_m: 18,
        unit_skin_friction_kpa: 55,
        unit_end_bearing_kpa: 1800,
        applied_load_kn: 900,
      },
    },
    {
      route: '/geotech/earth-pressure/rankine',
      payload: {
        friction_angle_deg: 0,
        unit_weight_kn_m3: 18,
        retained_height_m: 5,
      },
    },
    {
      route: '/geotech/earth-pressure/seismic',
      payload: {
        unit_weight_kn_m3: 18,
        retained_height_m: 6,
        kh: 0.9,
        static_active_thrust_kn_per_m: 120,
      },
    },
  ] as const;

  it.each(invalidPayloadCases)(
    'rejects invalid payload for $route with 400 and does not call backend',
    async ({ route, payload }) => {
      const app = makeApp();
      const response = await request(app).post(`/api/design${route}`).send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(rustProxyMock).not.toHaveBeenCalled();
      expect(pythonProxyMock).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid geotech payload with 400 and does not call backend', async () => {
    const app = makeApp();
    const response = await request(app)
      .post('/api/design/geotech/spt-correlation')
      .send({ n60: -1 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(rustProxyMock).not.toHaveBeenCalled();
  });

  it('returns backend error status when Rust service fails and no Python fallback is configured', async () => {
    rustProxyMock.mockResolvedValueOnce({
      success: false,
      status: 503,
      error: 'rust unavailable',
      service: 'rust',
      latencyMs: 3,
    });

    const app = makeApp();
    const response = await request(app)
      .post('/api/design/geotech/foundation/pile-axial-capacity')
      .send({
        diameter_m: 0.6,
        length_m: 18,
        unit_skin_friction_kpa: 55,
        unit_end_bearing_kpa: 1800,
        applied_load_kn: 900,
      });

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('rust unavailable');
    expect(pythonProxyMock).not.toHaveBeenCalled();
  });

  it('wraps successful backend payload in gateway envelope with engine marker', async () => {
    rustProxyMock.mockResolvedValueOnce({
      success: true,
      status: 200,
      data: {
        success: true,
        result: {
          passed: true,
          utilization: 0.37,
          message: 'rankine complete',
        },
      },
      service: 'rust',
      latencyMs: 3,
    });

    const app = makeApp();
    const response = await request(app)
      .post('/api/design/geotech/earth-pressure/rankine')
      .send({
        friction_angle_deg: 30,
        unit_weight_kn_m3: 18,
        retained_height_m: 5,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      engine: 'rust',
      result: {
        success: true,
        result: {
          passed: true,
          utilization: 0.37,
          message: 'rankine complete',
        },
      },
    });
  });

  it('uses label-based fallback error text when backend error message is missing', async () => {
    rustProxyMock.mockResolvedValueOnce({
      success: false,
      status: 502,
      error: '',
      service: 'rust',
      latencyMs: 2,
    });

    const app = makeApp();
    const response = await request(app)
      .post('/api/design/geotech/foundation/bearing-capacity')
      .send({
        cohesion_kpa: 0,
        friction_angle_deg: 32,
        unit_weight_kn_m3: 18,
        footing_width_m: 2,
        embedment_depth_m: 1.5,
        applied_pressure_kpa: 220,
      });

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Geotech/BearingCapacity failed via rust');
  });

  it('never invokes python backend for geotech Rust-only routes', async () => {
    const app = makeApp();
    await request(app)
      .post('/api/design/geotech/earth-pressure/rankine')
      .send({ friction_angle_deg: 30, unit_weight_kn_m3: 18, retained_height_m: 5 });

    expect(pythonProxyMock).not.toHaveBeenCalled();
  });
});
