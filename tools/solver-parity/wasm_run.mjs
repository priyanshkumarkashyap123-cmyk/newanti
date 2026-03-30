import fs from 'fs/promises';
import path from 'path';
import url from 'url';

// Simple WASM parity runner that compares solver-wasm output against a JSON fixture
// Usage: node tools/solver-parity/wasm_run.mjs tests/solver-parity/fixtures/basic_frame.json

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

async function loadWasm() {
  const pkgPath = path.join(root, 'packages', 'solver-wasm', 'pkg', 'solver_wasm.js');
  const mod = await import(url.pathToFileURL(pkgPath));
  // Initialize wasm without fetch: use initSync with raw bytes to avoid network
  if (typeof mod.initSync === 'function') {
    const wasmPath = path.join(root, 'packages', 'solver-wasm', 'pkg', 'solver_wasm_bg.wasm');
    const wasmBytes = await fs.readFile(wasmPath);
    mod.initSync(wasmBytes);
  }
  return mod;
}

function to2dof(nodes, supports) {
  // solver-wasm uses 2D frame (dx, dy, rz) with fixed flags
  const supportMap = new Map();
  for (const s of supports || []) {
    const id = String(s.nodeId ?? s.node_id ?? s.id ?? '');
    if (!id) continue;
    supportMap.set(id, {
      fx: !!s.fx,
      fy: !!s.fy,
      rz: !!(s.mz ?? s.rz),
    });
  }

  return nodes.map((n) => {
    const idStr = String(n.id ?? n.nodeId ?? n.node_id);
    const sup = supportMap.get(idStr);
    const fixed = [false, false, false];
    if (sup) {
      fixed[0] = sup.fx;
      fixed[1] = sup.fy;
      fixed[2] = sup.rz;
    }
    return {
      id: Number(idStr),
      x: Number(n.x ?? 0),
      y: Number(n.y ?? 0),
      fixed,
    };
  });
}

function toElements(members) {
  return members.map((m, idx) => {
    // ids may be strings like "m1"; use idx fallback if not numeric
    const idRaw = m.id ?? m.elementId ?? m.element_id;
    const idNum = Number(idRaw);
    const id = Number.isFinite(idNum) ? idNum : idx;

    const node_start = Number(m.startNodeId ?? m.start_node_id ?? m.node_start ?? m.nodeStart ?? 0);
    const node_end = Number(m.endNodeId ?? m.end_node_id ?? m.node_end ?? m.nodeEnd ?? 1);
    if (!Number.isFinite(node_start) || !Number.isFinite(node_end)) {
      throw new Error(`Invalid element node identifiers: start=${node_start}, end=${node_end}`);
    }
    return {
      id,
      node_start,
      node_end,
      e: Number(m.E ?? m.e ?? 200e9),
      i: Number(m.I ?? m.i ?? m.Iy ?? m.Iz ?? 1e-4),
      a: Number(m.A ?? m.a ?? 0.01),
      g: null,
      j: null,
      alpha: null,
      releases: null,
    };
  });
}

function toLoads(loads) {
  return (loads || []).map((l) => {
    const node_id = Number(l.nodeId ?? l.node_id ?? l.node ?? 0);
    if (!Number.isFinite(node_id)) {
      throw new Error(`Invalid load node id: ${l.nodeId ?? l.node_id ?? l.node}`);
    }
    return {
      node_id,
      fx: Number(l.fx ?? 0),
      fy: Number(l.fy ?? 0),
      mz: Number(l.mz ?? l.my ?? 0),
    };
  });
}

async function runFixture(fixturePath) {
  const txt = await fs.readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(txt);
  const payload = fixture.payload || fixture;

  const nodes = to2dof(payload.nodes || [], payload.supports || []);
  const elements = toElements(payload.members || []);
  const loads = toLoads(payload.loads || []);

  const wasm = await loadWasm();
  if (typeof wasm.solve_structure_wasm !== 'function') {
    throw new Error('solve_structure_wasm is not exported from solver-wasm pkg; build the WASM pkg first.');
  }

  const result = wasm.solve_structure_wasm(nodes, elements, loads, []);
  const disp = result?.displacements || {};
  const maxDy = Math.max(
    ...Object.values(disp).map((d) => Math.abs(d?.fy ?? d?.dy ?? 0)),
    0,
  );
  console.log(`Fixture ${fixturePath}: success=${result?.success}, maxDy=${maxDy}`);
  if (Object.keys(disp).length) {
    console.log('Displacements:', JSON.stringify(disp, null, 2));
  }
  if (!result?.success) {
    console.log('Result payload:', JSON.stringify(result, null, 2));
  }
  return result;
}

async function main() {
  const fixtureArg = process.argv[2];
  if (!fixtureArg) {
    console.error('Usage: node tools/solver-parity/wasm_run.mjs <fixture.json>');
    process.exit(2);
  }
  await runFixture(fixtureArg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
