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

import { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FloorPlanRenderer, OverlayMode } from '../components/space-planning/FloorPlanRenderer';
import { ElevationSectionViewer } from '../components/space-planning/ElevationSectionViewer';
import { VastuCompass } from '../components/space-planning/VastuCompass';
import { RoomConfigWizard, WizardConfig } from '../components/space-planning/RoomConfigWizard';
import { spacePlanningEngine } from '../services/space-planning/SpacePlanningEngine';
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

  useEffect(() => {
    document.title = 'Space Planning | BeamLab';
    // Record session start
    sessionStartRef.current = Date.now();
  }, []);

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
      try {
        // Small delay for UI feedback
        await new Promise((r) => setTimeout(r, 300));

        const result = spacePlanningEngine.generateCompletePlan(
          config.plot,
          config.orientation,
          config.constraints,
          config.roomSpecs,
          config.preferences,
          config.location,
        );

        setProject(result);
        setActiveTab('floor_plan');
        setSelectedFloor(0);

        // Mark template as completed if this was a guided template
        if (templateId) {
          handleTemplateCompletion();
        }
      } catch (err) {
        console.error('Plan generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    },
    [templateId, handleTemplateCompletion],
  );

  const currentFloorPlan =
    project?.floorPlans.find((fp) => fp.floor === selectedFloor) || project?.floorPlans[0];

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
                  <div className="flex items-center justify-between">
                    <FloorSelector
                      floors={project.floorPlans}
                      selected={selectedFloor}
                      onChange={setSelectedFloor}
                    />
                    <OverlaySelector current={overlayMode} onChange={setOverlayMode} />
                  </div>
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
                  />
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
                    electrical={project.electrical}
                    overlayMode="electrical"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <ElectricalSummary electrical={project.electrical} />
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
                    plumbing={project.plumbing}
                    overlayMode="plumbing"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <PlumbingSummary plumbing={project.plumbing} />
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
                    hvac={project.hvac}
                    overlayMode="hvac"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <HVACSummary hvac={project.hvac} />
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

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default SpacePlanningPage;
