/**
 * DetailingDesignPage.tsx — Comprehensive Structural Detailing Center
 *
 * Advanced UX with:
 * - URL-based tab navigation (e.g. /design/detailing?tab=beam)
 * - Auto-populate from analysis results when model is loaded
 * - Quick-jump links to individual member design
 * - Design summary dashboard with pass/fail overview
 * - Memory-efficient lazy tab loading
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useModelStore } from '../store/model';
import type { Member, MemberForceData } from '../store/modelTypes';
import {
  Ruler, Columns3, Square, BarChart3, Layers, ArrowRight, CheckCircle,
  XCircle, AlertTriangle, Zap, FileText, Download, ChevronRight
} from 'lucide-react';
import { DesignPanelSkeleton } from '../components/ui/DesignPageSkeleton';

// Lazy-load heavy design panels — they pull in large engines
const RCDesignPanel = lazy(() =>
  import('../components/design/RCDesignPanel').then(m => ({ default: m.RCDesignPanel }))
);
const FoundationDesignPanel = lazy(() =>
  import('../components/design/FoundationDesignPanel').then(m => ({ default: m.FoundationDesignPanel }))
);
const DetailedDesignPanelInline = lazy(() =>
  import('../components/DetailedDesignPanel').then(m => ({ default: m.DetailedDesignPanel }))
);

type DetailingTab = 'overview' | 'beam' | 'column' | 'slab' | 'steel' | 'foundation' | 'rc';

interface TabInfo {
  id: DetailingTab;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  codes: string[];
}

const TABS: TabInfo[] = [
  {
    id: 'overview', label: 'Design Overview', description: 'Summary of all member designs',
    icon: Layers, color: 'from-blue-500 to-indigo-500', codes: [],
  },
  {
    id: 'beam', label: 'RC Beam', description: 'Flexure, shear, torsion, curtailment, crack width',
    icon: Ruler, color: 'from-emerald-500 to-teal-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'column', label: 'RC Column', description: 'P-M interaction, biaxial check, ties, lap splices',
    icon: Columns3, color: 'from-amber-500 to-orange-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'slab', label: 'RC Slab', description: 'One-way/two-way, temperature steel, deflection',
    icon: Square, color: 'from-purple-500 to-pink-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'steel', label: 'Steel Member', description: 'Classification, LTB, web buckling, connections',
    icon: BarChart3, color: 'from-cyan-500 to-blue-500', codes: ['IS 800:2007', 'AISC 360-22'],
  },
  {
    id: 'foundation', label: 'Foundation', description: 'Isolated, combined, strap, mat footings',
    icon: Layers, color: 'from-rose-500 to-red-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'rc', label: 'RC Design (IS 456)', description: 'Complete RC member design with code checks',
    icon: FileText, color: 'from-slate-500 to-gray-500', codes: ['IS 456:2000'],
  },
];

/** Classify member orientation from node positions */
function classifyMember(
  member: Member,
  nodes: Map<string, { x: number; y: number; z: number }>
): { orientation: 'beam' | 'column' | 'brace'; length: number } {
  const s = nodes.get(member.startNodeId);
  const e = nodes.get(member.endNodeId);
  if (!s || !e) return { orientation: 'beam', length: 3000 };
  const dx = e.x - s.x, dy = e.y - s.y, dz = e.z - s.z;
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const vr = Math.abs(dy) / (L || 1);
  if (vr > 0.6) return { orientation: 'column', length: L * 1000 };
  if (vr > 0.3) return { orientation: 'brace', length: L * 1000 };
  return { orientation: 'beam', length: L * 1000 };
}

// ── Overview Card ──────────────────────────────────────
const OverviewCard = memo(function OverviewCard({
  tab, memberCount, onClick
}: {
  tab: TabInfo; memberCount?: number; onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tab.color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tab.label}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{tab.description}</p>
      {tab.codes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tab.codes.map(code => (
            <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {code}
            </span>
          ))}
        </div>
      )}
      {memberCount !== undefined && memberCount > 0 && (
        <div className="mt-2 text-xs text-blue-500 font-medium">
          {memberCount} members available
        </div>
      )}
    </button>
  );
});

