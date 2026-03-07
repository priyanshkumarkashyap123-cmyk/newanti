/**
 * SpacePlanningPage.tsx - Complete House/Building Space Planning
 *
 * Professional multi-disciplinary planning page:
 * - Architectural floor plan generation (room placement, doors, windows)
 * - Structural layout (columns, beams, foundations)
 * - Electrical plan (circuits, fixtures, panels, load calc)
 * - Plumbing plan (supply, drainage, fixtures, rainwater)
 * - HVAC plan (AC sizing, ventilation, exhaust)
 * - Vastu Shastra / Astrological compliance
 * - Sunlight & shadow analysis
 * - Cross ventilation & airflow study
 * - 4 Elevation views (Front, Rear, Left, Right)
 * - 2 Cross-sections (A-A, B-B)
 * - Color & material recommendations
 * - DXF/PDF export support
 *
 * Built with 35+ years multi-disciplinary engineering wisdom.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  LayoutGrid,
  Compass,
  Zap,
  Droplets,
  Wind,
  Sun,
  Eye,
  Ruler,
  Palette,
  FileDown,
  Layers,
  Table2,
  ArrowLeft,
  ChevronDown,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
  PanelTopOpen,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Trophy,
  RefreshCw,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FloorPlanRenderer, OverlayMode } from '../components/space-planning/FloorPlanRenderer';
import { ElevationSectionViewer } from '../components/space-planning/ElevationSectionViewer';
import { VastuCompass } from '../components/space-planning/VastuCompass';
import { RoomConfigWizard, WizardConfig } from '../components/space-planning/RoomConfigWizard';
import { ConstraintScorecard } from '../components/space-planning/ConstraintScorecard';
import { CandidateComparison } from '../components/space-planning/CandidateComparison';
import { spacePlanningEngine } from '../services/space-planning/SpacePlanningEngine';
import {
  solveLayout,
  solveMultipleCandidates,
  placementsToPlacedRooms,
  checkSolverBackendHealth,
  type ConstraintReport,
  type PlacementResponse,
  type MultiCandidateResult,
} from '../services/space-planning/layoutApiService';
import type { HousePlanProject, ColorScheme } from '../services/space-planning/types';
import { getLearningProgress, saveLearningProgress, completeTemplate } from '../services/learning/progressTracker';
import { checkMilestoneUnlocks, applyMilestoneUnlocks } from '../services/learning/milestoneUnlocker';
import { recordSessionEnd, recordTemplateCompletion } from '../services/learning/analyticsTracker';

// ============================================
// TABS
// ============================================

type PlanTab =
  | 'wizard'
  | 'floor_plan'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'vastu'
  | 'sunlight'
  | 'airflow'
  | 'elevations'
  | 'sections'
  | 'colors'
  | 'schedule';

const PLAN_TABS: { key: PlanTab; label: string; icon: typeof Building2; group: string }[] = [
  { key: 'wizard', label: 'Configure', icon: Settings2, group: 'Setup' },
  { key: 'floor_plan', label: 'Floor Plan', icon: LayoutGrid, group: 'Architectural' },
  { key: 'structural', label: 'Structural', icon: Building2, group: 'Structural' },
  { key: 'electrical', label: 'Electrical', icon: Zap, group: 'MEP' },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets, group: 'MEP' },
  { key: 'hvac', label: 'HVAC', icon: Wind, group: 'MEP' },
  { key: 'vastu', label: 'Vastu', icon: Compass, group: 'Analysis' },
  { key: 'sunlight', label: 'Sunlight', icon: Sun, group: 'Analysis' },
  { key: 'airflow', label: 'Airflow', icon: Thermometer, group: 'Analysis' },
  { key: 'elevations', label: 'Elevations', icon: Eye, group: 'Drawings' },
  { key: 'sections', label: 'Sections', icon: PanelTopOpen, group: 'Drawings' },
  { key: 'colors', label: 'Colors', icon: Palette, group: 'Finishes' },
  { key: 'schedule', label: 'Schedule', icon: Table2, group: 'Documents' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function SpacePlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template') || undefined;
  const [activeTab, setActiveTab] = useState<PlanTab>('wizard');
  const [project, setProject] = useState<HousePlanProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // ── NEW: Constraint solver state ──
  const [constraintReport, setConstraintReport] = useState<ConstraintReport | null>(null);
  const [solverPlacements, setSolverPlacements] = useState<PlacementResponse[] | null>(null);
  const [multiCandidateResult, setMultiCandidateResult] = useState<MultiCandidateResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [generationMode, setGenerationMode] = useState<'single' | 'multi'>('single');
  const [solverError, setSolverError] = useState<string | null>(null);
  const [solverBackendState, setSolverBackendState] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [solverBackendMessage, setSolverBackendMessage] = useState<string | null>(null);
  const [lastWizardConfig, setLastWizardConfig] = useState<WizardConfig | null>(null);

  const parseSolverError = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const anyErr = err as Record<string, unknown>;
      const status = typeof anyErr.status === 'number' ? anyErr.status : undefined;
      const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
      const message = typeof anyErr.message === 'string' ? anyErr.message : undefined;

      if (status === 404) return 'Optimization service route not found (HTTP 404).';
      if (status === 0 || code === 'NETWORK_ERROR') return 'Optimization service is currently unreachable.';
      if (status && status >= 500) return `Optimization service error (HTTP ${status}).`;
      if (status && status >= 400) return `Optimization request failed (HTTP ${status}).`;
      if (code === 'TIMEOUT') return 'Optimization request timed out. Please retry.';
      if (message) return message;
    }

    if (err instanceof Error && err.message) return err.message;
    return 'Unknown solver error.';
  };

  const runSolverHealthCheck = useCallback(async () => {
    setSolverBackendState('checking');
    setSolverBackendMessage('Checking optimization service...');

    const health = await checkSolverBackendHealth();
    if (health.ok) {
      setSolverBackendState('online');
      setSolverBackendMessage('Optimization service is available.');
    } else {
      setSolverBackendState('offline');
      setSolverBackendMessage('Optimization service is currently unavailable.');
    }

    return health;
  }, []);

  useEffect(() => {
    document.title = 'Space Planning | BeamLab';
    // Record session start
    sessionStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Warm check backend once so retry banner has immediate diagnostics
    runSolverHealthCheck();
  }, [runSolverHealthCheck]);

  const handleTemplateCompletion = useCallback(() => {
    if (!templateId) return;

    // Update learning progress
    let progressState = getLearningProgress();
    progressState = completeTemplate(progressState, templateId);
    saveLearningProgress(progressState);

    // Record analytics
    recordTemplateCompletion();
    const sessionDurationMs = Date.now() - sessionStartRef.current;
    recordSessionEnd(sessionStartRef.current, Math.floor(sessionDurationMs / 60000));

    // Check for milestone unlocks
    const unlockResult = checkMilestoneUnlocks(progressState, 'Learner');
    if (unlockResult.unlockedMilestones.length > 0) {
      progressState = applyMilestoneUnlocks(progressState, unlockResult);
      saveLearningProgress(progressState);

      // Show milestone notification (could use toast here)
      console.log('Milestones unlocked:', unlockResult.unlockedMilestones);
    }
  }, [templateId]);

  const handleGenerate = useCallback(
    async (config: WizardConfig) => {
      setIsGenerating(true);
      setSolverError(null);
      setLastWizardConfig(config);
      try {
        // ── Phase 1: Call backend v2 CSP solver for optimized placement ──
        let report: ConstraintReport | null = null;
        let placements: PlacementResponse[] | null = null;

        if (generationMode === 'multi') {
          // Multi-candidate mode: generate 3 alternatives
          try {
            const multiResult = await solveMultipleCandidates(config, 3, 300);
            setMultiCandidateResult(multiResult);
            setShowCandidates(true);

            // Auto-select the best candidate
            const best = multiResult.candidates[0];
            setSelectedCandidateId(best.id);
            report = best.report;
            placements = best.placements;
            setConstraintReport(report);
            setSolverPlacements(placements);
          } catch (apiErr) {
            console.warn('Multi-candidate solver failed, falling back to single:', apiErr);
            // Fall through to single mode
          }
        }

        if (!report) {
          // Single candidate mode (or fallback)
          try {
            const solverResult = await solveLayout(config, { maxIterations: 300 });
            report = solverResult.report;
            placements = solverResult.placements;
            setConstraintReport(report);
            setSolverPlacements(placements);
            setSolverBackendState('online');
            setSolverBackendMessage('Backend solver connected.');
          } catch (apiErr) {
            console.warn('Optimization service unavailable, using client-side engine:', apiErr);
            setSolverBackendState('offline');
            const diag = parseSolverError(apiErr);
            setSolverBackendMessage(diag);
            setSolverError(
              'Optimization service unavailable — using client-side placement. ' +
              `Constraint analysis will not be available. ${diag}`,
            );
          }
        }

        // ── Phase 2: Generate complete project using the engine ──
        // If we got solver placements, merge them into the engine-generated plan.
        // The engine still handles doors, windows, walls, MEP, Vastu, elevations etc.
        const result = spacePlanningEngine.generateCompletePlan(
          config.plot,
          config.orientation,
          config.constraints,
          config.roomSpecs,
          config.preferences,
          config.location,
        );

        // ── Phase 3: If solver succeeded, override room placements with optimized positions ──
        if (placements && placements.length > 0) {
          const optimizedRooms = placementsToPlacedRooms(placements, config.roomSpecs);

          // Merge solver placements into the base floor plan, preserving
          // doors/windows/finishes from the engine but using solver positions
          if (result.floorPlans.length > 0) {
            const basePlan = result.floorPlans[0];
            const mergedRooms = basePlan.rooms.map((engineRoom) => {
              const solverRoom = optimizedRooms.find(
                (sr) => sr.id === engineRoom.id || sr.spec.type === engineRoom.spec.type,
              );
              if (solverRoom) {
                return {
                  ...engineRoom,
                  x: solverRoom.x,
                  y: solverRoom.y,
                  width: solverRoom.width,
                  height: solverRoom.height,
                };
              }
              return engineRoom;
            });
            result.floorPlans[0] = { ...basePlan, rooms: mergedRooms };
          }
        }

        setProject(result);
        setActiveTab('floor_plan');
        setSelectedFloor(0);

        // Mark template as completed if this was a guided template
        if (templateId) {
          handleTemplateCompletion();
        }
      } catch (err) {
        console.error('Plan generation failed:', err);
        setSolverError('Plan generation failed. Please check your configuration and try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [templateId, handleTemplateCompletion, generationMode],
  );

  // ── Handle candidate selection from comparison panel ──
  const handleSelectCandidate = useCallback(
    (candidateId: string) => {
      if (!multiCandidateResult || !lastWizardConfig) return;
      const candidate = multiCandidateResult.candidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      setSelectedCandidateId(candidateId);
      setConstraintReport(candidate.report);
      setSolverPlacements(candidate.placements);

      // Re-merge this candidate's placements into the project
      if (project && project.floorPlans.length > 0) {
        const optimizedRooms = placementsToPlacedRooms(
          candidate.placements,
          lastWizardConfig.roomSpecs,
        );
        const basePlan = project.floorPlans[0];
        const mergedRooms = basePlan.rooms.map((engineRoom) => {
          const solverRoom = optimizedRooms.find(
            (sr) => sr.id === engineRoom.id || sr.spec.type === engineRoom.spec.type,
          );
          if (solverRoom) {
            return {
              ...engineRoom,
              x: solverRoom.x,
              y: solverRoom.y,
              width: solverRoom.width,
              height: solverRoom.height,
            };
          }
          return engineRoom;
        });

        setProject({
          ...project,
          floorPlans: [
            { ...basePlan, rooms: mergedRooms },
            ...project.floorPlans.slice(1),
          ],
        });
      }
    },
    [multiCandidateResult, lastWizardConfig, project],
  );

  // ── Handle re-solve with different seed ──
  const handleRegenerate = useCallback(() => {
    if (lastWizardConfig) {
      handleGenerate(lastWizardConfig);
    }
  }, [lastWizardConfig, handleGenerate]);

  // ── Handle violation click → highlight room on canvas ──
  const handleViolationClick = useCallback((roomIds: string[]) => {
    if (roomIds.length > 0) {
      setSelectedRoomId(roomIds[0]);
      setActiveTab('floor_plan');
    }
  }, []);

  const currentFloorPlan =
    project?.floorPlans.find((fp) => fp.floor === selectedFloor) || project?.floorPlans[0];

  // Floor-aware MEP filtering so overlays and summaries reflect selected floor only
  const floorRoomIdSet = useMemo(() => {
    return new Set((currentFloorPlan?.rooms || []).map((r) => r.id));
  }, [currentFloorPlan]);

  const floorElectrical = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const fixtures = project.electrical.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
    const fixtureSet = new Set(fixtures.map((f) => f.id));
    const circuits = project.electrical.circuits
      .map((c) => ({ ...c, fixtures: c.fixtures.filter((id) => fixtureSet.has(id)) }))
      .filter((c) => c.fixtures.length > 0);
    const panels = project.electrical.panels.filter((p) => floorRoomIdSet.has(p.roomId));
    const connectedLoad = fixtures.reduce((sum, f) => sum + f.wattage, 0) / 1000;

    return {
      ...project.electrical,
      fixtures,
      circuits,
      panels,
      connectedLoad,
      mainLoad: connectedLoad,
      demandLoad: connectedLoad * 0.72,
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  const floorPlumbing = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const fixtures = project.plumbing.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
    const pipes = project.plumbing.pipes.filter((p) => p.floor === currentFloorPlan.floor);
    return {
      ...project.plumbing,
      fixtures,
      pipes,
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  const floorHVAC = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const equipment = project.hvac.equipment.filter((e) => floorRoomIdSet.has(e.roomId));
    const roomSet = new Set(equipment.map((e) => e.roomId));
    const ventilationPaths = project.hvac.ventilationPaths.filter(
      (v) => roomSet.has(v.startRoomId) || (!!v.endRoomId && roomSet.has(v.endRoomId)),
    );
    const ductRoutes = project.hvac.ductRoutes.filter((d) => d.floor === currentFloorPlan.floor);
    return {
      ...project.hvac,
      equipment,
      ventilationPaths,
      ductRoutes,
      coolingLoad:
        equipment
          .filter((e) => ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type))
          .reduce((sum, e) => sum + (typeof e.capacity === 'number' ? e.capacity : 0), 0),
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  // Map tab to overlay mode
  const getOverlayForTab = (tab: PlanTab): OverlayMode => {
    switch (tab) {
      case 'structural':
        return 'structural';
      case 'electrical':
        return 'electrical';
      case 'plumbing':
        return 'plumbing';
      case 'hvac':
        return 'hvac';
      default:
        return 'none';
    }
  };

  const selectedRoom = currentFloorPlan?.rooms.find((r) => r.id === selectedRoomId);

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stream')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">Space Planning</h1>
          </div>
          {project && (
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {project.plot.width}m × {project.plot.depth}m | {project.floorPlans.length} floor(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <>
              {/* Constraint solver score badge */}
              {constraintReport && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                    constraintReport.score >= 85
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : constraintReport.score >= 70
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                  onClick={() => setActiveTab('floor_plan')}
                  title="Constraint compliance score — click to view details"
                >
                  {constraintReport.score >= 85 ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : constraintReport.score >= 70 ? (
                    <ShieldAlert className="w-3 h-3" />
                  ) : (
                    <ShieldX className="w-3 h-3" />
                  )}
                  Solver: {constraintReport.score}%
                </div>
              )}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold ${
                  project.vastu.overallScore >= 80
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : project.vastu.overallScore >= 60
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}
              >
                <Compass className="w-3 h-3" />
                Vastu: {project.vastu.overallScore}%
              </div>
              {/* Regenerate button */}
              {lastWizardConfig && (
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50"
                  title="Re-solve with different seed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={() => setActiveTab('wizard')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Edit Config
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="w-44 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-y-auto flex-shrink-0 hidden md:block">
          {(
            [
              'Setup',
              'Architectural',
              'Structural',
              'MEP',
              'Analysis',
              'Drawings',
              'Finishes',
              'Documents',
            ] as const
          ).map((group) => {
            const groupTabs = PLAN_TABS.filter((t) => t.group === group);
            if (groupTabs.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  {group}
                </div>
                {groupTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  const isDisabled = tab.key !== 'wizard' && !project;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => !isDisabled && setActiveTab(tab.key)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600'
                          : isDisabled
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex overflow-x-auto px-2 py-1 gap-0.5">
          {PLAN_TABS.filter((t) => t.key === 'wizard' || project)
            .slice(0, 8)
            .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded text-[9px] min-w-[48px] ${
                    activeTab === tab.key
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* ======================== WIZARD ======================== */}
              {activeTab === 'wizard' && (
                <RoomConfigWizard
                  initialTemplateId={templateId}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  className="max-w-2xl mx-auto"
                />
              )}

              {/* ======================== FLOOR PLAN ======================== */}
              {activeTab === 'floor_plan' && project && currentFloorPlan && (
                <div className="space-y-4">
                  {/* Solver error banner */}
                  {solverError && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">{solverError}</p>
                        {solverBackendMessage && (
                          <p className="text-[10px] text-amber-600/90 dark:text-amber-400/80 mt-0.5">
                            {solverBackendMessage}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            onClick={async () => {
                              const health = await runSolverHealthCheck();
                              if (health.ok && lastWizardConfig) {
                                handleRegenerate();
                              }
                            }}
                            disabled={isGenerating || solverBackendState === 'checking'}
                            className="text-[10px] text-amber-700 underline hover:text-amber-900 disabled:opacity-60"
                          >
                            {solverBackendState === 'checking'
                              ? 'Checking service...'
                              : 'Check service & retry'}
                          </button>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              solverBackendState === 'online'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : solverBackendState === 'offline'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : solverBackendState === 'checking'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            Optimizer: {solverBackendState}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <FloorSelector
                      floors={project.floorPlans}
                      selected={selectedFloor}
                      onChange={setSelectedFloor}
                    />
                    <div className="flex items-center gap-2">
                      {/* Generation mode toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => setGenerationMode('single')}
                          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                            generationMode === 'single'
                              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Single
                        </button>
                        <button
                          onClick={() => setGenerationMode('multi')}
                          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 ${
                            generationMode === 'multi'
                              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Trophy className="w-3 h-3" />
                          Compare
                        </button>
                      </div>
                      <OverlaySelector current={overlayMode} onChange={setOverlayMode} />
                    </div>
                  </div>

                  {/* Main floor plan + scorecard layout */}
                  <div className="flex gap-4">
                    {/* Floor plan (left/main) */}
                    <div className="flex-1 min-w-0">
                      <FloorPlanRenderer
                        floorPlan={currentFloorPlan}
                        plot={project.plot}
                        constraints={project.constraints}
                        orientation={project.orientation}
                        structural={overlayMode === 'structural' ? project.structural : undefined}
                        electrical={overlayMode === 'electrical' ? project.electrical : undefined}
                        plumbing={overlayMode === 'plumbing' ? project.plumbing : undefined}
                        hvac={overlayMode === 'hvac' ? project.hvac : undefined}
                        overlayMode={overlayMode}
                        sectionLines={project.sectionLines}
                        selectedRoomId={selectedRoomId}
                        onRoomSelect={setSelectedRoomId}
                        showGrid
                        showDimensions
                        showCompass
                        showLabels
                        className="h-[600px]"
                        constraintReport={constraintReport ?? undefined}
                        solverPlacements={solverPlacements ?? undefined}
                        onViolationClick={(roomId, _domain) => handleViolationClick([roomId])}
                      />
                    </div>

                    {/* Constraint scorecard (right rail) */}
                    {constraintReport && (
                      <div className="w-72 flex-shrink-0 hidden lg:block space-y-3 overflow-y-auto max-h-[600px]">
                        <ConstraintScorecard
                          report={constraintReport}
                          onViolationClick={handleViolationClick}
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile constraint scorecard (below floor plan) */}
                  {constraintReport && (
                    <div className="lg:hidden">
                      <ConstraintScorecard
                        report={constraintReport}
                        onViolationClick={handleViolationClick}
                        collapsed
                      />
                    </div>
                  )}

                  {/* Multi-candidate comparison panel */}
                  {multiCandidateResult && showCandidates && (
                    <CandidateComparison
                      result={multiCandidateResult}
                      onSelectCandidate={handleSelectCandidate}
                      selectedCandidateId={selectedCandidateId || undefined}
                    />
                  )}
                  {/* Room details panel */}
                  {selectedRoom && <RoomDetailsPanel room={selectedRoom} project={project} />}
                </div>
              )}

              {/* ======================== STRUCTURAL ======================== */}
              {activeTab === 'structural' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" /> Structural Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    structural={project.structural}
                    overlayMode="structural"
                    sectionLines={project.sectionLines}
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <StructuralSummary structural={project.structural} />
                </div>
              )}

              {/* ======================== ELECTRICAL ======================== */}
              {activeTab === 'electrical' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" /> Electrical Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    electrical={floorElectrical || project.electrical}
                    overlayMode="electrical"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <ElectricalSummary electrical={floorElectrical || project.electrical} />
                  <ElectricalDetailingPanel electrical={floorElectrical || project.electrical} />
                </div>
              )}

              {/* ======================== PLUMBING ======================== */}
              {activeTab === 'plumbing' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" /> Plumbing Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    plumbing={floorPlumbing || project.plumbing}
                    overlayMode="plumbing"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <PlumbingSummary plumbing={floorPlumbing || project.plumbing} />
                  <PlumbingDetailingPanel plumbing={floorPlumbing || project.plumbing} />
                </div>
              )}

              {/* ======================== HVAC ======================== */}
              {activeTab === 'hvac' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-purple-500" /> HVAC & Ventilation Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    hvac={floorHVAC || project.hvac}
                    overlayMode="hvac"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <HVACSummary hvac={floorHVAC || project.hvac} />
                  <HVACDetailingPanel hvac={floorHVAC || project.hvac} />
                </div>
              )}

              {/* ======================== VASTU ======================== */}
              {activeTab === 'vastu' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-500" /> Vastu Shastra Analysis
                  </h2>
                  <VastuCompass analysis={project.vastu} />
                </div>
              )}

              {/* ======================== SUNLIGHT ======================== */}
              {activeTab === 'sunlight' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" /> Sunlight & Shadow Analysis
                  </h2>
                  <SunlightAnalysisPanel
                    sunlight={project.sunlight}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                  <SimulationCompliancePanel
                    sunlight={project.sunlight}
                    airflow={project.airflow}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                </div>
              )}

              {/* ======================== AIRFLOW ======================== */}
              {activeTab === 'airflow' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-green-500" /> Airflow & Ventilation
                    Analysis
                  </h2>
                  <AirflowAnalysisPanel
                    airflow={project.airflow}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                </div>
              )}

              {/* ======================== ELEVATIONS ======================== */}
              {activeTab === 'elevations' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500" /> Elevation Views
                  </h2>
                  <ElevationSectionViewer views={project.elevations} className="min-h-[400px]" />
                </div>
              )}

              {/* ======================== SECTIONS ======================== */}
              {activeTab === 'sections' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <PanelTopOpen className="w-4 h-4 text-red-500" /> Cross-Section Views
                  </h2>
                  <ElevationSectionViewer views={project.sections} className="min-h-[400px]" />
                </div>
              )}

              {/* ======================== COLORS ======================== */}
              {activeTab === 'colors' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-500" /> Color & Material Recommendations
                  </h2>
                  <ColorSchemePanel schemes={project.colorSchemes} />
                </div>
              )}

              {/* ======================== SCHEDULE ======================== */}
              {activeTab === 'schedule' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-slate-500" /> Room & Door/Window Schedule
                  </h2>
                  <SchedulePanel project={project} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

const FloorSelector: React.FC<{
  floors: HousePlanProject['floorPlans'];
  selected: number;
  onChange: (floor: number) => void;
}> = ({ floors, selected, onChange }) => (
  <div className="flex gap-1">
    {floors.map((fp) => (
      <button
        key={fp.floor}
        onClick={() => onChange(fp.floor)}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
          selected === fp.floor
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
        }`}
      >
        {fp.label}
      </button>
    ))}
  </div>
);

const OverlaySelector: React.FC<{
  current: OverlayMode;
  onChange: (mode: OverlayMode) => void;
}> = ({ current, onChange }) => (
  <div className="flex gap-1">
    {[
      { key: 'none' as const, label: 'Plan Only', icon: LayoutGrid },
      { key: 'structural' as const, label: 'Structural', icon: Building2 },
      { key: 'electrical' as const, label: 'Electrical', icon: Zap },
      { key: 'plumbing' as const, label: 'Plumbing', icon: Droplets },
      { key: 'hvac' as const, label: 'HVAC', icon: Wind },
    ].map((opt) => {
      const Icon = opt.icon;
      return (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          title={opt.label}
          className={`p-1.5 rounded ${current === opt.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      );
    })}
  </div>
);

const RoomDetailsPanel: React.FC<{
  room: import('../services/space-planning/types').PlacedRoom;
  project: HousePlanProject;
}> = ({ room, project }) => {
  const colorScheme = project.colorSchemes.find((cs) => cs.roomType === room.spec.type);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
        {room.spec.name}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <InfoItem
          label="Dimensions"
          value={`${room.width.toFixed(1)}m × ${room.height.toFixed(1)}m`}
        />
        <InfoItem label="Area" value={`${(room.width * room.height).toFixed(1)} sq.m`} />
        <InfoItem label="Ceiling Height" value={`${room.ceilingHeight}m`} />
        <InfoItem label="Wall Thickness" value={`${room.wallThickness * 1000}mm`} />
        <InfoItem label="Floor Finish" value={room.finishFloor} />
        <InfoItem label="Wall Finish" value={room.finishWall} />
        <InfoItem label="Ceiling Finish" value={room.finishCeiling} />
        <InfoItem label="Vastu Direction" value={room.spec.vastuDirection || 'N/A'} />
        <InfoItem label="Doors" value={`${room.doors.length}`} />
        <InfoItem label="Windows" value={`${room.windows.length}`} />
        {colorScheme && (
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-slate-400">Colors:</span>
            {[colorScheme.wallColor, colorScheme.floorColor, colorScheme.accentColor].map(
              (c, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded border border-slate-300"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ),
            )}
            <span className="text-[10px] text-slate-400">Mood: {colorScheme.mood}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{value}</div>
  </div>
);

const StructuralSummary: React.FC<{ structural: HousePlanProject['structural'] }> = ({
  structural,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Columns"
      value={`${structural.columns.length}`}
      detail={`${structural.columns[0]?.width * 1000}×${structural.columns[0]?.depth * 1000}mm`}
      color="blue"
    />
    <SummaryCard
      label="Beams"
      value={`${structural.beams.length}`}
      detail={`${structural.beams[0]?.width * 1000}×${structural.beams[0]?.depth * 1000}mm`}
      color="indigo"
    />
    <SummaryCard
      label="Foundations"
      value={`${structural.foundations.length}`}
      detail={structural.foundations[0]?.type}
      color="amber"
    />
    <SummaryCard
      label="Slab"
      value={structural.slabType.replace(/_/g, ' ')}
      detail={`${structural.slabThickness * 1000}mm thick`}
      color="green"
    />
  </div>
);

const ElectricalSummary: React.FC<{ electrical: HousePlanProject['electrical'] }> = ({
  electrical,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Connected Load"
      value={`${electrical.connectedLoad.toFixed(1)} kW`}
      detail={`Demand: ${electrical.demandLoad.toFixed(1)} kW`}
      color="yellow"
    />
    <SummaryCard
      label="Fixtures"
      value={`${electrical.fixtures.length}`}
      detail={`${electrical.circuits.length} circuits`}
      color="amber"
    />
    <SummaryCard
      label="Supply"
      value={electrical.meterType.replace(/_/g, ' ')}
      detail={`${electrical.earthingType} earthing`}
      color="red"
    />
    <SummaryCard
      label="Panels"
      value={`${electrical.panels.length}`}
      detail={electrical.lightningProtection ? 'Lightning protected' : ''}
      color="orange"
    />
  </div>
);

const PlumbingSummary: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({ plumbing }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Fixtures"
      value={`${plumbing.fixtures.length}`}
      detail={`${plumbing.pipes.length} pipe runs`}
      color="blue"
    />
    <SummaryCard
      label="Storage"
      value={`${plumbing.storageCapacity} L`}
      detail={`OHT: ${plumbing.overheadTankCapacity}L | Sump: ${plumbing.sumpCapacity}L`}
      color="cyan"
    />
    <SummaryCard
      label="Source"
      value={plumbing.waterSupplySource}
      detail={`Pump: ${plumbing.pumpHP} HP`}
      color="teal"
    />
    <SummaryCard
      label="Features"
      value={plumbing.rainwaterHarvesting ? 'RWH ✓' : 'No RWH'}
      detail={`Hot: ${plumbing.hotWaterSystem}`}
      color="green"
    />
  </div>
);

const HVACSummary: React.FC<{ hvac: HousePlanProject['hvac'] }> = ({ hvac }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Cooling Load"
      value={`${hvac.coolingLoad.toFixed(1)} TR`}
      detail={`${hvac.equipment.filter((e) => e.type === 'split_ac').length} AC units`}
      color="blue"
    />
    <SummaryCard
      label="Equipment"
      value={`${hvac.equipment.length}`}
      detail={`Fans, AC, exhaust`}
      color="indigo"
    />
    <SummaryCard
      label="Ventilation"
      value={`${hvac.ventilationRate} ACH`}
      detail={`${hvac.freshAirPercentage}% fresh air`}
      color="teal"
    />
    <SummaryCard
      label="Cross Vent"
      value={`${hvac.ventilationPaths.length} paths`}
      detail="Natural + mechanical"
      color="green"
    />
  </div>
);

const ElectricalDetailingPanel: React.FC<{ electrical: HousePlanProject['electrical'] }> = ({
  electrical,
}) => {
  const fixtureByType = electrical.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Electrical Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold">Circuit Schedule</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th className="px-2 py-1 text-left">Circuit</th>
                <th className="px-2 py-1 text-center">MCB</th>
                <th className="px-2 py-1 text-center">Wire</th>
                <th className="px-2 py-1 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {electrical.circuits.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1">{c.name}</td>
                  <td className="px-2 py-1 text-center">{c.mcbRating}A</td>
                  <td className="px-2 py-1 text-center">{c.wireSize}mm²</td>
                  <td className="px-2 py-1 text-center">{c.fixtures.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold mb-2">Fixture Mix & Safety</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Smoke Detectors" value={`${fixtureByType.smoke_detector || 0}`} />
            <InfoMini label="Emergency Lights" value={`${fixtureByType.emergency_light || 0}`} />
            <InfoMini label="CCTV Points" value={`${fixtureByType.cctv || 0}`} />
            <InfoMini label="EV Chargers" value={`${fixtureByType.ev_charging || 0}`} />
            <InfoMini label="Solar Ready" value={electrical.solarCapacity ? `${electrical.solarCapacity} kWp` : 'No'} />
            <InfoMini label="Backup" value={electrical.backupType || 'Not set'} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlumbingDetailingPanel: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({ plumbing }) => {
  const pipeTypeCount = plumbing.pipes.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});
  const fixtureTypeCount = plumbing.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Plumbing Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold mb-2">Pipe Network</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Water Supply" value={`${pipeTypeCount.water_supply || 0}`} />
            <InfoMini label="Drainage" value={`${pipeTypeCount.drainage || 0}`} />
            <InfoMini label="Vent" value={`${pipeTypeCount.vent || 0}`} />
            <InfoMini label="Hot Water" value={`${pipeTypeCount.hot_water || 0}`} />
            <InfoMini label="Rain Water" value={`${pipeTypeCount.rain_water || 0}`} />
            <InfoMini label="RWH" value={plumbing.rainwaterHarvesting ? 'Enabled' : 'Disabled'} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold mb-2">Fixtures & Systems</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="WC" value={`${fixtureTypeCount.wc || 0}`} />
            <InfoMini label="Basins" value={`${fixtureTypeCount.wash_basin || 0}`} />
            <InfoMini label="Showers" value={`${fixtureTypeCount.shower || 0}`} />
            <InfoMini label="Kitchen Sinks" value={`${fixtureTypeCount.kitchen_sink || 0}`} />
            <InfoMini label="Inspection Chambers" value={`${fixtureTypeCount.inspection_chamber || 0}`} />
            <InfoMini label="Pumps" value={`${fixtureTypeCount.pressure_pump || 0}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

const HVACDetailingPanel: React.FC<{ hvac: HousePlanProject['hvac'] }> = ({ hvac }) => {
  const eqByType = hvac.equipment.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  const mechPaths = hvac.ventilationPaths.filter((p) => p.type === 'mechanical').length;
  const natPaths = hvac.ventilationPaths.filter((p) => p.type === 'natural').length;
  const mixedPaths = hvac.ventilationPaths.filter((p) => p.type === 'mixed').length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">HVAC / Mechanical Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold mb-2">Equipment Schedule</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="AC Units" value={`${(eqByType.split_ac || 0) + (eqByType.vrf_unit || 0) + (eqByType.window_ac || 0)}`} />
            <InfoMini label="Fresh Air Units" value={`${eqByType.fresh_air_unit || 0}`} />
            <InfoMini label="Exhaust Fans" value={`${eqByType.exhaust_fan || 0}`} />
            <InfoMini label="Ventilators" value={`${eqByType.ventilator || 0}`} />
            <InfoMini label="Diffusers" value={`${eqByType.diffuser || 0}`} />
            <InfoMini label="Grilles" value={`${eqByType.grille || 0}`} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold mb-2">Air Movement Simulation</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Natural Paths" value={`${natPaths}`} />
            <InfoMini label="Mechanical Paths" value={`${mechPaths}`} />
            <InfoMini label="Mixed Paths" value={`${mixedPaths}`} />
            <InfoMini label="Duct Routes" value={`${hvac.ductRoutes.length}`} />
            <InfoMini label="Ventilation Rate" value={`${hvac.ventilationRate} ACH`} />
            <InfoMini label="Fresh Air" value={`${hvac.freshAirPercentage}%`} />
          </div>
        </div>
      </div>
    </div>
  );
};

const SimulationCompliancePanel: React.FC<{
  sunlight: HousePlanProject['sunlight'];
  airflow: HousePlanProject['airflow'];
  rooms: import('../services/space-planning/types').PlacedRoom[];
}> = ({ sunlight, airflow, rooms }) => {
  const daylightPass = sunlight.roomSunlight.filter((r) => r.naturalLightFactor >= 0.5).length;
  const ventilationPass = airflow.roomVentilation.filter((r) => r.airChangesPerHour >= 4).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Simulation Compliance</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
        <InfoMini label="Rooms Daylight ≥ 50%" value={`${daylightPass}/${sunlight.roomSunlight.length}`} />
        <InfoMini label="Rooms ACH ≥ 4" value={`${ventilationPass}/${airflow.roomVentilation.length}`} />
        <InfoMini label="Cross Vent Paths" value={`${airflow.crossVentilationPaths.length}`} />
        <InfoMini label="Stack Potential" value={`${(airflow.stackVentilationPotential * 100).toFixed(0)}%`} />
      </div>
      <div className="mt-3 text-[10px] text-slate-500 dark:text-slate-400">
        Targets used: daylight factor ≥ 0.5 (good), ventilation ≥ 4 ACH (good), cross ventilation preferred for habitable rooms.
      </div>
    </div>
  );
};

const InfoMini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1.5 border border-slate-200 dark:border-slate-700">
    <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</div>
  </div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  color: string;
}> = ({ label, value, detail, color }) => (
  <div
    className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg px-3 py-2.5 border border-${color}-200 dark:border-${color}-800/30`}
  >
    <div className={`text-[10px] text-${color}-600 dark:text-${color}-400`}>{label}</div>
    <div className={`text-sm font-bold text-${color}-800 dark:text-${color}-300`}>{value}</div>
    <div className={`text-[10px] text-${color}-500 dark:text-${color}-400/70 capitalize`}>
      {detail}
    </div>
  </div>
);

const SunlightAnalysisPanel: React.FC<{
  sunlight: HousePlanProject['sunlight'];
  rooms: import('../services/space-planning/types').PlacedRoom[];
}> = ({ sunlight, rooms }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800/30">
        <div className="text-[10px] text-amber-600">Summer Solar Altitude</div>
        <div className="text-lg font-bold text-amber-800 dark:text-amber-300">
          {sunlight.solsticeAngles.summer.altitude.toFixed(1)}°
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800/30">
        <div className="text-[10px] text-blue-600">Winter Solar Altitude</div>
        <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
          {sunlight.solsticeAngles.winter.altitude.toFixed(1)}°
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
        <div className="text-[10px] text-slate-500">Location</div>
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {sunlight.latitude.toFixed(2)}°N, {sunlight.longitude.toFixed(2)}°E
        </div>
      </div>
    </div>
    {/* Room sunlight table */}
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
              Room
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              Summer (hrs)
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              Winter (hrs)
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              Light Factor
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              UV
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              Glare
            </th>
          </tr>
        </thead>
        <tbody>
          {sunlight.roomSunlight.map((rs) => {
            const room = rooms.find((r) => r.id === rs.roomId);
            return (
              <tr key={rs.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300">
                  {room?.spec.name || rs.roomId}
                </td>
                <td className="px-3 py-1.5 text-center">{rs.hoursOfDirectSun.summer}h</td>
                <td className="px-3 py-1.5 text-center">{rs.hoursOfDirectSun.winter}h</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      rs.naturalLightFactor >= 0.7
                        ? 'bg-green-100 text-green-700'
                        : rs.naturalLightFactor >= 0.4
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {(rs.naturalLightFactor * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center capitalize">{rs.uvExposure}</td>
                <td className="px-3 py-1.5 text-center">{rs.glareRisk ? '⚠️' : '✓'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {/* Recommendations */}
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
        Recommendations
      </div>
      {sunlight.recommendations.map((r, i) => (
        <div
          key={i}
          className="text-[10px] text-amber-600 dark:text-amber-400/80 flex gap-1 mb-0.5"
        >
          <Sun className="w-3 h-3 flex-shrink-0 mt-0.5" /> {r}
        </div>
      ))}
    </div>
  </div>
);

const AirflowAnalysisPanel: React.FC<{
  airflow: HousePlanProject['airflow'];
  rooms: import('../services/space-planning/types').PlacedRoom[];
}> = ({ airflow, rooms }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-200 dark:border-teal-800/30">
        <div className="text-[10px] text-teal-600">Prevailing Wind</div>
        <div className="text-lg font-bold text-teal-800 dark:text-teal-300">
          {airflow.prevailingWindDirection}
        </div>
        <div className="text-[10px] text-teal-500">{airflow.windSpeed} m/s avg</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800/30">
        <div className="text-[10px] text-green-600">Cross Ventilation</div>
        <div className="text-lg font-bold text-green-800 dark:text-green-300">
          {airflow.crossVentilationPaths.length} paths
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800/30">
        <div className="text-[10px] text-blue-600">Stack Effect</div>
        <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
          {(airflow.stackVentilationPotential * 100).toFixed(0)}%
        </div>
      </div>
    </div>
    {/* Room ventilation table */}
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
              Room
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              ACH
            </th>
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
              Adequacy
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody>
          {airflow.roomVentilation.map((rv) => {
            const room = rooms.find((r) => r.id === rv.roomId);
            const color =
              rv.adequacy === 'excellent'
                ? 'green'
                : rv.adequacy === 'good'
                  ? 'blue'
                  : rv.adequacy === 'fair'
                    ? 'yellow'
                    : 'red';
            return (
              <tr key={rv.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300">
                  {room?.spec.name || rv.roomId}
                </td>
                <td className="px-3 py-1.5 text-center font-mono">{rv.airChangesPerHour}</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-400 capitalize`}
                  >
                    {rv.adequacy}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                  {rv.recommendation}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const ColorSchemePanel: React.FC<{ schemes: ColorScheme[] }> = ({ schemes }) => {
  const uniqueSchemes = schemes.filter(
    (s, i, arr) => arr.findIndex((a) => a.roomType === s.roomType) === i,
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {uniqueSchemes.map((scheme) => (
        <div
          key={scheme.roomType}
          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
        >
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 capitalize">
            {scheme.roomType.replace(/_/g, ' ')}
            {scheme.direction && (
              <span className="text-[10px] text-slate-400 ml-1">({scheme.direction})</span>
            )}
          </div>
          <div className="flex gap-1.5 mb-2">
            {[
              { color: scheme.wallColor, label: 'Wall' },
              { color: scheme.ceilingColor, label: 'Ceiling' },
              { color: scheme.floorColor, label: 'Floor' },
              { color: scheme.accentColor, label: 'Accent' },
            ].map(({ color, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-8 h-8 rounded border border-slate-300 shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="text-[8px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                scheme.vastuCompatible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {scheme.vastuCompatible ? 'Vastu ✓' : 'Non-vastu'}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">{scheme.mood}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const SchedulePanel: React.FC<{ project: HousePlanProject }> = ({ project }) => {
  const allRooms = project.floorPlans.flatMap((fp) => fp.rooms);
  const allDoors = allRooms.flatMap((r) => r.doors.map((d) => ({ ...d, roomName: r.spec.name })));
  const allWindows = allRooms.flatMap((r) =>
    r.windows.map((w) => ({ ...w, roomName: r.spec.name })),
  );
  const [boqPreset, setBoqPreset] = useState<'economy' | 'standard' | 'premium'>('standard');

  const BOQ_RATE_PRESETS: Record<'economy' | 'standard' | 'premium', Record<string, number>> = {
    economy: {
      'A-001': 1500, 'A-002': 280, 'A-003': 650, 'A-004': 350, 'A-005': 4200, 'A-006': 5200,
      'S-001': 7800, 'S-002': 8400, 'S-003': 8600, 'S-004': 7600,
      'E-001': 950, 'E-002': 3500, 'E-003': 18000, 'E-004': 2800,
      'P-001': 3200, 'P-002': 420, 'P-003': 0.5, 'P-004': 0.4,
      'M-001': 4200, 'M-002': 52000, 'M-003': 4500, 'M-004': 30000, 'M-005': 850,
      'X-001': 0, 'X-002': 0, 'X-003': 0,
    },
    standard: {
      'A-001': 2100, 'A-002': 420, 'A-003': 950, 'A-004': 520, 'A-005': 7000, 'A-006': 8200,
      'S-001': 9800, 'S-002': 10400, 'S-003': 10600, 'S-004': 9200,
      'E-001': 1450, 'E-002': 5200, 'E-003': 26000, 'E-004': 3600,
      'P-001': 5200, 'P-002': 620, 'P-003': 0.7, 'P-004': 0.6,
      'M-001': 6200, 'M-002': 72000, 'M-003': 6800, 'M-004': 42000, 'M-005': 1200,
      'X-001': 0, 'X-002': 0, 'X-003': 0,
    },
    premium: {
      'A-001': 3200, 'A-002': 680, 'A-003': 1650, 'A-004': 860, 'A-005': 13000, 'A-006': 15200,
      'S-001': 13200, 'S-002': 14100, 'S-003': 14500, 'S-004': 12600,
      'E-001': 2400, 'E-002': 7600, 'E-003': 42000, 'E-004': 5200,
      'P-001': 9200, 'P-002': 980, 'P-003': 1.0, 'P-004': 0.9,
      'M-001': 9800, 'M-002': 115000, 'M-003': 9800, 'M-004': 62000, 'M-005': 2200,
      'X-001': 0, 'X-002': 0, 'X-003': 0,
    },
  };

  const toCSV = (headers: string[], rows: Array<Array<string | number | boolean>>) => {
    const escape = (v: string | number | boolean) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  };

  const downloadCSV = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportRooms = () => {
    const csv = toCSV(
      ['Room ID', 'Room Name', 'Floor', 'Width (m)', 'Height (m)', 'Area (m²)', 'Ceiling Height (m)', 'Floor Finish', 'Wall Finish'],
      allRooms.map((r) => [
        r.id,
        r.spec.name,
        r.floor,
        r.width.toFixed(2),
        r.height.toFixed(2),
        (r.width * r.height).toFixed(2),
        r.ceilingHeight,
        r.finishFloor,
        r.finishWall,
      ]),
    );
    downloadCSV('room_schedule.csv', csv);
  };

  const handleExportMEP = () => {
    const electricalRows = project.electrical.fixtures.map((f) => [
      'Electrical Fixture',
      f.id,
      f.type,
      f.roomId,
      f.circuit,
      f.wattage,
      f.height,
      f.x.toFixed(2),
      f.y.toFixed(2),
    ]);

    const circuitRows = project.electrical.circuits.map((c) => [
      'Electrical Circuit',
      c.id,
      c.name,
      c.type,
      c.mcbRating,
      c.wireSize,
      c.phase,
      c.fixtures.length,
      '',
    ]);

    const plumbingFixtureRows = project.plumbing.fixtures.map((f) => [
      'Plumbing Fixture',
      f.id,
      f.type,
      f.roomId,
      f.pipeSize,
      f.waterSupply,
      f.drainage,
      f.x.toFixed(2),
      f.y.toFixed(2),
    ]);

    const pipeRows = project.plumbing.pipes.map((p) => [
      'Plumbing Pipe',
      p.id,
      p.type,
      p.material,
      p.diameter,
      p.floor,
      p.startX.toFixed(2),
      p.startY.toFixed(2),
      `${p.endX.toFixed(2)},${p.endY.toFixed(2)}`,
    ]);

    const hvacRows = project.hvac.equipment.map((e) => [
      'HVAC Equipment',
      e.id,
      e.type,
      e.roomId,
      typeof e.capacity === 'number' ? e.capacity : '',
      e.powerConsumption,
      '',
      e.x.toFixed(2),
      e.y.toFixed(2),
    ]);

    const ventilationRows = project.hvac.ventilationPaths.map((v) => [
      'Ventilation Path',
      v.id,
      v.type,
      v.startRoomId,
      v.endRoomId || 'OUTSIDE',
      v.airflow,
      v.direction,
      '',
      '',
    ]);

    const csv = toCSV(
      ['Category', 'ID', 'Type/Name', 'Room/From', 'Circuit/To', 'Load/Size', 'Meta 1', 'X/StartX', 'Y/EndXY'],
      [
        ...electricalRows,
        ...circuitRows,
        ...plumbingFixtureRows,
        ...pipeRows,
        ...hvacRows,
        ...ventilationRows,
      ],
    );
    downloadCSV('mep_schedule.csv', csv);
  };

  const handleExportSimulation = () => {
    const sunlightRows = project.sunlight.roomSunlight.map((s) => [
      'Sunlight',
      s.roomId,
      s.hoursOfDirectSun.summer,
      s.hoursOfDirectSun.winter,
      (s.naturalLightFactor * 100).toFixed(1),
      s.glareRisk,
      s.uvExposure,
      '',
      '',
    ]);

    const airflowRows = project.airflow.roomVentilation.map((a) => [
      'Airflow',
      a.roomId,
      a.airChangesPerHour,
      a.adequacy,
      a.recommendation,
      '',
      '',
      '',
      '',
    ]);

    const csv = toCSV(
      ['Category', 'Room ID', 'Metric 1', 'Metric 2', 'Metric 3', 'Metric 4', 'Metric 5', 'Metric 6', 'Metric 7'],
      [...sunlightRows, ...airflowRows],
    );
    downloadCSV('simulation_schedule.csv', csv);
  };

  const buildMasterBoq = (preset: 'economy' | 'standard' | 'premium') => {
    const floorPlans = project.floorPlans;
    const avgFloorHeight =
      floorPlans.length > 0
        ? floorPlans.reduce((s, f) => s + f.floorHeight, 0) / floorPlans.length
        : 3;

    const roomArea = allRooms.reduce((s, r) => s + r.width * r.height, 0);
    const wallLengthExt = floorPlans
      .flatMap((fp) => fp.walls)
      .filter((w) => w.type === 'external')
      .reduce((s, w) => s + Math.hypot(w.endX - w.startX, w.endY - w.startY), 0);
    const wallLengthInt = floorPlans
      .flatMap((fp) => fp.walls)
      .filter((w) => w.type === 'internal')
      .reduce((s, w) => s + Math.hypot(w.endX - w.startX, w.endY - w.startY), 0);

    const plasterArea = (wallLengthExt + wallLengthInt * 2) * avgFloorHeight * 2;
    const tileArea = allRooms
      .filter((r) => ['kitchen', 'bathroom', 'toilet', 'utility', 'laundry'].includes(r.spec.type))
      .reduce((s, r) => s + r.width * r.height, 0);

    const slabVolume = floorPlans.reduce(
      (s, fp) =>
        s +
        (project.plot.width - project.constraints.setbacks.left - project.constraints.setbacks.right) *
          (project.plot.depth - project.constraints.setbacks.front - project.constraints.setbacks.rear) *
          fp.slabThickness,
      0,
    );
    const beamVolume = project.structural.beams.reduce(
      (s, b) => s + Math.hypot(b.endX - b.startX, b.endY - b.startY) * b.width * b.depth,
      0,
    );
    const columnVolume = project.structural.columns.reduce(
      (s, c) => s + c.width * c.depth * avgFloorHeight,
      0,
    );
    const foundationVolume = project.structural.foundations.reduce(
      (s, f) => s + f.width * f.depth * f.thickness,
      0,
    );

    const doorArea = allDoors.reduce((s, d) => s + d.width * d.height, 0);
    const windowArea = allWindows.reduce((s, w) => s + w.width * w.height, 0);

    const acUnits = project.hvac.equipment.filter((e) =>
      ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type),
    ).length;
    const exhaustFans = project.hvac.equipment.filter((e) => e.type === 'exhaust_fan').length;

    const rates = BOQ_RATE_PRESETS[preset];

    const rawRows: Array<{
      section: string;
      code: string;
      desc: string;
      unit: string;
      qty: number;
      remarks: string;
    }> = [
      { section: 'ARCH', code: 'A-001', desc: 'Built-up floor area', unit: 'm²', qty: roomArea, remarks: 'Sum of room floor areas' },
      { section: 'ARCH', code: 'A-002', desc: 'Floor finish area', unit: 'm²', qty: roomArea, remarks: 'General floor finish' },
      { section: 'ARCH', code: 'A-003', desc: 'Wet-area anti-skid tiling', unit: 'm²', qty: tileArea, remarks: 'Kitchen + toilets + utility + laundry' },
      { section: 'ARCH', code: 'A-004', desc: 'Wall plaster + putty + paint (both sides)', unit: 'm²', qty: plasterArea, remarks: 'Approximate' },
      { section: 'ARCH', code: 'A-005', desc: 'Door shutters and frames', unit: 'm²', qty: doorArea, remarks: `${allDoors.length} doors` },
      { section: 'ARCH', code: 'A-006', desc: 'Window units + glazing', unit: 'm²', qty: windowArea, remarks: `${allWindows.length} windows` },

      { section: 'STR', code: 'S-001', desc: 'RCC slab concrete', unit: 'm³', qty: slabVolume, remarks: 'Based on slab thickness and buildable footprint' },
      { section: 'STR', code: 'S-002', desc: 'RCC beam concrete', unit: 'm³', qty: beamVolume, remarks: `${project.structural.beams.length} beams` },
      { section: 'STR', code: 'S-003', desc: 'RCC columns concrete', unit: 'm³', qty: columnVolume, remarks: `${project.structural.columns.length} columns` },
      { section: 'STR', code: 'S-004', desc: 'Foundation concrete', unit: 'm³', qty: foundationVolume, remarks: `${project.structural.foundations.length} foundations` },

      { section: 'ELE', code: 'E-001', desc: 'Electrical points (all fixtures)', unit: 'nos', qty: project.electrical.fixtures.length, remarks: 'Includes LV + safety points' },
      { section: 'ELE', code: 'E-002', desc: 'Circuiting with DB/MCB', unit: 'nos', qty: project.electrical.circuits.length, remarks: 'Distribution circuits' },
      { section: 'ELE', code: 'E-003', desc: 'Panel boards', unit: 'nos', qty: project.electrical.panels.length, remarks: 'DB panels' },
      { section: 'ELE', code: 'E-004', desc: 'Connected electrical load', unit: 'kW', qty: project.electrical.connectedLoad, remarks: 'For service sizing' },

      { section: 'PLB', code: 'P-001', desc: 'Plumbing fixtures', unit: 'nos', qty: project.plumbing.fixtures.length, remarks: 'All sanitary and utility fixtures' },
      {
        section: 'PLB',
        code: 'P-002',
        desc: 'Plumbing pipelines',
        unit: 'rm',
        qty: project.plumbing.pipes.reduce((s, p) => s + Math.hypot(p.endX - p.startX, p.endY - p.startY), 0),
        remarks: 'Supply + drainage + vent + rain',
      },
      { section: 'PLB', code: 'P-003', desc: 'Overhead tank capacity', unit: 'L', qty: project.plumbing.overheadTankCapacity, remarks: 'Storage' },
      { section: 'PLB', code: 'P-004', desc: 'Sump capacity', unit: 'L', qty: project.plumbing.sumpCapacity, remarks: 'Underground storage' },

      { section: 'MECH', code: 'M-001', desc: 'HVAC equipment points', unit: 'nos', qty: project.hvac.equipment.length, remarks: 'AC + fans + FAU + accessories' },
      { section: 'MECH', code: 'M-002', desc: 'Air-conditioning units', unit: 'nos', qty: acUnits, remarks: 'Split/VRF/Window/Cassette' },
      { section: 'MECH', code: 'M-003', desc: 'Exhaust fan points', unit: 'nos', qty: exhaustFans, remarks: 'Kitchen/wet areas' },
      { section: 'MECH', code: 'M-004', desc: 'Cooling load', unit: 'TR', qty: project.hvac.coolingLoad, remarks: 'Total cooling tonnage' },
      {
        section: 'MECH',
        code: 'M-005',
        desc: 'Duct routing length',
        unit: 'rm',
        qty: project.hvac.ductRoutes.reduce((s, d) => s + Math.hypot(d.endX - d.startX, d.endY - d.startY), 0),
        remarks: 'Indicative',
      },

      {
        section: 'SIM',
        code: 'X-001',
        desc: 'Average daylight factor',
        unit: '%',
        qty:
          (project.sunlight.roomSunlight.reduce((s, r) => s + r.naturalLightFactor, 0) /
            Math.max(1, project.sunlight.roomSunlight.length)) *
          100,
        remarks: 'Simulation KPI',
      },
      {
        section: 'SIM',
        code: 'X-002',
        desc: 'Average room ACH',
        unit: 'ACH',
        qty:
          project.airflow.roomVentilation.reduce((s, r) => s + r.airChangesPerHour, 0) /
          Math.max(1, project.airflow.roomVentilation.length),
        remarks: 'Ventilation KPI',
      },
      {
        section: 'SIM',
        code: 'X-003',
        desc: 'Cross-vent paths',
        unit: 'nos',
        qty: project.airflow.crossVentilationPaths.length,
        remarks: 'Natural airflow connectivity',
      },
    ];

    const rows = rawRows.map((r) => {
      const rate = rates[r.code] ?? 0;
      const amount = rate > 0 ? r.qty * rate : 0;
      return { ...r, rate, amount };
    });

    const subtotal = rows.reduce((s, r) => s + r.amount, 0);
    const contingency = subtotal * 0.05;
    const gst = (subtotal + contingency) * 0.18;
    const total = subtotal + contingency + gst;

    return { rows, subtotal, contingency, gst, total };
  };

  const handleExportMasterBOQ = () => {
    const { rows, subtotal, contingency, gst, total } = buildMasterBoq(boqPreset);

    const boqRows: Array<Array<string | number>> = rows.map((r) => [
      r.section,
      r.code,
      r.desc,
      r.unit,
      r.qty.toFixed(2),
      r.rate.toFixed(2),
      r.amount.toFixed(2),
      r.remarks,
    ]);

    boqRows.push(
      ['', '', 'SUBTOTAL', '', '', '', subtotal.toFixed(2), `Preset: ${boqPreset}`],
      ['', '', 'CONTINGENCY (5%)', '', '', '', contingency.toFixed(2), 'Project risk allowance'],
      ['', '', 'GST (18%)', '', '', '', gst.toFixed(2), 'Tax'],
      ['', '', 'GRAND TOTAL', '', '', '', total.toFixed(2), 'Estimated project amount'],
    );

    const csv = toCSV(
      ['Section', 'Item Code', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount', 'Remarks'],
      boqRows,
    );
    downloadCSV(`master_boq_${boqPreset}.csv`, csv);
  };

  const masterBoqTotals = buildMasterBoq(boqPreset);

  const acCount = project.hvac.equipment.filter((e) =>
    ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type),
  ).length;

  return (
    <div className="space-y-6">
      {/* Export bar */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
          <span className="text-slate-500">BOQ Preset:</span>
          <select
            value={boqPreset}
            onChange={(e) => setBoqPreset(e.target.value as 'economy' | 'standard' | 'premium')}
            className="bg-transparent outline-none text-slate-700 dark:text-slate-200"
          >
            <option value="economy">Economy</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <button
          onClick={handleExportRooms}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <FileDown className="w-3.5 h-3.5" /> Export Room CSV
        </button>
        <button
          onClick={handleExportMEP}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
        >
          <FileDown className="w-3.5 h-3.5" /> Export MEP CSV
        </button>
        <button
          onClick={handleExportSimulation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
        >
          <FileDown className="w-3.5 h-3.5" /> Export Simulation CSV
        </button>
        <button
          onClick={handleExportMasterBOQ}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50"
        >
          <FileDown className="w-3.5 h-3.5" /> Export Master BOQ CSV
        </button>
        <div className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300">
          Est. Total: ₹{masterBoqTotals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Room Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Room Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">Room</th>
                <th className="px-2 py-1.5 text-center font-semibold">Floor</th>
                <th className="px-2 py-1.5 text-center font-semibold">Size (m)</th>
                <th className="px-2 py-1.5 text-center font-semibold">Area (m²)</th>
                <th className="px-2 py-1.5 text-center font-semibold">CH (m)</th>
                <th className="px-2 py-1.5 text-left font-semibold">Floor Finish</th>
                <th className="px-2 py-1.5 text-left font-semibold">Wall Finish</th>
              </tr>
            </thead>
            <tbody>
              {allRooms.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-medium text-slate-700 dark:text-slate-300">
                    {r.spec.name}
                  </td>
                  <td className="px-2 py-1 text-center">{r.floor === 0 ? 'GF' : `F${r.floor}`}</td>
                  <td className="px-2 py-1 text-center font-mono">
                    {r.width.toFixed(1)}×{r.height.toFixed(1)}
                  </td>
                  <td className="px-2 py-1 text-center font-mono">
                    {(r.width * r.height).toFixed(1)}
                  </td>
                  <td className="px-2 py-1 text-center">{r.ceilingHeight}</td>
                  <td className="px-2 py-1 text-slate-500">{r.finishFloor}</td>
                  <td className="px-2 py-1 text-slate-500">{r.finishWall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Door Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Door Schedule ({allDoors.length} doors)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">ID</th>
                <th className="px-2 py-1.5 text-left font-semibold">Room</th>
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-center font-semibold">Size (m)</th>
                <th className="px-2 py-1.5 text-left font-semibold">Material</th>
                <th className="px-2 py-1.5 text-center font-semibold">Wall</th>
              </tr>
            </thead>
            <tbody>
              {allDoors.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{d.id}</td>
                  <td className="px-2 py-1 text-slate-700 dark:text-slate-300">{d.roomName}</td>
                  <td className="px-2 py-1 capitalize">{d.type.replace(/_/g, ' ')}</td>
                  <td className="px-2 py-1 text-center font-mono">
                    {d.width}×{d.height}
                  </td>
                  <td className="px-2 py-1 capitalize">{d.material}</td>
                  <td className="px-2 py-1 text-center">{d.wallSide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Window Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Window Schedule ({allWindows.length} windows)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">ID</th>
                <th className="px-2 py-1.5 text-left font-semibold">Room</th>
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-center font-semibold">Size (m)</th>
                <th className="px-2 py-1.5 text-center font-semibold">Sill (m)</th>
                <th className="px-2 py-1.5 text-left font-semibold">Glazing</th>
                <th className="px-2 py-1.5 text-center font-semibold">Wall</th>
              </tr>
            </thead>
            <tbody>
              {allWindows.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{w.id}</td>
                  <td className="px-2 py-1 text-slate-700 dark:text-slate-300">{w.roomName}</td>
                  <td className="px-2 py-1 capitalize">{w.type}</td>
                  <td className="px-2 py-1 text-center font-mono">
                    {w.width}×{w.height}
                  </td>
                  <td className="px-2 py-1 text-center">{w.sillHeight}</td>
                  <td className="px-2 py-1 capitalize">{w.glazing}</td>
                  <td className="px-2 py-1 text-center">{w.wallSide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Electrical Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Electrical Schedule ({project.electrical.fixtures.length} fixtures, {project.electrical.circuits.length} circuits)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">Fixture</th>
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-left font-semibold">Room</th>
                <th className="px-2 py-1.5 text-center font-semibold">Circuit</th>
                <th className="px-2 py-1.5 text-center font-semibold">Watt</th>
                <th className="px-2 py-1.5 text-center font-semibold">Height</th>
              </tr>
            </thead>
            <tbody>
              {project.electrical.fixtures.slice(0, 200).map((f) => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{f.id}</td>
                  <td className="px-2 py-1">{f.type}</td>
                  <td className="px-2 py-1">{f.roomId}</td>
                  <td className="px-2 py-1 text-center">{f.circuit}</td>
                  <td className="px-2 py-1 text-center">{f.wattage}</td>
                  <td className="px-2 py-1 text-center">{f.height}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plumbing Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Plumbing Schedule ({project.plumbing.fixtures.length} fixtures, {project.plumbing.pipes.length} pipes)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">Pipe</th>
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-center font-semibold">Dia (mm)</th>
                <th className="px-2 py-1.5 text-left font-semibold">Material</th>
                <th className="px-2 py-1.5 text-center font-semibold">Floor</th>
                <th className="px-2 py-1.5 text-center font-semibold">Slope</th>
              </tr>
            </thead>
            <tbody>
              {project.plumbing.pipes.slice(0, 200).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{p.id}</td>
                  <td className="px-2 py-1">{p.type}</td>
                  <td className="px-2 py-1 text-center">{p.diameter}</td>
                  <td className="px-2 py-1">{p.material}</td>
                  <td className="px-2 py-1 text-center">{p.floor}</td>
                  <td className="px-2 py-1 text-center">{typeof p.slope === 'number' ? p.slope.toFixed(3) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HVAC Schedule */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          HVAC Schedule ({project.hvac.equipment.length} equipment, {project.hvac.ductRoutes.length} ducts)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div className="text-[11px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">Cooling: {project.hvac.coolingLoad.toFixed(1)} TR</div>
          <div className="text-[11px] px-2 py-1 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/30">AC Units: {acCount}</div>
          <div className="text-[11px] px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">Vent Rate: {project.hvac.ventilationRate} ACH</div>
          <div className="text-[11px] px-2 py-1 rounded bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30">Fresh Air: {project.hvac.freshAirPercentage}%</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-2 py-1.5 text-left font-semibold">Equipment</th>
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-left font-semibold">Room</th>
                <th className="px-2 py-1.5 text-center font-semibold">Capacity</th>
                <th className="px-2 py-1.5 text-center font-semibold">Power (W)</th>
              </tr>
            </thead>
            <tbody>
              {project.hvac.equipment.slice(0, 200).map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{e.id}</td>
                  <td className="px-2 py-1">{e.type}</td>
                  <td className="px-2 py-1">{e.roomId}</td>
                  <td className="px-2 py-1 text-center">{typeof e.capacity === 'number' ? e.capacity : '-'}</td>
                  <td className="px-2 py-1 text-center">{e.powerConsumption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulation Summary */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Simulation Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-[11px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
            Avg Daylight Factor: {(project.sunlight.roomSunlight.reduce((s, r) => s + r.naturalLightFactor, 0) / Math.max(1, project.sunlight.roomSunlight.length) * 100).toFixed(0)}%
          </div>
          <div className="text-[11px] px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/30">
            Avg ACH: {(project.airflow.roomVentilation.reduce((s, r) => s + r.airChangesPerHour, 0) / Math.max(1, project.airflow.roomVentilation.length)).toFixed(1)}
          </div>
          <div className="text-[11px] px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
            Cross Vent Paths: {project.airflow.crossVentilationPaths.length}
          </div>
          <div className="text-[11px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
            Stack Potential: {(project.airflow.stackVentilationPotential * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpacePlanningPage;
