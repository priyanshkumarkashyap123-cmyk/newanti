import { useCallback, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { UnifiedUser } from '../providers/AuthProvider';
import type { SubscriptionStatus } from '../hooks/useSubscription';
import type { HousePlanProject } from '../services/space-planning/types';
import type { WizardConfig } from '../components/space-planning/RoomConfigWizard';
import type {
  ConstraintReport,
  LayoutVariantsResponse,
  MultiCandidateResult,
  PlacementResponse,
  VariantResponse,
} from '../services/space-planning/layoutApiService';


type GenerationMode = 'single' | 'multi' | 'variants';

type SolverBackendState = 'unknown' | 'checking' | 'online' | 'offline';

type UseSpacePlanningArgs = {
  templateId?: string;
  user: UnifiedUser | null;
  isSignedIn: boolean;
  subscription: SubscriptionStatus | null;
  navigate: NavigateFunction;
};

export type UseSpacePlanningResult = {
  activeTab: 'wizard';
  setActiveTab: React.Dispatch<React.SetStateAction<'wizard'>>;
  project: HousePlanProject | null;
  setProject: React.Dispatch<React.SetStateAction<HousePlanProject | null>>;
  isGenerating: boolean;
  selectedFloor: number;
  setSelectedFloor: React.Dispatch<React.SetStateAction<number>>;
  overlayMode: 'none';
  setOverlayMode: React.Dispatch<React.SetStateAction<'none'>>;
  selectedRoomId: string | null;
  setSelectedRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  constraintReport: ConstraintReport | null;
  solverPlacements: PlacementResponse[] | null;
  multiCandidateResult: MultiCandidateResult | null;
  selectedCandidateId: string | null;
  setSelectedCandidateId: React.Dispatch<React.SetStateAction<string | null>>;
  showCandidates: boolean;
  generationMode: GenerationMode;
  setGenerationMode: React.Dispatch<React.SetStateAction<GenerationMode>>;
  solverError: string | null;
  solverBackendState: SolverBackendState;
  solverBackendMessage: string | null;
  lastWizardConfig: WizardConfig | null;
  layoutVariantsResult: LayoutVariantsResponse | null;
  selectedVariantId: string | null;
  setSelectedVariantId: React.Dispatch<React.SetStateAction<string | null>>;
  showVariants: boolean;
  isGeneratingVariants: boolean;
  handleExportVariant: (variant: VariantResponse) => void;
  handleExportConstraintJson: () => void;
  handleExportConstraintPdf: () => void;
  triggerDownload: (blob: Blob, filename: string) => void;
};

export function useSpacePlanning(_args: UseSpacePlanningArgs): UseSpacePlanningResult {
  const [activeTab, setActiveTab] = useState<'wizard'>('wizard');
  const [project, setProject] = useState<HousePlanProject | null>(null);
  const [isGenerating] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [overlayMode, setOverlayMode] = useState<'none'>('none');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [constraintReport] = useState<ConstraintReport | null>(null);
  const [solverPlacements] = useState<PlacementResponse[] | null>(null);
  const [multiCandidateResult] = useState<MultiCandidateResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showCandidates] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('variants');
  const [solverError] = useState<string | null>(null);
  const [solverBackendState] = useState<SolverBackendState>('unknown');
  const [solverBackendMessage] = useState<string | null>(null);
  const [lastWizardConfig] = useState<WizardConfig | null>(null);
  const [layoutVariantsResult] = useState<LayoutVariantsResponse | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showVariants] = useState(false);
  const [isGeneratingVariants] = useState(false);

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportVariant = useCallback((variant: VariantResponse) => {
    const payload = {
      export_type: 'space_planning_variant',
      exported_at: new Date().toISOString(),
      variant,
      recommendation: layoutVariantsResult?.recommendation ?? null,
      selected_floor: selectedFloor,
      wizard_config: lastWizardConfig,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const safeName = variant.strategy_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerDownload(blob, `space-plan-variant-${safeName || variant.variant_id}.json`);
  }, [layoutVariantsResult, selectedFloor, lastWizardConfig, triggerDownload]);

  const handleExportConstraintJson = useCallback(() => {
    if (!constraintReport) return;
    const payload = {
      export_type: 'space_planning_constraint_report',
      exported_at: new Date().toISOString(),
      selected_floor: selectedFloor,
      report: constraintReport,
      placements: solverPlacements ?? [],
      wizard_config: lastWizardConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `constraint-report-floor-${selectedFloor}.json`);
  }, [constraintReport, selectedFloor, solverPlacements, lastWizardConfig, triggerDownload]);

  const handleExportConstraintPdf = useCallback(() => {
    if (!constraintReport) return;
    const html = `<!doctype html><html><body><h1>Constraint Compliance Report</h1></body></html>`;
    void html;
  }, [constraintReport]);

  return useMemo(() => ({
    activeTab,
    setActiveTab,
    project,
    setProject,
    isGenerating,
    selectedFloor,
    setSelectedFloor,
    overlayMode,
    setOverlayMode,
    selectedRoomId,
    setSelectedRoomId,
    containerRef,
    constraintReport,
    solverPlacements,
    multiCandidateResult,
    selectedCandidateId,
    setSelectedCandidateId,
    showCandidates,
    generationMode,
    setGenerationMode,
    solverError,
    solverBackendState,
    solverBackendMessage,
    lastWizardConfig,
    layoutVariantsResult,
    selectedVariantId,
    setSelectedVariantId,
    showVariants,
    isGeneratingVariants,
    handleExportVariant,
    handleExportConstraintJson,
    handleExportConstraintPdf,
    triggerDownload,
  }), [
    activeTab,
    project,
    isGenerating,
    selectedFloor,
    overlayMode,
    selectedRoomId,
    constraintReport,
    solverPlacements,
    multiCandidateResult,
    selectedCandidateId,
    showCandidates,
    generationMode,
    solverError,
    solverBackendState,
    solverBackendMessage,
    lastWizardConfig,
    layoutVariantsResult,
    selectedVariantId,
    showVariants,
    isGeneratingVariants,
    handleExportVariant,
    handleExportConstraintJson,
    handleExportConstraintPdf,
    triggerDownload,
  ]);
}
