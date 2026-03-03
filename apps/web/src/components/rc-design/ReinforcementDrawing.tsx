/**
 * ReinforcementDrawing - IS 456/SP 34 compliant reinforcement detailing SVG
 * Cross-section + Longitudinal section + Bar Bending Schedule
 */

import React from "react";
import type { BeamDesignResult } from "@/modules/concrete/RCBeamDesignEngine";

const ReinforcementDrawing = React.memo(function ReinforcementDrawing({
  result,
}: {
  result: BeamDesignResult;
}) {
  const { geometry, flexure, shear } = result;
  const b = geometry.b;
  const D = geometry.D;
  const d = geometry.d || D - (geometry.cover || 40) - 25;
  const cover = geometry.cover || 40;
  const L = geometry.L || 6000;

  // Tension bars
  const tensionBars = flexure.tensionBars;
  const totalTensionCount = tensionBars.reduce((s, tb) => s + tb.count, 0);
  const mainDia = tensionBars[0]?.diameter || 16;
  // Compression bars
  const compBars = flexure.compressionBars;
  const totalCompCount = compBars.reduce((s, cb) => s + cb.count, 0);
  const compDia = compBars[0]?.diameter || 12;
  // Stirrups
  const stirDia = shear.stirrupDiameter || 8;
  const stirSpacing = shear.stirrupSpacing || 150;
  const stirLegs = shear.stirrupLegs || 2;
  // Derived
  const stirrupPerimeter =
    2 * (b - 2 * cover + 2 * stirDia + (D - 2 * cover + 2 * stirDia)) +
    2 * (10 * stirDia) +
    2 * (6 * stirDia); // Total bar length approx

  // ========= CROSS SECTION (left) =========
  const csW = 280;
  const csH = 420;
  const csMargin = { top: 40, right: 60, bottom: 60, left: 60 };
  const csDrawW = csW - csMargin.left - csMargin.right;
  const csDrawH = csH - csMargin.top - csMargin.bottom;
  const csAspect = b / D;
  let csBW: number, csBH: number;
  if (csAspect > csDrawW / csDrawH) {
    csBW = csDrawW;
    csBH = csDrawW / csAspect;
  } else {
    csBH = csDrawH;
    csBW = csDrawH * csAspect;
  }
  const csOX = csMargin.left + (csDrawW - csBW) / 2;
  const csOY = csMargin.top + (csDrawH - csBH) / 2;
  const csPx = csBW / b; // px per mm
  const coverPx = cover * csPx;
  const barR = Math.max(3, (mainDia * csPx) / 2);
  const compBarR = Math.max(2.5, (compDia * csPx) / 2);
  const stirInset = coverPx;

  // Multi-layer check: if > 4 bars per row, use 2 layers
  const maxPerRow = 4;
  const needsSecondLayer = totalTensionCount > maxPerRow;
  const layer1Count = needsSecondLayer ? maxPerRow : totalTensionCount;
  const layer2Count = needsSecondLayer ? totalTensionCount - maxPerRow : 0;
  const layerSpacing = barR * 3;

  // ========= LONGITUDINAL SECTION (right) =========
  const lsW = 520;
  const lsH = 420;
  const lsMargin = { top: 40, right: 30, bottom: 60, left: 30 };
  const lsDrawW = lsW - lsMargin.left - lsMargin.right;
  const lsDrawH = lsH - lsMargin.top - lsMargin.bottom;
  const beamDrawW = lsDrawW;
  const beamDrawH = lsDrawH;
  const lsOX = lsMargin.left;
  const lsOY = lsMargin.top;
  const lsPxMM = beamDrawH / D;
  const lsCoverPx = cover * lsPxMM;

  // Stirrup zones: IS 456 Cl. 26.5.1.6 — close spacing near supports for 2d distance
  const twoD = 2 * d; // mm
  const twoDpx = (twoD / L) * beamDrawW;
  const closeSpacingMM = Math.min(stirSpacing, 0.75 * d, 300);
  const normalSpacingMM = stirSpacing;
  const closeCount = Math.max(2, Math.ceil(twoD / closeSpacingMM));
  const normalCount = Math.max(4, Math.ceil((L - 2 * twoD) / normalSpacingMM));

  // SVG total
  const totalW = csW + lsW + 20;
  const totalH = Math.max(csH, lsH) + 200; // extra for bar schedule

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        Reinforcement Detailing
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        IS 456:2000 / SP 34:1987 compliant detailing
      </p>

      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full bg-slate-50/50 dark:bg-slate-900/50 rounded-xl"
        style={{
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          minHeight: "500px",
        }}
      >
        <defs>
          <pattern
            id="rd-hatch"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              stroke="#475569"
              strokeWidth="0.35"
            />
          </pattern>
          <marker
            id="rd-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
          </marker>
          <marker
            id="rd-arrow-cyan"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
          </marker>
        </defs>

        {/* ==================== CROSS SECTION ==================== */}
        <g>
          <text
            x={csW / 2}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fill="#e2e8f0"
            fontWeight="700"
          >
            CROSS SECTION
          </text>

          {/* Concrete body with hatch */}
          <rect
            x={csOX}
            y={csOY}
            width={csBW}
            height={csBH}
            fill="url(#rd-hatch)"
          />
          <rect
            x={csOX}
            y={csOY}
            width={csBW}
            height={csBH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Stirrup with 135° hooks (IS 13920 Fig. 7A) */}
          <rect
            x={csOX + stirInset}
            y={csOY + stirInset}
            width={csBW - 2 * stirInset}
            height={csBH - 2 * stirInset}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.8"
            rx="3"
          />
          {/* Top-left 135° hook */}
          <line
            x1={csOX + stirInset + 10}
            y1={csOY + stirInset}
            x2={csOX + stirInset + 10 + 12 * Math.cos(Math.PI * 0.75)}
            y2={csOY + stirInset + 12 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Top-right 135° hook */}
          <line
            x1={csOX + csBW - stirInset - 10}
            y1={csOY + stirInset}
            x2={csOX + csBW - stirInset - 10 - 12 * Math.cos(Math.PI * 0.75)}
            y2={csOY + stirInset + 12 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Cross-tie for 4+ leg stirrup */}
          {stirLegs >= 4 && (
            <line
              x1={csOX + csBW / 2}
              y1={csOY + stirInset}
              x2={csOX + csBW / 2}
              y2={csOY + csBH - stirInset}
              stroke="#3b82f6"
              strokeWidth="1.2"
              strokeDasharray="3,2"
            />
          )}

          {/* Tension bars — Layer 1 */}
          {Array.from({ length: layer1Count }).map((_, i) => {
            const sx = csOX + stirInset + barR + 4;
            const ex = csOX + csBW - stirInset - barR - 4;
            const cx =
              layer1Count === 1
                ? (sx + ex) / 2
                : sx + (i * (ex - sx)) / (layer1Count - 1);
            const cy = csOY + csBH - stirInset - barR - 3;
            return (
              <circle
                key={`t1-${i}`}
                cx={cx}
                cy={cy}
                r={barR}
                fill="#ef4444"
                stroke="#991b1b"
                strokeWidth="0.8"
              />
            );
          })}

          {/* Tension bars — Layer 2 (if needed) */}
          {layer2Count > 0 &&
            Array.from({ length: layer2Count }).map((_, i) => {
              const sx = csOX + stirInset + barR + 4;
              const ex = csOX + csBW - stirInset - barR - 4;
              const cx =
                layer2Count === 1
                  ? (sx + ex) / 2
                  : sx + (i * (ex - sx)) / (layer2Count - 1);
              const cy = csOY + csBH - stirInset - barR - 3 - layerSpacing;
              return (
                <circle
                  key={`t2-${i}`}
                  cx={cx}
                  cy={cy}
                  r={barR}
                  fill="#ef4444"
                  stroke="#991b1b"
                  strokeWidth="0.8"
                />
              );
            })}

          {/* Compression bars (top) */}
          {(() => {
            const nComp = totalCompCount > 0 ? totalCompCount : 2; // At least 2 hanger bars
            const isHanger = totalCompCount === 0;
            const r = isHanger ? compBarR * 0.85 : compBarR;
            const fillC = isHanger ? "#f97316" : "#f97316";
            const strokeC = isHanger ? "#9a3412" : "#9a3412";
            return Array.from({ length: nComp }).map((_, i) => {
              const sx = csOX + stirInset + r + 4;
              const ex = csOX + csBW - stirInset - r - 4;
              const cx =
                nComp === 1
                  ? (sx + ex) / 2
                  : sx + (i * (ex - sx)) / (nComp - 1);
              const cy = csOY + stirInset + r + 3;
              return (
                <circle
                  key={`c-${i}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fillC}
                  stroke={strokeC}
                  strokeWidth="0.8"
                />
              );
            });
          })()}

          {/* Neutral Axis indicator */}
          {(() => {
            const xuPx = (flexure.xu || d * 0.4) * csPx;
            const naY = csOY + Math.min(xuPx, csBH * 0.6);
            return (
              <g>
                <line
                  x1={csOX - 5}
                  y1={naY}
                  x2={csOX + csBW + 5}
                  y2={naY}
                  stroke="#facc15"
                  strokeWidth="0.8"
                  strokeDasharray="5,3"
                />
                <text
                  x={csOX + csBW + 8}
                  y={naY + 3}
                  fontSize="7"
                  fill="#facc15"
                >
                  N.A.
                </text>
              </g>
            );
          })()}

          {/* Clear cover annotation — bottom */}
          {(() => {
            const ax = csOX - 6;
            const y1 = csOY + csBH;
            const y2 = csOY + csBH - coverPx;
            return (
              <g>
                <line
                  x1={ax}
                  y1={y1}
                  x2={ax}
                  y2={y2}
                  stroke="#22d3ee"
                  strokeWidth="0.8"
                  markerStart="url(#rd-arrow-cyan)"
                  markerEnd="url(#rd-arrow-cyan)"
                />
                <text
                  x={ax - 4}
                  y={(y1 + y2) / 2 + 3}
                  textAnchor="end"
                  fontSize="7"
                  fill="#22d3ee"
                  fontWeight="600"
                >
                  {cover}
                </text>
              </g>
            );
          })()}

          {/* Clear cover annotation — side */}
          {(() => {
            const ay = csOY + csBH + 6;
            const x1 = csOX;
            const x2 = csOX + coverPx;
            return (
              <g>
                <line
                  x1={x1}
                  y1={ay}
                  x2={x2}
                  y2={ay}
                  stroke="#22d3ee"
                  strokeWidth="0.8"
                />
                <line
                  x1={x1}
                  y1={ay - 3}
                  x2={x1}
                  y2={ay + 3}
                  stroke="#22d3ee"
                  strokeWidth="0.6"
                />
                <line
                  x1={x2}
                  y1={ay - 3}
                  x2={x2}
                  y2={ay + 3}
                  stroke="#22d3ee"
                  strokeWidth="0.6"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={ay + 10}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#22d3ee"
                >
                  {cover}
                </text>
              </g>
            );
          })()}

          {/* Width dimension */}
          {(() => {
            const dy = csOY + csBH + 24;
            return (
              <g>
                <line
                  x1={csOX}
                  y1={csOY + csBH + 3}
                  x2={csOX}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW}
                  y1={csOY + csBH + 3}
                  x2={csOX + csBW}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX}
                  y1={dy}
                  x2={csOX + csBW}
                  y2={dy}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={csOX - 3}
                  y1={dy + 3}
                  x2={csOX + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={csOX + csBW - 3}
                  y1={dy + 3}
                  x2={csOX + csBW + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={csOX + csBW / 2}
                  y={dy + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                >
                  {b} mm
                </text>
              </g>
            );
          })()}

          {/* Depth dimension */}
          {(() => {
            const dx = csOX + csBW + 24;
            return (
              <g>
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY}
                  x2={dx + 4}
                  y2={csOY}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY + csBH}
                  x2={dx + 4}
                  y2={csOY + csBH}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={dx}
                  y1={csOY}
                  x2={dx}
                  y2={csOY + csBH}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={dx - 3}
                  y1={csOY + 3}
                  x2={dx + 3}
                  y2={csOY - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={dx - 3}
                  y1={csOY + csBH + 3}
                  x2={dx + 3}
                  y2={csOY + csBH - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={dx + 14}
                  y={csOY + csBH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                  transform={`rotate(-90, ${dx + 14}, ${csOY + csBH / 2})`}
                >
                  {D} mm
                </text>
              </g>
            );
          })()}

          {/* Effective depth dim (d) */}
          {(() => {
            const dx = csOX + csBW + 40;
            const dPx = d * csPx;
            return (
              <g>
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY}
                  x2={dx + 4}
                  y2={csOY}
                  stroke="#6366f1"
                  strokeWidth="0.4"
                  strokeDasharray="2,2"
                />
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY + dPx}
                  x2={dx + 4}
                  y2={csOY + dPx}
                  stroke="#6366f1"
                  strokeWidth="0.4"
                  strokeDasharray="2,2"
                />
                <line
                  x1={dx}
                  y1={csOY}
                  x2={dx}
                  y2={csOY + dPx}
                  stroke="#6366f1"
                  strokeWidth="0.6"
                />
                <text
                  x={dx + 10}
                  y={csOY + dPx / 2}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#6366f1"
                  transform={`rotate(-90, ${dx + 10}, ${csOY + dPx / 2})`}
                >
                  d = {Math.round(d)} mm
                </text>
              </g>
            );
          })()}

          {/* Bar labels callout */}
          {(() => {
            const botCY = csOY + csBH - stirInset - barR - 3;
            const topCY = csOY + stirInset + compBarR + 3;
            return (
              <g>
                {/* Bottom bar label */}
                <line
                  x1={csOX + csBW - stirInset - barR - 4}
                  y1={botCY}
                  x2={csOX + csBW + 10}
                  y2={botCY - 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 10}
                  y1={botCY - 15}
                  x2={csOX + csBW + 40}
                  y2={botCY - 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <text
                  x={csOX + csBW + 42}
                  y={botCY - 12}
                  fontSize="7"
                  fill="#e2e8f0"
                >
                  {tensionBars
                    .map((tb) => `${tb.count}-T${tb.diameter}`)
                    .join(" + ")}
                </text>
                {/* Top bar label */}
                <line
                  x1={csOX + csBW - stirInset - compBarR - 4}
                  y1={topCY}
                  x2={csOX + csBW + 10}
                  y2={topCY + 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 10}
                  y1={topCY + 15}
                  x2={csOX + csBW + 40}
                  y2={topCY + 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <text
                  x={csOX + csBW + 42}
                  y={topCY + 18}
                  fontSize="7"
                  fill="#e2e8f0"
                >
                  {totalCompCount > 0
                    ? compBars
                        .map((cb) => `${cb.count}-T${cb.diameter}`)
                        .join(" + ")
                    : `2-T${compDia} (hanger)`}
                </text>
              </g>
            );
          })()}
        </g>

        {/* ==================== LONGITUDINAL SECTION ==================== */}
        <g transform={`translate(${csW + 20}, 0)`}>
          <text
            x={lsW / 2}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fill="#e2e8f0"
            fontWeight="700"
          >
            LONGITUDINAL SECTION
          </text>

          {/* Beam outline */}
          <rect
            x={lsOX}
            y={lsOY}
            width={beamDrawW}
            height={beamDrawH}
            fill="url(#rd-hatch)"
            opacity="0.3"
          />
          <rect
            x={lsOX}
            y={lsOY}
            width={beamDrawW}
            height={beamDrawH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Supports — left (fixed/pinned) */}
          <polygon
            points={`${lsOX},${lsOY + beamDrawH} ${lsOX - 8},${lsOY + beamDrawH + 14} ${lsOX + 8},${lsOY + beamDrawH + 14}`}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="1"
          />
          <line
            x1={lsOX - 12}
            y1={lsOY + beamDrawH + 16}
            x2={lsOX + 12}
            y2={lsOY + beamDrawH + 16}
            stroke="#a1a1aa"
            strokeWidth="1"
          />

          {/* Supports — right (roller) */}
          <polygon
            points={`${lsOX + beamDrawW},${lsOY + beamDrawH} ${lsOX + beamDrawW - 8},${lsOY + beamDrawH + 14} ${lsOX + beamDrawW + 8},${lsOY + beamDrawH + 14}`}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="1"
          />
          <circle
            cx={lsOX + beamDrawW - 4}
            cy={lsOY + beamDrawH + 17}
            r="2"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />
          <circle
            cx={lsOX + beamDrawW + 4}
            cy={lsOY + beamDrawH + 17}
            r="2"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />

          {/* Top bars (continuous) */}
          <line
            x1={lsOX + 6}
            y1={lsOY + lsCoverPx + 6}
            x2={lsOX + beamDrawW - 6}
            y2={lsOY + lsCoverPx + 6}
            stroke="#f97316"
            strokeWidth="2.5"
          />
          <text
            x={lsOX + beamDrawW - 4}
            y={lsOY + lsCoverPx + 3}
            fontSize="7"
            fill="#f97316"
            textAnchor="start"
          >
            {totalCompCount > 0
              ? compBars.map((cb) => `${cb.count}T${cb.diameter}`).join("+")
              : `2T${compDia}`}
          </text>

          {/* Bottom bars (main tension — continuous) */}
          <line
            x1={lsOX + 6}
            y1={lsOY + beamDrawH - lsCoverPx - 6}
            x2={lsOX + beamDrawW - 6}
            y2={lsOY + beamDrawH - lsCoverPx - 6}
            stroke="#ef4444"
            strokeWidth="3.5"
          />
          <text
            x={lsOX + beamDrawW - 4}
            y={lsOY + beamDrawH - lsCoverPx - 3}
            fontSize="7"
            fill="#ef4444"
            textAnchor="start"
          >
            {tensionBars.map((tb) => `${tb.count}T${tb.diameter}`).join("+")}
          </text>

          {/* Curtailment bars – bent up at L/7 from support (IS 456 Cl. 26.2.3) */}
          {totalTensionCount > 2 &&
            (() => {
              const curtailFrac = 1 / 7;
              const cLeftPx = curtailFrac * beamDrawW;
              const cRightPx = (1 - curtailFrac) * beamDrawW;
              const topY = lsOY + lsCoverPx + 6;
              const botY = lsOY + beamDrawH - lsCoverPx - 6;
              return (
                <g>
                  {/* Left bent-up bar */}
                  <polyline
                    points={`${lsOX + 6},${botY} ${lsOX + cLeftPx},${botY} ${lsOX + cLeftPx + 15},${topY}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,2"
                  />
                  {/* Right bent-up bar */}
                  <polyline
                    points={`${lsOX + beamDrawW - 6},${botY} ${lsOX + cRightPx},${botY} ${lsOX + cRightPx - 15},${topY}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,2"
                  />
                  {/* Annotations */}
                  <text
                    x={lsOX + cLeftPx}
                    y={lsOY + beamDrawH / 2}
                    fontSize="6"
                    fill="#ef4444"
                    textAnchor="middle"
                    transform={`rotate(-60, ${lsOX + cLeftPx + 8}, ${lsOY + beamDrawH / 2})`}
                  >
                    L/7
                  </text>
                  <text
                    x={lsOX + cRightPx}
                    y={lsOY + beamDrawH / 2}
                    fontSize="6"
                    fill="#ef4444"
                    textAnchor="middle"
                    transform={`rotate(60, ${lsOX + cRightPx - 8}, ${lsOY + beamDrawH / 2})`}
                  >
                    L/7
                  </text>
                </g>
              );
            })()}

          {/* Stirrups — close spacing zone (2d from support) */}
          {Array.from({ length: closeCount }).map((_, i) => {
            const xPos = lsOX + 8 + i * (twoDpx / closeCount);
            return (
              <line
                key={`csl-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="1"
              />
            );
          })}
          {/* Right close spacing zone */}
          {Array.from({ length: closeCount }).map((_, i) => {
            const xPos = lsOX + beamDrawW - 8 - i * (twoDpx / closeCount);
            return (
              <line
                key={`csr-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="1"
              />
            );
          })}
          {/* Normal spacing zone (mid-span) */}
          {Array.from({ length: normalCount }).map((_, i) => {
            const midStart = lsOX + twoDpx + 10;
            const midEnd = lsOX + beamDrawW - twoDpx - 10;
            const xPos =
              midStart +
              (i * (midEnd - midStart)) / Math.max(1, normalCount - 1);
            return (
              <line
                key={`ns-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="0.8"
                strokeDasharray="none"
              />
            );
          })}

          {/* Stirrup spacing annotations */}
          {(() => {
            const annY = lsOY - 8;
            return (
              <g>
                {/* Close zone left */}
                <line
                  x1={lsOX + 4}
                  y1={annY}
                  x2={lsOX + twoDpx}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + twoDpx / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(closeSpacingMM)}c/c
                </text>
                {/* Normal zone center */}
                <line
                  x1={lsOX + twoDpx + 5}
                  y1={annY}
                  x2={lsOX + beamDrawW - twoDpx - 5}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + beamDrawW / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(normalSpacingMM)}c/c
                </text>
                {/* Close zone right */}
                <line
                  x1={lsOX + beamDrawW - twoDpx}
                  y1={annY}
                  x2={lsOX + beamDrawW - 4}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + beamDrawW - twoDpx / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(closeSpacingMM)}c/c
                </text>
              </g>
            );
          })()}

          {/* Span dimension below */}
          {(() => {
            const dy = lsOY + beamDrawH + 30;
            return (
              <g>
                <line
                  x1={lsOX}
                  y1={lsOY + beamDrawH + 5}
                  x2={lsOX}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={lsOX + beamDrawW}
                  y1={lsOY + beamDrawH + 5}
                  x2={lsOX + beamDrawW}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={lsOX}
                  y1={dy}
                  x2={lsOX + beamDrawW}
                  y2={dy}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={lsOX - 3}
                  y1={dy + 3}
                  x2={lsOX + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={lsOX + beamDrawW - 3}
                  y1={dy + 3}
                  x2={lsOX + beamDrawW + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={lsOX + beamDrawW / 2}
                  y={dy + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                >
                  {L} mm
                </text>
              </g>
            );
          })()}

          {/* Section cut markers — "A-A" */}
          {(() => {
            const cutX = lsOX + beamDrawW * 0.45;
            const r = 7;
            return (
              <g>
                <line
                  x1={cutX}
                  y1={lsOY - 16}
                  x2={cutX}
                  y2={lsOY + beamDrawH + 16}
                  stroke="#f43f5e"
                  strokeWidth="0.8"
                  strokeDasharray="8,3,2,3"
                />
                <circle
                  cx={cutX}
                  cy={lsOY - 16}
                  r={r}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1"
                />
                <text
                  x={cutX}
                  y={lsOY - 12.5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#f43f5e"
                  fontWeight="700"
                >
                  A
                </text>
                <circle
                  cx={cutX}
                  cy={lsOY + beamDrawH + 16}
                  r={r}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1"
                />
                <text
                  x={cutX}
                  y={lsOY + beamDrawH + 19.5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#f43f5e"
                  fontWeight="700"
                >
                  A
                </text>
              </g>
            );
          })()}
        </g>

        {/* ==================== LEGEND ==================== */}
        <g transform={`translate(20, ${Math.max(csH, lsH) + 10})`}>
          <text x="0" y="0" fontSize="11" fill="#e2e8f0" fontWeight="700">
            REINFORCEMENT SCHEDULE
          </text>
          <g transform="translate(0, 18)">
            <circle
              cx="8"
              cy="4"
              r="5"
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="0.8"
            />
            <text x="20" y="8" fontSize="9" fill="#94a3b8">
              Main tension:{" "}
              {tensionBars
                .map((tb) => `${tb.count}-T${tb.diameter}`)
                .join(" + ")}
            </text>
          </g>
          <g transform="translate(200, 18)">
            <circle
              cx="8"
              cy="4"
              r="4"
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth="0.8"
            />
            <text x="20" y="8" fontSize="9" fill="#94a3b8">
              Comp/hanger:{" "}
              {totalCompCount > 0
                ? compBars
                    .map((cb) => `${cb.count}-T${cb.diameter}`)
                    .join(" + ")
                : `2-T${compDia}`}
            </text>
          </g>
          <g transform="translate(430, 18)">
            <rect
              x="0"
              y="-1"
              width="16"
              height="10"
              rx="2"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Stirrup: T{stirDia}@{Math.round(stirSpacing)}c/c ({stirLegs}L)
            </text>
          </g>
          <g transform="translate(630, 18)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#facc15"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Neutral axis
            </text>
          </g>
          <g transform="translate(0, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#22d3ee"
              strokeWidth="1"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Clear cover = {cover} mm
            </text>
          </g>
          <g transform="translate(200, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Bent-up bar (curtailment)
            </text>
          </g>
          <g transform="translate(430, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#f43f5e"
              strokeWidth="0.8"
              strokeDasharray="8,3,2,3"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Section cut
            </text>
          </g>
        </g>

        {/* Design notes */}
        <g transform={`translate(20, ${Math.max(csH, lsH) + 72})`}>
          <text x="0" y="0" fontSize="8" fill="#64748b">
            Notes:
          </text>
          <text x="0" y="12" fontSize="7" fill="#64748b">
            1. All dimensions in mm. Cover as per IS 456 Cl. 26.4.
          </text>
          <text x="0" y="22" fontSize="7" fill="#64748b">
            2. Stirrup hooks: 135° per IS 13920 for seismic detailing.
          </text>
          <text x="0" y="32" fontSize="7" fill="#64748b">
            3. Curtailment per IS 456 Cl. 26.2.3. Close stirrup spacing within
            2d from support face.
          </text>
          <text x="0" y="42" fontSize="7" fill="#64748b">
            4. Lap length ={" "}
            {flexure.sectionType === "singly-reinforced" ? "40" : "50"}d per IS
            456 Cl. 26.2.5.
          </text>
        </g>
      </svg>

      {/* Bar Bend Schedule Table */}
      <div className="mt-6 overflow-x-auto">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          Bar Bending Schedule
        </h4>
        <table className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-700/60">
              <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Bar Mark
              </th>
              <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Type
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Dia (mm)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                No.
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Cutting Length (mm)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Shape (IS 2502)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Total Wt (kg)
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Mark A — Main tension bars */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-red-400">A</td>
              <td className="py-3 px-4 text-slate-900 dark:text-white">Main Tension</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">{mainDia}</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {totalTensionCount}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {L + 2 * (40 * mainDia) - 2 * cover}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">Straight</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {(
                  (((totalTensionCount *
                    (L + 2 * 40 * mainDia - 2 * cover) *
                    Math.PI *
                    mainDia *
                    mainDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Mark B — Compression / hanger bars */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-orange-400">B</td>
              <td className="py-3 px-4 text-slate-900 dark:text-white">
                {totalCompCount > 0 ? "Compression" : "Hanger"}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">{compDia}</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {totalCompCount > 0 ? totalCompCount : 2}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {L - 2 * cover}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">Straight</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {(
                  ((((totalCompCount || 2) *
                    (L - 2 * cover) *
                    Math.PI *
                    compDia *
                    compDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Mark C — Stirrups */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-blue-400">C</td>
              <td className="py-3 px-4 text-slate-900 dark:text-white">{stirLegs}L Stirrup</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">{stirDia}</td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {Math.ceil(L / stirSpacing) + 1}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {Math.round(
                  2 * (b - 2 * cover + 2 * stirDia) +
                    2 * (D - 2 * cover + 2 * stirDia) +
                    2 * 10 * stirDia,
                )}
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                2L Stirrup (135° hooks)
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {(
                  ((((Math.ceil(L / stirSpacing) + 1) *
                    (2 * (b - 2 * cover + 2 * stirDia) +
                      2 * (D - 2 * cover + 2 * stirDia) +
                      2 * 10 * stirDia) *
                    Math.PI *
                    stirDia *
                    stirDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Bent-up bars if any */}
            {totalTensionCount > 2 && (
              <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-3 px-4 font-bold text-red-300">D</td>
                <td className="py-3 px-4 text-slate-900 dark:text-white">Bent-up Bar</td>
                <td className="py-3 px-4 text-center text-slate-900 dark:text-white">{mainDia}</td>
                <td className="py-3 px-4 text-center text-slate-900 dark:text-white">2</td>
                <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                  {Math.round(L * 0.75)}
                </td>
                <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                  Bent-up (45°)
                </td>
                <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                  {(
                    (((2 * L * 0.75 * Math.PI * mainDia * mainDia) / 4) *
                      7850) /
                    1e9
                  ).toFixed(1)}
                </td>
              </tr>
            )}
            {/* Total row */}
            <tr className="bg-slate-700/40 font-semibold">
              <td colSpan={6} className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                Total Steel Weight
              </td>
              <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                {(() => {
                  const Abar = (dia: number) => (Math.PI * dia * dia) / 4;
                  const rho = 7850 / 1e9; // kg/mm³
                  const lDev = 40 * mainDia;
                  const mainWt =
                    totalTensionCount *
                    (L + 2 * lDev - 2 * cover) *
                    Abar(mainDia) *
                    rho;
                  const compWt =
                    (totalCompCount || 2) *
                    (L - 2 * cover) *
                    Abar(compDia) *
                    rho;
                  const nStir = Math.ceil(L / stirSpacing) + 1;
                  const stirLen =
                    2 * (b - 2 * cover + 2 * stirDia) +
                    2 * (D - 2 * cover + 2 * stirDia) +
                    2 * 10 * stirDia;
                  const stirWt = nStir * stirLen * Abar(stirDia) * rho;
                  const bentWt =
                    totalTensionCount > 2
                      ? 2 * L * 0.75 * Abar(mainDia) * rho
                      : 0;
                  return (mainWt + compWt + stirWt + bentWt).toFixed(1);
                })()}{" "}
                kg
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

(ReinforcementDrawing as unknown as { displayName: string }).displayName =
  "ReinforcementDrawing";

export default ReinforcementDrawing;
