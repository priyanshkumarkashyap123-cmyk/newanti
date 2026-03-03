/**
 * RCBeamCrossSection — SVG cross-section drawing for RC Beam
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC } from "react";

export interface RCBeamCrossSectionProps {
  b: number;
  d: number;
  cover: number;
  mainBars: { count: number; diameter: number };
  stirrupDia: number;
  topBars?: { count: number; diameter: number };
}

const RCBeamCrossSection: FC<RCBeamCrossSectionProps> = ({
  b,
  d,
  cover,
  mainBars,
  stirrupDia,
  topBars,
}) => {
  const svgW = 320;
  const svgH = 400;
  const margin = { top: 24, right: 55, bottom: 50, left: 55 };
  const drawW = svgW - margin.left - margin.right;
  const drawH = svgH - margin.top - margin.bottom;

  // Scale to fit while preserving aspect ratio
  const D = d + (cover ?? 40);
  const aspect = b / D;
  let W: number, H: number;
  if (aspect > drawW / drawH) {
    W = drawW;
    H = drawW / aspect;
  } else {
    H = drawH;
    W = drawH * aspect;
  }
  const ox = margin.left + (drawW - W) / 2;
  const oy = margin.top + (drawH - H) / 2;
  const sc = W / b;

  const coverPx = cover * sc;
  const stirPx = Math.max(stirrupDia * sc, 1.5);
  const mainDiaPx = Math.max(mainBars.diameter * sc, 6);
  const topDiaPx = topBars ? Math.max(topBars.diameter * sc, 5) : 5;

  // Stirrup rect with cover offset
  const sx = ox + coverPx;
  const sy = oy + coverPx;
  const sw = W - 2 * coverPx;
  const sh = H - 2 * coverPx;

  // Multi-layer check
  const maxPerRow = 4;
  const needsSecondLayer = mainBars.count > maxPerRow;
  const layer1Count = needsSecondLayer ? maxPerRow : mainBars.count;
  const layer2Count = needsSecondLayer ? mainBars.count - maxPerRow : 0;
  const layerGap = mainDiaPx * 2.5;

  // Bottom bars
  const barY1 = oy + H - coverPx - stirPx - mainDiaPx / 2;
  const barY2 = barY1 - layerGap;
  const spacing1 =
    layer1Count > 1 ? (sw - 2 * stirPx - mainDiaPx) / (layer1Count - 1) : 0;
  const startX = sx + stirPx + mainDiaPx / 2;

  // Top bars positions
  const topBarY = oy + coverPx + stirPx + topDiaPx / 2;
  const topCount = topBars?.count ?? 2;
  const topSpacing =
    topCount > 1 ? (sw - 2 * stirPx - topDiaPx) / (topCount - 1) : 0;
  const topStartX = sx + stirPx + topDiaPx / 2;

  // Neutral axis approximate position (0.45d)
  const naY = oy + 0.45 * d * sc;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <defs>
        <pattern
          id="pds-hatch"
          width={5}
          height={5}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={5}
            stroke="#71717a"
            strokeWidth={0.4}
          />
        </pattern>
        <marker
          id="pds-arrow-cyan"
          viewBox="0 0 10 10"
          refX={10}
          refY={5}
          markerWidth={3}
          markerHeight={3}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
        </marker>
      </defs>

      {/* Concrete body with hatch */}
      <rect x={ox} y={oy} width={W} height={H} fill="url(#pds-hatch)" />
      <rect
        x={ox}
        y={oy}
        width={W}
        height={H}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        rx={2}
      />

      {/* Stirrup with 135° hooks */}
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        rx={3}
      />
      {/* 135° hooks */}
      <line
        x1={sx + 8}
        y1={sy}
        x2={sx + 8 + 10 * Math.cos(Math.PI * 0.75)}
        y2={sy + 10 * Math.sin(Math.PI * 0.75)}
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        strokeLinecap="round"
      />
      <line
        x1={sx + sw - 8}
        y1={sy}
        x2={sx + sw - 8 - 10 * Math.cos(Math.PI * 0.75)}
        y2={sy + 10 * Math.sin(Math.PI * 0.75)}
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        strokeLinecap="round"
      />

      {/* Bottom tension bars — layer 1 */}
      {Array.from({ length: layer1Count }).map((_, i) => {
        const cx =
          layer1Count === 1
            ? startX + (sw - 2 * stirPx - mainDiaPx) / 2
            : startX + i * spacing1;
        return (
          <circle
            key={`bot1-${i}`}
            cx={cx}
            cy={barY1}
            r={mainDiaPx / 2}
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth={0.8}
          />
        );
      })}
      {/* Layer 2 */}
      {layer2Count > 0 &&
        (() => {
          const sp2 =
            layer2Count > 1
              ? (sw - 2 * stirPx - mainDiaPx) / (layer2Count - 1)
              : 0;
          return Array.from({ length: layer2Count }).map((_, i) => {
            const cx =
              layer2Count === 1
                ? startX + (sw - 2 * stirPx - mainDiaPx) / 2
                : startX + i * sp2;
            return (
              <circle
                key={`bot2-${i}`}
                cx={cx}
                cy={barY2}
                r={mainDiaPx / 2}
                fill="#ef4444"
                stroke="#991b1b"
                strokeWidth={0.8}
              />
            );
          });
        })()}

      {/* Top (hanger / compression) bars */}
      {Array.from({ length: topCount }).map((_, i) => {
        const cx =
          topCount === 1
            ? topStartX + (sw - 2 * stirPx - topDiaPx) / 2
            : topStartX + i * topSpacing;
        return (
          <circle
            key={`top-${i}`}
            cx={cx}
            cy={topBarY}
            r={topDiaPx / 2}
            fill="#f97316"
            stroke="#9a3412"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Neutral axis */}
      <line
        x1={ox - 4}
        y1={naY}
        x2={ox + W + 4}
        y2={naY}
        stroke="#facc15"
        strokeWidth={0.8}
        strokeDasharray="5,3"
      />
      <text x={ox + W + 6} y={naY + 3} fontSize={7} fill="#facc15">
        N.A.
      </text>

      {/* Cover annotation — bottom */}
      <line
        x1={ox - 5}
        y1={oy + H}
        x2={ox - 5}
        y2={oy + H - coverPx}
        stroke="#22d3ee"
        strokeWidth={0.8}
        markerStart="url(#pds-arrow-cyan)"
        markerEnd="url(#pds-arrow-cyan)"
      />
      <text
        x={ox - 9}
        y={oy + H - coverPx / 2 + 3}
        textAnchor="end"
        fontSize={7}
        fill="#22d3ee"
        fontWeight={600}
      >
        {cover}
      </text>

      {/* Cover annotation — side */}
      <line
        x1={ox}
        y1={oy + H + 5}
        x2={ox + coverPx}
        y2={oy + H + 5}
        stroke="#22d3ee"
        strokeWidth={0.8}
      />
      <line
        x1={ox}
        y1={oy + H + 2}
        x2={ox}
        y2={oy + H + 8}
        stroke="#22d3ee"
        strokeWidth={0.5}
      />
      <line
        x1={ox + coverPx}
        y1={oy + H + 2}
        x2={ox + coverPx}
        y2={oy + H + 8}
        stroke="#22d3ee"
        strokeWidth={0.5}
      />
      <text
        x={ox + coverPx / 2}
        y={oy + H + 16}
        textAnchor="middle"
        fontSize={7}
        fill="#22d3ee"
      >
        {cover}
      </text>

      {/* Width dimension */}
      <line
        x1={ox}
        y1={oy + H + 22}
        x2={ox + W}
        y2={oy + H + 22}
        stroke="#a1a1aa"
        strokeWidth={0.6}
      />
      <line
        x1={ox}
        y1={oy + H + 10}
        x2={ox}
        y2={oy + H + 26}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W}
        y1={oy + H + 10}
        x2={ox + W}
        y2={oy + H + 26}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox - 3}
        y1={oy + H + 25}
        x2={ox + 3}
        y2={oy + H + 19}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <line
        x1={ox + W - 3}
        y1={oy + H + 25}
        x2={ox + W + 3}
        y2={oy + H + 19}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <text
        x={ox + W / 2}
        y={oy + H + 35}
        textAnchor="middle"
        fontSize={10}
        fill="#a1a1aa"
        fontWeight={500}
      >
        {b} mm
      </text>

      {/* Depth dimension */}
      <line
        x1={ox + W + 22}
        y1={oy}
        x2={ox + W + 22}
        y2={oy + H}
        stroke="#a1a1aa"
        strokeWidth={0.6}
      />
      <line
        x1={ox + W + 10}
        y1={oy}
        x2={ox + W + 26}
        y2={oy}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W + 10}
        y1={oy + H}
        x2={ox + W + 26}
        y2={oy + H}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W + 19}
        y1={oy + 3}
        x2={ox + W + 25}
        y2={oy - 3}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <line
        x1={ox + W + 19}
        y1={oy + H + 3}
        x2={ox + W + 25}
        y2={oy + H - 3}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <text
        x={ox + W + 36}
        y={oy + H / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#a1a1aa"
        fontWeight={500}
        transform={`rotate(-90, ${ox + W + 36}, ${oy + H / 2})`}
      >
        {D.toFixed(0)} mm
      </text>

      {/* Bar callouts */}
      <line
        x1={startX + (layer1Count > 1 ? spacing1 * (layer1Count - 1) : 0)}
        y1={barY1}
        x2={ox + W + 8}
        y2={barY1 - 10}
        stroke="#71717a"
        strokeWidth={0.5}
      />
      <text x={ox + W + 10} y={barY1 - 7} fontSize={7} fill="#e2e8f0">
        {mainBars.count}-T{mainBars.diameter}
      </text>
      <line
        x1={topStartX + (topCount > 1 ? topSpacing * (topCount - 1) : 0)}
        y1={topBarY}
        x2={ox + W + 8}
        y2={topBarY + 10}
        stroke="#71717a"
        strokeWidth={0.5}
      />
      <text x={ox + W + 10} y={topBarY + 13} fontSize={7} fill="#e2e8f0">
        {topCount}-T{topBars?.diameter || 12}
      </text>

      {/* Legend */}
      <g transform={`translate(${margin.left - 10}, ${svgH - 14})`}>
        <circle
          cx={6}
          cy={-2}
          r={4}
          fill="#ef4444"
          stroke="#991b1b"
          strokeWidth={0.5}
        />
        <text x={14} y={2} fontSize={7} fill="#a1a1aa">
          Tension
        </text>
        <circle
          cx={62}
          cy={-2}
          r={3}
          fill="#f97316"
          stroke="#9a3412"
          strokeWidth={0.5}
        />
        <text x={70} y={2} fontSize={7} fill="#a1a1aa">
          Hanger
        </text>
        <rect
          x={110}
          y={-5}
          width={10}
          height={6}
          rx={1}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
        />
        <text x={124} y={2} fontSize={7} fill="#a1a1aa">
          Stirrup
        </text>
        <line
          x1={160}
          y1={-2}
          x2={176}
          y2={-2}
          stroke="#facc15"
          strokeWidth={0.8}
          strokeDasharray="4,2"
        />
        <text x={180} y={2} fontSize={7} fill="#a1a1aa">
          N.A.
        </text>
        <line
          x1={200}
          y1={-2}
          x2={212}
          y2={-2}
          stroke="#22d3ee"
          strokeWidth={1}
        />
        <text x={216} y={2} fontSize={7} fill="#a1a1aa">
          Cover
        </text>
      </g>
    </svg>
  );
};

RCBeamCrossSection.displayName = "RCBeamCrossSection";

export default React.memo(RCBeamCrossSection);
