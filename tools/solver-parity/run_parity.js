const fs = require('fs').promises;
const path = require('path');

// Ensure fetch is available (Node 18+). Try node-fetch fallback if not present.
if (typeof globalThis.fetch === 'undefined') {
  try {
    const fetchFn = require('node-fetch');
    globalThis.fetch = fetchFn;
    globalThis.Headers = fetchFn.Headers;
    globalThis.Request = fetchFn.Request;
    globalThis.Response = fetchFn.Response;
  } catch (e) {
    console.error('Global fetch is not available and node-fetch is not installed. Use Node 18+ or install node-fetch.');
    process.exit(1);
  }
}

const RUST_URL = (process.env.RUST_API_URL || 'http://localhost:3002').replace(/\/+$/,'');
const PYTHON_URL = (process.env.PYTHON_API_URL || 'http://localhost:8000').replace(/\/+$/,'');

async function doPost(url, payload, timeoutMs = 120000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = controller ? controller.signal : undefined;
  if (controller) setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON from ${url}: ${text}`); }
  return { status: res.status, body: json };
}

function normalizeRustResponse(data) {
  const top = data && data.result ? data.result : data;
  const displacements = {};
  if (Array.isArray(top.displacements)) {
    for (const d of top.displacements) {
      const id = String(d.nodeId ?? d.node_id ?? d.node ?? d.id);
      displacements[id] = { dx: d.dx ?? 0, dy: d.dy ?? 0, dz: d.dz ?? 0, rx: d.rx ?? 0, ry: d.ry ?? 0, rz: d.rz ?? 0 };
    }
  } else if (top.displacements && typeof top.displacements === 'object') {
    for (const [k, v] of Object.entries(top.displacements)) {
      displacements[String(k)] = v;
    }
  }
  return { displacements, raw: top };
}

function normalizePythonResponse(data) {
  const top = data || {};
  const displacements = {};
  if (top.displacements && typeof top.displacements === 'object') {
    for (const [k, v] of Object.entries(top.displacements)) {
      displacements[String(k)] = v;
    }
  } else if (top.result && top.result.displacements) {
    for (const [k, v] of Object.entries(top.result.displacements)) {
      displacements[String(k)] = v;
    }
  }
  return { displacements, raw: top };
}

function computeMaxDeltaMM(pyDisp, rsDisp) {
  let maxDelta = 0;
  const nodes = Object.keys(pyDisp);
  for (const node of nodes) {
    if (!rsDisp[node]) continue;
    const p = pyDisp[node] || {};
    const r = rsDisp[node] || {};
    for (const key of ['dx','dy','dz']) {
      const pv = Number(p[key] ?? p[key.toUpperCase?.()] ?? 0) || 0;
      const rv = Number(r[key] ?? r[key.toUpperCase?.()] ?? 0) || 0;
      const deltaMM = Math.abs((pv - rv) * 1000.0);
      if (deltaMM > maxDelta) maxDelta = deltaMM;
    }
  }
  return maxDelta;
}

async function runFixture(fixturePath) {
  const txt = await fs.readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(txt);
  const payload = fixture.payload || fixture;
  const tolerance = fixture.tolerance_mm ?? 0.5;
  const name = fixture.name || path.basename(fixturePath);
  console.log(`\n=== Running fixture: ${name} (${fixturePath})`);

  const rustEndpoint = `${RUST_URL}/api/analyze`;
  const pythonEndpoint = `${PYTHON_URL}/analyze/large-frame`;

  try {
    const [rRust, rPy] = await Promise.allSettled([
      doPost(rustEndpoint, payload),
      doPost(pythonEndpoint, { nodes: payload.nodes, members: payload.members, node_loads: payload.loads || [], backend: 'python', debug_compare: false }),
    ]);

    if (rRust.status === 'rejected') {
      console.error(`Rust request failed: ${rRust.reason}`);
      return { fixture: name, ok: false, reason: 'rust_failed' };
    }
    if (rPy.status === 'rejected') {
      console.error(`Python request failed: ${rPy.reason}`);
      return { fixture: name, ok: false, reason: 'python_failed' };
    }

    const rustJson = rRust.value.body;
    const pyJson = rPy.value.body;
    const rnorm = normalizeRustResponse(rustJson);
    const pnorm = normalizePythonResponse(pyJson);
    const maxDelta = computeMaxDeltaMM(pnorm.displacements, rnorm.displacements);
    const ok = maxDelta <= tolerance;
    console.log(`  Rust status: ${rRust.value.status}, Python status: ${rPy.value.status}`);
    console.log(`  Nodes compared: ${Object.keys(pnorm.displacements).length} Python, ${Object.keys(rnorm.displacements).length} Rust`);
    console.log(`  Max displacement delta: ${maxDelta.toFixed(4)} mm (tolerance ${tolerance} mm) -> ${ok ? 'PASS' : 'FAIL'}`);
    return { fixture: name, ok, maxDelta, tolerance, rust: rnorm.raw, python: pnorm.raw };
  } catch (e) {
    console.error(`Error running fixture ${name}:`, e);
    return { fixture: name, ok: false, reason: e.message };
  }
}

async function main() {
  const fixturesDir = process.argv[2] || 'tests/solver-parity/fixtures';
  let files;
  try { files = await fs.readdir(fixturesDir); } catch (e) { console.error('Could not read fixtures directory:', fixturesDir, e); process.exit(1); }
  const jsons = files.filter(f => f.endsWith('.json'));
  if (jsons.length === 0) {
    console.log('No fixtures found in', fixturesDir);
    process.exit(1);
  }
  let anyFail = false;
  for (const f of jsons) {
    const res = await runFixture(path.join(fixturesDir, f));
    if (!res.ok) anyFail = true;
  }
  if (anyFail) {
    console.error('\nParity run: FAIL (one or more fixtures exceeded tolerance)');
    process.exit(2);
  } else {
    console.log('\nParity run: SUCCESS (all fixtures within tolerance)');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(3); });
