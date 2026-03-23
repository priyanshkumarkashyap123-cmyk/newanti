/**
 * ResultsHub.tsx — Unified Results Display & Report Generation
 * 
 * Consolidates:
 * - Analysis results (summary cards, reactions summary)
 * - Diagram selection (SFD, BMD, AFD)
 * - Member design details (D/C ratios, utilization, recommendations)
 * - Design/detailing/report navigation
 * 
 * Primary actions:
 * - Run Analysis
 * - Run Design Check
 * - Generate Full Report (primary CTA)
 */

import React, { FC, useState, useMemo, useCallback } from 'react';
import {
  Zap,
  BarChart3,
  Layers,
  Settings,
  Download,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Maximize2,
  FileText,
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useUIStore } from '../../store/uiStore';
import { UnifiedAnalysisResult, UnifiedDesignResult, UnifiedDetailingResult, UnifiedReportData } from '../../data/UnifiedResultsModel';
import type { UnifiedReportConfig } from '../../services/reports/UnifiedReportGenerator';
import { Tooltip } from '../ui/Tooltip';
import { AnalysisSkeleton } from '../ui/AnalysisSkeleton';

// ============================================================
// ANALYSIS SUMMARY CARDS
// ============================================================

interface SummaryCardProps {
  title: string;
  value: string;
  unit?: string;
  status?: 'normal' | 'warn' | 'critical';
  icon: React.FC<{ className?: string }>;
}

