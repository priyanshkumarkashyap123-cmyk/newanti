/**
 * ResultsPanel - Display RC beam design results with flexure, shear, serviceability
 */

import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Download,
} from "lucide-react";
import type { BeamDesignResult } from "@/modules/concrete/RCBeamDesignEngine";

function ResultCard({
  title,
  status,
  children,
}: {
  title: string;
  status: "pass" | "fail";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === "pass"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm">{label}</span>
      <span className="text-slate-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

const ResultsPanel = React.memo(function ResultsPanel({
  result,
}: {
  result: BeamDesignResult;
}) {
  const isDesignOk =
    result.flexure.status === "safe" && result.shear.status === "safe";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Card */}
      <div
        className={`col-span-1 lg:col-span-3 p-6 rounded-2xl ${
          isDesignOk
            ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30"
            : "bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30"
        }`}
      >
        <div className="flex items-center gap-4">
          {isDesignOk ? (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-red-400" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isDesignOk ? "Design OK" : "Design Needs Revision"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {isDesignOk
                ? "All checks passed. Beam is safe for the applied loads."
                : "One or more checks failed. Please review and modify design."}
            </p>
          </div>
        </div>
      </div>

      {/* Flexural Design */}
      <ResultCard
        title="Flexural Design"
        status={result.flexure.status === "safe" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Applied Moment"
            value={`${result.loading.Mu.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Capacity"
            value={`${result.flexure.Mu_capacity.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Utilization"
            value={`${(result.flexure.utilizationRatio * 100).toFixed(1)}%`}
          />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow
              label="Tension Steel (Ast)"
              value={`${result.flexure.Ast_required.toFixed(0)} mm²`}
            />
            <ResultRow
              label="Bars Provided"
              value={result.flexure.tensionBars
                .map((b) => `${b.count}T${b.diameter}`)
                .join(" + ")}
            />
            {result.flexure.Asc_required > 0 && (
              <>
                <ResultRow
                  label="Compression Steel"
                  value={`${result.flexure.Asc_required.toFixed(0)} mm²`}
                />
                <ResultRow
                  label="Comp. Bars"
                  value={
                    result.flexure.compressionBars
                      .map((b) => `${b.count}T${b.diameter}`)
                      .join(" + ") || "-"
                  }
                />
              </>
            )}
          </div>
        </div>
      </ResultCard>

      {/* Shear Design */}
      <ResultCard
        title="Shear Design"
        status={result.shear.status === "safe" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Applied Shear"
            value={`${result.loading.Vu.toFixed(1)} kN`}
          />
          <ResultRow
            label="Concrete Capacity"
            value={`${result.shear.Vuc.toFixed(1)} kN`}
          />
          <ResultRow
            label="Steel Capacity"
            value={`${result.shear.Vus_required.toFixed(1)} kN`}
          />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow
              label="Stirrup Legs"
              value={`${result.shear.stirrupLegs}`}
            />
            <ResultRow
              label="Stirrup Spacing"
              value={`${result.shear.stirrupSpacing.toFixed(0)} mm`}
            />
            <ResultRow
              label="Stirrups Provided"
              value={`T${result.shear.stirrupDiameter}@${result.shear.stirrupSpacing.toFixed(0)}c/c`}
            />
          </div>
        </div>
      </ResultCard>

      {/* Serviceability */}
      <ResultCard
        title="Serviceability"
        status={result.deflection?.status === "pass" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Span/Depth (actual)"
            value={
              result.deflection?.spanDepthRatio_provided?.toFixed(1) || "-"
            }
          />
          <ResultRow
            label="Limit"
            value={result.deflection?.spanDepthRatio_allowed?.toFixed(1) || "-"}
          />
          {result.crackWidth && (
            <>
              <ResultRow
                label="Crack Width"
                value={`${result.crackWidth.crackWidth.toFixed(2)} mm`}
              />
              <ResultRow
                label="Limit"
                value={`${result.crackWidth.allowableCrackWidth.toFixed(2)} mm`}
              />
            </>
          )}
        </div>
      </ResultCard>

      {/* Export Button */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-900 dark:text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Drawing
        </motion.button>
      </div>
    </div>
  );
});

(ResultsPanel as unknown as { displayName: string }).displayName =
  "ResultsPanel";

export default ResultsPanel;
