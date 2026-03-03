/**
 * BeamPreview - SVG cross-section preview for RC beam
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BeamFormData } from "./rcBeamTypes";

const BeamPreview = React.memo(function BeamPreview({
  formData,
}: {
  formData: BeamFormData;
}) {
  const svgW = 440;
  const svgH = 340;
  const margin = { top: 30, right: 60, bottom: 50, left: 60 };
  const drawW = svgW - margin.left - margin.right;
  const drawH = svgH - margin.top - margin.bottom;

  // Scale to fit while preserving aspect ratio
  const aspectRatio = formData.b / formData.D;
  let beamW: number, beamH: number;
  if (aspectRatio > drawW / drawH) {
    beamW = drawW;
    beamH = drawW / aspectRatio;
  } else {
    beamH = drawH;
    beamW = drawH * aspectRatio;
  }
  const ox = margin.left + (drawW - beamW) / 2;
  const oy = margin.top + (drawH - beamH) / 2;
  const pxPerMM = beamW / formData.b;

  // Cover in px
  const coverPx = formData.cover * pxPerMM;
  const barRadius = Math.max(3, 10 * pxPerMM);
  const stirrupInset = coverPx;

  // Assume 4 bottom bars, 2 top bars for preview
  const nBot: number = 4;
  const nTop: number = 2;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" viewBox="0 0 16 16">
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
        </svg>
        Cross-Section Preview
      </h3>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-72 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <defs>
          <pattern
            id="preview-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#475569"
              strokeWidth="0.4"
            />
          </pattern>
        </defs>

        {formData.beamType === "rectangular" ? (
          <g>
            {/* Concrete section with hatch */}
            <rect
              x={ox}
              y={oy}
              width={beamW}
              height={beamH}
              fill="url(#preview-hatch)"
            />
            <rect
              x={ox}
              y={oy}
              width={beamW}
              height={beamH}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
            />
          </g>
        ) : (
          <g>
            {/* T-beam / L-beam */}
            {(() => {
              const bf = formData.bf || 1200;
              const Df = formData.Df || 120;
              const flangeW = Math.min(bf * pxPerMM, drawW);
              const flangeH = Df * pxPerMM;
              const webW = beamW;
              const webH = beamH - flangeH;
              const fox = margin.left + (drawW - flangeW) / 2;
              const foy = oy;
              const wox = ox;
              const woy = oy + flangeH;
              const path = `M${fox},${foy} h${flangeW} v${flangeH} h-${(flangeW - webW) / 2} v${webH} h-${webW} v-${webH} h-${(flangeW - webW) / 2} Z`;
              return (
                <>
                  <path d={path} fill="url(#preview-hatch)" />
                  <path d={path} fill="none" stroke="#94a3b8" strokeWidth="2" />
                </>
              );
            })()}
          </g>
        )}

        {/* Stirrup rectangle (inside cover) */}
        <rect
          x={ox + stirrupInset}
          y={oy + stirrupInset}
          width={beamW - 2 * stirrupInset}
          height={beamH - 2 * stirrupInset}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          rx="3"
        />
        {/* 135° hooks on stirrup */}
        <line
          x1={ox + stirrupInset + 8}
          y1={oy + stirrupInset}
          x2={ox + stirrupInset}
          y2={oy + stirrupInset + 10}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1={ox + beamW - stirrupInset - 8}
          y1={oy + stirrupInset}
          x2={ox + beamW - stirrupInset}
          y2={oy + stirrupInset + 10}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Bottom bars */}
        {Array.from({ length: nBot }).map((_, i) => {
          const startX = ox + stirrupInset + barRadius + 4;
          const endX = ox + beamW - stirrupInset - barRadius - 4;
          const cx =
            nBot === 1
              ? (startX + endX) / 2
              : startX + (i * (endX - startX)) / (nBot - 1);
          const cy = oy + beamH - stirrupInset - barRadius - 2;
          return (
            <circle
              key={`b${i}`}
              cx={cx}
              cy={cy}
              r={barRadius}
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Top bars */}
        {Array.from({ length: nTop }).map((_, i) => {
          const startX = ox + stirrupInset + barRadius + 4;
          const endX = ox + beamW - stirrupInset - barRadius - 4;
          const cx =
            nTop === 1
              ? (startX + endX) / 2
              : startX + (i * (endX - startX)) / (nTop - 1);
          const cy = oy + stirrupInset + barRadius + 2;
          return (
            <circle
              key={`t${i}`}
              cx={cx}
              cy={cy}
              r={barRadius * 0.8}
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Cover annotation — bottom */}
        <line
          x1={ox}
          y1={oy + beamH}
          x2={ox}
          y2={oy + beamH - coverPx}
          stroke="#22d3ee"
          strokeWidth="0.8"
        />
        <line
          x1={ox - 8}
          y1={oy + beamH}
          x2={ox + 8}
          y2={oy + beamH}
          stroke="#22d3ee"
          strokeWidth="0.6"
        />
        <line
          x1={ox - 8}
          y1={oy + beamH - coverPx}
          x2={ox + 8}
          y2={oy + beamH - coverPx}
          stroke="#22d3ee"
          strokeWidth="0.6"
        />
        <text
          x={ox - 12}
          y={oy + beamH - coverPx / 2 + 3}
          textAnchor="end"
          fontSize="8"
          fill="#22d3ee"
        >
          {formData.cover}
        </text>

        {/* Dimension: width (bottom) */}
        {/* Extension lines */}
        <line
          x1={ox}
          y1={oy + beamH + 5}
          x2={ox}
          y2={oy + beamH + 22}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW}
          y1={oy + beamH + 5}
          x2={ox + beamW}
          y2={oy + beamH + 22}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox}
          y1={oy + beamH + 18}
          x2={ox + beamW}
          y2={oy + beamH + 18}
          stroke="#a1a1aa"
          strokeWidth="0.6"
        />
        {/* Ticks */}
        <line
          x1={ox - 3}
          y1={oy + beamH + 21}
          x2={ox + 3}
          y2={oy + beamH + 15}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <line
          x1={ox + beamW - 3}
          y1={oy + beamH + 21}
          x2={ox + beamW + 3}
          y2={oy + beamH + 15}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <text
          x={ox + beamW / 2}
          y={oy + beamH + 35}
          textAnchor="middle"
          fontSize="10"
          fill="#a1a1aa"
          fontWeight="500"
        >
          {formData.b} mm
        </text>

        {/* Dimension: depth (right) */}
        <line
          x1={ox + beamW + 5}
          y1={oy}
          x2={ox + beamW + 22}
          y2={oy}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW + 5}
          y1={oy + beamH}
          x2={ox + beamW + 22}
          y2={oy + beamH}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW + 18}
          y1={oy}
          x2={ox + beamW + 18}
          y2={oy + beamH}
          stroke="#a1a1aa"
          strokeWidth="0.6"
        />
        <line
          x1={ox + beamW + 15}
          y1={oy - 3}
          x2={ox + beamW + 21}
          y2={oy + 3}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <line
          x1={ox + beamW + 15}
          y1={oy + beamH - 3}
          x2={ox + beamW + 21}
          y2={oy + beamH + 3}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <text
          x={ox + beamW + 35}
          y={oy + beamH / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#a1a1aa"
          fontWeight="500"
          transform={`rotate(-90, ${ox + beamW + 35}, ${oy + beamH / 2})`}
        >
          {formData.D} mm
        </text>

        {/* Legend */}
        <g transform={`translate(${margin.left}, ${svgH - 12})`}>
          <circle
            cx="6"
            cy="-2"
            r="4"
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth="0.5"
          />
          <text x="14" y="2" fontSize="8" fill="#94a3b8">
            Tension bars
          </text>
          <circle
            cx="80"
            cy="-2"
            r="3"
            fill="#f97316"
            stroke="#9a3412"
            strokeWidth="0.5"
          />
          <text x="88" y="2" fontSize="8" fill="#94a3b8">
            Hanger bars
          </text>
          <rect
            x="150"
            y="-5"
            width="12"
            height="6"
            rx="1"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <text x="166" y="2" fontSize="8" fill="#94a3b8">
            Stirrup
          </text>
        </g>
      </svg>
    </div>
  );
});

(BeamPreview as unknown as { displayName: string }).displayName = "BeamPreview";

export default BeamPreview;