const SummaryCard: FC<SummaryCardProps> = ({ title, value, unit, status = 'normal', icon: Icon }) => {
  const colors = {
    normal: 'bg-emerald-50 dark:bg-emerald-950/30 border-[#1a2333] text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-50 dark:bg-amber-950/30 border-[#1a2333] text-amber-600 dark:text-amber-400',
    critical: 'bg-rose-50 dark:bg-rose-950/30 border-[#1a2333] text-rose-600 dark:text-rose-400',
  };

  return (
    <div className={`flex-1 min-w-[180px] p-4 rounded-lg border ${colors[status]} transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium tracking-wide opacity-75 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {unit && <p className="text-xs opacity-60 mt-1">{unit}</p>}
        </div>
        <Icon className="w-5 h-5 opacity-50 mt-1" />
      </div>
    </div>
  );
};

// ============================================================
// RESULTS HUB MODAL
// ============================================================

interface ResultsHubProps {
  analysisResults?: UnifiedAnalysisResult;
  designResults?: UnifiedDesignResult;
  detailingResults?: UnifiedDetailingResult;
  onClose?: () => void;
  onGenerateReport?: (config?: UnifiedReportConfig) => Promise<void>;
  isLoading?: boolean;
  progress?: import('../../hooks/useAnalysis').AnalysisProgressStep[];
}

export const ResultsHub: FC<ResultsHubProps> = ({
  analysisResults,
  designResults,
  detailingResults,
  onClose,
  onGenerateReport,
  isLoading = false,
  progress = [],
}) => {
  const showNotification = useUIStore((s) => s.showNotification);
  const analysisFreshness = useUIStore((s) => s.analysisFreshness);
  const [activeTab, setActiveTab] = useState<'ANALYSIS' | 'DESIGN' | 'DETAILING' | 'EXPORT'>('ANALYSIS');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<'SFD' | 'BMD' | 'AFD'>('BMD');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportConfig, setReportConfig] = useState<UnifiedReportConfig>({
    includeAnalysisSummary: true,
    includeDesignTables: true,
    includeDetailing: true,
    includeSchedules: true,
    includeSignatureBlock: true,
  });

  const handleRunAnalysis = useCallback(() => {
    document.dispatchEvent(new CustomEvent('trigger-analysis'));
  }, []);

  const handleRunDesign = useCallback(() => {
    if (analysisFreshness.stale) {
      showNotification('warning', analysisFreshness.staleReason || 'Results are stale. Re-run analysis first.');
      return;
    }
    if (!analysisResults || analysisResults.status !== 'complete') {
      showNotification('warning', 'Please run analysis first.');
      return;
    }
    document.dispatchEvent(new CustomEvent('trigger-design-check'));
  }, [analysisFreshness.stale, analysisFreshness.staleReason, analysisResults, showNotification]);

  const handleGenerateReport = useCallback(async () => {
    if (analysisFreshness.stale) {
      showNotification('warning', analysisFreshness.staleReason || 'Results are stale. Re-run analysis before exporting reports.');
      return;
    }
    if (!onGenerateReport) return;
    setIsGeneratingReport(true);
    try {
      await onGenerateReport(reportConfig);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [analysisFreshness.stale, analysisFreshness.staleReason, onGenerateReport, reportConfig, showNotification]);

  const toggleReportConfig = useCallback((key: keyof UnifiedReportConfig) => {
    setReportConfig((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }, []);

  // Analysis summary derived values
  const analysisSummary = useMemo(() => {
    if (!analysisResults || analysisResults.status !== 'complete') {
      return null;
    }

    return {
      nodeCount: analysisResults.nodeResults.size,
      memberCount: analysisResults.memberResults.size,
      maxDisplacement: analysisResults.maxDisplacement.value.toFixed(4),
      maxForce: analysisResults.maxMemberForce.value.toFixed(2),
      maxStress: analysisResults.maxStress.value.toFixed(2),
      maxReaction: analysisResults.reactions.maxReaction.toFixed(2),
    };
  }, [analysisResults]);

  // Design summary derived values
  const designSummary = useMemo(() => {
    if (!designResults || designResults.status !== 'complete') {
      return null;
    }

    return {
      designed: designResults.memberDesigns.size,
      critical: designResults.criticalMembers.length,
      failed: designResults.failedMembers.length,
      maxUtil: (designResults.maxUtilization * 100).toFixed(1),
      status: designResults.overallStatus,
    };
  }, [designResults]);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0b1326] rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2333] bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <div>
            <h2 className="text-xl font-bold text-[#dae2fd]">Results Hub</h2>
            <p className="text-xs text-[#869ab8] mt-0.5">
              Unified analysis, design, and detailing results
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex-1 overflow-auto">
            <AnalysisSkeleton steps={progress} />
          </div>
        )}

        {/* Tab Navigation */}
        {!isLoading && <div className="flex gap-1 px-6 py-3 border-b border-[#1a2333] bg-[#131b2e]">
          {(['ANALYSIS', 'DESIGN', 'DETAILING', 'EXPORT'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>}

        {/* Content */}
        {!isLoading && <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {analysisFreshness.stale && (
            <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/10">
              <p className="text-sm text-rose-200">
                <strong>Results are stale.</strong> {analysisFreshness.staleReason || 'Model changed after analysis.'}
              </p>
              <button
                type="button"
                onClick={handleRunAnalysis}
                className="mt-3 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium tracking-wide"
              >
                Re-run Analysis
              </button>
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'ANALYSIS' && (
            <div className="space-y-6">
              {/* Run button & status */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium tracking-wide flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Run Analysis
                </button>
                {analysisResults?.status === 'complete' && (
                  <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Analysis complete
                  </div>
                )}
              </div>

              {/* Summary cards */}
              {analysisSummary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <SummaryCard
                    title="Max Displacement"
                    value={analysisSummary.maxDisplacement}
                    unit="m"
                    icon={BarChart3}
                  />
                  <SummaryCard
                    title="Max Member Force"
                    value={analysisSummary.maxForce}
                    unit="kN"
                    icon={BarChart3}
                  />
                  <SummaryCard
                    title="Max Stress"
                    value={analysisSummary.maxStress}
                    unit="MPa"
                    icon={BarChart3}
                  />
                  <SummaryCard
                    title="Nodes Analyzed"
                    value={analysisSummary.nodeCount.toString()}
                    icon={Layers}
                  />
                  <SummaryCard
                    title="Members Analyzed"
                    value={analysisSummary.memberCount.toString()}
                    icon={BarChart3}
                  />
                  <SummaryCard
                    title="Max Reaction"
                    value={analysisSummary.maxReaction}
                    unit="kN"
                    icon={BarChart3}
                  />
                </div>
              )}

              {!analysisSummary && (
                <div className="text-center py-8 text-[#869ab8]">
                  <p className="text-lg font-medium tracking-wide mb-2">No analysis results yet</p>
                  <p className="text-sm">Click "Run Analysis" to generate structural analysis results</p>
                </div>
              )}
            </div>
          )}

          {/* DESIGN TAB */}
          {activeTab === 'DESIGN' && (
            <div className="space-y-6">
              {/* Run button & status */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleRunDesign}
                  disabled={!analysisResults || analysisResults.status !== 'complete'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Run Design Check
                </button>
                {designResults?.status === 'complete' && (
                  <div
                    className={`text-sm flex items-center gap-2 font-medium tracking-wide ${
                      designResults.failedMembers.length > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : designResults.criticalMembers.length > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {designResults.overallStatus.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Design summary cards */}
              {designSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard
                    title="Members Designed"
                    value={designSummary.designed.toString()}
                    icon={CheckCircle}
                  />
                  <SummaryCard
                    title="Critical (>80%)"
                    value={designSummary.critical.toString()}
                    status={designSummary.critical > 0 ? 'warn' : 'normal'}
                    icon={AlertTriangle}
                  />
                  <SummaryCard
                    title="Failed (>100%)"
                    value={designSummary.failed.toString()}
                    status={designSummary.failed > 0 ? 'critical' : 'normal'}
                    icon={AlertTriangle}
                  />
                  <SummaryCard
                    title="Max Utilization"
                    value={designSummary.maxUtil}
                    unit="%"
                    status={
                      designSummary.failed > 0 ? 'critical' : designSummary.critical > 0 ? 'warn' : 'normal'
                    }
                    icon={BarChart3}
                  />
                </div>
              )}

              {!designSummary && (
                <div className="text-center py-8 text-[#869ab8]">
                  <p className="text-lg font-medium tracking-wide mb-2">No design results yet</p>
                  <p className="text-sm">Run analysis first, then click "Run Design Check"</p>
                </div>
              )}

              {/* Design code info */}
              {designResults && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-[#1a2333]">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Design Code:</strong> {designResults.designCode} · <strong>Material:</strong>{' '}
                    {designResults.materialType.toUpperCase()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* DETAILING TAB */}
          {activeTab === 'DETAILING' && (
            <div className="space-y-6">
              {detailingResults?.status === 'complete' ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-[#1a2333]">
                  <p className="text-sm text-emerald-900 dark:text-emerald-100">
                    ✓ Detailing drawings available for <strong>{detailingResults.materialType}</strong> structure
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-[#869ab8]">
                  <p className="text-lg font-medium tracking-wide mb-2">Detailing not yet available</p>
                  <p className="text-sm">Complete design checks to generate detailing drawings and schedules</p>
                </div>
              )}
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === 'EXPORT' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="mb-6 flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#dae2fd] mb-2">Generate Full Report</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto">
                  Create a comprehensive PDF report including analysis results, design checks, detailing drawings, and material schedules
                </p>

                {/* Requirements check */}
                <div className="max-w-md mx-auto mb-6 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        analysisResults?.status === 'complete' ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      {analysisResults?.status === 'complete' ? '✓' : '○'}
                    </div>
                    <span className="text-sm">Analysis results required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        designResults?.status === 'complete' ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      {designResults?.status === 'complete' ? '✓' : '○'}
                    </div>
                    <span className="text-sm">Design checks recommended</span>
                  </div>
                </div>

                <div className="max-w-md mx-auto mb-6 text-left border border-[#1a2333] rounded-lg p-4 bg-slate-50/60 dark:bg-slate-800/30">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Include in report</p>
                  <div className="space-y-2">
                    {[
                      { key: 'includeAnalysisSummary' as const, label: 'Analysis Summary' },
                      { key: 'includeDesignTables' as const, label: 'Design Tables' },
                      { key: 'includeDetailing' as const, label: 'Detailing' },
                      { key: 'includeSchedules' as const, label: 'Schedules / Quantities' },
                      { key: 'includeSignatureBlock' as const, label: 'Signature Block' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reportConfig[item.key] ?? true}
                          onChange={() => toggleReportConfig(item.key)}
                          className="rounded border-slate-300"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={!analysisResults || analysisResults.status !== 'complete' || isGeneratingReport}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  <Download className="w-5 h-5" />
                  {isGeneratingReport ? 'Generating...' : 'Download PDF Report'}
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
};

export default ResultsHub;
