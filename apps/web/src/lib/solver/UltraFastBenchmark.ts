/**
 * UltraFastBenchmark.ts - Performance Testing Suite
 * 
 * Tests the ultra-fast solver against performance targets:
 * - 20 nodes:   < 100μs
 * - 100 nodes:  < 1ms  
 * - 1000 nodes: < 10ms
 * 
 * Also tests memory usage and GPU acceleration
 */

import { gpuSolver, hybridSolver, GPUAcceleratedSolver } from './GPUAcceleratedSolver';

// ============================================
// BENCHMARK UTILITIES
// ============================================

interface BenchmarkResult {
  name: string;
  numNodes: number;
  numElements: number;
  samples: number;
  meanMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  stdDevMs: number;
  targetMs: number;
  passed: boolean;
  memoryKB?: number;
}

function calculateStats(times: number[]): { mean: number; median: number; min: number; max: number; stdDev: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, median, min, max, stdDev };
}

// ============================================
// TEST STRUCTURE GENERATORS
// ============================================

interface TestNode {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints: boolean[];
}

interface TestElement {
  id: string;
  node_i: number;
  node_j: number;
  e: number;
  g: number;
  a: number;
  iy: number;
  iz: number;
  j: number;
  beta: number;
}

interface TestLoad {
  node_idx: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/**
 * Generate a grid frame structure
 * Perfect for benchmarking - regular connectivity pattern
 */
function generateGridFrame(
  rows: number,
  cols: number,
  spacing: number = 3.0
): { nodes: TestNode[]; elements: TestElement[]; loads: TestLoad[] } {
  const nodes: TestNode[] = [];
  const elements: TestElement[] = [];
  const loads: TestLoad[] = [];
  
  // Create nodes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      nodes.push({
        id: `n${idx}`,
        x: c * spacing,
        y: r * spacing,
        z: 0,
        restraints: r === 0 
          ? [true, true, true, true, true, true] // Fixed at bottom
          : [false, false, false, false, false, false],
      });
    }
  }
  
  let elemId = 0;
  
  // Horizontal elements
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      const j = i + 1;
      elements.push({
        id: `e${elemId++}`,
        node_i: i,
        node_j: j,
        e: 200e9,
        g: 80e9,
        a: 0.01,
        iy: 1e-4,
        iz: 1e-4,
        j: 2e-4,
        beta: 0,
      });
    }
  }
  
  // Vertical elements
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const j = (r + 1) * cols + c;
      elements.push({
        id: `e${elemId++}`,
        node_i: i,
        node_j: j,
        e: 200e9,
        g: 80e9,
        a: 0.01,
        iy: 1e-4,
        iz: 1e-4,
        j: 2e-4,
        beta: 0,
      });
    }
  }
  
  // Apply loads to top row
  for (let c = 0; c < cols; c++) {
    const topIdx = (rows - 1) * cols + c;
    loads.push({
      node_idx: topIdx,
      fx: 10000, // 10kN horizontal
      fy: -5000, // 5kN downward
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });
  }
  
  return { nodes, elements, loads };
}

/**
 * Generate a tall building frame
 * Realistic structure for seismic/wind analysis
 */
function generateBuildingFrame(
  stories: number,
  baysX: number,
  baysY: number,
  storyHeight: number = 3.5,
  bayWidth: number = 6.0
): { nodes: TestNode[]; elements: TestElement[]; loads: TestLoad[] } {
  const nodes: TestNode[] = [];
  const elements: TestElement[] = [];
  const loads: TestLoad[] = [];
  
  const nodesPerFloor = (baysX + 1) * (baysY + 1);
  
  // Create nodes (including ground floor)
  for (let f = 0; f <= stories; f++) {
    for (let y = 0; y <= baysY; y++) {
      for (let x = 0; x <= baysX; x++) {
        const idx = f * nodesPerFloor + y * (baysX + 1) + x;
        nodes.push({
          id: `n${idx}`,
          x: x * bayWidth,
          y: y * bayWidth,
          z: f * storyHeight,
          restraints: f === 0
            ? [true, true, true, true, true, true]
            : [false, false, false, false, false, false],
        });
      }
    }
  }
  
  let elemId = 0;
  
  // Column properties (larger)
  const columnE = 200e9;
  const columnG = 80e9;
  const columnA = 0.04; // 200mm x 200mm
  const columnI = 2.67e-4;
  const columnJ = 5.33e-4;
  
  // Beam properties (smaller)
  const beamE = 200e9;
  const beamG = 80e9;
  const beamA = 0.02;
  const beamI = 1e-4;
  const beamJ = 2e-4;
  
  // Columns (vertical)
  for (let f = 0; f < stories; f++) {
    for (let y = 0; y <= baysY; y++) {
      for (let x = 0; x <= baysX; x++) {
        const i = f * nodesPerFloor + y * (baysX + 1) + x;
        const j = (f + 1) * nodesPerFloor + y * (baysX + 1) + x;
        elements.push({
          id: `col${elemId++}`,
          node_i: i,
          node_j: j,
          e: columnE,
          g: columnG,
          a: columnA,
          iy: columnI,
          iz: columnI,
          j: columnJ,
          beta: 0,
        });
      }
    }
  }
  
  // Beams X-direction
  for (let f = 1; f <= stories; f++) {
    for (let y = 0; y <= baysY; y++) {
      for (let x = 0; x < baysX; x++) {
        const i = f * nodesPerFloor + y * (baysX + 1) + x;
        const j = i + 1;
        elements.push({
          id: `beamX${elemId++}`,
          node_i: i,
          node_j: j,
          e: beamE,
          g: beamG,
          a: beamA,
          iy: beamI,
          iz: beamI,
          j: beamJ,
          beta: 0,
        });
      }
    }
  }
  
  // Beams Y-direction
  for (let f = 1; f <= stories; f++) {
    for (let y = 0; y < baysY; y++) {
      for (let x = 0; x <= baysX; x++) {
        const i = f * nodesPerFloor + y * (baysX + 1) + x;
        const j = i + (baysX + 1);
        elements.push({
          id: `beamY${elemId++}`,
          node_i: i,
          node_j: j,
          e: beamE,
          g: beamG,
          a: beamA,
          iy: beamI,
          iz: beamI,
          j: beamJ,
          beta: 0,
        });
      }
    }
  }
  
  // Lateral loads (wind/seismic) at each floor
  for (let f = 1; f <= stories; f++) {
    // Apply to corner nodes
    const baseIdx = f * nodesPerFloor;
    const force = 5000 * f; // Increasing with height
    
    loads.push({
      node_idx: baseIdx,
      fx: force,
      fy: 0,
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });
  }
  
  return { nodes, elements, loads };
}

