/**
 * useAnalysisExecution — Encapsulates all structural analysis logic.
 * Extracted from ModernModeler.tsx (~1,800 lines → single hook).
 *
 * Manages: executeAnalysis, handleRunAnalysis, cancelAnalysis,
 *          calculateStresses, and all associated state.
 */
import { useState, useCallback, useRef, useEffect, startTransition } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useModelStore } from "../store/model";
import { useUIStore } from "../store/uiStore";
import type { AnalysisStage } from "../components/AnalysisProgressModal";
import type { Member, MemberForceData } from "../store/model";
import { API_CONFIG } from "../config/env";
import { validateStructure, type ValidationResult, type ValidationError } from "../utils/structuralValidation";
import { runDiagnostics } from "../engine/diagnostics";
import { distributeFloorLoads } from "../services/floorLoadDistributor";
import type { ValidationResults } from "../components/ValidationErrorDisplay";
import type { MemberStress } from "../components/StressVisualization";
import { scheduleAnalysisTelemetry } from "../core/AnalysisTelemetry";
import { rustApi } from "../api/rustApi";

/** Result from stress calculation endpoint */
type StressResult = MemberStress;

/** Advanced analysis type discriminant */
export type AdvancedAnalysisType =
  | 'response_spectrum'
  | 'pushover'
  | 'steady_state'
  | 'imperfection';

/** Node displacement result from WASM solver */
interface NodeDisplacementResult {
  nodeId: string;
  DX: number;
  DY: number;
  DZ: number;
  RX: number;
  RY: number;
  RZ: number;
}

/** Plate stress/moment result from WASM solver */
interface PlateResult {
  stress_xx: number;
  stress_yy: number;
  stress_xy: number;
  moment_xx: number;
  moment_yy: number;
  moment_xy: number;
  displacement: number;
  von_mises: number;
}

import {
  buildLocalAxesForDiagram,
  accumulateLoadEffects,
  buildDiagramStations,
  integrateDeflection,
  type DiagramLoad,
} from "../utils/diagramUtils";
import { buildRotation3x3 } from "../utils/memberLoadFEF";
import { modelerLogger, stressLogger } from "../utils/logger";

// Analysis service — lazy-loaded on first analysis run
let _analysisServicePromise: Promise<
  typeof import("../services/AnalysisService")
> | null = null;
function getAnalysisService() {
  if (!_analysisServicePromise)
    _analysisServicePromise = import("../services/AnalysisService");
  return _analysisServicePromise;
}

export interface UseAnalysisExecutionReturn {
  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStage: AnalysisStage;
  analysisError: string | undefined;
  showProgressModal: boolean;
  analysisStats: { nodes: number; members: number; dof: number; timeMs: number } | undefined;
  showResultsToolbar: boolean;
  showResultsDock: boolean;

  // Validation state
  validationErrors: ValidationResults | null;
  showValidationErrors: boolean;
  showValidationDialog: boolean;
  structuralValidationErrors: ValidationError[];
  structuralValidationWarnings: ValidationError[];

  // Stress state
  stressResults: StressResult[] | null;
  showStressVisualization: boolean;
  currentStressType: string;

  // Actions
  executeAnalysis: () => Promise<void>;
  handleRunAnalysis: () => Promise<void>;
  cancelAnalysis: () => void;
  calculateStresses: (memberForces: Map<string, MemberForceData>, members: Map<string, Member>) => Promise<void>;
  handleAdvancedAnalysis: (type: AdvancedAnalysisType, params: Record<string, unknown>) => Promise<void>;

  // State setters (needed by JSX in parent)
  setShowProgressModal: (v: boolean) => void;
  setShowResultsToolbar: (v: boolean) => void;
  setShowResultsDock: (v: boolean) => void;
  setShowValidationErrors: (v: boolean) => void;
  setValidationErrors: (v: ValidationResults | null) => void;
  setShowValidationDialog: (v: boolean) => void;
  setStructuralValidationErrors: (v: ValidationError[]) => void;
  setStructuralValidationWarnings: (v: ValidationError[]) => void;
  setShowStressVisualization: (v: boolean) => void;
  setCurrentStressType: (v: string) => void;
  setStressResults: (v: StressResult[] | null) => void;
}