// ── Model Summary Banner ───────────────────────────────
const ModelSummaryBanner = memo(function ModelSummaryBanner({
  beamCount, columnCount, totalMembers, hasAnalysis, onDesignAll
}: {
  beamCount: number; columnCount: number; totalMembers: number;
  hasAnalysis: boolean; onDesignAll: () => void;
}) {
  if (totalMembers === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Model Loaded: {totalMembers} members
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {beamCount} beams · {columnCount} columns
              {hasAnalysis ? (
                <span className="text-green-500 ml-2">✓ Analysis results available</span>
              ) : (
                <span className="text-amber-500 ml-2">⚠ Run analysis first for auto-populate</span>
              )}
            </p>
          </div>
        </div>
        {hasAnalysis && (
          <button
            type="button"
            onClick={onDesignAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Design All Members
          </button>
        )}
      </div>
    </div>
  );
});

// ── Main Page Component ────────────────────────────────
export const DetailingDesignPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL-driven tab state
  const activeTab = (searchParams.get('tab') as DetailingTab) || 'overview';
  const setActiveTab = useCallback((tab: DetailingTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Store connection
  const members = useModelStore(s => s.members);
  const nodes = useModelStore(s => s.nodes);
  const analysisResults = useModelStore(s => s.analysisResults);

  const hasAnalysis = !!(analysisResults?.memberForces && analysisResults.memberForces.size > 0);

  // Classify members
  const memberStats = useMemo(() => {
    let beams = 0, columns = 0, braces = 0;
    members.forEach((member) => {
      const { orientation } = classifyMember(member, nodes as any);
      if (orientation === 'beam') beams++;
      else if (orientation === 'column') columns++;
      else braces++;
    });
    return { beams, columns, braces, total: members.size };
  }, [members, nodes]);

  useEffect(() => { document.title = 'Structural Detailing | BeamLab'; }, []);

  const handleDesignAll = useCallback(() => {
    // Navigate to the detailed design with batch mode
    // The DetailedDesignPanel handles batch design internally
    setActiveTab('beam');
  }, [setActiveTab]);

  // Active tab info
  const activeTabInfo = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Structural Detailing Center
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Complete member design with bar layout, curtailment, crack width, interaction diagrams
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/design-hub')}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg transition-colors"
              >
                Design Hub
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-0 -mb-px scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-all ${
                    isActive
                      ? 'border-blue-500 text-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Model summary (when model is loaded) */}
        {memberStats.total > 0 && activeTab === 'overview' && (
          <ModelSummaryBanner
            beamCount={memberStats.beams}
            columnCount={memberStats.columns}
            totalMembers={memberStats.total}
            hasAnalysis={hasAnalysis}
            onDesignAll={handleDesignAll}
          />
        )}

        {/* Overview Tab — Design Module Cards */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TABS.filter(t => t.id !== 'overview').map(tab => (
              <OverviewCard
                key={tab.id}
                tab={tab}
                memberCount={
                  tab.id === 'beam' ? memberStats.beams :
                  tab.id === 'column' ? memberStats.columns :
                  tab.id === 'steel' ? memberStats.total :
                  undefined
                }
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        )}

        {/* RC Beam / Column / Slab / Steel Tabs — uses DetailedDesignPanel inline */}
        {(activeTab === 'beam' || activeTab === 'column' || activeTab === 'slab' || activeTab === 'steel') && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <DetailedDesignPanelInline
                open={true}
                onClose={() => setActiveTab('overview')}
              />
            </Suspense>
          </div>
        )}

        {/* Foundation Tab */}
        {activeTab === 'foundation' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <FoundationDesignPanel />
            </Suspense>
          </div>
        )}

        {/* RC Design (IS 456) Tab */}
        {activeTab === 'rc' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <RCDesignPanel />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailingDesignPage;