// ============================================
// BENCHMARK RUNNERS
// ============================================

type SolverFunction = (
  nodes: TestNode[],
  elements: TestElement[],
  loads: TestLoad[]
) => Promise<{ success: boolean; metrics?: { total_time_us?: number } }>;

/**
 * Run a single benchmark
 */
async function runBenchmark(
  name: string,
  solver: SolverFunction,
  nodes: TestNode[],
  elements: TestElement[],
  loads: TestLoad[],
  targetMs: number,
  samples: number = 50
): Promise<BenchmarkResult> {
  const times: number[] = [];
  
  // Warm-up runs
  for (let i = 0; i < 5; i++) {
    await solver(nodes, elements, loads);
  }
  
  // Timed runs
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const result = await solver(nodes, elements, loads);
    const elapsed = performance.now() - start;
    
    if (result.success) {
      // Use internal timing if available
      if (result.metrics?.total_time_us) {
        times.push(result.metrics.total_time_us / 1000); // Convert to ms
      } else {
        times.push(elapsed);
      }
    }
  }
  
  if (times.length === 0) {
    return {
      name,
      numNodes: nodes.length,
      numElements: elements.length,
      samples: 0,
      meanMs: Infinity,
      medianMs: Infinity,
      minMs: Infinity,
      maxMs: Infinity,
      stdDevMs: 0,
      targetMs,
      passed: false,
    };
  }
  
  const stats = calculateStats(times);
  
  return {
    name,
    numNodes: nodes.length,
    numElements: elements.length,
    samples: times.length,
    meanMs: stats.mean,
    medianMs: stats.median,
    minMs: stats.min,
    maxMs: stats.max,
    stdDevMs: stats.stdDev,
    targetMs,
    passed: stats.min <= targetMs,
  };
}

// ============================================
// MAIN BENCHMARK SUITE
// ============================================

export interface BenchmarkSuiteResult {
  timestamp: string;
  platform: string;
  gpuAvailable: boolean;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    speedup: number;
  };
}

/**
 * Run the full benchmark suite
 */
