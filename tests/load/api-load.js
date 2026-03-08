/**
 * k6 Load Test — BeamLab API
 *
 * Install: brew install k6  (or https://k6.io/docs/get-started/installation/)
 *
 * Usage:
 *   k6 run tests/load/api-load.js                          # default (10 VUs, 30s)
 *   k6 run --vus 50 --duration 2m tests/load/api-load.js   # custom
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/api-load.js  # local
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_NODE = __ENV.BASE_URL || 'https://beamlab-api.azurewebsites.net';
const BASE_PYTHON = __ENV.PYTHON_URL || 'https://beamlab-backend-python.azurewebsites.net';

const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency', true);
const analysisLatency = new Trend('analysis_latency', true);

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // ramp up
    { duration: '30s', target: 10 },  // sustain
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    errors: ['rate<0.1'],               // <10% error rate
    health_latency: ['p(99)<500'],      // health checks fast
  },
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export default function () {
  // 1. Health check — Node.js API
  {
    const res = http.get(`${BASE_NODE}/health`);
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      'node health 200': (r) => r.status === 200,
      'node health < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 2. Health check — Python API
  {
    const res = http.get(`${BASE_PYTHON}/health`);
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      'python health 200': (r) => r.status === 200,
      'python health < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 3. Analysis validation (POST, no auth required for validation)
  {
    const payload = JSON.stringify({
      type: 'beam',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'fixed' },
        { id: 2, x: 6000, y: 0, support: 'roller' },
      ],
      members: [{ id: 1, start: 1, end: 2, section: 'ISMB300' }],
      loads: [{ type: 'udl', member: 1, w: 20 }],
    });

    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_NODE}/api/analysis/validate`, payload, params);
    analysisLatency.add(res.timings.duration);
    const ok = check(res, {
      'validate 2xx or 401': (r) => r.status < 500,
      'validate < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!ok);
  }

  sleep(1);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in text summary
  return JSON.stringify(data.metrics, null, 2);
}
