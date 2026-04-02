import { useCallback, useState } from 'react';

import type { WizardConfig } from '../../components/space-planning/RoomConfigWizard';
import type { HousePlanProject } from '../../services/space-planning/types';
import {
  buildConstraintReportFromVariant,
  checkSolverBackendHealth,
  generateLayoutVariants,
  mergeSolverPlacementsIntoProject,
  solveLayout,
  solveLayoutFromMinimal,
  solveMultipleCandidates,
  spacePlanningEngine,
  type ConstraintReport,
  type LayoutVariantsResponse,
  type MultiCandidateResult,
  type PlacementResponse,
} from './spacePlanningWorkflow';
import { parseSolverError } from '../spacePlanningPageUtils';

export type GenerationMode = 'single' | 'multi' | 'variants';

interface UseSpacePlanningGenerationOptions {
  templateId?: string;
  onTemplateCompletion: () => void;
  onProjectGenerated: () => void;
}

export function useSpacePlanningGeneration(options: UseSpacePlanningGenerationOptions) {
  const { templateId, onTemplateCompletion, onProjectGenerated } = options;

  const [project, setProject] = useState<HousePlanProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  const [constraintReport, setConstraintReport] = useState<ConstraintReport | null>(null);
  const [solverPlacements, setSolverPlacements] = useState<PlacementResponse[] | null>(null);
  const [multiCandidateResult, setMultiCandidateResult] = useState<MultiCandidateResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);

  const [generationMode, setGenerationMode] = useState<GenerationMode>('variants');
  const [solverError, setSolverError] = useState<string | null>(null);
  const [solverBackendState, setSolverBackendState] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [solverBackendMessage, setSolverBackendMessage] = useState<string | null>(null);

  const [lastWizardConfig, setLastWizardConfig] = useState<WizardConfig | null>(null);
  const [layoutVariantsResult, setLayoutVariantsResult] = useState<LayoutVariantsResponse | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showVariants, setShowVariants] = useState(false);

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

  const handleGenerate = useCallback(
    async (config: WizardConfig) => {
      setIsGenerating(true);
      setSolverError(null);
      setLastWizardConfig(config);
      try {
        let report: ConstraintReport | null = null;
        let placements: PlacementResponse[] | null = null;

        if (generationMode === 'multi') {
          try {
            const multiResult = await solveMultipleCandidates(config, 3, 300);
            setMultiCandidateResult(multiResult);
            setShowCandidates(true);

            const best = multiResult.candidates[0];
            setSelectedCandidateId(best.id);
            report = best.report;
            placements = best.placements;
            setConstraintReport(report);
            setSolverPlacements(placements);
          } catch (apiErr) {
            if (import.meta.env.DEV) {
              console.warn('Multi-candidate solver failed, falling back to single:', apiErr);
            }
          }
        }

        if (!report) {
          try {
            const solverResult =
              config.inputMode === 'minimal'
                ? await solveLayoutFromMinimal(config, { maxIterations: 300 })
                : await solveLayout(config, { maxIterations: 300 });
            report = solverResult.report;
            placements = solverResult.placements;
            setConstraintReport(report);
            setSolverPlacements(placements);
            setSolverBackendState('online');
            setSolverBackendMessage('Backend solver connected.');
          } catch (apiErr) {
            if (import.meta.env.DEV) {
              console.warn('Optimization service unavailable, using client-side engine:', apiErr);
            }
            setSolverBackendState('offline');
            const diag = parseSolverError(apiErr);
            setSolverBackendMessage(diag);
            setSolverError(
              'Optimization service unavailable — using client-side placement. ' +
                `Constraint analysis will not be available. ${diag}`,
            );
          }
        }

        const result = spacePlanningEngine.generateCompletePlan(
          config.plot,
          config.orientation,
          config.constraints,
          config.roomSpecs,
          config.preferences,
          config.location,
        );

        if (placements && placements.length > 0) {
          const merged = await mergeSolverPlacementsIntoProject(placements, result, config);
          Object.assign(result, merged);
        }

        setProject(result);
        onProjectGenerated();

        if (templateId) {
          onTemplateCompletion();
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Plan generation failed:', err);
        }
        setSolverError('Plan generation failed. Please check your configuration and try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [generationMode, onProjectGenerated, onTemplateCompletion, templateId],
  );

  const handleSelectCandidate = useCallback(
    async (candidateId: string) => {
      if (!multiCandidateResult || !lastWizardConfig) return;
      const candidate = multiCandidateResult.candidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      setSelectedCandidateId(candidateId);
      setConstraintReport(candidate.report);
      setSolverPlacements(candidate.placements);

      if (project && project.floorPlans.length > 0) {
        const merged = await mergeSolverPlacementsIntoProject(candidate.placements, project, lastWizardConfig);
        setProject(merged);
      }
    },
    [multiCandidateResult, lastWizardConfig, project],
  );

  const handleGenerateVariants = useCallback(
    async (config: WizardConfig) => {
      setIsGenerating(true);
      setIsGeneratingVariants(true);
      setSolverError(null);
      setLastWizardConfig(config);

      try {
        const variantsResult = await generateLayoutVariants(config, {
          maxIterationsPerVariant: 150,
        });

        setLayoutVariantsResult(variantsResult);
        setShowVariants(true);

        if (variantsResult.best_variant_id) {
          setSelectedVariantId(variantsResult.best_variant_id);
          const bestVariant = variantsResult.variants.find((v) => v.variant_id === variantsResult.best_variant_id);
          if (bestVariant) {
            setSolverPlacements(bestVariant.placements);
            setConstraintReport(buildConstraintReportFromVariant(bestVariant));
          }
        }

        const result = spacePlanningEngine.generateCompletePlan(
          config.plot,
          config.orientation,
          config.constraints,
          config.roomSpecs,
          config.preferences,
          config.location,
        );

        if (variantsResult.best_variant_id) {
          const bestVariant = variantsResult.variants.find((v) => v.variant_id === variantsResult.best_variant_id);
          if (bestVariant) {
            const merged = await mergeSolverPlacementsIntoProject(bestVariant.placements, result, config);
            Object.assign(result, merged);
          }
        }

        setProject(result);
        onProjectGenerated();
        setSolverBackendState('online');

        if (templateId) {
          onTemplateCompletion();
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Variant generation failed:', err);
        }
        setSolverError(`Variant generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
        setIsGeneratingVariants(false);
      }
    },
    [onProjectGenerated, onTemplateCompletion, templateId],
  );

  const handleSelectVariant = useCallback(
    async (variantId: string) => {
      if (!layoutVariantsResult || !lastWizardConfig) return;
      const variant = layoutVariantsResult.variants.find((v) => v.variant_id === variantId);
      if (!variant) return;

      setSelectedVariantId(variantId);
      setSolverPlacements(variant.placements);
      setConstraintReport(buildConstraintReportFromVariant(variant));

      if (project && project.floorPlans.length > 0) {
        const merged = await mergeSolverPlacementsIntoProject(variant.placements, project, lastWizardConfig);
        setProject(merged);
      }
    },
    [layoutVariantsResult, lastWizardConfig, project],
  );

  const handleRegenerate = useCallback(() => {
    if (lastWizardConfig) {
      handleGenerate(lastWizardConfig);
    }
  }, [handleGenerate, lastWizardConfig]);

  return {
    project,
    setProject,
    isGenerating,
    isGeneratingVariants,
    constraintReport,
    solverPlacements,
    multiCandidateResult,
    selectedCandidateId,
    showCandidates,
    generationMode,
    setGenerationMode,
    solverError,
    solverBackendState,
    solverBackendMessage,
    lastWizardConfig,
    layoutVariantsResult,
    selectedVariantId,
    showVariants,
    runSolverHealthCheck,
    handleGenerate,
    handleSelectCandidate,
    handleGenerateVariants,
    handleSelectVariant,
    handleRegenerate,
  };
}
