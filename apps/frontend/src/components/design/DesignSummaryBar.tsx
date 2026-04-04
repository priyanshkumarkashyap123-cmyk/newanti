/**
 * DesignSummaryBar — Summary counts and action buttons for the detailing page
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 10.4, 11.1, 13.1
 */
import React from 'react';
import { Loader2, Play, FileText } from 'lucide-react';

interface DesignSummaryBarProps {
  summary: { total: number; pass: number; fail: number; skipped: number; passRate: number };
  onBatchDesign: () => void;
  onGenerateReport: () => void;
  isBatchRunning: boolean;
  hasResults: boolean;
}

export const DesignSummaryBar: React.FC<DesignSummaryBarProps> = ({
  summary,
  onBatchDesign,
  onGenerateReport,
  isBatchRunning,
  hasResults,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '0.5rem',
      }}
    >
      {/* Stat chips */}
      <StatChip label="Total" value={summary.total} color="#94a3b8" />
      <StatChip label="Pass" value={summary.pass} color="#4ade80" />
      <StatChip label="Fail" value={summary.fail} color="#f87171" />
      <StatChip label="Skipped" value={summary.skipped} color="#94a3b8" />

      {/* Pass rate */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Pass rate:</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: summary.passRate >= 100 ? '#4ade80' : summary.passRate >= 80 ? '#facc15' : '#f87171',
          }}
        >
          {summary.total === 0 ? '—' : `${summary.passRate.toFixed(1)}%`}
        </span>
      </div>

      {/* Buttons */}
      <button
        onClick={onBatchDesign}
        disabled={isBatchRunning}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.4375rem 0.875rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: isBatchRunning ? '#334155' : '#2563eb',
          color: isBatchRunning ? '#64748b' : '#fff',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: isBatchRunning ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
        aria-busy={isBatchRunning}
      >
        {isBatchRunning ? (
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
        ) : (
          <Play size={14} aria-hidden />
        )}
        Auto-Design All Members
      </button>

      <button
        onClick={onGenerateReport}
        disabled={!hasResults}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.4375rem 0.875rem',
          borderRadius: '0.375rem',
          border: '1px solid #334155',
          background: hasResults ? '#0f172a' : '#1e293b',
          color: hasResults ? '#e2e8f0' : '#475569',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: hasResults ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        <FileText size={14} aria-hidden />
        Generate Report
      </button>

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

interface StatChipProps {
  label: string;
  value: number;
  color: string;
}

const StatChip: React.FC<StatChipProps> = ({ label, value, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '3rem' }}>
    <span style={{ fontSize: '1.125rem', fontWeight: 700, color }}>{value}</span>
    <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
  </div>
);

export default DesignSummaryBar;
