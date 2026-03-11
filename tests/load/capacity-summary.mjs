#!/usr/bin/env node

/**
 * Capacity summary parser for k6 --summary-export output.
 *
 * Usage:
 *   node tests/load/capacity-summary.mjs ./k6-summary.json
 *   node tests/load/capacity-summary.mjs ./k6-summary.json --concurrency 120
 */

import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] || './k6-summary.json';
const argConcurrencyIndex = process.argv.indexOf('--concurrency');
const manualConcurrency =
  argConcurrencyIndex > -1 ? Number(process.argv[argConcurrencyIndex + 1]) : undefined;

if (!fs.existsSync(inputPath)) {
  console.error(`❌ Summary file not found: ${path.resolve(inputPath)}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const summary = JSON.parse(raw);
const metrics = summary.metrics || {};

function metric(pathName, fallback = 0) {
  const m = metrics[pathName];
  if (!m || !m.values) return fallback;
  return m.values;
}

const duration = metric('http_req_duration');
const httpFailed = metric('http_req_failed').rate ?? 0;
const analysis429 = metric('analysis_429').rate ?? 0;
const analysis5xx = metric('analysis_5xx').rate ?? 0;
const httpReqCount = metric('http_reqs').count ?? 0;
const vusMax = metric('vus_max').value ?? 0;
const iterations = metric('iterations').count ?? 0;

const measuredConcurrency = Number.isFinite(manualConcurrency)
  ? manualConcurrency
  : Math.max(vusMax, Math.round(iterations / 3));

const p95 = duration['p(95)'] ?? duration.p95 ?? 0;

const sloPass = p95 <= 3000 && httpFailed < 0.01 && analysis5xx < 0.01 && analysis429 < 0.05;

const safe = Math.max(1, Math.floor(measuredConcurrency * 0.7));
const stretch = Math.max(safe, Math.floor(measuredConcurrency * 0.85));
const burst = measuredConcurrency;

const report = {
  inputFile: path.resolve(inputPath),
  measured: {
    p95_ms: p95,
    http_failed_rate: httpFailed,
    analysis_429_rate: analysis429,
    analysis_5xx_rate: analysis5xx,
    http_requests: httpReqCount,
    vus_max: vusMax,
    iterations,
    inferred_concurrency: measuredConcurrency,
  },
  classification: {
    slo_pass: sloPass,
    reason: sloPass
      ? 'SLO and error budget satisfied.'
      : 'SLO or error budget violated; reduce concurrency or scale bottleneck service.',
  },
  capacity_recommendation: {
    safe_concurrent_analysis_jobs: safe,
    stretch_concurrent_analysis_jobs: stretch,
    burst_concurrent_analysis_jobs: burst,
  },
  assumptions: [
    'Concurrency inferred from vus_max (or explicit --concurrency).',
    'SLO target: P95 analysis latency <= 3000ms.',
    'Error budget: http_failed <1%, 5xx <1%, 429 <5%.',
  ],
};

console.log('=== BeamLab Capacity Summary ===');
console.log(JSON.stringify(report, null, 2));