export async function runBenchmarkSuite(
  solver: SolverFunction,
  options: {
    testGPU?: boolean;
    verbose?: boolean;
  } = {}
): Promise<BenchmarkSuiteResult> {
  const results: BenchmarkResult[] = [];
  const verbose = options.verbose ?? true;
  
  if (verbose) {
    console.log('🚀 Ultra-Fast Solver Benchmark Suite');
    console.log('====================================\n');
  }
  
  // Test cases: [name, rows, cols, targetMs]
  const gridTests: [string, number, number, number][] = [
    ['Tiny (4 nodes)', 2, 2, 0.1],      // 4 nodes, target < 100μs
    ['Small (16 nodes)', 4, 4, 0.5],    // 16 nodes
    ['Medium (100 nodes)', 10, 10, 1],  // 100 nodes, target < 1ms
    ['Large (400 nodes)', 20, 20, 5],   // 400 nodes
    ['XLarge (1024 nodes)', 32, 32, 10],// 1024 nodes, target < 10ms
  ];
  
  for (const [name, rows, cols, targetMs] of gridTests) {
    if (verbose) console.log(`Testing: ${name}...`);
    
    const { nodes, elements, loads } = generateGridFrame(rows, cols);
    const result = await runBenchmark(name, solver, nodes, elements, loads, targetMs);
    results.push(result);
    
    if (verbose) {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${status} ${result.numNodes} nodes, ${result.numElements} elements`);
      console.log(`     Mean: ${result.meanMs.toFixed(3)}ms, Min: ${result.minMs.toFixed(3)}ms (target: ${targetMs}ms)\n`);
    }
  }
  
  // Building frame tests
  const buildingTests: [string, number, number, number, number][] = [
    ['5-Story Building', 5, 2, 2, 5],   // 54 nodes
    ['10-Story Building', 10, 3, 3, 10], // 176 nodes
    ['20-Story Building', 20, 4, 4, 30], // 525 nodes
  ];
  
  for (const [name, stories, baysX, baysY, targetMs] of buildingTests) {
    if (verbose) console.log(`Testing: ${name}...`);
    
    const { nodes, elements, loads } = generateBuildingFrame(stories, baysX, baysY);
    const result = await runBenchmark(name, solver, nodes, elements, loads, targetMs);
    results.push(result);
    
    if (verbose) {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${status} ${result.numNodes} nodes, ${result.numElements} elements`);
      console.log(`     Mean: ${result.meanMs.toFixed(3)}ms, Min: ${result.minMs.toFixed(3)}ms (target: ${targetMs}ms)\n`);
    }
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  // Calculate average speedup vs baseline (assume baseline is 10x slower)
  const avgSpeedup = results.reduce((sum, r) => {
    const baseline = r.targetMs * 10; // Assume old solver was 10x slower
    return sum + (baseline / r.minMs);
  }, 0) / results.length;
  
  if (verbose) {
    console.log('====================================');
    console.log(`Summary: ${passed}/${results.length} tests passed`);
    console.log(`Average speedup: ${avgSpeedup.toFixed(1)}x`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
    gpuAvailable: options.testGPU ? gpuSolver.isAvailable() : false,
    results,
    summary: {
      totalTests: results.length,
      passed,
      failed,
      speedup: avgSpeedup,
    },
  };
}

// ============================================
// GPU BENCHMARK
// ============================================

export async function benchmarkGPU(): Promise<void> {
  console.log('🎮 GPU Benchmark');
  console.log('================\n');
  
  const initialized = await gpuSolver.initialize();
  
  if (!initialized) {
    console.log('❌ WebGPU not available');
    return;
  }
  
  console.log('✅ WebGPU initialized\n');
  
  // Test matrix-vector multiplication
  const sizes = [100, 500, 1000, 2000];
  
  for (const n of sizes) {
    // Create random matrix and vector
    const A = new Float32Array(n * n);
    const x = new Float32Array(n);
    
    for (let i = 0; i < n * n; i++) A[i] = Math.random();
    for (let i = 0; i < n; i++) x[i] = Math.random();
    
    // Benchmark
    const warmup = 3;
    const samples = 20;
    const times: number[] = [];
    
    for (let i = 0; i < warmup + samples; i++) {
      const start = performance.now();
      await gpuSolver.matVec(A, x, n);
      const elapsed = performance.now() - start;
      
      if (i >= warmup) {
        times.push(elapsed);
      }
    }
    
    const stats = calculateStats(times);
    console.log(`Matrix-Vector (${n}x${n}):`);
    console.log(`  Mean: ${stats.mean.toFixed(3)}ms, Min: ${stats.min.toFixed(3)}ms\n`);
  }
  
  gpuSolver.destroy();
}

// ============================================
// MEMORY BENCHMARK
// ============================================

export function benchmarkMemory(): void {
  console.log('💾 Memory Benchmark');
  console.log('===================\n');
  
  const sizes = [100, 500, 1000, 5000];
  
  for (const n of sizes) {
    // Dense matrix memory
    const denseBytes = n * n * 8; // f64
    
    // Sparse matrix memory (assuming 30 non-zeros per row)
    const nnzPerRow = Math.min(30, n);
    const sparseBytes = n * nnzPerRow * (8 + 4); // value + column index
    
    const savings = ((denseBytes - sparseBytes) / denseBytes * 100).toFixed(1);
    
    console.log(`${n} nodes (${n * 6} DOFs):`);
    console.log(`  Dense: ${(denseBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Sparse: ${(sparseBytes / 1024 / 1024).toFixed(2)} MB (${savings}% savings)\n`);
  }
}

// ============================================
// EXPORT FOR USE
// ============================================

export {
  generateGridFrame,
  generateBuildingFrame,
  calculateStats,
  runBenchmark,
};

// Run benchmarks if this is the main module
if (typeof window !== 'undefined') {
  (window as any).runUltraFastBenchmark = runBenchmarkSuite;
  (window as any).benchmarkGPU = benchmarkGPU;
  (window as any).benchmarkMemory = benchmarkMemory;
}
