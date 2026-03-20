/**
 * SectionWiseResultsPanel.tsx
 *
 * Tabs: Envelope | Utilization | Layout | Table
 * SAFE/UNSAFE badge, economy ratio, governing station info.
 */

import { FC, useState } from 'react';
import { CheckCircle, XCircle, BarChart2, LineChart, Ruler, Table2 } from 'lucide-react';
import { DemandCapacityEnvelope } from './DemandCapacityEnvelope';
import { UtilizationProfile } from './UtilizationProfile';
import { RebarLayoutDiagram } from './RebarLayoutDiagram';
import type { SectionWiseResult, SteelSectionWiseResult } from '@/api/design';

type Tab = 'envelope' | 'utilization' | 'layout' | 'table';

interface Props {
  rcResult?: SectionWiseResult;
  steelResult?: SteelSectionWiseResult;
  spanMm: number;
  depthMm?: number;
  memberId?: string;
}

export const SectionWiseResultsPanel: FC<Props> = ({
  rcResult,
  steelResult,
  spanMm,
  depthMm,
  memberId,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('envelope');

  const isSafe = rcResult?.is_safe_everywhere ?? steelResult?.passed ?? false;
  const nSections = rcResult?.n_sections ?? steelResult?.n_sections ?? 0;
  const summary = rcResult?.summary ?? steelResult?.message ?? '';

  const tabs: { id: Tab; label: string; icon: FC<{ className?: string }> }[] = [
    { id: 'envelope', label: 'Envelope', icon: BarChart2 },
    { id: 'utilization', label: 'Utilization', icon: LineChart },
    { id: 'layout', label: rcResult ? 'Rebar Layout' : 'Member Layout', icon: Ruler },
    { id: 'table', label: 'Table', icon: Table2 },
  ];

  return (
    <div className="border border-[#1a2333] rounded-xl overflow-hidden bg-[#0b1326]">
      {/* Header */}
      <div className="px-4 py-3 bg-[#131b2e] border-b border-[#1a2333] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSafe ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <CheckCircle className="w-4 h-4" /> SAFE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <XCircle className="w-4 h-4" /> INADEQUATE
            </span>
          )}
          <span className="text-xs text-slate-500">
            {nSections} stations • {memberId ? `Member ${memberId}` : ''} • L = {(spanMm / 1000).toFixed(2)} m
          </span>
        </div>
        {rcResult && (
          <span className="text-xs font-mono text-indigo-600">
            Economy: {(rcResult.economy_ratio * 100).toFixed(0)}%
          </span>
        )}
        {steelResult && (
          <span className="text-xs font-mono text-indigo-600">
            Max UR: {(steelResult.utilization * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a2333]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium tracking-wide tracking-wide transition-colors
                ${activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'envelope' && (
          <DemandCapacityEnvelope
            rcResult={rcResult}
            steelResult={steelResult}
            spanMm={spanMm}
          />
        )}

        {activeTab === 'utilization' && (
          <UtilizationProfile
            rcResult={rcResult}
            steelResult={steelResult}
            spanMm={spanMm}
          />
        )}

        {activeTab === 'layout' && (
          <RebarLayoutDiagram
            rcResult={rcResult}
            steelResult={steelResult}
            spanMm={spanMm}
            depthMm={depthMm}
          />
        )}

        {activeTab === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1a2333] text-slate-500">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">x/L</th>
                  <th className="py-2 px-2">x (m)</th>
                  <th className="py-2 px-2">UR(M)</th>
                  <th className="py-2 px-2">UR(V)</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rcResult?.section_checks.map((s, i) => (
                  <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 ${
                    s.utilization_M > 1 || s.utilization_V > 1 ? 'bg-red-50 dark:bg-red-950' : ''
                  }`}>
                    <td className="py-1.5 px-2 font-mono">{i + 1}</td>
                    <td className="py-1.5 px-2 font-mono">{s.x_ratio.toFixed(3)}</td>
                    <td className="py-1.5 px-2 font-mono">{(s.x_ratio * spanMm / 1000).toFixed(3)}</td>
                    <td className="py-1.5 px-2 font-mono">{(s.utilization_M * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2 font-mono">{(s.utilization_V * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide tracking-wide ${
                        s.status === 'SAFE' || s.status === 'OK'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
                {steelResult?.section_checks.map((s, i) => (
                  <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 ${
                    Math.max(s.utilization_m, s.utilization_v) > 1 ? 'bg-red-50 dark:bg-red-950' : ''
                  }`}>
                    <td className="py-1.5 px-2 font-mono">{i + 1}</td>
                    <td className="py-1.5 px-2 font-mono">{s.location.x_ratio.toFixed(3)}</td>
                    <td className="py-1.5 px-2 font-mono">{(s.location.x_mm / 1000).toFixed(3)}</td>
                    <td className="py-1.5 px-2 font-mono">{(s.utilization_m * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2 font-mono">{(s.utilization_v * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide tracking-wide ${
                        s.passed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>{s.passed ? 'SAFE' : 'FAIL'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="px-4 py-2 bg-[#131b2e] border-t border-[#1a2333]">
          <p className="text-xs text-[#869ab8]">{summary}</p>
        </div>
      )}

      {/* Engineering notes */}
      {rcResult?.engineering_notes?.map((note, i) => (
        <div key={i} className="px-4 py-1 text-[10px] text-slate-500 font-mono">
          {note}
        </div>
      ))}
    </div>
  );
};