export function useAnalysisExecution(
  getToken: () => Promise<string | null>,
): UseAnalysisExecutionReturn {
  const MAIN_THREAD_WASM_MAX_NODES = 750;
  const MAIN_THREAD_WASM_MAX_MEMBERS = 1500;

  // ── Analysis state ──
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("validating");
  const [analysisError, setAnalysisError] = useState<string | undefined>();
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<
    { nodes: number; members: number; dof: number; timeMs: number } | undefined
  >();
  const [showResultsToolbar, setShowResultsToolbar] = useState(false);
  const [showResultsDock, setShowResultsDock] = useState(false);

  // ── Validation state ──
  const [validationErrors, setValidationErrors] = useState<ValidationResults | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [structuralValidationErrors, setStructuralValidationErrors] = useState<ValidationError[]>([]);
  const [structuralValidationWarnings, setStructuralValidationWarnings] = useState<ValidationError[]>([]);

  // ── Stress state ──
  const [stressResults, setStressResults] = useState<StressResult[] | null>(null);
  const [showStressVisualization, setShowStressVisualization] = useState(false);
  const [currentStressType, setCurrentStressType] = useState("von_mises");

  // ── Refs ──
  const analysisAbortRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressUiStateRef = useRef<{ stage: AnalysisStage; progress: number; at: number }>({
    stage: "validating",
    progress: 0,
    at: 0,
  });

  const commitAnalysisProgress = useCallback(
    (stage: AnalysisStage, progress: number, options?: { force?: boolean }) => {
      const now = performance.now();
      const rounded = Math.max(0, Math.min(100, Math.round(progress)));
      const prev = progressUiStateRef.current;
      const stageChanged = prev.stage !== stage;
      const delta = Math.abs(rounded - prev.progress);
      const elapsed = now - prev.at;
      const shouldCommit = options?.force || stageChanged || rounded >= 100 || delta >= 2 || elapsed >= 100;

      if (!shouldCommit) return;

      progressUiStateRef.current = { stage, progress: rounded, at: now };
      unstable_batchedUpdates(() => {
        setAnalysisStage(stage);
        setAnalysisProgress(rounded);
      });
    },
    [],
  );

  // ══════════════════════════════════════════
  // CALCULATE STRESSES
  // ══════════════════════════════════════════
  const calculateStresses = useCallback(
    async (memberForces: Map<string, MemberForceData>, membersParam: Map<string, Member>) => {
      try {
        stressLogger.log("Calculating stresses for members...");
        const nodes = useModelStore.getState().nodes;

        // Prepare stress calculation request
        const membersData = Array.from(membersParam.values())
          .map((member) => {
            const forces = memberForces.get(member.id);
            if (!forces) return null;

            const axialArray = forces.diagramData?.axial || [forces.axial || 0];
            const shearYArray = forces.diagramData?.shear_y || [forces.shearY || 0];
            const shearZArray = forces.diagramData?.shear_z || [forces.shearZ || 0];
            const momentYArray = forces.diagramData?.moment_y || [forces.momentY || 0];
            const momentZArray = forces.diagramData?.moment_z || [forces.momentZ || 0];

            const area = member.A || 0.01;
            const I = member.I || 1e-4;
            const estimatedDepth = Math.pow(((12 * I) / area) * 2, 1 / 2);
            const estimatedWidth = estimatedDepth / 2;

            const section = {
              area,
              Ixx: I,
              Iyy: I / 10,
              depth: estimatedDepth || 0.3,
              width: estimatedWidth || 0.15,
            };

            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) return null;

            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return {
              id: member.id,
              forces: {
                axial: axialArray,
                moment_x: momentZArray,
                moment_y: momentYArray,
                shear_y: shearYArray,
                shear_z: shearZArray,
              },
              section,
              length,
            };
          })
          .filter((m) => m !== null);

        if (membersData.length === 0) {
          stressLogger.log("No member force data available");
          return;
        }

        const PYTHON_API = API_CONFIG.pythonUrl;
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${PYTHON_API}/stress/calculate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            members: membersData,
            stress_type: currentStressType,
            fy: 250.0,
            safety_factor: 1.5,
          }),
        });

        if (!response.ok) {
          throw new Error(`Stress calculation failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.results) {
          setStressResults(data.results);
          setShowStressVisualization(true);
          stressLogger.log(`Stress calculation completed: ${data.results.length} members`);
        }
      } catch (error) {
        stressLogger.error("Error calculating stresses:", error);
      }
    },
    [currentStressType, getToken],
  );

  // ══════════════════════════════════════════
  // CANCEL ANALYSIS
  // ══════════════════════════════════════════
  const cancelAnalysis = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
      analysisAbortRef.current = null;
    }
    setIsAnalyzingLocal(false);
    useModelStore.getState().setIsAnalyzing(false);
    setShowProgressModal(false);
    commitAnalysisProgress("validating", 0, { force: true });
  }, [commitAnalysisProgress]);

  // ══════════════════════════════════════════
  // EXECUTE ANALYSIS
  // ══════════════════════════════════════════
  const executeAnalysis = useCallback(async () => {
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;

    const {
      nodes, members, loads, memberLoads, floorLoads, plates,
      settings: modelSettings, setAnalysisResults, setIsAnalyzing,
    } = useModelStore.getState();
    const { showNotification } = useUIStore.getState();

    setIsAnalyzingLocal(true);
    setIsAnalyzing(true);
    setShowProgressModal(true);
    commitAnalysisProgress("validating", 5, { force: true });
    setAnalysisError(undefined);

    // Smooth sub-progress animation for each stage
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    const animateProgress = (from: number, to: number, durationMs: number) => {
      if (progressInterval) clearInterval(progressInterval);
      let current = from;
      const step = (to - from) / (durationMs / 50);
      progressInterval = setInterval(() => {
        progressIntervalRef.current = progressInterval;
        current = Math.min(current + step, to);
        commitAnalysisProgress(progressUiStateRef.current.stage, current);
        if (current >= to && progressInterval) clearInterval(progressInterval);
      }, 50);
    };

    animateProgress(5, 15, 500);
    const startTime = Date.now();

    try {
      // Build model data for analysis
      const nodesArray = Array.from(nodes.values()).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        restraints: n.restraints,
        support: n.restraints
          ? n.restraints.fx &&
            n.restraints.fy &&
            n.restraints.fz &&
            n.restraints.mx &&
            n.restraints.my &&
            n.restraints.mz
            ? "fixed"
            : n.restraints.fx && n.restraints.fy && n.restraints.fz
              ? "pinned"
              : n.restraints.fy
                ? "roller_x"
                : "none"
          : "none",
      }));

      const membersArray = Array.from(members.values()).map((m) => {
        const E = m.E ?? 200e6;
        const G = m.G ?? E / (2 * (1 + 0.3)); // G = E/(2(1+ν)), ν=0.3 for steel
        const I = m.I ?? 1e-4;
        const Iy = m.Iy ?? I;
        const Iz = m.Iz ?? I;
        const J = m.J ?? Iy + Iz;
        return {
          id: m.id,
          startNodeId: m.startNodeId,
          endNodeId: m.endNodeId,
          E, G,
          A: m.A ?? 0.01,
          Iy, Iz, J, I,
          betaAngle: m.betaAngle ?? 0,
          rho: m.rho ?? 7850,
          releases: m.releases,
        };
      });

      let result: {
        success: boolean;
        displacements?: Record<string, NodeDisplacementResult | number[]>;
        reactions?: Record<string, number[]>;
         
        memberForces?: Record<string, any>;
        plateResults?: Record<string, PlateResult>;
        equilibriumCheck?: {
          applied_forces: number[];
          reaction_forces: number[];
          residual: number[];
          error_percent: number;
          pass: boolean;
        };
        conditionNumber?: number;
        stats?: Record<string, unknown>;
        error?: string;
        [key: string]: unknown; // Accept AnalysisResult and WASM output shapes
      };

      const workerCompatible = plates.size === 0 && floorLoads.length === 0;
      const shouldPreferWorkerPath =
        workerCompatible &&
        (nodes.size > MAIN_THREAD_WASM_MAX_NODES ||
          members.size > MAIN_THREAD_WASM_MAX_MEMBERS);

      // Prefer worker/cloud routing for larger worker-compatible models to avoid
      // blocking the UI thread with synchronous main-thread WASM execution.
      if (shouldPreferWorkerPath) {
        modelerLogger.log(
          `[Analysis] Routing directly to worker/cloud path (${nodes.size} nodes, ${members.size} members)` ,
        );

        const token = await getToken();
        const { analysisService } = await getAnalysisService();
        const workerModelData = {
          nodes: nodesArray,
          members: membersArray,
          loads,
          memberLoads,
          dofPerNode: undefined,
          settings: { selfWeight: modelSettings?.selfWeight ?? false },
        } as any;

        result = (await analysisService.analyze(
          workerModelData,
          (stage, progress) => {
            commitAnalysisProgress(stage as AnalysisStage, progress);
          },
          token,
        )) as typeof result;
      } else {
        commitAnalysisProgress("assembling", 15, { force: true });
        animateProgress(15, 40, 800);

        const convertDirection = (dir: string): string => {
          if (dir.includes("_")) return dir;
          switch (dir) {
            case "Fy": return "local_y";
            case "Fz": return "local_z";
            case "Fx": return "local_x";
            case "FX": return "global_x";
            case "FY": return "global_y";
            case "FZ": return "global_z";
            case "axial": return "local_x";
            case "projected": return "global_y";
            default: return dir || "global_y";
          }
        };

        const wasmMemberLoads = memberLoads
          .filter((ml) => ml.type === "UDL" || ml.type === "UVL")
          .map((ml) => ({
            element_id: ml.memberId,
            w1: (ml.w1 ?? 0) * 1000,
            w2: ml.type === "UDL" ? (ml.w1 ?? 0) * 1000 : (ml.w2 ?? ml.w1 ?? 0) * 1000,
            direction: convertDirection(ml.direction),
            start_pos: ml.startPos ?? 0,
            end_pos: ml.endPos ?? 1,
            is_projected: false,
          }));

        // ── Floor Load → Member UDL Distribution ──
        if (floorLoads && floorLoads.length > 0) {
          const floorResult = distributeFloorLoads(
            floorLoads,
            nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z ?? 0 })),
            membersArray.map((m) => ({ id: m.id, startNodeId: m.startNodeId, endNodeId: m.endNodeId })),
          );
          if (floorResult.loads.length > 0) {
            modelerLogger.log(
              `[Analysis] Floor loads: ${floorLoads.length} area loads → ${floorResult.panels.length} panels → ${floorResult.loads.length} beam UDLs`,
            );
            for (const fl of floorResult.loads) {
              wasmMemberLoads.push({
                element_id: fl.element_id,
                w1: fl.w1, w2: fl.w2,
                direction: fl.direction,
                start_pos: fl.start_pos, end_pos: fl.end_pos,
                is_projected: fl.is_projected,
              });
            }
          } else {
            modelerLogger.log(
              `[Analysis] Floor loads: ${floorLoads.length} defined but no panels detected`,
            );
          }
        }

        // Convert member point loads and moments to equivalent nodal loads
        const memberPointLoads = memberLoads.filter(
          (ml) => ml.type === "point" || ml.type === "moment",
        );
        const equivalentNodalFromMemberPt: Array<{
          node_id: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number;
        }> = [];
        for (const mpl of memberPointLoads) {
          const mInfo = membersArray.find((m) => m.id === mpl.memberId);
          if (!mInfo) continue;
          const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
          const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
          if (!nd1 || !nd2) continue;
          const dx = nd2.x - nd1.x, dy = nd2.y - nd1.y;
          const dz = (nd2.z ?? 0) - (nd1.z ?? 0);
          const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (L < 1e-12) continue;
          const aRaw = mpl.a ?? 0.5;
          const a = aRaw <= 1.0 ? aRaw * L : aRaw;
          const b = L - a;
          if (mpl.type === "point" && mpl.P) {
            const P = mpl.P * 1000;
            const R1 = (P * b * b * (3 * a + b)) / (L * L * L);
            const R2 = (P * a * a * (a + 3 * b)) / (L * L * L);
            const M1 = (P * a * b * b) / (L * L);
            const M2 = (-P * a * a * b) / (L * L);
            const dir = mpl.direction || "global_y";

            if (dir === "local_y" || dir === "local_z") {
              // Local direction loads: FEF is in local coords, transform to global
              // via T^T (rows of T are local axes in global)
              const T = buildRotation3x3(
                { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
                { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
              );
              // Determine which local axis the force acts along:
              //   local_y → transverse Y → bending about Z: force=[0,R,0], moment=[0,0,M]
              //   local_z → transverse Z → bending about Y: force=[0,0,R], moment=[0,-M,0]
              let locF1: number[], locF2: number[], locM1: number[], locM2: number[];
              if (dir === "local_y") {
                locF1 = [0, R1, 0]; locF2 = [0, R2, 0];
                locM1 = [0, 0, M1]; locM2 = [0, 0, M2];
              } else {
                locF1 = [0, 0, R1]; locF2 = [0, 0, R2];
                locM1 = [0, -M1, 0]; locM2 = [0, -M2, 0];
              }
              // Transform local → global: v_global = T^T * v_local
              const toGlobal = (v: number[]) => [
                T[0][0] * v[0] + T[1][0] * v[1] + T[2][0] * v[2],
                T[0][1] * v[0] + T[1][1] * v[1] + T[2][1] * v[2],
                T[0][2] * v[0] + T[1][2] * v[1] + T[2][2] * v[2],
              ];
              const gF1 = toGlobal(locF1), gF2 = toGlobal(locF2);
              const gM1 = toGlobal(locM1), gM2 = toGlobal(locM2);
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: gF1[0], fy: gF1[1], fz: gF1[2], mx: gM1[0], my: gM1[1], mz: gM1[2] },
                { node_id: mInfo.endNodeId,   fx: gF2[0], fy: gF2[1], fz: gF2[2], mx: gM2[0], my: gM2[1], mz: gM2[2] },
              );
            } else if (dir === "global_y") {
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: 0, fy: R1, fz: 0, mx: 0, my: 0, mz: M1 },
                { node_id: mInfo.endNodeId, fx: 0, fy: R2, fz: 0, mx: 0, my: 0, mz: M2 },
              );
            } else if (dir === "global_z") {
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: R1, mx: 0, my: -M1, mz: 0 },
                { node_id: mInfo.endNodeId, fx: 0, fy: 0, fz: R2, mx: 0, my: -M2, mz: 0 },
              );
            } else if (dir === "global_x" || dir === "axial") {
              const R1x = (P * b) / L;
              const R2x = (P * a) / L;
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: R1x, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
                { node_id: mInfo.endNodeId, fx: R2x, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
              );
            }
          } else if (mpl.type === "moment" && mpl.M) {
            const Mo = mpl.M * 1000;
            const R1 = (6 * Mo * a * b) / (L * L * L);
            const R2 = -R1;
            const M1 = (Mo * b * (2 * a - b)) / (L * L);
            const M2 = (Mo * a * (2 * b - a)) / (L * L);
            const dir = mpl.direction || "global_z";

            if (dir === "local_y" || dir === "local_z" || dir.includes("local")) {
              // Local moment: compute FEF in local, then transform to global
              const T = buildRotation3x3(
                { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
                { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
              );
              // Moment about local Z (primary bending) — shear in local Y
              // Moment about local Y (weak bending) — shear in local Z, signs negated
              let locF1: number[], locF2: number[], locM1: number[], locM2: number[];
              if (dir === "local_y") {
                // Moment about local Y → shear in local Z
                locF1 = [0, 0, R1]; locF2 = [0, 0, R2];
                locM1 = [0, M1, 0]; locM2 = [0, M2, 0];
              } else {
                // Moment about local Z → shear in local Y (default)
                locF1 = [0, R1, 0]; locF2 = [0, R2, 0];
                locM1 = [0, 0, M1]; locM2 = [0, 0, M2];
              }
              const toGlobal = (v: number[]) => [
                T[0][0] * v[0] + T[1][0] * v[1] + T[2][0] * v[2],
                T[0][1] * v[0] + T[1][1] * v[1] + T[2][1] * v[2],
                T[0][2] * v[0] + T[1][2] * v[1] + T[2][2] * v[2],
              ];
              const gF1 = toGlobal(locF1), gF2 = toGlobal(locF2);
              const gM1 = toGlobal(locM1), gM2 = toGlobal(locM2);
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: gF1[0], fy: gF1[1], fz: gF1[2], mx: gM1[0], my: gM1[1], mz: gM1[2] },
                { node_id: mInfo.endNodeId,   fx: gF2[0], fy: gF2[1], fz: gF2[2], mx: gM2[0], my: gM2[1], mz: gM2[2] },
              );
            } else if (dir === "global_y") {
              // Moment about global Y → shear in fz, moment in my
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: R1, mx: 0, my: M1, mz: 0 },
                { node_id: mInfo.endNodeId,   fx: 0, fy: 0, fz: R2, mx: 0, my: M2, mz: 0 },
              );
            } else if (dir === "global_x") {
              // Moment about global X → torsion, shear in both Y and Z planes
              // For simplicity, apply as torsional moment (no transverse shear from torsion)
              const Mx1 = (Mo * b) / L;
              const Mx2 = (Mo * a) / L;
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: 0, mx: Mx1, my: 0, mz: 0 },
                { node_id: mInfo.endNodeId,   fx: 0, fy: 0, fz: 0, mx: Mx2, my: 0, mz: 0 },
              );
            } else {
              // Default: moment about global Z → shear in fy, moment in mz
              equivalentNodalFromMemberPt.push(
                { node_id: mInfo.startNodeId, fx: 0, fy: R1, fz: 0, mx: 0, my: 0, mz: M1 },
                { node_id: mInfo.endNodeId,   fx: 0, fy: R2, fz: 0, mx: 0, my: 0, mz: M2 },
              );
            }
          }
        }

        // Build point loads from nodal loads in WASM format
        const wasmPointLoads = [
          ...loads.map((l) => ({
            node_id: l.nodeId,
            fx: (l.fx ?? 0) * 1000, fy: (l.fy ?? 0) * 1000, fz: (l.fz ?? 0) * 1000,
            mx: (l.mx ?? 0) * 1000, my: (l.my ?? 0) * 1000, mz: (l.mz ?? 0) * 1000,
          })),
          ...equivalentNodalFromMemberPt,
        ];

        modelerLogger.log(
          `[Analysis] Member loads: ${wasmMemberLoads.length}, Point loads: ${wasmPointLoads.length}`,
        );
        if (wasmMemberLoads.length > 0) {
          modelerLogger.log(`[Analysis] First member load:`, JSON.stringify(wasmMemberLoads[0]));
        }
        if (wasmPointLoads.length > 0) {
          modelerLogger.log(`[Analysis] First point load:`, JSON.stringify(wasmPointLoads[0]));
        }

        // Use Rust WASM solver (client-side) for frame analysis
        try {
          commitAnalysisProgress("solving", 40, { force: true });
          animateProgress(40, 75, 1200);

          modelerLogger.log("[Analysis] Using Rust WASM solver - client-side computation");
          const { analyzeStructure, initSolver } = await import("../services/wasmSolverService");
          await initSolver();

          // Detect 2D structure
          const allZValues = nodesArray.map((n) => n.z ?? 0);
          const zRange = Math.max(...allZValues) - Math.min(...allZValues);
          const is2DPlanar = zRange < 0.001;

          if (is2DPlanar) {
            modelerLogger.log("[Analysis] 2D planar structure detected — constraining out-of-plane DOFs");
          }

          const wasmNodes = nodesArray.map((n) => ({
            id: n.id,
            x: n.x, y: n.y, z: n.z ?? 0,
            restraints: [
              n.restraints?.fx || false,
              n.restraints?.fy || false,
              is2DPlanar ? true : n.restraints?.fz || false,
              is2DPlanar ? true : n.restraints?.mx || false,
              is2DPlanar ? true : n.restraints?.my || false,
              n.restraints?.mz || false,
            ],
          }));

          const wasmElements = membersArray.map((m) => {
            const rel = m.releases;
            const releases_i = rel
              ? [rel.fxStart || false, rel.fyStart || false, rel.fzStart || false, rel.mxStart || false, rel.myStart || false, rel.mzStart || rel.startMoment || false]
              : [false, false, false, false, false, false];
            const releases_j = rel
              ? [rel.fxEnd || false, rel.fyEnd || false, rel.fzEnd || false, rel.mxEnd || false, rel.myEnd || false, rel.mzEnd || rel.endMoment || false]
              : [false, false, false, false, false, false];
            return {
              id: m.id,
              node_i: m.startNodeId, node_j: m.endNodeId,
              E: (m.E || 200e6) * 1000, G: (m.G || 76.9e6) * 1000,
              A: m.A || 0.01, Iy: m.Iy || 1e-4, Iz: m.Iz || 1e-4, J: m.J || 2e-4,
              beta: ((m.betaAngle || 0) * Math.PI) / 180,
              releases_i, releases_j,
            };
          });

          // ── Plate / Slab elements ──
          const platesArray = Array.from(plates.values());
          const wasmPlateElements = platesArray.map((p) => ({
            id: p.id,
            node_i: p.nodeIds[0], node_j: p.nodeIds[1], node_k: p.nodeIds[2], node_l: p.nodeIds[3],
            element_type: "Plate" as const,
            E: (p.E ?? (p.materialType === "concrete" ? 25e6 : 200e6)) * 1000,
            thickness: p.thickness ?? 0.2,
            nu: p.nu ?? (p.materialType === "concrete" ? 0.2 : 0.3),
            G: 0, A: 0, Iy: 0, Iz: 0, J: 0, beta: 0,
            releases_i: [false, false, false, false, false, false],
            releases_j: [false, false, false, false, false, false],
          }));

          // Add plate pressure loads as equivalent nodal loads
          for (const p of platesArray) {
            if (p.pressure && Math.abs(p.pressure) > 1e-12) {
              const pNodes = p.nodeIds
                .map((nid) => nodesArray.find((n) => n.id === nid))
                .filter(Boolean) as typeof nodesArray;
              if (pNodes.length === 4) {
                const dx13 = pNodes[2].x - pNodes[0].x, dy13 = pNodes[2].y - pNodes[0].y, dz13 = (pNodes[2].z ?? 0) - (pNodes[0].z ?? 0);
                const dx24 = pNodes[3].x - pNodes[1].x, dy24 = pNodes[3].y - pNodes[1].y, dz24 = (pNodes[3].z ?? 0) - (pNodes[1].z ?? 0);
                const cx = dy13 * dz24 - dz13 * dy24;
                const cy = dz13 * dx24 - dx13 * dz24;
                const cz = dx13 * dy24 - dy13 * dx24;
                const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
                const forcePerNode = (p.pressure * 1000 * area) / 4;
                for (const nd of pNodes) {
                  wasmPointLoads.push({ node_id: nd.id, fx: 0, fy: -forcePerNode, fz: 0, mx: 0, my: 0, mz: 0 });
                }
              }
            }
          }

          const allWasmElements = [...wasmElements, ...wasmPlateElements];

          modelerLogger.log(
            `[Analysis] Calling WASM solver with ${wasmNodes.length} nodes, ${allWasmElements.length} elements (${wasmElements.length} frame + ${wasmPlateElements.length} plate)`,
          );
          const wasmResult = await analyzeStructure(wasmNodes, allWasmElements, wasmPointLoads, wasmMemberLoads);

          if (!wasmResult.success) {
            throw new Error(wasmResult.error || "WASM analysis failed");
          }

          modelerLogger.log("[Analysis] WASM Result received");

          // Diagnostic dump
          {
            const mfRaw = wasmResult.member_forces;
            const mfType = mfRaw instanceof Map ? "Map" : typeof mfRaw;
            const mfKeys = mfRaw instanceof Map ? Array.from(mfRaw.keys()).slice(0, 3) : mfRaw ? Object.keys(mfRaw).slice(0, 3) : [];
            modelerLogger.log(`[Analysis][Debug] member_forces type=${mfType}, keys(first 3)=${JSON.stringify(mfKeys)}`);
            if (mfKeys.length > 0) {
              const firstKey = mfKeys[0];
              const firstVal = mfRaw instanceof Map ? mfRaw.get(firstKey) : mfRaw?.[firstKey as keyof typeof mfRaw];
              modelerLogger.log(`[Analysis][Debug] First member force entry:`, JSON.stringify(firstVal, (_, v) => ArrayBuffer.isView(v) ? Array.from(v as Uint8Array) : v));
            }
          }

          // Convert WASM result to expected format
          const mapEntries = (obj: unknown): [string, unknown][] => {
            if (!obj) return [];
            if (obj instanceof Map) return Array.from(obj.entries());
            if (typeof obj === "object") return Object.entries(obj as Record<string, unknown>);
            return [];
          };

          // Parse displacements
          const nodesDict: Record<string, NodeDisplacementResult> = {};
          const displacements = wasmResult.displacements;
          for (const [nodeId, disp] of mapEntries(displacements)) {
            const dispArray = disp as number[];
            nodesDict[nodeId] = {
              nodeId,
              DX: dispArray[0] ?? 0, DY: dispArray[1] ?? 0, DZ: dispArray[2] ?? 0,
              RX: dispArray[3] ?? 0, RY: dispArray[4] ?? 0, RZ: dispArray[5] ?? 0,
            };
          }
          modelerLogger.log(`[Analysis] Parsed ${Object.keys(nodesDict).length} displacements`);

          // Parse reactions
          const reactionsDict: Record<string, number[]> = {};
          const reactions = wasmResult.reactions;
          for (const [nodeId, rxn] of mapEntries(reactions)) {
            const rxnArray = rxn as number[];
            reactionsDict[nodeId] = [
              (rxnArray[0] ?? 0) / 1000, (rxnArray[1] ?? 0) / 1000, (rxnArray[2] ?? 0) / 1000,
              (rxnArray[3] ?? 0) / 1000, (rxnArray[4] ?? 0) / 1000, (rxnArray[5] ?? 0) / 1000,
            ];
          }
          modelerLogger.log(`[Analysis] Parsed ${Object.keys(reactionsDict).length} reactions`);

          // ── FEF correction ──
          const { computePointMomentFEF } = await import("../utils/memberLoadFEF");
          const memberFEFMap = new Map<string, { forces_i: number[]; forces_j: number[] }>();
          for (const mpl of memberPointLoads) {
            const mInfo = membersArray.find((m) => m.id === mpl.memberId);
            if (!mInfo) continue;
            const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
            const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
            if (!nd1 || !nd2) continue;
            const ddx = nd2.x - nd1.x, ddy = nd2.y - nd1.y;
            const ddz = (nd2.z ?? 0) - (nd1.z ?? 0);
            const mL = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
            if (mL < 1e-12) continue;
            const aRaw = mpl.a ?? 0.5;
            const aVal = aRaw <= 1.0 ? aRaw * mL : aRaw;
            let val = 0;
            if (mpl.type === "point" && mpl.P) val = mpl.P * 1000;
            else if (mpl.type === "moment" && mpl.M) val = mpl.M * 1000;
            if (Math.abs(val) < 1e-12) continue;
            const beta = ((mInfo.betaAngle || 0) * Math.PI) / 180;
            const fef = computePointMomentFEF(
              [{ type: mpl.type as "point" | "moment", value: val, a: aVal, direction: mpl.direction || "global_y" }],
              { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
              { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
              beta,
            );
            const existing = memberFEFMap.get(mpl.memberId);
            if (existing) {
              for (let k = 0; k < 6; k++) { existing.forces_i[k] += fef.forces_i[k]; existing.forces_j[k] += fef.forces_j[k]; }
            } else {
              memberFEFMap.set(mpl.memberId, { forces_i: [...fef.forces_i], forces_j: [...fef.forces_j] });
            }
          }
          if (memberFEFMap.size > 0) {
            modelerLogger.log(`[Analysis] FEF correction: ${memberFEFMap.size} member(s) have point/moment loads requiring force recovery correction`);
          }

          // ── Pin-support detection ──
          const memberCountPerNode = new Map<string, number>();
          for (const mm of membersArray) {
            memberCountPerNode.set(mm.startNodeId, (memberCountPerNode.get(mm.startNodeId) ?? 0) + 1);
            memberCountPerNode.set(mm.endNodeId, (memberCountPerNode.get(mm.endNodeId) ?? 0) + 1);
          }
          const isPinSupport = (nodeId: string): boolean => {
            const nd = nodesArray.find((n) => n.id === nodeId);
            if (!nd?.restraints) return false;
            const r = nd.restraints;
            const hasTranslation = r.fx || r.fy || r.fz;
            const hasMomentRestraint = r.mz;
            const singleMember = (memberCountPerNode.get(nodeId) ?? 0) <= 1;
            return !!hasTranslation && !hasMomentRestraint && singleMember;
          };

          // ── Parse member forces ──
           
          const membersDict: Record<string, any> = {};
          const memberForcesMap = wasmResult.member_forces;
          for (const [elemId, forces] of mapEntries(memberForcesMap)) {
            const mf = forces as {
              axial?: number; shear_start?: number; moment_start?: number; shear_end?: number; moment_end?: number;
              forces_i?: number[]; forces_j?: number[];
              max_shear_y?: number; max_shear_z?: number; max_moment_y?: number; max_moment_z?: number;
              max_axial?: number; max_torsion?: number;
            };

            const genDiagram = (
              axF: number, v1: number, m1: number, v2: number, m2: number, memberElemId: string,
              vz1 = 0, my1 = 0, vz2 = 0, my2 = 0,
            ) => {
              const mInfo = membersArray.find((m) => m.id === memberElemId);
              if (!mInfo) return undefined;
              const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
              const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
              if (!nd1 || !nd2) return undefined;
              const ddx = nd2.x - nd1.x, ddy = nd2.y - nd1.y;
              const ddz = (nd2.z ?? 0) - (nd1.z ?? 0);
              const L = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1;
              const EIz = (mInfo.E || 200e6) * (mInfo.I || mInfo.Iz || 1e-4);
              const EIy = (mInfo.E || 200e6) * (mInfo.Iy || mInfo.I || 1e-4);

              const myMLs: DiagramLoad[] = memberLoads.filter((ml) => ml.memberId === memberElemId);
              const { ly: lyAx, lz: lzAx } = buildLocalAxesForDiagram(ddx, ddy, ddz, L, mInfo.betaAngle ?? 0);

              const stations = buildDiagramStations(L, myMLs, 51);
              const numSt = stations.length;
              const xv: number[] = [], sy: number[] = [], sz: number[] = [], mzArr: number[] = [], myArr: number[] = [];
              const ax: number[] = [], dy: number[] = [], dz: number[] = [];

              for (let s = 0; s < numSt; s++) {
                const x = stations[s];
                xv.push(x);
                ax.push(axF);
                const { dVy, dMz, dVz, dMy } = accumulateLoadEffects(x, myMLs, L, lyAx, lzAx);
                sy.push(v1 + dVy);
                mzArr.push(-m1 + v1 * x + dMz);
                sz.push(vz1 + dVz);
                myArr.push(my1 + vz1 * x + dMy);
              }

              // Enforce endpoint closure
              if (numSt > 0) {
                mzArr[0] = -m1;
                mzArr[numSt - 1] = m2;
                myArr[0] = my1;
                myArr[numSt - 1] = -my2;
                sy[0] = v1;
                sy[numSt - 1] = -v2;
                sz[0] = vz1;
                sz[numSt - 1] = -vz2;
              }

              // When there are no member distributed/point loads (only nodal loads),
              // accumulateLoadEffects returns dVy=0 everywhere — making shear constant
              // and moment purely linear. For nodal point loads, the shear IS a step
              // function and moment IS a tent. Re-derive M by integrating the shear
              // diagram (trapezoidal rule) using linearly interpolated shear between
              // the correct end values, which matches equilibrium.
              if (myMLs.length === 0 && numSt > 1) {
                // Re-fill shear with linear interpolation between known end values
                for (let s = 0; s < numSt; s++) {
                  const t = stations[s] / L;
                  sy[s] = v1 + ((-v2) - v1) * t;
                  sz[s] = vz1 + ((-vz2) - vz1) * t;
                }
                // Re-integrate moment from shear (dM/dx = V)
                mzArr[0] = -m1;
                for (let s = 1; s < numSt; s++) {
                  const dx_s = stations[s] - stations[s - 1];
                  mzArr[s] = mzArr[s - 1] + 0.5 * (sy[s - 1] + sy[s]) * dx_s;
                }
                mzArr[numSt - 1] = m2; // enforce endpoint
                myArr[0] = my1;
                for (let s = 1; s < numSt; s++) {
                  const dx_s = stations[s] - stations[s - 1];
                  myArr[s] = myArr[s - 1] - 0.5 * (sz[s - 1] + sz[s]) * dx_s;
                }
                myArr[numSt - 1] = -my2; // enforce endpoint
              }

              // Solver displacement BCs for deflection
              const disp_nd_i = nodesDict[mInfo.startNodeId];
              const disp_nd_j = nodesDict[mInfo.endNodeId];
              const dy_i_loc = disp_nd_i ? lyAx[0] * (disp_nd_i.DX ?? 0) + lyAx[1] * (disp_nd_i.DY ?? 0) + lyAx[2] * (disp_nd_i.DZ ?? 0) : 0;
              const dy_j_loc = disp_nd_j ? lyAx[0] * (disp_nd_j.DX ?? 0) + lyAx[1] * (disp_nd_j.DY ?? 0) + lyAx[2] * (disp_nd_j.DZ ?? 0) : 0;
              const dz_i_loc = disp_nd_i ? lzAx[0] * (disp_nd_i.DX ?? 0) + lzAx[1] * (disp_nd_i.DY ?? 0) + lzAx[2] * (disp_nd_i.DZ ?? 0) : 0;
              const dz_j_loc = disp_nd_j ? lzAx[0] * (disp_nd_j.DX ?? 0) + lzAx[1] * (disp_nd_j.DY ?? 0) + lzAx[2] * (disp_nd_j.DZ ?? 0) : 0;

              const rawDY = integrateDeflection(stations, mzArr, EIz, dy_i_loc, dy_j_loc, L, 1);
              for (let s = 0; s < numSt; s++) dy.push(rawDY[s] * 1000);

              const rawDZ = integrateDeflection(stations, myArr, EIy, dz_i_loc, dz_j_loc, L, -1);
              for (let s = 0; s < numSt; s++) dz.push(rawDZ[s] * 1000);

              return {
                x_values: xv, shear_y: sy, shear_z: sz,
                moment_z: mzArr, moment_y: myArr,
                axial: ax, deflection_y: dy, deflection_z: dz,
              };
            };

            // Handle both 2D and 3D formats
            if (mf.forces_i && mf.forces_j) {
              const ptFEF = memberFEFMap.get(elemId);
              const fi0 = (mf.forces_i as number[]).map((v, k) => (v ?? 0) - (ptFEF ? ptFEF.forces_i[k] : 0));
              const fj0 = (mf.forces_j as number[]).map((v, k) => (v ?? 0) - (ptFEF ? ptFEF.forces_j[k] : 0));

              // Zero out released DOFs
              const mElem = membersArray.find((mm) => mm.id === elemId);
              if (mElem?.releases) {
                const relI = mElem.releases;
                if (relI.fxStart) fi0[0] = 0; if (relI.fyStart) fi0[1] = 0; if (relI.fzStart) fi0[2] = 0;
                if (relI.mxStart) fi0[3] = 0; if (relI.myStart) fi0[4] = 0; if (relI.mzStart || relI.startMoment) fi0[5] = 0;
                if (relI.fxEnd) fj0[0] = 0; if (relI.fyEnd) fj0[1] = 0; if (relI.fzEnd) fj0[2] = 0;
                if (relI.mxEnd) fj0[3] = 0; if (relI.myEnd) fj0[4] = 0; if (relI.mzEnd || relI.endMoment) fj0[5] = 0;
              }

              if (isPinSupport(mElem?.startNodeId ?? "")) { fi0[5] = 0; fi0[4] = 0; }
              if (isPinSupport(mElem?.endNodeId ?? "")) { fj0[5] = 0; fj0[4] = 0; }

              // Clean numerical noise
              const peakForce = Math.max(...fi0.map(Math.abs), ...fj0.map(Math.abs), 1e-12);
              const noiseTol = peakForce * 1e-6;
              for (let k = 0; k < 6; k++) {
                if (Math.abs(fi0[k]) < noiseTol) fi0[k] = 0;
                if (Math.abs(fj0[k]) < noiseTol) fj0[k] = 0;
              }

              const axV = fi0[0] / 1000, syV = fi0[1] / 1000, szV = fi0[2] / 1000;
              const txV = fi0[3] / 1000, myV = fi0[4] / 1000, mzV = fi0[5] / 1000;
              const syE = fj0[1] / 1000, szE = fj0[2] / 1000, myE = fj0[4] / 1000, mzE = fj0[5] / 1000;

              if (Object.keys(membersDict).length === 0) {
                modelerLogger.log(`[Analysis][Diag] First member ${elemId}: Vy_i=${syV.toFixed(3)} kN, Mz_i=${mzV.toFixed(3)} kN·m, Vy_j=${syE.toFixed(3)} kN, Mz_j=${mzE.toFixed(3)} kN·m`);
              }
              const maxSY = mf.max_shear_y != null ? mf.max_shear_y / 1000 : Math.max(Math.abs(syV), Math.abs(syE));
              const maxSZ = (mf.max_shear_z ?? 0) / 1000;
              const maxMY = (mf.max_moment_y ?? 0) / 1000;
              const maxMZ = mf.max_moment_z != null ? mf.max_moment_z / 1000 : Math.max(Math.abs(mzV), Math.abs(mzE));
              const diag3D = genDiagram(axV, syV, mzV, syE, mzE, elemId, szV, myV, szE, myE);

              if (Object.keys(membersDict).length === 0 && diag3D) {
                const mz = diag3D.moment_z;
                const dfy = diag3D.deflection_y;
                modelerLogger.log(`[Analysis][Diag] BMD for ${elemId}: M(0)=${mz[0]?.toFixed(3)}, M(mid)=${mz[Math.floor(mz.length / 2)]?.toFixed(3)}, M(end)=${mz[mz.length - 1]?.toFixed(3)} kN·m`);
                modelerLogger.log(`[Analysis][Diag] Deflection for ${elemId}: dy(0)=${dfy[0]?.toFixed(4)}, dy(mid)=${dfy[Math.floor(dfy.length / 2)]?.toFixed(4)}, dy(end)=${dfy[dfy.length - 1]?.toFixed(4)} mm`);
              } else if (Object.keys(membersDict).length === 0 && !diag3D) {
                modelerLogger.warn(`[Analysis][Diag] genDiagram returned undefined for ${elemId}`);
              }
              membersDict[elemId] = {
                memberId: elemId, axial: diag3D?.axial || [axV],
                shearY: syV, shearZ: szV, torsion: txV, momentY: myV, momentZ: mzV,
                shearStart: syV, shearEnd: syE, momentStart: mzV, momentEnd: mzE,
                max_shear_y: maxSY, max_shear_z: maxSZ, max_moment_y: maxMY, max_moment_z: maxMZ,
                x_values: diag3D?.x_values, shear_y: diag3D?.shear_y,
                shear_z: diag3D?.shear_z || [], moment_y: diag3D?.moment_y || [],
                moment_z: diag3D?.moment_z, torsion_arr: [] as number[],
                deflection_y: diag3D?.deflection_y, deflection_z: diag3D?.deflection_z || [],
              };
            } else {
              // 2D format
              const axF = (mf.axial ?? 0) / 1000;
              let v1 = (mf.shear_start ?? 0) / 1000, v2 = (mf.shear_end ?? 0) / 1000;
              let m1 = (mf.moment_start ?? 0) / 1000, m2 = (mf.moment_end ?? 0) / 1000;

              const mElem2D = membersArray.find((mm) => mm.id === elemId);
              if (mElem2D?.releases) {
                if (mElem2D.releases.mzStart || mElem2D.releases.startMoment) m1 = 0;
                if (mElem2D.releases.mzEnd || mElem2D.releases.endMoment) m2 = 0;
              }
              if (mElem2D && isPinSupport(mElem2D.startNodeId)) m1 = 0;
              if (mElem2D && isPinSupport(mElem2D.endNodeId)) m2 = 0;
              const peak2D = Math.max(Math.abs(axF), Math.abs(v1), Math.abs(v2), Math.abs(m1), Math.abs(m2), 1e-12);
              const tol2D = peak2D * 1e-6;
              if (Math.abs(m1) < tol2D) m1 = 0; if (Math.abs(m2) < tol2D) m2 = 0;
              if (Math.abs(v1) < tol2D) v1 = 0; if (Math.abs(v2) < tol2D) v2 = 0;

              const diag2D = genDiagram(axF, v1, m1, v2, m2, elemId);
              membersDict[elemId] = {
                memberId: elemId, axial: diag2D?.axial || [axF],
                max_shear_y: Math.max(Math.abs(v1), Math.abs(v2)), max_shear_z: 0, max_moment_y: 0,
                max_moment_z: Math.max(Math.abs(m1), Math.abs(m2)),
                x_values: diag2D?.x_values, shear_y: diag2D?.shear_y,
                shear_z: diag2D?.shear_z || [], moment_y: diag2D?.moment_y || [],
                moment_z: diag2D?.moment_z, torsion: [] as number[],
                deflection_y: diag2D?.deflection_y, deflection_z: [] as number[],
                shearStart: v1, shearEnd: v2, momentStart: m1, momentEnd: m2,
              };
            }
          }
          modelerLogger.log(`[Analysis] Parsed ${Object.keys(membersDict).length} member forces`);

          const equilibriumCheck = wasmResult.equilibrium_check
            ? wasmResult.equilibrium_check instanceof Map
              ? Object.fromEntries(wasmResult.equilibrium_check)
              : wasmResult.equilibrium_check
            : undefined;
          const conditionNumber = wasmResult.condition_number ?? undefined;

          if (equilibriumCheck) {
            modelerLogger.log(`[Analysis] Equilibrium check: ${equilibriumCheck.pass ? "PASS" : "FAIL"} (error: ${equilibriumCheck.error_percent?.toFixed(6)}%)`);
          }
          if (conditionNumber && conditionNumber > 1e10) {
            modelerLogger.warn(`[Analysis] Warning: High condition number (${conditionNumber.toExponential(2)})`);
          }

          // ── Parse plate results ──
          const plateResultsDict: Record<string, PlateResult> = {};
          if (wasmResult.plate_results) {
            for (const [elemId2, pr] of mapEntries(wasmResult.plate_results)) {
              const p = pr as Record<string, number>;
              plateResultsDict[elemId2] = {
                stress_xx: (p.stress_xx ?? 0) / 1e6, stress_yy: (p.stress_yy ?? 0) / 1e6,
                stress_xy: (p.stress_xy ?? 0) / 1e6,
                moment_xx: (p.moment_xx ?? 0) / 1000, moment_yy: (p.moment_yy ?? 0) / 1000,
                moment_xy: (p.moment_xy ?? 0) / 1000,
                displacement: (p.displacement ?? 0) * 1000, von_mises: (p.von_mises ?? 0) / 1e6,
              };
            }
            modelerLogger.log(`[Analysis] Parsed ${Object.keys(plateResultsDict).length} plate results`);
          }

          result = {
            success: true,
            displacements: nodesDict, reactions: reactionsDict,
            memberForces: membersDict, plateResults: plateResultsDict,
            equilibriumCheck, conditionNumber,
            stats: {
              computation_time: wasmResult.stats?.solveTimeMs ? `${wasmResult.stats.solveTimeMs.toFixed(2)}ms` : "< 1ms",
              usedPythonApi: false, solver: "Rust WASM",
            },
          };

          modelerLogger.log("[Analysis] Complete:", {
            displacements: Object.keys(nodesDict).length,
            reactions: Object.keys(reactionsDict).length,
            memberForces: Object.keys(membersDict).length,
            plateResults: Object.keys(plateResultsDict).length,
          });
        } catch (err) {
          // WASM failed — try EnhancedAnalysisEngine, then Worker fallback
          modelerLogger.warn("[Analysis] WASM solver failed, trying EnhancedAnalysisEngine:", err);
          commitAnalysisProgress("assembling", 35, { force: true });

          try {
            const { analyzeWithEnhancedEngine } = await import("../core/engineAdapter");
            const engineResult = await analyzeWithEnhancedEngine(
              nodesArray, membersArray, loads, memberLoads,
              (stage: string, progress: number) => {
                commitAnalysisProgress(stage as AnalysisStage, progress);
              },
            );
            if (engineResult.success) {
              result = engineResult as typeof result;
              modelerLogger.log("[Analysis] EnhancedAnalysisEngine succeeded");
            } else {
              throw new Error(engineResult.error ?? "EnhancedAnalysisEngine failed");
            }
          } catch (engineErr) {
            modelerLogger.warn("[Analysis] EnhancedAnalysisEngine failed, falling back to TypeScript Worker:", engineErr);

            try {
              const { convertMemberLoadsToNodal, mergeNodalLoads } = await import("../utils/loadConversion");
              const conversionResult = convertMemberLoadsToNodal(
                memberLoads.map((ml) => ({
                  id: ml.id, memberId: ml.memberId, type: ml.type,
                  w1: ml.w1 ?? 0, w2: ml.w2 ?? 0, direction: ml.direction,
                  startPos: ml.startPos ?? 0, endPos: ml.endPos ?? 1,
                })),
                membersArray.map((m) => ({ id: m.id, startNodeId: m.startNodeId, endNodeId: m.endNodeId, E: m.E, A: m.A, I: m.I })),
                nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
              );
              const existingLoads = loads.map((l) => ({ nodeId: l.nodeId, fx: l.fx, fy: l.fy, fz: l.fz, mx: l.mx, my: l.my, mz: l.mz }));
              const allLoads = mergeNodalLoads([...existingLoads, ...conversionResult.nodalLoads]);

              modelerLogger.log(`[Analysis] Converted ${memberLoads.length} member loads → ${allLoads.length} nodal loads, using TS solver`);

              const modelData = {
                nodes: nodesArray, members: membersArray, loads: allLoads,
                memberLoads: [] as Array<Record<string, unknown>>,
                settings: { selfWeight: modelSettings?.selfWeight ?? false },
              };

              const token = await getToken();
              const { analysisService } = await getAnalysisService();
              result = await analysisService.analyze(
                modelData,
                (stage, progress) => {
                  commitAnalysisProgress(stage as AnalysisStage, progress);
                },
                token,
              ) as typeof result;

              if (result.success && result.stats) {
                result.stats = { ...result.stats, solver: "TypeScript (WASM fallback)", usedPythonApi: false };
              }
            } catch (fallbackErr) {
              modelerLogger.error("[Analysis] TypeScript fallback also failed:", fallbackErr);
              result = {
                success: false,
                error: `WASM solver: ${err instanceof Error ? err.message : String(err)}\nEnhancedEngine: ${engineErr instanceof Error ? engineErr.message : String(engineErr)}\nWorker fallback: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
              };
            }
          }
        }
      }

      const endTime = Date.now();

      if (result.success) {
        // Convert results to store format
        const displacementsMap = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
        const reactionsMap = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
        const memberForcesStoreMap = new Map<string, {
          axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number;
          diagramData?: { x_values: number[]; shear_y: number[]; shear_z: number[]; moment_y: number[]; moment_z: number[]; axial: number[]; torsion: number[]; deflection_y: number[]; deflection_z: number[] };
        }>();

        // Parse displacements
        if (result.displacements) {
          Object.entries(result.displacements).forEach(([nodeId, disp]) => {
            if (Array.isArray(disp)) {
              displacementsMap.set(nodeId, { dx: disp[0] ?? 0, dy: disp[1] ?? 0, dz: disp[2] ?? 0, rx: disp[3] ?? 0, ry: disp[4] ?? 0, rz: disp[5] ?? 0 });
            } else if (typeof disp === "object" && disp !== null) {
              const d = disp as unknown as Record<string, unknown>;
              const displacement = (d.displacement ?? d) as Record<string, unknown>;
              displacementsMap.set(nodeId, {
                dx: ((displacement.dx ?? displacement.DX ?? 0) as number), dy: ((displacement.dy ?? displacement.DY ?? 0) as number), dz: ((displacement.dz ?? displacement.DZ ?? 0) as number),
                rx: ((displacement.rx ?? displacement.RX ?? 0) as number), ry: ((displacement.ry ?? displacement.RY ?? 0) as number), rz: ((displacement.rz ?? displacement.RZ ?? 0) as number),
              });
            }
          });
        }

        // Parse reactions
        if (result.reactions) {
          Object.entries(result.reactions).forEach(([nodeId, react]) => {
            const r = react as number[];
            reactionsMap.set(nodeId, { fx: r[0] ?? 0, fy: r[1] ?? 0, fz: r[2] ?? 0, mx: r[3] ?? 0, my: r[4] ?? 0, mz: r[5] ?? 0 });
          });
        }

        // Parse member forces
        if (result.memberForces) {
          Object.entries(result.memberForces).forEach(([memberId, forces]) => {
             
            const f = forces as Record<string, any>;  // Solver output has variable property naming
            const getMaxAbs = (arr: number[] | undefined): number => {
              if (!arr || arr.length === 0) return 0;
              return Math.max(Math.abs(Math.min(...arr)), Math.abs(Math.max(...arr)));
            };
            const axialVal = f.max_shear_y !== undefined
              ? Array.isArray(f.axial) ? getMaxAbs(f.axial) : (f.axial ?? 0)
              : typeof f.axial === "number" ? f.axial : getMaxAbs(f.axial as number[] | undefined);
            const shearY = f.max_shear_y ?? (typeof f.shearY === "number" ? Math.abs(f.shearY) : getMaxAbs(f.shear_y));
            const shearZ = f.max_shear_z ?? (typeof f.shearZ === "number" ? Math.abs(f.shearZ) : getMaxAbs(f.shear_z));
            const momentY = f.max_moment_y ?? (typeof f.momentY === "number" ? Math.abs(f.momentY) : getMaxAbs(f.moment_y));
            const momentZ = f.max_moment_z ?? (typeof f.momentZ === "number" ? Math.abs(f.momentZ) : getMaxAbs(f.moment_z));
            const torsionVal = typeof f.torsion === "number" ? Math.abs(f.torsion) : getMaxAbs(f.torsion as number[] | undefined);

            const diagramData = f.x_values && f.shear_y ? {
              x_values: f.x_values, shear_y: f.shear_y, shear_z: f.shear_z || [],
              moment_y: f.moment_y || [], moment_z: f.moment_z || [],
              axial: Array.isArray(f.axial) ? f.axial : [],
              torsion: f.torsion_arr || (Array.isArray(f.torsion) ? f.torsion : []),
              deflection_y: f.deflection_y || [], deflection_z: f.deflection_z || [],
            } : undefined;

            memberForcesStoreMap.set(memberId, {
              axial: axialVal as number, shearY, shearZ, momentY, momentZ, torsion: torsionVal,
              ...(f.shearStart !== undefined ? {
                startForces: { axial: axialVal as number, shearY: f.shearStart ?? shearY, momentZ: f.momentStart ?? momentZ },
                endForces: { axial: -(axialVal as number), shearY: f.shearEnd ?? shearY, momentZ: f.momentEnd ?? momentZ },
              } : {}),
              diagramData,
            });

            if (memberForcesStoreMap.size === 1) {
              const dd = diagramData;
              if (dd) {
                const mzSample = dd.moment_z;
                modelerLogger.log(`[Analysis][Store] First member ${memberId}: diagramData present, moment_z.length=${mzSample?.length}, moment_z[0]=${mzSample?.[0]?.toFixed?.(4)}, moment_z[mid]=${mzSample?.[Math.floor((mzSample?.length || 0) / 2)]?.toFixed?.(4)}`);
              } else {
                modelerLogger.warn(`[Analysis][Store] First member ${memberId}: diagramData=undefined! x_values=${!!f.x_values}, shear_y=${!!f.shear_y}`);
              }
            }
          });
        }

         
        setAnalysisResults({
          displacements: displacementsMap, reactions: reactionsMap, memberForces: memberForcesStoreMap,
          plateResults: result.plateResults ?? {},
          equilibriumCheck: result.equilibriumCheck, conditionNumber: result.conditionNumber,
          completed: true, timestamp: Date.now(),
        } as any);

        useUIStore.getState().setAnalysisResults({ completed: true, timestamp: Date.now(), type: (result.stats?.solver as string) ?? "Rust WASM" });

        if (progressInterval) clearInterval(progressInterval);
        unstable_batchedUpdates(() => {
          commitAnalysisProgress("complete", 100, { force: true });
          setAnalysisStats({ nodes: nodes.size, members: members.size, dof: (result.stats?.totalDof as number) ?? nodes.size * 3, timeMs: endTime - startTime });
          setShowResultsToolbar(true);
          setShowResultsDock(true);
        });
        showNotification("success", "Analysis completed successfully!");
        startTransition(() => {
          void calculateStresses(memberForcesStoreMap, members);
        });

        // ── AI Telemetry (fire-and-forget, opt-out, non-blocking) ──
        try {
          scheduleAnalysisTelemetry(
            nodes,
            members,
            loads,
            {
              displacements: displacementsMap as Map<string, Record<string, number>>,
              reactions: reactionsMap as Map<string, Record<string, number>>,
              memberForces: memberForcesStoreMap as Map<string, Record<string, unknown>>,
              equilibriumCheck: result.equilibriumCheck,
              conditionNumber: result.conditionNumber,
            },
            endTime - startTime,
            async () => null,
          );
        } catch { /* telemetry errors must never break analysis */ }
      } else {
        commitAnalysisProgress("error" as AnalysisStage, progressUiStateRef.current.progress, { force: true });
        setAnalysisError(result.error || "Analysis failed");
        const event = new CustomEvent("ai-diagnose-error", { detail: { error: result.error || "Unknown analysis error" } });
        window.dispatchEvent(event);
        showNotification("error", `Analysis failed: ${result.error || "Unknown error"}. Check model for issues.`);
      }
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      commitAnalysisProgress("error" as AnalysisStage, progressUiStateRef.current.progress, { force: true });
      setAnalysisError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
        analysisAbortRef.current = null;
      }
      setIsAnalyzingLocal(false);
      useModelStore.getState().setIsAnalyzing(false);

      // Release analysis device lock (fire-and-forget)
      try {
        const { getDeviceId } = await import("./useDeviceId");
        const { API_CONFIG: apiCfg } = await import("../config/env");
        const deviceId = getDeviceId();
        const token = await getToken();
        if (token) {
          fetch(`${apiCfg.baseUrl}/api/session/analysis-lock/release`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "X-Device-Id": deviceId },
            body: JSON.stringify({ deviceId }),
          }).catch(() => { /* non-critical */ });
        }
      } catch { /* non-critical */ }
    }
  }, [getToken, calculateStresses, commitAnalysisProgress]);

  // ══════════════════════════════════════════
  // HANDLE RUN ANALYSIS (validation + lock + execute)
  // ══════════════════════════════════════════
  const handleRunAnalysis = useCallback(async () => {
    const { nodes, members, loads, memberLoads, floorLoads } = useModelStore.getState();
    const { showNotification } = useUIStore.getState();

    const hasModel = nodes.size > 0 && members.size > 0;
    const hasLoads = loads.length > 0 || memberLoads.length > 0 || floorLoads.length > 0;

    if (!hasModel) {
      showNotification('warning', 'Create model geometry first (nodes and members) before analysis.');
      return;
    }

    if (!hasLoads) {
      showNotification('warning', 'Define loads first before analysis.');
      return;
    }

    // STEP 1: Validate structure
    const validationResult = validateStructure(nodes, members);

    // STEP 1b: Run model diagnostics engine and merge with structural validation
    const nodesArray = Array.from(nodes.values());
    const membersArray = Array.from(members.values());
    const supports = nodesArray
      .filter((n) => {
        const r = n.restraints;
        return !!(r && (r.fx || r.fy || r.fz || r.mx || r.my || r.mz));
      })
      .map((n) => ({
        nodeId: n.id,
        fx: n.restraints?.fx,
        fy: n.restraints?.fy,
        fz: n.restraints?.fz,
        mx: n.restraints?.mx,
        my: n.restraints?.my,
        mz: n.restraints?.mz,
      }));

    const diagSummary = runDiagnostics({
      nodes: nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
      members: membersArray.map((m) => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        E: m.E,
        A: m.A,
        I: m.I,
      })),
      supports,
      loads: loads.map((l) => ({ nodeId: l.nodeId, fx: l.fx, fy: l.fy, fz: l.fz })),
    });

    const diagErrors: ValidationError[] = diagSummary.items
      .filter((d) => d.severity === "error")
      .map((d) => ({
        type: "error",
        message: d.message,
        details: `Code: ${d.code}`,
        affectedItems: d.entityIds,
      }));

    const diagWarnings: ValidationError[] = diagSummary.items
      .filter((d) => d.severity === "warning")
      .map((d) => ({
        type: "warning",
        message: d.message,
        details: `Code: ${d.code}`,
        affectedItems: d.entityIds,
      }));

    const mergedErrors = [...validationResult.errors, ...diagErrors];
    const mergedWarnings = [...validationResult.warnings, ...diagWarnings];

    if (!validationResult.valid || mergedErrors.length > 0) {
      setStructuralValidationErrors(mergedErrors);
      setStructuralValidationWarnings(mergedWarnings);
      setShowValidationDialog(true);
      return;
    }

    if (mergedWarnings.length > 0) {
      setStructuralValidationErrors([]);
      setStructuralValidationWarnings(mergedWarnings);
      setShowValidationDialog(true);
      return;
    }

    if (validationResult.warnings.length > 0) {
      modelerLogger.log(
        `[Analysis] Proceeding with ${validationResult.warnings.length} warning(s):`,
        validationResult.warnings.map((w) => w.message).join(", "),
      );
    }

    // STEP 2: Acquire analysis device lock
    try {
      const { getDeviceId } = await import("./useDeviceId");
      const deviceId = getDeviceId();
      const { API_CONFIG: apiCfg } = await import("../config/env");
      const API_URL = apiCfg.baseUrl;
      const token = await getToken();
      if (token) {
        const lockRes = await fetch(`${API_URL}/api/session/analysis-lock/acquire`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "X-Device-Id": deviceId },
          body: JSON.stringify({ deviceId }),
        });
        if (lockRes.status === 409) {
          const lockData = await lockRes.json();
          const deviceName = lockData?.data?.currentLockDevice?.deviceName || "another device";
          showNotification("error", `Analysis is currently active on ${deviceName}. Release the session on that device first, or go to Settings → Active Sessions to terminate it.`);
          return;
        }
      }
    } catch (err) {
      modelerLogger.log("[Analysis] Device lock check skipped:", err);
    }

    await executeAnalysis();
  }, [executeAnalysis, getToken]);

  // Clean up analysis worker when component using this hook unmounts
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
        analysisAbortRef.current = null;
      }
      getAnalysisService()
        .then((m) => m.analysisService.dispose())
        .catch(() => { /* Worker already disposed or failed to load */ });
    };
  }, []);

  // ══════════════════════════════════════════
  // ADVANCED ANALYSIS (Response Spectrum, Pushover, Steady-State, Imperfection)
  // ══════════════════════════════════════════
  const handleAdvancedAnalysis = useCallback(
    async (type: AdvancedAnalysisType, params: Record<string, unknown>): Promise<void> => {
      const { showNotification } = useUIStore.getState();
      const { setIsAnalyzing } = useModelStore.getState();

      setIsAnalyzingLocal(true);
      setIsAnalyzing(true);
      setShowProgressModal(true);
      setAnalysisError(undefined);

      const ANALYSIS_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

      try {
        const abortController = new AbortController();
        analysisAbortRef.current = abortController;
        const timeoutId = setTimeout(() => abortController.abort('timeout'), ANALYSIS_TIMEOUT_MS);

        try {
          commitAnalysisProgress("assembling", 10, { force: true });
          const submit = await rustApi.submitJob(type, params, "high");

          const startedAt = Date.now();
          while (!abortController.signal.aborted && Date.now() - startedAt < ANALYSIS_TIMEOUT_MS) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const status = await rustApi.getJobStatus(submit.job_id);

            commitAnalysisProgress(
              "solving",
              typeof status.progress === "number" ? status.progress : 50,
            );

            if (status.status === "completed") {
              commitAnalysisProgress("complete", 100, { force: true });
              showNotification('success', `${type.replace('_', ' ')} analysis completed.`);
              clearTimeout(timeoutId);
              return;
            }

            if (status.status === "failed" || status.status === "cancelled") {
              throw new Error(status.error ?? `${type.replace('_', ' ')} analysis ${status.status}`);
            }
          }

          throw new Error('Analysis timed out after 2 minutes. The backend did not respond in time.');
        } finally {
          clearTimeout(timeoutId);
          analysisAbortRef.current = null;
        }
      } catch (error) {
        const isTimeout =
          (error instanceof Error && (error.name === 'AbortError' || error.message === 'timeout')) ||
          (typeof error === 'string' && error === 'timeout');
        const msg = isTimeout
          ? 'Analysis timed out after 2 minutes. The backend solver did not respond in time.'
          : error instanceof Error ? error.message : 'Advanced analysis failed';
        setAnalysisError(msg);
        useUIStore.getState().showNotification('error', msg);
      } finally {
        setIsAnalyzingLocal(false);
        useModelStore.getState().setIsAnalyzing(false);
        setShowProgressModal(false);
      }
    },
    [getToken],
  );

  return {
    // Analysis state
    isAnalyzing, analysisProgress, analysisStage, analysisError,
    showProgressModal, analysisStats, showResultsToolbar, showResultsDock,
    // Validation state
    validationErrors, showValidationErrors, showValidationDialog,
    structuralValidationErrors, structuralValidationWarnings,
    // Stress state
    stressResults, showStressVisualization, currentStressType,
    // Actions
    executeAnalysis, handleRunAnalysis, cancelAnalysis, calculateStresses,
    handleAdvancedAnalysis,
    // State setters
    setShowProgressModal, setShowResultsToolbar, setShowResultsDock,
    setShowValidationErrors, setValidationErrors, setShowValidationDialog,
    setStructuralValidationErrors, setStructuralValidationWarnings,
    setShowStressVisualization, setCurrentStressType, setStressResults,
  };
}
