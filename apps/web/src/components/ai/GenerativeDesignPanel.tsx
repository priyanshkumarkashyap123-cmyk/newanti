/**
 * GenerativeDesignPanel.tsx
 *
 * Non-blocking topology optimization UI with live iteration preview,
 * cancel support, and safe grid-size caps.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  TopologyOptimizer,
  createCantileverOptimizer,
  createMBBBeamOptimizer,
  OptimizationResult,
  BoundaryCondition,
  LoadCondition,
  OptimizationDomain,
} from "../../modules/optimization/TopologyOptimizer";

// ============================================
// CONSTANTS
// ============================================

const MAX_NELX = 40;
const MAX_NELY = 20;
const DEFAULT_NELX = 20;
const DEFAULT_NELY = 10;

interface GenerativeDesignPanelProps {
  onDesignComplete?: (result: OptimizationResult) => void;
  initialConfig?: { width: number; height: number; volumeFraction: number };
}

interface DesignCase {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const DESIGN_CASES: DesignCase[] = [
  {
    id: "cantilever",
    name: "Cantilever",
    description: "Fixed left, loaded right",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect
          x="2"
          y="6"
          width="3"
          height="16"
          rx="1"
          fill="currentColor"
          opacity="0.5"
        />
        <rect x="5" y="12" width="18" height="4" rx="1" fill="currentColor" />
        <path
          d="M23 16 L27 20 M23 16 L19 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "mbb",
    name: "MBB Beam",
    description: "Simply supported, center load",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="10" width="22" height="4" rx="1" fill="currentColor" />
        <polygon points="4,16 2,20 6,20" fill="currentColor" opacity="0.5" />
        <polygon points="24,16 22,20 26,20" fill="currentColor" opacity="0.5" />
        <path
          d="M14 10 L14 6 M12 6 L16 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "lbracket",
    name: "L-Bracket",
    description: "Fixed top, loaded side",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          d="M6 4 L6 22 L20 22"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="2"
          y="2"
          width="8"
          height="3"
          rx="1"
          fill="currentColor"
          opacity="0.3"
        />
      </svg>
    ),
  },
  {
    id: "custom",
    name: "Custom",
    description: "Define your own",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect
          x="4"
          y="4"
          width="20"
          height="20"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
];

// ============================================
// DENSITY CANVAS
// ============================================

const DensityCanvas: React.FC<{
  densities: number[][] | null;
  width: number;
  height: number;
}> = ({ densities, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!densities || !densities.length) {
      // Empty state grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (let x = 0; x < width; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      return;
    }

    const nely = densities.length;
    const nelx = densities[0].length;
    const cw = width / nelx;
    const ch = height / nely;

    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        const d = densities[j][i];
        if (d < 0.01) {
          ctx.fillStyle = "rgba(15,23,42,1)";
        } else {
          // Blend from dark bg to emerald based on density
          const r = Math.round(15 + d * (52 - 15));
          const g = Math.round(23 + d * (211 - 23));
          const b = Math.round(42 + d * (153 - 42));
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
      }
    }
  }, [densities, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

// ============================================
// MAIN PANEL
// ============================================

export const GenerativeDesignPanel: React.FC<GenerativeDesignPanelProps> = ({
  onDesignComplete,
  initialConfig,
}) => {
  const [selectedCase, setSelectedCase] = useState("cantilever");
  const [config, setConfig] = useState({
    nelx: DEFAULT_NELX,
    nely: DEFAULT_NELY,
    volumeFraction: 0.4,
    load: 1000,
    ...initialConfig,
  });
  const [status, setStatus] = useState<
    "idle" | "running" | "complete" | "error"
  >("idle");
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [liveDensities, setLiveDensities] = useState<number[][] | null>(null);
  const [progress, setProgress] = useState({
    iter: 0,
    maxIter: 50,
    compliance: 0,
  });
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  const runOptimization = useCallback(async () => {
    setStatus("running");
    setProgress({ iter: 0, maxIter: 50, compliance: 0 });
    setResult(null);
    setLiveDensities(null);
    setErrorMsg("");

    const controller = new AbortController();
    abortRef.current = controller;

    // Yield so React paints the running state
    await new Promise((r) => setTimeout(r, 50));

    try {
      const nelx = clamp(config.nelx, 10, MAX_NELX);
      const nely = clamp(config.nely, 5, MAX_NELY);
      let optimizer: TopologyOptimizer;
      let supports: BoundaryCondition[];
      let loads: LoadCondition[];

      if (selectedCase === "cantilever") {
        const setup = createCantileverOptimizer(
          nelx * 10,
          nely * 10,
          config.load,
          config.volumeFraction,
        );
        optimizer = setup.optimizer;
        supports = setup.supports;
        loads = setup.loads;
      } else if (selectedCase === "mbb") {
        const setup = createMBBBeamOptimizer(
          nelx * 10,
          nely * 10,
          config.load,
          config.volumeFraction,
        );
        optimizer = setup.optimizer;
        supports = setup.supports;
        loads = setup.loads;
      } else {
        const domain: OptimizationDomain = {
          width: nelx * 10,
          height: nely * 10,
          nelx,
          nely,
        };
        optimizer = new TopologyOptimizer(domain, {
          volumeFraction: config.volumeFraction,
          maxIterations: 50,
        });
        supports = [
          {
            type: "fixed",
            nodeIndices: Array.from(
              { length: nely + 1 },
              (_, j) => j * (nelx + 1),
            ),
            direction: "xy",
          },
        ];
        const midRight = Math.floor(nely / 2) * (nelx + 1) + nelx;
        loads = [{ nodeIndex: midRight, fx: 0, fy: -config.load }];
      }

      const optResult = await optimizer.optimizeAsync(
        supports,
        loads,
        (iter, maxIter, compliance, densities) => {
          setProgress({ iter, maxIter, compliance });
          setLiveDensities(densities);
        },
        controller.signal,
      );

      setResult(optResult);
      setLiveDensities(optResult.densities);
      setStatus("complete");
      onDesignComplete?.(optResult);
    } catch (error: any) {
      if (error?.message === "Optimization cancelled") {
        setStatus("idle");
      } else {
        console.error("Optimization failed:", error);
        setErrorMsg(error?.message || "Unknown error");
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [selectedCase, config, onDesignComplete]);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const pct =
    progress.maxIter > 0
      ? Math.round((progress.iter / progress.maxIter) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Design Case Selector */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Design Case
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DESIGN_CASES.map((dc) => (
            <button type="button"
              key={dc.id}
              onClick={() => setSelectedCase(dc.id)}
              disabled={status === "running"}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
                ${
                  selectedCase === dc.id
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/5"
                    : "border-white/[0.06] bg-white/[0.02] text-[#869ab8] hover:border-white/[0.12] hover:bg-white/[0.04]"
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-current">{dc.icon}</div>
              <span className="text-xs font-medium tracking-wide">{dc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Parameters
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Width (elem)",
              key: "nelx",
              min: 10,
              max: MAX_NELX,
              step: 1,
            },
            {
              label: "Height (elem)",
              key: "nely",
              min: 5,
              max: MAX_NELY,
              step: 1,
            },
            {
              label: "Volume Fraction",
              key: "volumeFraction",
              min: 0.1,
              max: 0.8,
              step: 0.05,
            },
            { label: "Load (N)", key: "load", min: 100, max: 50000, step: 100 },
          ].map((p) => (
            <div key={p.key}>
              <label className="block text-[11px] text-slate-500 mb-1.5">
                {p.label}
              </label>
              <input
                type="number"
                value={(config as any)[p.key]}
                onChange={(e) => {
                  const raw =
                    p.step < 1
                      ? parseFloat(e.target.value)
                      : parseInt(e.target.value);
                  if (!isNaN(raw)) {
                    setConfig((c) => ({
                      ...c,
                      [p.key]: clamp(raw, p.min, p.max),
                    }));
                  }
                }}
                min={p.min}
                max={p.max}
                step={p.step}
                disabled={status === "running"}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200
                  placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
                  disabled:opacity-40 transition-colors tabular-nums"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-600">
          Max grid: {MAX_NELX}&times;{MAX_NELY} elements ({MAX_NELX * MAX_NELY}{" "}
          total). Larger grids may slow your browser.
        </p>
      </div>

      {/* Visualization + Controls */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Canvas */}
        <div className="p-4 flex justify-center bg-white/60 dark:bg-slate-950/60">
          <DensityCanvas densities={liveDensities} width={480} height={240} />
        </div>

        {/* Progress / Actions */}
        <div className="border-t border-white/[0.06] px-4 py-3">
          {status === "idle" && (
            <button type="button"
              onClick={runOptimization}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium tracking-wide
                transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
              </svg>
              Generate Optimal Design
            </button>
          )}

          {status === "running" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#869ab8]">
                  Iteration{" "}
                  <span className="text-emerald-400 font-mono">
                    {progress.iter}
                  </span>
                  <span className="text-slate-600"> / {progress.maxIter}</span>
                </span>
                <span className="text-slate-500 font-mono">
                  C ={" "}
                  {progress.compliance > 0
                    ? progress.compliance.toExponential(2)
                    : "\u2014"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <button type="button"
                onClick={handleCancel}
                className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium tracking-wide
                  hover:bg-red-500/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {status === "complete" && result && (
            <div className="space-y-3">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Iterations", value: String(result.iterations) },
                  {
                    label: "Compliance",
                    value: result.compliance.toExponential(2),
                  },
                  {
                    label: "Volume",
                    value: `${(result.volume * 100).toFixed(0)}%`,
                  },
                  {
                    label: "Time",
                    value: `${(result.computationTime / 1000).toFixed(1)}s`,
                  },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-[10px] text-slate-500 mb-0.5">
                      {s.label}
                    </div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-200">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {result.converged && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Converged
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => {
                    setStatus("idle");
                    setResult(null);
                    setLiveDensities(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium tracking-wide transition-colors"
                >
                  New Design
                </button>
                <button type="button"
                  onClick={() => {
                    const canvas = document.querySelector("canvas");
                    if (canvas) {
                      const link = document.createElement("a");
                      link.download = "topology_design.png";
                      link.href = canvas.toDataURL();
                      link.click();
                    }
                  }}
                  className="flex-1 py-2 rounded-lg border border-white/[0.08] text-slate-600 dark:text-slate-300 text-xs font-medium tracking-wide
                    hover:bg-white/[0.04] transition-colors"
                >
                  Export Image
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-400">
                {errorMsg || "Optimization failed"}
              </p>
              <button type="button"
                onClick={() => {
                  setStatus("idle");
                  setErrorMsg("");
                }}
                className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium tracking-wide
                  hover:bg-red-500/10 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerativeDesignPanel;
