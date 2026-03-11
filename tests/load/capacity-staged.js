/**
 * BeamLab staged capacity test (k6)
 *
 * Purpose:
 * - Measure maximum concurrent analysis pressure that still satisfies SLO.
 * - Produce machine-readable summary JSON using --summary-export.
 *
 * Profiles:
 *   PROFILE=health   -> health-only baseline
 *   PROFILE=w1       -> low analysis pressure
 *   PROFILE=w2       -> medium analysis pressure
 *   PROFILE=w3       -> burst analysis pressure
 *
 * Required env for analysis profiles:
 *   ENABLE_ANALYSIS=true
 *   AUTH_TOKEN=<bearer token>
 *
 * Optional env:
 *   BASE_URL=https://beamlab-backend-node.azurewebsites.net
 *   NORMAL_SLO_MS=300
 *   ANALYSIS_SLO_MS=3000
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://beamlab-backend-node.azurewebsites.net';
const PROFILE = (__ENV.PROFILE || 'health').toLowerCase();
const ENABLE_ANALYSIS = (__ENV.ENABLE_ANALYSIS || 'false').toLowerCase() === 'true';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const NORMAL_SLO_MS = Number(__ENV.NORMAL_SLO_MS || 300);
const ANALYSIS_SLO_MS = Number(__ENV.ANALYSIS_SLO_MS || 3000);

const errors = new Rate('errors');
const analysisErrors = new Rate('analysis_errors');
const analysis429 = new Rate('analysis_429');
const analysis5xx = new Rate('analysis_5xx');
const normalLatency = new Trend('normal_latency', true);
const analysisLatency = new Trend('analysis_latency', true);

function scenarioForProfile(profile) {
  switch (profile) {
    case 'w1':
      return {
        analysis_w1: {
          executor: 'constant-arrival-rate',
          duration: '3m',
          rate: 2,
          timeUnit: '1s',
          preAllocatedVUs: 20,
          maxVUs: 60,
          exec: 'analysisScenario',
          tags: { stage: 'w1' },
        },
      };
    case 'w2':
      return {
        analysis_w2: {
          executor: 'constant-arrival-rate',
          duration: '3m',
          rate: 5,
          timeUnit: '1s',
          preAllocatedVUs: 50,
          maxVUs: 120,
          exec: 'analysisScenario',
          tags: { stage: 'w2' },
        },
      };
    case 'w3':
      return {
        analysis_w3: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 60,
          maxVUs: 180,
          stages: [
            { target: 5, duration: '1m' },
            { target: 10, duration: '1m' },
            { target: 15, duration: '1m' },
            { target: 20, duration: '1m' },
          ],
          exec: 'analysisScenario',
          tags: { stage: 'w3' },
        },
      };
    case 'w4':
      // Endurance test: sustained medium load for 10 minutes to surface memory
      // leaks, connection pool exhaustion, and cumulative degradation.
      return {
        analysis_w4: {
          executor: 'constant-arrival-rate',
          duration: '10m',
          rate: 3,
          timeUnit: '1s',
          preAllocatedVUs: 30,
          maxVUs: 80,
          exec: 'analysisScenario',
          tags: { stage: 'w4' },
        },
        health_sidecar: {
          executor: 'constant-vus',
          vus: 2,
          duration: '10m',
          exec: 'healthScenario',
          tags: { stage: 'w4_health' },
        },
      };
    case 'health':
    default:
      return {
        health_probe: {
          executor: 'constant-vus',
          vus: 10,
          duration: '2m',
          exec: 'healthScenario',
          tags: { stage: 'health' },
        },
      };
  }
}

export const options = {
  scenarios: scenarioForProfile(PROFILE),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    analysis_errors: ['rate<0.01'],
    analysis_429: ['rate<0.05'],
    analysis_5xx: ['rate<0.01'],
    normal_latency: [`p(95)<${NORMAL_SLO_MS}`],
    analysis_latency: [`p(95)<${ANALYSIS_SLO_MS}`],
  },
};

function buildModelPayload() {
  return {
    nodes: [
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true } },
      { id: 'n2', x: 6000, y: 0, z: 0, restraints: { fx: false, fy: true, fz: true } },
    ],
    members: [
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200000, A: 3500, I: 8.6e7 },
    ],
    loads: [
      { nodeId: 'n2', fy: -25 },
    ],
    dofPerNode: 6,
    options: { method: 'spsolve' },
  };
}

export function setup() {
  if ((PROFILE === 'w1' || PROFILE === 'w2' || PROFILE === 'w3') && !ENABLE_ANALYSIS) {
    throw new Error('Analysis profile selected but ENABLE_ANALYSIS is not true. Set --env ENABLE_ANALYSIS=true.');
  }

  if (ENABLE_ANALYSIS && !AUTH_TOKEN) {
    throw new Error('ENABLE_ANALYSIS=true requires AUTH_TOKEN. Set --env AUTH_TOKEN=<token>.');
  }

  return { payload: JSON.stringify(buildModelPayload()) };
}

export function healthScenario() {
  const res = http.get(`${BASE_URL}/health`);
  normalLatency.add(res.timings.duration);

  const ok = check(res, {
    'health: status 200': (r) => r.status === 200,
    [`health: p95 target < ${NORMAL_SLO_MS}ms`]: (r) => r.timings.duration < NORMAL_SLO_MS,
  });

  errors.add(!ok);
  sleep(0.25);
}

export function analysisScenario(data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  const res = http.post(`${BASE_URL}/api/analysis`, data.payload, { headers });
  analysisLatency.add(res.timings.duration);

  const ok = check(res, {
    'analysis: status < 500': (r) => r.status < 500,
  });

  errors.add(!ok);
  analysisErrors.add(!ok);
  analysis429.add(res.status === 429);
  analysis5xx.add(res.status >= 500);

  sleep(0.1);
}
