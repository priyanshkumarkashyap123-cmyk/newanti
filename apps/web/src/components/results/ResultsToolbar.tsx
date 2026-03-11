/**
 * ResultsToolbar - Post-Analysis Results Controls
 *
 * Floating toolbar after analysis:
 * - Toggle buttons for Deflected Shape, BMD, SFD, Reactions
 * - Scale slider for diagram visualization
 * - Animation controls for deflected shape
 * - Quick access to Advanced Analysis and Design
 * - Heat map visualization for stress/displacement
 * - Full Results Dashboard with enhanced visualizations
 */

import React, { FC, useState, useEffect, useMemo } from "react";
import { logger } from '../../lib/logging/logger';
import { Link } from "react-router-dom";
import {
  TrendingDown,
  BarChart2,
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  X,
  Maximize2,
  Minimize2,
  Zap,
  FileCheck,
  Flame,
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Loader,
  Eye,
  BarChart3,
  Waves,
  Search,
  Table2,
  ChevronDown,
  ChevronUp,
  Hash,
  ArrowUpDown,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  Palette,
} from "lucide-react";
import { useModelStore, type AnalysisResults } from "../../store/model";
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from "../../store/uiStore";
import {
  AnalysisResultsDashboard,
  type AnalysisResultsData,
} from "./AnalysisResultsDashboard";
import { MemberDetailPanel, type MemberForceData } from "./MemberDetailPanel";
import { PostProcessingDesignStudio } from "./PostProcessingDesignStudio";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";


// ============================================
// TYPES
// ============================================

interface ResultsToolbarProps {
  onClose?: () => void;
}

type DiagramType =
  | "deflection"
  | "bmd"
  | "sfd"
  | "bmd_my"
  | "sfd_vz"
  | "reactions"
  | "axial"
  | "heatmap";

// ============================================
// HELPER: Convert store results to dashboard format
// ============================================

/**
 * Helper: compute actual member length from node coordinates
 */
const getMemberLength = (
  member: { startNodeId: string; endNodeId: string },
  modelNodes: Map<string, { x: number; y: number; z?: number }>,
): number => {
  const n1 = modelNodes.get(member.startNodeId);
  const n2 = modelNodes.get(member.endNodeId);
  if (!n1 || !n2) return 5; // fallback
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = (n2.z ?? 0) - (n1.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
};

/**
 * Helper: compute real stress and utilization from actual section properties.
 * sigma_bending = M * c / I, sigma_axial = N / A
 * Combined: sigma = sigma_axial + sigma_bending (conservative)
 */
const computeRealStress = (
  moment: number,
  axial: number,
  member: {
    A?: number;
    I?: number;
    Iy?: number;
    dimensions?: any;
    sectionType?: string;
    E?: number;
  },
): { stress: number; utilization: number } => {
  // Get actual section properties
  const A = member.A ?? 0.01; // m² (default ~100 cm²)
  const I = member.I ?? member.Iy ?? 1e-4; // m⁴

  // Estimate c (distance to extreme fiber) from section dimensions or from I and A
  let c = 0.15; // fallback
  const dims = member.dimensions;
  if (dims) {
    if (dims.height) c = dims.height / 2;
    else if (dims.totalHeight) c = dims.totalHeight / 2;
    else if (dims.rectHeight) c = dims.rectHeight / 2;
    else if (dims.diameter) c = dims.diameter / 2;
    else if (dims.channelHeight) c = dims.channelHeight / 2;
  }
  // If no dimensions but we have I and A, estimate c from Zx ≈ I/c, A = b*d → c ≈ √(12*I/A)/2
  if (c === 0.15 && I > 0 && A > 0) {
    c = Math.sqrt((12 * I) / A) / 2;
  }

  // Compute stresses (kN & m → MPa = kN/m² / 1000)
  const sigmaBending = I > 0 ? (Math.abs(moment) * c) / I / 1000 : 0; // MPa
  const sigmaAxial = A > 0 ? Math.abs(axial) / A / 1000 : 0; // MPa
  const stress = sigmaBending + sigmaAxial; // Conservative linear combination

  // Yield stress: default Fe250 for steel, Fe415 for rebar
  const fy = 250; // MPa — could be enhanced with material lookup
  const utilization = Math.min(stress / fy, 2.0);

  return { stress, utilization };
};

const convertToAnalysisResultsData = (
  results: AnalysisResults,
  modelNodes?: Map<string, any>,
  modelMembers?: Map<string, any>,
): AnalysisResultsData => {
  const nodes: AnalysisResultsData["nodes"] = [];
  const members: AnalysisResultsData["members"] = [];

  let maxDisp = 0;
  let maxStress = 0;
  let maxUtil = 0;

  // Convert node displacements and reactions
  if (results.displacements) {
    results.displacements.forEach((disp, nodeId) => {
      const reaction = results.reactions?.get(nodeId);
      const totalDisp = Math.sqrt(disp.dx ** 2 + disp.dy ** 2 + disp.dz ** 2);
      maxDisp = Math.max(maxDisp, totalDisp);

      // Look up real node coordinates from model
      const modelNode = modelNodes?.get(nodeId);

      nodes.push({
        id: nodeId,
        x: modelNode?.x ?? 0,
        y: modelNode?.y ?? 0,
        z: modelNode?.z ?? 0,
        displacement: {
          dx: disp.dx,
          dy: disp.dy,
          dz: disp.dz,
          rx: disp.rx,
          ry: disp.ry,
          rz: disp.rz,
        },
        reaction: reaction
          ? {
              fx: reaction.fx,
              fy: reaction.fy,
              fz: reaction.fz,
              mx: reaction.mx,
              my: reaction.my,
              mz: reaction.mz,
            }
          : undefined,
      });
    });
  }

  // Convert member forces - use actual diagram data from PyNite analysis
  if (results.memberForces) {
    results.memberForces.forEach((forces, memberId) => {
      // Forces are already in kN/kNm from PyNite (no need to divide by 1000)
      const shear = Math.max(Math.abs(forces.shearY), Math.abs(forces.shearZ));
      const moment = Math.max(
        Math.abs(forces.momentY),
        Math.abs(forces.momentZ),
      );
      const axial = Math.abs(forces.axial);

      // Get actual member model data for real properties
      const memberModel = modelMembers?.get(memberId);

      // Use actual PyNite diagram data if available, otherwise generate default
      const pyniteDiagram = forces.diagramData;
      let x_values: number[];
      let shear_values: number[];
      let moment_values: number[];
      let axial_values: number[];
      let deflection_values: number[];
      let memberLength: number;

      // Compute actual member length from model nodes
      if (memberModel && modelNodes) {
        memberLength = getMemberLength(memberModel, modelNodes);
      } else {
        memberLength = 5; // fallback only if no geometry
      }

      if (
        pyniteDiagram &&
        pyniteDiagram.x_values &&
        pyniteDiagram.x_values.length > 0
      ) {
        // Use actual PyNite data (with null-safety fallbacks)
        x_values = pyniteDiagram.x_values;
        shear_values = pyniteDiagram.shear_y || [];
        moment_values = pyniteDiagram.moment_z || [];
        axial_values = pyniteDiagram.axial || [];
        deflection_values = pyniteDiagram.deflection_y || [];
        memberLength = x_values[x_values.length - 1] || 5;
      } else {
        // Fallback: Generate diagrams from end forces using equilibrium
        // w = (Vi + Vj)/L,  V(x) = Vi - w*x,  M_internal(x) = -Mi + Vi*x - w*x²/2
        // (negate FEM moment for internal bending moment convention: sagging positive)
        const numPoints = 40;
        const L = memberLength;
        const Vi = forces.startForces?.shearY ?? forces.shearY;
        const Vj = forces.endForces?.shearY ?? -forces.shearY;
        let Mi = forces.startForces?.momentZ ?? forces.momentZ;
        let Mj = forces.endForces?.momentZ ?? forces.momentZ;
        const ax = forces.axial;

        // ─── Pin-support zeroing: force moment to zero at simple supports ───
        // A pin/roller support has translational restraints but NO moment
        // restraint (mz=false). If only ONE member connects to that node,
        // the bending moment reaction is zero (simple support).
        if (memberModel && modelNodes && modelMembers) {
          const countMembersAtNode = (nodeId: string): number => {
            let c = 0;
            modelMembers.forEach((mm: any) => {
              if (mm.startNodeId === nodeId || mm.endNodeId === nodeId) c++;
            });
            return c;
          };
          const startNode = modelNodes.get(memberModel.startNodeId);
          const endNode = modelNodes.get(memberModel.endNodeId);
          if (startNode?.restraints) {
            const r = startNode.restraints;
            if ((r.fx || r.fy || r.fz) && !r.mz && countMembersAtNode(memberModel.startNodeId) <= 1) {
              Mi = 0;
            }
          }
          if (endNode?.restraints) {
            const r = endNode.restraints;
            if ((r.fx || r.fy || r.fz) && !r.mz && countMembersAtNode(memberModel.endNodeId) <= 1) {
              Mj = 0;
            }
          }
        }

        // Back-calculate equivalent distributed load from equilibrium
        const w = L > 1e-12 ? (Vi + Vj) / L : 0;

        x_values = [];
        shear_values = [];
        moment_values = [];
        axial_values = [];
        deflection_values = [];

        for (let i = 0; i <= numPoints; i++) {
          const t = i / numPoints;
          const x = t * L;
          x_values.push(x);
          // Shear: V(x) = Vi - w*x
          shear_values.push(Vi - w * x);
          // Moment: M_internal(x) = -Mi + Vi*x - w*x²/2 (negate FEM moment)
          moment_values.push(-Mi + Vi * x - (w * x * x) / 2);
          // Axial: constant
          axial_values.push(ax);
        }
        // Enforce endpoint closure: M(0) = -Mi, M(L) = +Mj
        // At the near end (node i): M_internal = -Mz_i (negate DSM CCW+ convention)
        // At the far end (node j):  M_internal = +Mz_j (NO negation; at the far
        //   end the CCW↔sagging relationship reverses vs the near end)
        if (moment_values.length > 0) {
          moment_values[0] = -Mi;
          moment_values[moment_values.length - 1] = Mj;
        }

        // ─── Deflection: double integration of M(x)/EI with actual nodal displacement BCs ───
        // EI·y''(x) = M(x)  →  y(x) = (∫∫M dx² + C1·x + C2) / EI
        // BCs: y(0) = dy_i_local, y(L) = dy_j_local (from solver displacements)
        const E_fb = memberModel?.E ?? 200000000; // kN/m²
        const I_fb = memberModel?.I ?? memberModel?.Iz ?? 1e-4; // m⁴
        const EI_fb = E_fb * I_fb;

        if (EI_fb > 1e-12 && memberModel && modelNodes && results.displacements) {
          const startNode = modelNodes.get(memberModel.startNodeId);
          const endNode = modelNodes.get(memberModel.endNodeId);
          const dispI = results.displacements.get(memberModel.startNodeId);
          const dispJ = results.displacements.get(memberModel.endNodeId);

          if (startNode && endNode && dispI && dispJ) {
            // Compute local y-axis for projecting global displacements
            const ddx = (endNode.x ?? 0) - (startNode.x ?? 0);
            const ddy = (endNode.y ?? 0) - (startNode.y ?? 0);
            const ddz = (endNode.z ?? 0) - (startNode.z ?? 0);
            const Lm = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);

            if (Lm > 1e-12) {
              const lx_ax = ddx / Lm, ly_ax = ddy / Lm, lz_ax = ddz / Lm;

              // Local y-axis (perpendicular to member in bending plane)
              // 2D (lz ≈ 0): rotate 90° CCW → (-ly, lx, 0)
              // 3D vertical: use global X
              let yx: number, yy: number, yz: number;
              if (Math.abs(lz_ax) < 0.999) {
                // Cross Z × localX → local Y (in global XY plane)
                yx = -ly_ax;
                yy = lx_ax;
                yz = 0;
                const yn = Math.sqrt(yx * yx + yy * yy + yz * yz);
                if (yn > 1e-12) { yx /= yn; yy /= yn; yz /= yn; }
              } else {
                // Vertical member: use global X as local Y
                yx = 1; yy = 0; yz = 0;
              }

              // Project global displacements onto local y-axis (m)
              const dy_i = (dispI.dx ?? 0) * yx + (dispI.dy ?? 0) * yy + (dispI.dz ?? 0) * yz;
              const dy_j = (dispJ.dx ?? 0) * yx + (dispJ.dy ?? 0) * yy + (dispJ.dz ?? 0) * yz;

              // First integration: slope_raw(x) = ∫ M(x)/EI dx  (starting from 0)
              const slopeRaw: number[] = [0];
              for (let k = 1; k <= numPoints; k++) {
                const dxStep = x_values[k] - x_values[k - 1];
                const avgM = (moment_values[k - 1] + moment_values[k]) / 2;
                slopeRaw.push(slopeRaw[k - 1] + (avgM / EI_fb) * dxStep);
              }
              // Second integration: y_raw(x) = ∫ slope dx  (starting from 0)
              const yRaw: number[] = [0];
              for (let k = 1; k <= numPoints; k++) {
                const dxStep = x_values[k] - x_values[k - 1];
                const avgSlope = (slopeRaw[k - 1] + slopeRaw[k]) / 2;
                yRaw.push(yRaw[k - 1] + avgSlope * dxStep);
              }
              // Apply displacement BCs: y(x) = y_raw(x) + C1·x + C2
              // y(0) = dy_i → C2 = dy_i
              // y(L) = dy_j → C1 = (dy_j - dy_i - y_raw(L)) / L
              const C2_fb = dy_i;
              const C1_fb = L > 1e-12 ? (dy_j - dy_i - yRaw[numPoints]) / L : 0;
              for (let k = 0; k <= numPoints; k++) {
                deflection_values.push((yRaw[k] + C1_fb * x_values[k] + C2_fb) * 1000); // m → mm
              }
            } else {
              // Zero-length member
              for (let k = 0; k <= numPoints; k++) deflection_values.push(0);
            }
          } else {
            // Missing node/displacement data
            for (let k = 0; k <= numPoints; k++) deflection_values.push(0);
          }
        } else {
          // No EI or no displacement data — zero fallback
          for (let k = 0; k <= numPoints; k++) deflection_values.push(0);
        }
      }

      // Compute real stress from actual section properties
      const { stress: estimatedStress, utilization: util } = computeRealStress(
        moment,
        axial,
        memberModel || {},
      );

      maxStress = Math.max(maxStress, Math.abs(estimatedStress));
      maxUtil = Math.max(maxUtil, util);

      // Compute actual min/max from diagram data rather than assuming symmetry
      const actualMaxShear =
        shear_values.length > 0 ? Math.max(...shear_values) : shear;
      const actualMinShear =
        shear_values.length > 0 ? Math.min(...shear_values) : -shear;
      const actualMaxMoment =
        moment_values.length > 0 ? Math.max(...moment_values) : moment;
      const actualMinMoment =
        moment_values.length > 0 ? Math.min(...moment_values) : -moment;
      const actualMaxAxial =
        axial_values.length > 0 ? Math.max(...axial_values) : axial;
      const actualMinAxial =
        axial_values.length > 0 ? Math.min(...axial_values) : -axial;

      members.push({
        id: memberId,
        startNodeId: memberModel?.startNodeId ?? "",
        endNodeId: memberModel?.endNodeId ?? "",
        length: memberLength,
        sectionType: memberModel?.sectionType ?? "General",
        maxShear: Math.max(Math.abs(actualMaxShear), Math.abs(actualMinShear)),
        minShear: actualMinShear,
        maxMoment: Math.max(
          Math.abs(actualMaxMoment),
          Math.abs(actualMinMoment),
        ),
        minMoment: actualMinMoment,
        maxAxial: Math.max(Math.abs(actualMaxAxial), Math.abs(actualMinAxial)),
        minAxial: actualMinAxial,
        maxDeflection:
          deflection_values.length > 0
            ? Math.max(...deflection_values.map(Math.abs))
            : Math.abs(maxDisp * 1000), // mm — prefer diagram data, fallback to global max
        maxShearZ: Math.abs(forces.shearZ ?? 0),
        maxMomentY: Math.abs(forces.momentY ?? 0),
        torsion: Math.abs(forces.torsion ?? 0),
        sectionProps: {
          A: memberModel?.A ?? 0.01,
          I: memberModel?.I ?? memberModel?.Iz ?? 1e-4,
          Iy: memberModel?.Iy ?? 1e-4,
          E: memberModel?.E ?? 200000000, // kN/m² (200 GPa)
          fy: 250, // MPa — steel default
        },
        stress: Math.abs(estimatedStress),
        utilization: util,
        diagramData: {
          x_values,
          shear_values,
          moment_values,
          axial_values,
          deflection_values,
          // 3D data (minor axis / Z-direction)
          shear_z_values: pyniteDiagram?.shear_z || [],
          moment_y_values: pyniteDiagram?.moment_y || [],
          deflection_z_values: pyniteDiagram?.deflection_z || [],
        },
      });
    });
  }

  // ===== SERVICEABILITY CHECKS (industry-standard per IS 800/EN 1993/AISC 360) =====
  const serviceabilityLimits = [
    { limit: "Floor beams (L/240)", code: "IS 800 / ASCE 7", ratio: 240 },
    { limit: "Roof beams (L/180)", code: "IS 800 / ASCE 7", ratio: 180 },
    {
      limit: "Sensitive finishes (L/360)",
      code: "ACI 318 / IS 456",
      ratio: 360,
    },
    { limit: "Cantilevers (L/120)", code: "General", ratio: 120 },
  ];

  const serviceabilityChecks = members.map((m) => {
    const L_mm = m.length * 1000; // m → mm
    const maxDefl = m.maxDeflection; // already in mm
    const ratios = serviceabilityLimits.map((sl) => {
      const allowable = L_mm / sl.ratio;
      return {
        limit: sl.limit,
        code: sl.code,
        allowable,
        actual: maxDefl,
        ratio: maxDefl > 1e-6 ? L_mm / maxDefl : Infinity,
        pass: maxDefl <= allowable,
      };
    });
    const worstRatio = Math.min(...ratios.map((r) => r.ratio));
    return {
      memberId: m.id,
      length: m.length,
      maxDeflection: maxDefl,
      ratios,
      worstRatio,
      pass: ratios.every((r) => r.pass),
    };
  });

  return {
    nodes,
    members,
    summary: {
      totalNodes: nodes.length,
      totalMembers: members.length,
      totalDOF: nodes.length * 6,
      maxDisplacement: maxDisp * 1000, // Convert m → mm for display
      maxStress,
      maxUtilization: maxUtil,
      analysisTime:
        results.stats?.totalTimeMs ?? results.stats?.solveTimeMs ?? 0,
      status: maxUtil > 1 ? "error" : maxUtil > 0.9 ? "warning" : "success",
    },
    equilibriumCheck: results.equilibriumCheck,
    conditionNumber: results.conditionNumber,
    serviceabilityChecks,
  };
};

// ============================================
// COMPONENT
// ============================================

export const ResultsToolbar: FC<ResultsToolbarProps> = React.memo(({ onClose }) => {
  // Batched selector — single subscription instead of 12 individual ones
  const {
    analysisResults,
    displacementScale,
    setShowSFD,
    setShowBMD,
    setShowAFD,
    setShowBMDMy,
    setShowShearZ,
    setShowStressOverlay,
    setShowDeflectedShape,
    setDisplacementScale,
    nodes,
    members,
  } = useModelStore(
    useShallow((s) => ({
      analysisResults: s.analysisResults as AnalysisResults | null,
      displacementScale: s.displacementScale as number,
      setShowSFD: s.setShowSFD,
      setShowBMD: s.setShowBMD,
      setShowAFD: s.setShowAFD,
      setShowBMDMy: s.setShowBMDMy,
      setShowShearZ: s.setShowShearZ,
      setShowStressOverlay: s.setShowStressOverlay,
      setShowDeflectedShape: s.setShowDeflectedShape,
      setDisplacementScale: s.setDisplacementScale,
      nodes: s.nodes,
      members: s.members,
    }))
  );
  const openModal = useUIStore((s) => s.openModal);
  const showNotification = useUIStore((s) => s.showNotification);

  // Local state
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeDiagram, setActiveDiagram] = useState<DiagramType | null>(
    "deflection",
  );
  const [scale, setScale] = useState(displacementScale ?? 50);
  const [heatmapType, setHeatmapType] = useState<
    "displacement" | "stress" | "utilization"
  >("displacement");
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDesignStudio, setShowDesignStudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMemberDetail, setShowMemberDetail] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // === STAAD.Pro-level post-processing state ===
  const [showTabularResults, setShowTabularResults] = useState(false);
  const [tabularTab, setTabularTab] = useState<'displacements' | 'forces' | 'reactions' | 'summary'>('forces');
  const [queryMemberId, setQueryMemberId] = useState('');
  const [showForceSummary, setShowForceSummary] = useState(false);
  const [contourLevels, setContourLevels] = useState(10);
  const [colorScheme, setColorScheme] = useState<'jet' | 'rainbow' | 'thermal' | 'grayscale'>('jet');
  const [sortColumn, setSortColumn] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get member IDs for navigation
  const memberIds = useMemo(() => {
    if (!analysisResults?.memberForces) return [];
    return Array.from(analysisResults.memberForces.keys());
  }, [analysisResults?.memberForces]);

  // Get selected member forces
  const selectedMemberForces = useMemo((): MemberForceData | null => {
    if (!selectedMemberId || !analysisResults?.memberForces) return null;
    const forces = analysisResults.memberForces.get(selectedMemberId);
    if (!forces) return null;
    return {
      axial: forces.axial,
      shearY: forces.shearY,
      shearZ: forces.shearZ ?? 0,
      momentY: forces.momentY ?? 0,
      momentZ: forces.momentZ,
      torsion: forces.torsion ?? 0,
      diagramData: forces.diagramData,
    };
  }, [selectedMemberId, analysisResults?.memberForces]);

  // ===== FORCE SUMMARY — Max/Min per force type with member IDs (STAAD.Pro Table output) =====
  const forceSummary = useMemo(() => {
    if (!analysisResults?.memberForces || analysisResults.memberForces.size === 0) return null;
    const summary = {
      maxAxial: { value: -Infinity, memberId: '' },
      minAxial: { value: Infinity, memberId: '' },
      maxShearY: { value: -Infinity, memberId: '' },
      minShearY: { value: Infinity, memberId: '' },
      maxShearZ: { value: -Infinity, memberId: '' },
      minShearZ: { value: Infinity, memberId: '' },
      maxMomentZ: { value: -Infinity, memberId: '' },
      minMomentZ: { value: Infinity, memberId: '' },
      maxMomentY: { value: -Infinity, memberId: '' },
      minMomentY: { value: Infinity, memberId: '' },
      maxTorsion: { value: -Infinity, memberId: '' },
    };
    for (const [memberId, f] of analysisResults.memberForces.entries()) {
      if (f.axial > summary.maxAxial.value) { summary.maxAxial = { value: f.axial, memberId }; }
      if (f.axial < summary.minAxial.value) { summary.minAxial = { value: f.axial, memberId }; }
      if (f.shearY > summary.maxShearY.value) { summary.maxShearY = { value: f.shearY, memberId }; }
      if (f.shearY < summary.minShearY.value) { summary.minShearY = { value: f.shearY, memberId }; }
      if ((f.shearZ ?? 0) > summary.maxShearZ.value) { summary.maxShearZ = { value: f.shearZ ?? 0, memberId }; }
      if ((f.shearZ ?? 0) < summary.minShearZ.value) { summary.minShearZ = { value: f.shearZ ?? 0, memberId }; }
      if (f.momentZ > summary.maxMomentZ.value) { summary.maxMomentZ = { value: f.momentZ, memberId }; }
      if (f.momentZ < summary.minMomentZ.value) { summary.minMomentZ = { value: f.momentZ, memberId }; }
      if ((f.momentY ?? 0) > summary.maxMomentY.value) { summary.maxMomentY = { value: f.momentY ?? 0, memberId }; }
      if ((f.momentY ?? 0) < summary.minMomentY.value) { summary.minMomentY = { value: f.momentY ?? 0, memberId }; }
      if (Math.abs(f.torsion ?? 0) > summary.maxTorsion.value) { summary.maxTorsion = { value: Math.abs(f.torsion ?? 0), memberId }; }
    }
    return summary;
  }, [analysisResults?.memberForces]);

  // ===== TABULAR DATA — Sortable tables for Node Displacements, Member Forces =====
  const nodeDisplacementTable = useMemo(() => {
    if (!analysisResults?.displacements) return [];
    const rows: Array<{ nodeId: string; dx: number; dy: number; dz: number; rx: number; ry: number; rz: number; resultant: number }> = [];
    for (const [nodeId, d] of analysisResults.displacements.entries()) {
      const resultant = Math.sqrt(d.dx * d.dx + d.dy * d.dy + (d.dz ?? 0) * (d.dz ?? 0));
      rows.push({
        nodeId,
        dx: d.dx, dy: d.dy, dz: d.dz ?? 0,
        rx: d.rx ?? 0, ry: d.ry ?? 0, rz: d.rz ?? 0,
        resultant,
      });
    }
    return rows;
  }, [analysisResults?.displacements]);

  const memberForceTable = useMemo(() => {
    if (!analysisResults?.memberForces) return [];
    const rows: Array<{ memberId: string; axial: number; shearY: number; shearZ: number; momentZ: number; momentY: number; torsion: number }> = [];
    for (const [memberId, f] of analysisResults.memberForces.entries()) {
      rows.push({
        memberId,
        axial: f.axial,
        shearY: f.shearY,
        shearZ: f.shearZ ?? 0,
        momentZ: f.momentZ,
        momentY: f.momentY ?? 0,
        torsion: f.torsion ?? 0,
      });
    }
    return rows;
  }, [analysisResults?.memberForces]);

  // ===== QUICK MEMBER QUERY — Inline force lookup by member ID =====
  const queriedMemberForces = useMemo(() => {
    if (!queryMemberId.trim() || !analysisResults?.memberForces) return null;
    const forces = analysisResults.memberForces.get(queryMemberId.trim());
    if (!forces) return null;
    const memberModel = members.get(queryMemberId.trim());
    const length = memberModel ? getMemberLength(memberModel, nodes) : 0;
    return { ...forces, length };
  }, [queryMemberId, analysisResults?.memberForces, members, nodes]);

  // ===== MAX DISPLACEMENT PER DOF — STAAD.Pro "Max Displacement Summary" =====
  const maxDispPerDOF = useMemo(() => {
    if (!analysisResults?.displacements || analysisResults.displacements.size === 0) return null;
    const result = {
      maxDx: { value: 0, nodeId: '' }, maxDy: { value: 0, nodeId: '' }, maxDz: { value: 0, nodeId: '' },
      maxRx: { value: 0, nodeId: '' }, maxRy: { value: 0, nodeId: '' }, maxRz: { value: 0, nodeId: '' },
    };
    for (const [nodeId, d] of analysisResults.displacements.entries()) {
      if (Math.abs(d.dx) > Math.abs(result.maxDx.value)) { result.maxDx = { value: d.dx, nodeId }; }
      if (Math.abs(d.dy) > Math.abs(result.maxDy.value)) { result.maxDy = { value: d.dy, nodeId }; }
      if (Math.abs(d.dz ?? 0) > Math.abs(result.maxDz.value)) { result.maxDz = { value: d.dz ?? 0, nodeId }; }
      if (Math.abs(d.rx ?? 0) > Math.abs(result.maxRx.value)) { result.maxRx = { value: d.rx ?? 0, nodeId }; }
      if (Math.abs(d.ry ?? 0) > Math.abs(result.maxRy.value)) { result.maxRy = { value: d.ry ?? 0, nodeId }; }
      if (Math.abs(d.rz ?? 0) > Math.abs(result.maxRz.value)) { result.maxRz = { value: d.rz ?? 0, nodeId }; }
    }
    return result;
  }, [analysisResults?.displacements]);

  // Handle member navigation
  const handleMemberNavigate = (direction: "prev" | "next") => {
    if (!selectedMemberId || memberIds.length === 0) return;
    const currentIndex = memberIds.indexOf(selectedMemberId);
    if (currentIndex === -1) return;

    const newIndex =
      direction === "next"
        ? (currentIndex + 1) % memberIds.length
        : (currentIndex - 1 + memberIds.length) % memberIds.length;
    setSelectedMemberId(memberIds[newIndex] ?? null);
  };

  // Open member detail panel
  const handleOpenMemberDetail = (memberId?: string) => {
    const id = memberId || (memberIds.length > 0 ? memberIds[0] : null);
    if (id) {
      setSelectedMemberId(id);
      setShowMemberDetail(true);
    }
  };

  // Sync diagram toggle state whenever activeDiagram changes
  useEffect(() => {
    setShowDeflectedShape(activeDiagram === "deflection");
    setShowSFD(activeDiagram === "sfd");
    setShowBMD(activeDiagram === "bmd");
    setShowAFD(activeDiagram === "axial");
    setShowBMDMy(activeDiagram === "bmd_my");
    setShowShearZ(activeDiagram === "sfd_vz");
    setShowStressOverlay(activeDiagram === "heatmap");
  }, [activeDiagram]); // Re-sync when diagram type changes

  // Sync diagram toggles with store
  const handleDiagramToggle = (type: DiagramType) => {
    const newActive = activeDiagram === type ? null : type;
    setActiveDiagram(newActive);

    // Update store based on diagram type
    setShowSFD(newActive === "sfd");
    setShowBMD(newActive === "bmd");
    setShowAFD(newActive === "axial");
    setShowBMDMy(newActive === "bmd_my");
    setShowShearZ(newActive === "sfd_vz");
    setShowStressOverlay(newActive === "heatmap");
    setShowDeflectedShape(newActive === "deflection");
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    // Proceed with PDF export directly
    executePDFExport();
  };

  const executePDFExport = async () => {
    setIsExporting(true);
    try {
      const ReportGeneratorModule =
        await import("../../services/ReportGenerator");
      const ReportGenerator = ReportGeneratorModule.default;
      const report = new ReportGenerator();

      // Pull real project metadata from store
      const projectInfo = useModelStore.getState().projectInfo;

      // Add header and project info
      report.addHeader(projectInfo.name || "Structural Analysis Report");
      report.addProjectInfo({
        projectName: projectInfo.name || "BeamLab Analysis",
        clientName: projectInfo.client || undefined,
        engineerName: projectInfo.engineer || undefined,
        projectNumber: projectInfo.jobNo || undefined,
        description: projectInfo.description || "Structural analysis results generated by BeamLab",
      });

      // Add nodes table
      const nodeList = Array.from(nodes.values()).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
      }));
      if (nodeList.length > 0) {
        report.addNodesTable(nodeList);
      }

      // Add members table (basic)
      const memberList = Array.from(members.values()).map((m) => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        sectionId: m.sectionId || "Default",
      }));
      if (memberList.length > 0) {
        report.addMembersTable(memberList);
      }

      // Add cross-sectional details with properties
      const memberDetails = Array.from(members.values()).map((m) => {
        // Calculate member length
        const startNode = nodes.get(m.startNodeId);
        const endNode = nodes.get(m.endNodeId);
        let length = 0;
        if (startNode && endNode) {
          length = Math.sqrt(
            Math.pow(endNode.x - startNode.x, 2) +
              Math.pow(endNode.y - startNode.y, 2) +
              Math.pow(endNode.z - startNode.z, 2),
          );
        }
        return {
          id: m.id,
          sectionId: m.sectionId || "Default",
          E: m.E || 200000000, // Default steel E in kN/m²
          A: m.A,
          Iy: (m as any).Iy ?? m.I,
          Iz: (m as any).Iz ?? m.I,
          J:
            (m as any).J ??
            Math.max(
              Math.min((m as any).Iy ?? m.I, (m as any).Iz ?? m.I) / 500,
              (((m as any).Iy ?? m.I) + ((m as any).Iz ?? m.I)) * 1e-4,
            ),
          length,
        };
      });
      if (memberDetails.length > 0) {
        report.addCrossSectionalDetails(memberDetails);
      }

      // Add analysis results if available
      if (analysisResults) {
        // Prepare loads for FBD (from applied loads if available)
        const appliedLoads: Array<{
          nodeId: string;
          fx?: number;
          fy?: number;
          fz?: number;
        }> = [];
        // Try to get loads from the store if available
        // For now, we'll use empty loads array - loads should be passed from store

        // Prepare supports info
        const supportsInfo: Array<{
          nodeId: string;
          type: "fixed" | "pinned" | "roller";
        }> = [];
        if (analysisResults.reactions) {
          for (const [nodeId, r] of analysisResults.reactions.entries()) {
            // Determine support type based on reaction components
            const hasRotation =
              Math.abs(r.mx ?? 0) > 0.001 ||
              Math.abs(r.my ?? 0) > 0.001 ||
              Math.abs(r.mz ?? 0) > 0.001;
            const hasHorizontal = Math.abs(r.fx) > 0.001;

            if (hasRotation && hasHorizontal) {
              supportsInfo.push({ nodeId, type: "fixed" });
            } else if (hasHorizontal) {
              supportsInfo.push({ nodeId, type: "pinned" });
            } else {
              supportsInfo.push({ nodeId, type: "roller" });
            }
          }
        }

        // Reactions for FBD
        const reactionsForFBD = analysisResults.reactions
          ? Array.from(analysisResults.reactions.entries()).map(
              ([nodeId, r]) => ({
                nodeId,
                fx: r.fx,
                fy: r.fy,
                fz: r.fz ?? 0,
                mx: r.mx ?? 0,
                my: r.my ?? 0,
                mz: r.mz ?? 0,
              }),
            )
          : [];

        // Add Free Body Diagram
        if (nodeList.length > 0 && memberList.length > 0) {
          try {
            report.addFreeBodyDiagram(
              nodeList,
              memberList,
              appliedLoads,
              reactionsForFBD,
              supportsInfo,
            );
          } catch (error) {
            logger.warn("Failed to add FBD to PDF", { error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Add detailed reactions with equilibrium check
        if (analysisResults.reactions && analysisResults.reactions.size > 0) {
          const reactions = Array.from(analysisResults.reactions.entries()).map(
            ([nodeId, r]) => ({
              nodeId,
              fx: r.fx,
              fy: r.fy,
              fz: r.fz ?? 0,
              mx: r.mx ?? 0,
              my: r.my ?? 0,
              mz: r.mz ?? 0,
            }),
          );
          report.addDetailedReactionsTable(reactions, appliedLoads);
        }

        // Member forces
        if (
          analysisResults.memberForces &&
          analysisResults.memberForces.size > 0
        ) {
          report.addPage("Member Forces");
          const forces = Array.from(analysisResults.memberForces.entries()).map(
            ([memberId, f]) => ({
              memberId,
              axial: f.axial,
              shearY: f.shearY,
              shearZ: f.shearZ ?? 0,
              momentY: f.momentY ?? 0,
              momentZ: f.momentZ,
              torsion: f.torsion ?? 0,
            }),
          );
          report.addMemberForcesTable(forces);
        }

        // Add combined structure diagrams (SFD, BMD, AFD for whole structure)
        if (nodeList.length > 0 && memberList.length > 0) {
          try {
            const membersWithDiagrams = Array.from(members.values()).map(
              (m) => {
                const forceData = analysisResults?.memberForces?.get(m.id);
                return {
                  id: m.id,
                  startNodeId: m.startNodeId,
                  endNodeId: m.endNodeId,
                  diagramData: forceData?.diagramData
                    ? {
                        x_values: forceData.diagramData.x_values || [],
                        shear_values: forceData.diagramData.shear_y || [],
                        moment_values: forceData.diagramData.moment_z || [],
                        axial_values: forceData.diagramData.axial || [],
                      }
                    : undefined,
                };
              },
            );

            // Add combined diagrams for entire structure
            report.addCombinedStructureDiagram(
              nodeList,
              membersWithDiagrams,
              "SFD",
            );
            report.addCombinedStructureDiagram(
              nodeList,
              membersWithDiagrams,
              "BMD",
            );
            report.addCombinedStructureDiagram(
              nodeList,
              membersWithDiagrams,
              "AFD",
            );
          } catch (error) {
            logger.warn("Failed to add combined diagrams to PDF", { error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Add detailed individual member diagrams with calculations
        // Only include critical members (top by max force) to avoid report bloat
        const dashboardData = convertToAnalysisResultsData(
          analysisResults,
          nodes,
          members,
        );
        if (dashboardData.members.length > 0) {
          try {
            // Prepare all member diagram data
            const allDetailedMembers = Array.from(members.values()).map((m) => {
              const startNode = nodes.get(m.startNodeId);
              const endNode = nodes.get(m.endNodeId);
              let length = 0;
              if (startNode && endNode) {
                length = Math.sqrt(
                  Math.pow(endNode.x - startNode.x, 2) +
                    Math.pow(endNode.y - startNode.y, 2) +
                    Math.pow(endNode.z - startNode.z, 2),
                );
              }

              const forceData = analysisResults?.memberForces?.get(m.id);
              const maxMomentAbs = Math.max(
                Math.abs(forceData?.momentZ ?? 0),
                Math.abs(forceData?.momentY ?? 0),
              );
              const maxShearAbs = Math.max(
                Math.abs(forceData?.shearY ?? 0),
                Math.abs(forceData?.shearZ ?? 0),
              );
              return {
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                length,
                sectionId: m.sectionId || "Default",
                E: m.E || 200000000,
                I: m.I,
                A: m.A,
                maxShear: forceData?.shearY,
                maxMoment: forceData?.momentZ,
                maxAxial: forceData?.axial,
                _rankScore: maxMomentAbs + maxShearAbs + Math.abs(forceData?.axial ?? 0),
                diagramData: forceData?.diagramData
                  ? {
                      x_values: forceData.diagramData.x_values || [],
                      shear_values: forceData.diagramData.shear_y || [],
                      moment_values: forceData.diagramData.moment_z || [],
                      axial_values: forceData.diagramData.axial || [],
                      deflection_values:
                        forceData.diagramData.deflection_y || [],
                    }
                  : undefined,
              };
            });

            // Sort by combined force magnitude, take top N critical members
            // For small models (≤10 members) include all; otherwise top 10
            const MAX_DETAILED = 10;
            const sorted = [...allDetailedMembers].sort(
              (a, b) => (b._rankScore ?? 0) - (a._rankScore ?? 0),
            );
            const selectedMembers = allDetailedMembers.length <= MAX_DETAILED
              ? allDetailedMembers
              : sorted.slice(0, MAX_DETAILED);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const detailedMembers = selectedMembers.map(({ _rankScore, ...rest }) => rest);

            report.addDetailedMemberDiagrams(detailedMembers);
          } catch (error) {
            logger.warn(
              "Failed to add detailed member diagrams to PDF",
              { error: error instanceof Error ? error.message : String(error) },
            );
          }
        }
      }

      report.save("BeamLab_Analysis_Report");
      showNotification("success", "PDF Report generated successfully");
    } catch (error) {
      logger.error("PDF export failed", { error: error instanceof Error ? error.message : String(error) });
      showNotification("error", "Failed to generate PDF report");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle CSV export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const { ExportService } = await import("../../services/ExportService");

      const exportData = {
        projectName: "BeamLab_Analysis",
        timestamp: new Date().toISOString(),
        nodes: Array.from(nodes.values()).map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          z: n.z,
        })),
        members: Array.from(members.values()).map((m) => ({
          id: m.id,
          startNodeId: m.startNodeId,
          endNodeId: m.endNodeId,
          sectionId: m.sectionId || "Default",
        })),
        displacements: analysisResults?.displacements
          ? Array.from(analysisResults.displacements.entries()).map(
              ([nodeId, d]) => ({
                nodeId,
                dx: d.dx,
                dy: d.dy,
                dz: d.dz,
                rx: d.rx,
                ry: d.ry,
                rz: d.rz,
              }),
            )
          : [],
        reactions: analysisResults?.reactions
          ? Array.from(analysisResults.reactions.entries()).map(
              ([nodeId, r]) => ({
                nodeId,
                fx: r.fx,
                fy: r.fy,
                fz: r.fz,
                mx: r.mx,
                my: r.my,
                mz: r.mz,
              }),
            )
          : [],
        memberForces: analysisResults?.memberForces
          ? Array.from(analysisResults.memberForces.entries()).map(
              ([memberId, f]) => ({
                memberId,
                axial: f.axial,
                shearY: f.shearY,
                shearZ: f.shearZ,
                momentY: f.momentY,
                momentZ: f.momentZ,
                torsion: f.torsion,
              }),
            )
          : [],
      };

      const service = new ExportService(exportData as any);
      const blob = service.exportToCSV("all");

      // Trigger download
      showNotification("success", "CSV exported successfully");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BeamLab_Analysis_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("CSV export failed", { error: error instanceof Error ? error.message : String(error) });
      showNotification("error", "Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  // Dialog handles Escape key natively for all modals

  if (!analysisResults) return null;

  const diagrams: {
    id: DiagramType;
    label: string;
    icon: React.ElementType;
    color: string;
  }[] = [
    {
      id: "deflection",
      label: "Deflected",
      icon: TrendingDown,
      color: "text-blue-500",
    },
    { id: "bmd", label: "BMD (Mz)", icon: BarChart2, color: "text-green-500" },
    { id: "sfd", label: "SFD (Vy)", icon: Activity, color: "text-orange-500" },
    { id: "bmd_my", label: "BMD (My)", icon: BarChart3, color: "text-teal-500" },
    { id: "sfd_vz", label: "SFD (Vz)", icon: Waves, color: "text-cyan-500" },
    {
      id: "reactions",
      label: "Reactions",
      icon: ArrowDownToLine,
      color: "text-purple-500",
    },
    {
      id: "axial",
      label: "Axial",
      icon: SlidersHorizontal,
      color: "text-red-500",
    },
    { id: "heatmap", label: "Heat Map", icon: Flame, color: "text-yellow-500" },
  ];

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    setDisplacementScale(newScale);
  };

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  const resetView = () => {
    setScale(50);
    setActiveDiagram("deflection");
    setIsAnimating(false);
  };

  // Memoized max values — avoid recomputing on every render
  const maxDisplacementStr = useMemo((): string => {
    if (
      !analysisResults.displacements ||
      analysisResults.displacements.size === 0
    )
      return "-";
    let max = 0;
    for (const d of analysisResults.displacements.values()) {
      const abs = Math.abs(d.dy);
      if (abs > max) max = abs;
    }
    return `${max.toFixed(4)} m`;
  }, [analysisResults.displacements]);

  const maxReactionStr = useMemo((): string => {
    if (!analysisResults.reactions || analysisResults.reactions.size === 0)
      return "-";
    let max = 0;
    for (const r of analysisResults.reactions.values()) {
      const abs = Math.abs(r.fy);
      if (abs > max) max = abs;
    }
    if (max < 0.001) return "-";
    return `${max.toFixed(2)} kN`;
  }, [analysisResults.reactions]);

  // Support reactions — memoized, only nodes with non-negligible reactions
  const supportReactions = useMemo(() => {
    if (!analysisResults.reactions || analysisResults.reactions.size === 0)
      return [];
    const supports: {
      nodeId: string;
      fx: number;
      fy: number;
      fz: number;
      mx: number;
      my: number;
      mz: number;
    }[] = [];
    analysisResults.reactions.forEach((r, nodeId) => {
      const total =
        Math.abs(r.fx) +
        Math.abs(r.fy) +
        Math.abs(r.fz) +
        Math.abs(r.mx) +
        Math.abs(r.my) +
        Math.abs(r.mz);
      if (total > 0.001) {
        supports.push({
          nodeId,
          fx: r.fx,
          fy: r.fy,
          fz: r.fz,
          mx: r.mx,
          my: r.my,
          mz: r.mz,
        });
      }
    });
    return supports;
  }, [analysisResults.reactions]);

  if (!isExpanded) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
          <button type="button"
            onClick={() => {
              useUIStore.getState().setCategory("MODELING");
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-300 rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"
            title="Back to Model"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Model</span>
          </button>
          <button type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Expand results panel"
          >
            <BarChart2 className="w-4 h-4" />
            <span className="text-sm font-medium">Results</span>
            <Maximize2 className="w-3 h-3" />
          </button>
          {onClose && (
            <button type="button"
              onClick={onClose}
              className="p-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"
              title="Close results toolbar"
              aria-label="Close results toolbar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Full Results Dashboard Modal - accessible even when collapsed */}
        <Dialog open={showDashboard && !!analysisResults} onOpenChange={(open) => !open && setShowDashboard(false)}>
          <DialogContent className="max-w-[1800px] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="sr-only">
              <DialogTitle>Analysis Results Dashboard</DialogTitle>
            </DialogHeader>
            <AnalysisResultsDashboard
              results={convertToAnalysisResultsData(
                analysisResults!,
                nodes,
                members,
              )}
              onClose={() => setShowDashboard(false)}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 w-80 max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            <span className="font-medium">Analysis Results</span>
            <span className="text-[9px] bg-white/20 rounded px-1.5 py-0.5 font-mono">
              v3.0
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            {onClose && (
              <button type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Back to Model Button */}
        <button type="button"
          onClick={() => {
            useUIStore.getState().setCategory("MODELING");
          }}
          className="flex-shrink-0 w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
          title="Return to modeling view while keeping results visible"
          aria-label="Back to modeling view"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Model
        </button>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Diagram Toggles */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Diagrams
          </h4>
          <div className="grid grid-cols-6 gap-1">
            {diagrams.map((diagram) => {
              const Icon = diagram.icon;
              const isActive = activeDiagram === diagram.id;

              return (
                <button type="button"
                  key={diagram.id}
                  onClick={() => handleDiagramToggle(diagram.id)}
                  className={`
                                    flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                                    ${
                                      isActive
                                        ? "bg-slate-100 dark:bg-blue-500 dark:text-white dark:ring-2 dark:ring-blue-400"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-400"
                                    }
                                `}
                  title={diagram.label}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? diagram.color : "text-slate-500 dark:text-slate-400"}`}
                  />
                  <span
                    className={`text-[9px] ${isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {diagram.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Heat Map Type Selector - Show when heatmap is active */}
          {activeDiagram === "heatmap" && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <h5 className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase">
                Heat Map Type
              </h5>
              <div className="flex gap-1">
                {[
                  {
                    id: "displacement",
                    label: "Displacement",
                    gradient: "from-[#1e3a8a] via-[#06b6d4] via-[#22c55e] via-[#eab308] to-[#dc2626]",
                  },
                  {
                    id: "stress",
                    label: "Stress",
                    gradient: "from-[#1e3a8a] via-[#06b6d4] via-[#22c55e] via-[#eab308] to-[#dc2626]",
                  },
                  {
                    id: "utilization",
                    label: "Utilization",
                    gradient: "from-[#22c55e] via-[#3b82f6] via-[#f59e0b] via-[#f97316] to-[#ef4444]",
                  },
                ].map((type) => (
                  <button type="button"
                    key={type.id}
                    onClick={() => setHeatmapType(type.id as any)}
                    className={`
                                        flex-1 px-2 py-1.5 text-[10px] font-medium rounded transition-all
                                        ${
                                          heatmapType === type.id
                                            ? "bg-gradient-to-r " +
                                              type.gradient +
                                              " text-slate-900 dark:text-white shadow-md"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        }
                                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {/* Color Scale Legend */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Low</span>
                <div
                  className={`flex-1 h-2 rounded bg-gradient-to-r ${
                    colorScheme === 'jet' ? 'from-[#1e3a8a] via-[#22c55e] to-[#dc2626]' :
                    colorScheme === 'rainbow' ? 'from-[#7c3aed] via-[#06b6d4] via-[#22c55e] via-[#eab308] to-[#ef4444]' :
                    colorScheme === 'thermal' ? 'from-[#0c0c2c] via-[#6b21a8] via-[#dc2626] to-[#fbbf24]' :
                    'from-[#1e293b] via-[#94a3b8] to-[#f8fafc]'
                  }`}
                />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">High</span>
              </div>

              {/* Contour Settings — STAAD.Pro-level color map control */}
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Color Scheme
                  </span>
                  <span className="text-[9px] text-slate-400">{contourLevels} levels</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {(['jet', 'rainbow', 'thermal', 'grayscale'] as const).map((scheme) => (
                    <button type="button" key={scheme}
                      onClick={() => setColorScheme(scheme)}
                      className={`px-1.5 py-1 text-[8px] font-medium rounded capitalize transition-all ${
                        colorScheme === scheme
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {scheme}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">Levels:</span>
                  <input
                    type="range" min="4" max="24" step="2" value={contourLevels}
                    onChange={(e) => setContourLevels(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scale Slider */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Scale
            </h4>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {scale}x
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="200"
            value={scale}
            onChange={(e) => handleScaleChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            <span>1x</span>
            <span>100x</span>
            <span>200x</span>
          </div>
        </div>

        {/* Animation Controls */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Animation
          </h4>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={toggleAnimation}
              className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1
                            ${
                              isAnimating
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                            }
                        `}
            >
              {isAnimating ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span className="text-sm font-medium">Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="text-sm font-medium">Animate</span>
                </>
              )}
            </button>
            <button type="button"
              onClick={resetView}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Max Values
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-[10px] text-blue-600 dark:text-blue-400">
                Max Displacement
              </div>
              <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                {maxDisplacementStr}
              </div>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-[10px] text-purple-600 dark:text-purple-400">
                Max Reaction
              </div>
              <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
                {maxReactionStr}
              </div>
            </div>
          </div>
        </div>

        {/* Force Summary — STAAD.Pro-style max/min per force type */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <button type="button"
            onClick={() => setShowForceSummary(!showForceSummary)}
            className="flex items-center justify-between w-full"
          >
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              Force Summary
            </h4>
            {showForceSummary ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>
          {showForceSummary && forceSummary && (
            <div className="mt-2 space-y-1 text-[9px]">
              {[
                { label: 'Axial', max: forceSummary.maxAxial, min: forceSummary.minAxial, unit: 'kN' },
                { label: 'Shear Y', max: forceSummary.maxShearY, min: forceSummary.minShearY, unit: 'kN' },
                { label: 'Moment Z', max: forceSummary.maxMomentZ, min: forceSummary.minMomentZ, unit: 'kN·m' },
                { label: 'Shear Z', max: forceSummary.maxShearZ, min: forceSummary.minShearZ, unit: 'kN' },
                { label: 'Moment Y', max: forceSummary.maxMomentY, min: forceSummary.minMomentY, unit: 'kN·m' },
                { label: 'Torsion', max: forceSummary.maxTorsion, min: null, unit: 'kN·m' },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-3 gap-1 items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{row.label}</span>
                  <div className="text-right">
                    <span className="text-red-500 font-mono">{row.max.value.toFixed(2)}</span>
                    <span className="text-slate-400 ml-0.5">({row.max.memberId})</span>
                  </div>
                  {row.min ? (
                    <div className="text-right">
                      <span className="text-blue-500 font-mono">{row.min.value.toFixed(2)}</span>
                      <span className="text-slate-400 ml-0.5">({row.min.memberId})</span>
                    </div>
                  ) : (
                    <div className="text-right text-slate-400">—</div>
                  )}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1 text-[8px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                <span>Force Type</span>
                <span className="text-right text-red-400">Max (Member)</span>
                <span className="text-right text-blue-400">Min (Member)</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Member Query — STAAD.Pro "Member Query" */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
            <Search className="w-3 h-3" />
            Member Query
          </h4>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                value={queryMemberId}
                onChange={(e) => setQueryMemberId(e.target.value)}
                placeholder="Member ID..."
                className="w-full pl-6 pr-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
              />
            </div>
            {queryMemberId && (
              <button type="button" onClick={() => setQueryMemberId('')} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {queriedMemberForces && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-300">
                  Member {queryMemberId.trim()} — L = {(queriedMemberForces as any).length?.toFixed(3) ?? '?'} m
                </span>
                <button type="button" onClick={() => handleOpenMemberDetail(queryMemberId.trim())} className="text-[9px] text-blue-500 hover:text-blue-700 underline">
                  Detail →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[9px]">
                <div className="text-slate-500 dark:text-slate-400">Axial: <span className="font-mono text-slate-900 dark:text-white">{queriedMemberForces.axial?.toFixed(2)} kN</span></div>
                <div className="text-slate-500 dark:text-slate-400">Vy: <span className="font-mono text-slate-900 dark:text-white">{queriedMemberForces.shearY?.toFixed(2)} kN</span></div>
                <div className="text-slate-500 dark:text-slate-400">Vz: <span className="font-mono text-slate-900 dark:text-white">{(queriedMemberForces.shearZ ?? 0).toFixed(2)} kN</span></div>
                <div className="text-slate-500 dark:text-slate-400">Mz: <span className="font-mono text-slate-900 dark:text-white">{queriedMemberForces.momentZ?.toFixed(2)} kN·m</span></div>
                <div className="text-slate-500 dark:text-slate-400">My: <span className="font-mono text-slate-900 dark:text-white">{(queriedMemberForces.momentY ?? 0).toFixed(2)} kN·m</span></div>
                <div className="text-slate-500 dark:text-slate-400">T: <span className="font-mono text-slate-900 dark:text-white">{(queriedMemberForces.torsion ?? 0).toFixed(2)} kN·m</span></div>
              </div>
            </div>
          )}
          {queryMemberId.trim() && !queriedMemberForces && (
            <div className="mt-1 text-[9px] text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              No results for member "{queryMemberId.trim()}"
            </div>
          )}
        </div>

        {/* Max Displacement per DOF — STAAD.Pro "Max Node Displacement Summary" */}
        {maxDispPerDOF && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
              <Crosshair className="w-3 h-3" />
              Max Displacements
            </h4>
            <div className="grid grid-cols-3 gap-1 text-[9px]">
              {[
                { dof: 'X', val: maxDispPerDOF.maxDx, unit: 'm' },
                { dof: 'Y', val: maxDispPerDOF.maxDy, unit: 'm' },
                { dof: 'Z', val: maxDispPerDOF.maxDz, unit: 'm' },
                { dof: 'Rx', val: maxDispPerDOF.maxRx, unit: 'rad' },
                { dof: 'Ry', val: maxDispPerDOF.maxRy, unit: 'rad' },
                { dof: 'Rz', val: maxDispPerDOF.maxRz, unit: 'rad' },
              ].map(({ dof, val, unit }) => (
                <div key={dof} className="p-1 bg-slate-50 dark:bg-slate-800 rounded text-center">
                  <div className="text-slate-400">{dof}</div>
                  <div className="font-mono text-slate-900 dark:text-white">{val.value.toFixed(4)}</div>
                  <div className="text-slate-400">N{val.nodeId} {unit}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeDiagram === "reactions" && supportReactions.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto scroll-smooth">
            <h4 className="text-xs font-medium text-purple-400 mb-2 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownToLine className="w-3 h-3" />
              Support Reactions ({supportReactions.length} supports)
            </h4>
            <div className="space-y-1.5">
              {supportReactions.map((sr) => (
                <div
                  key={sr.nodeId}
                  className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                >
                  <div className="text-[10px] font-medium text-purple-600 dark:text-purple-300 mb-1">
                    Node {sr.nodeId}
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px]">
                    {Math.abs(sr.fx) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        Fx:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.fx.toFixed(2)} kN
                        </span>
                      </div>
                    )}
                    {Math.abs(sr.fy) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        Fy:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.fy.toFixed(2)} kN
                        </span>
                      </div>
                    )}
                    {Math.abs(sr.fz) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        Fz:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.fz.toFixed(2)} kN
                        </span>
                      </div>
                    )}
                    {Math.abs(sr.mx) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        Mx:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.mx.toFixed(2)} kN·m
                        </span>
                      </div>
                    )}
                    {Math.abs(sr.my) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        My:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.my.toFixed(2)} kN·m
                        </span>
                      </div>
                    )}
                    {Math.abs(sr.mz) > 0.001 && (
                      <div className="text-slate-500 dark:text-slate-400">
                        Mz:{" "}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {sr.mz.toFixed(2)} kN·m
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export Results */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Export Results
          </h4>
          <div className="flex flex-col gap-2">
            <button type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg text-sm font-medium"
            >
              {isExporting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Export PDF Report</span>
            </button>
            <button type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-all text-sm font-medium"
            >
              {isExporting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export CSV Data</span>
            </button>
          </div>
        </div>

        {/* Next Steps — Advanced Tools */}
        <div className="px-4 py-3">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Next Steps
          </h4>
          <div className="flex flex-col gap-2">
            {/* Tabular Results — STAAD.Pro-style full results tables */}
            <button type="button"
              onClick={() => setShowTabularResults(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg text-sm"
            >
              <Table2 className="w-4 h-4" />
              <span className="font-medium">Tabular Results View</span>
            </button>
            {/* Member Force Diagrams Button */}
            <button type="button"
              onClick={() => handleOpenMemberDetail()}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg text-sm"
            >
              <Eye className="w-4 h-4" />
              <span className="font-medium">Member Force Diagrams</span>
            </button>
            {/* Full Dashboard Button - Premium feature */}
            <button type="button"
              onClick={() => setShowDashboard(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="font-medium">Full Results Dashboard</span>
            </button>
            <button type="button"
              onClick={() => openModal("advancedAnalysis")}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors text-sm"
            >
              <Zap className="w-4 h-4" />
              <span className="font-medium">Advanced Analysis</span>
            </button>
            <button type="button"
              onClick={() => openModal("designCodes")}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors text-sm"
            >
              <FileCheck className="w-4 h-4" />
              <span className="font-medium">Design Code Check</span>
            </button>
            {/* Post-Processing Design Studio — STAAD-Pro-class */}
            <button type="button"
              onClick={() => setShowDesignStudio(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg text-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium">Post-Processing Design Studio</span>
            </button>
            {/* Design Hub — Full STAAD-Pro workflow */}
            <Link
              to="/design-hub"
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg text-sm"
            >
              <Zap className="w-4 h-4" />
              <span className="font-medium">Open Design Hub</span>
            </Link>
          </div>
        </div>
        </div>{/* end scrollable body */}
      </div>

      {/* Full Results Dashboard Modal */}
      <Dialog open={showDashboard && !!analysisResults} onOpenChange={(open) => !open && setShowDashboard(false)}>
        <DialogContent className="max-w-[1800px] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Analysis Results Dashboard</DialogTitle>
          </DialogHeader>
          {analysisResults && (
            <AnalysisResultsDashboard
              results={convertToAnalysisResultsData(
                analysisResults,
                nodes,
                members,
              )}
              onClose={() => setShowDashboard(false)}
              onExport={(format) => {
                if (format === "pdf") {
                  handleExportPDF();
                } else if (format === "json") {
                  // Direct JSON export with full analysis results
                  const data = convertToAnalysisResultsData(
                    analysisResults,
                    nodes,
                    members,
                  );
                  const jsonStr = JSON.stringify(data, null, 2);
                  const blob = new Blob([jsonStr], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `BeamLab_Results_${new Date().toISOString().split("T")[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } else {
                  handleExportCSV();
                }
                setShowDashboard(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Post-Processing Design Studio Modal */}
      {showDesignStudio && (
        <PostProcessingDesignStudio onClose={() => setShowDesignStudio(false)} />
      )}

      {/* Tabular Results Dialog — STAAD.Pro-style full results tables */}
      <Dialog open={showTabularResults} onOpenChange={(open) => !open && setShowTabularResults(false)}>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Table2 className="w-5 h-5 text-blue-500" />
              Tabular Results — Analysis Output
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 flex-shrink-0">
              {([
                { id: 'displacements', label: 'Node Displacements', count: nodeDisplacementTable.length },
                { id: 'forces', label: 'Member End Forces', count: memberForceTable.length },
                { id: 'reactions', label: 'Support Reactions', count: supportReactions.length },
                { id: 'summary', label: 'Summary', count: null },
              ] as const).map((tab) => (
                <button type="button" key={tab.id}
                  onClick={() => setTabularTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tabularTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            {/* Table Content */}
            <div className="flex-1 overflow-auto p-4">
              {/* Node Displacements Table */}
              {tabularTab === 'displacements' && (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-500"
                          onClick={() => { setSortColumn('nodeId'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                        Node {sortColumn === 'nodeId' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      {['dx', 'dy', 'dz', 'rx', 'ry', 'rz', 'resultant'].map((col) => (
                        <th key={col} className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-500"
                            onClick={() => { setSortColumn(col); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          {col.toUpperCase()} {col === 'resultant' ? '(m)' : col.startsWith('r') ? '(rad)' : '(m)'}
                          {sortColumn === col && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...nodeDisplacementTable]
                      .sort((a, b) => {
                        const valA = sortColumn === 'nodeId' ? a.nodeId : a[sortColumn as keyof typeof a] as number;
                        const valB = sortColumn === 'nodeId' ? b.nodeId : b[sortColumn as keyof typeof b] as number;
                        const cmp = typeof valA === 'string' ? valA.localeCompare(valB as string) : (valA as number) - (valB as number);
                        return sortDirection === 'asc' ? cmp : -cmp;
                      })
                      .map((row, i) => (
                      <tr key={row.nodeId} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-blue-50 dark:hover:bg-blue-900/20`}>
                        <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">{row.nodeId}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.dx.toExponential(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.dy.toExponential(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.dz.toExponential(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.rx.toExponential(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.ry.toExponential(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.rz.toExponential(3)}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${row.resultant > 0.01 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {row.resultant.toExponential(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Member End Forces Table */}
              {tabularTab === 'forces' && (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-500"
                          onClick={() => { setSortColumn('memberId'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                        Member {sortColumn === 'memberId' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      {['axial', 'shearY', 'shearZ', 'momentZ', 'momentY', 'torsion'].map((col) => (
                        <th key={col} className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-500"
                            onClick={() => { setSortColumn(col); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          {col === 'axial' ? 'Fx (kN)' : col === 'shearY' ? 'Vy (kN)' : col === 'shearZ' ? 'Vz (kN)' : col === 'momentZ' ? 'Mz (kN·m)' : col === 'momentY' ? 'My (kN·m)' : 'T (kN·m)'}
                          {sortColumn === col && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...memberForceTable]
                      .sort((a, b) => {
                        const valA = sortColumn === 'memberId' ? a.memberId : a[sortColumn as keyof typeof a] as number;
                        const valB = sortColumn === 'memberId' ? b.memberId : b[sortColumn as keyof typeof b] as number;
                        const cmp = typeof valA === 'string' ? valA.localeCompare(valB as string) : (valA as number) - (valB as number);
                        return sortDirection === 'asc' ? cmp : -cmp;
                      })
                      .map((row, i) => (
                      <tr key={row.memberId} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-blue-50 dark:hover:bg-blue-900/20`}>
                        <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">{row.memberId}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${row.axial < 0 ? 'text-blue-500' : row.axial > 0 ? 'text-red-500' : 'text-slate-500'}`}>{row.axial.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.shearY.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.shearZ.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.momentZ.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.momentY.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{row.torsion.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button type="button" onClick={() => { setShowTabularResults(false); handleOpenMemberDetail(row.memberId); }}
                            className="text-blue-500 hover:text-blue-700 underline text-[10px]">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Support Reactions Table */}
              {tabularTab === 'reactions' && (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Node</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Fx (kN)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Fy (kN)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Fz (kN)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Mx (kN·m)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">My (kN·m)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Mz (kN·m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportReactions.map((sr, i) => (
                      <tr key={sr.nodeId} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                        <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">{sr.nodeId}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.fx.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.fy.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.fz.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.mx.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.my.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{sr.mz.toFixed(3)}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 font-semibold">
                      <td className="px-3 py-1.5 text-slate-900 dark:text-white">ΣTotal</td>
                      {['fx', 'fy', 'fz', 'mx', 'my', 'mz'].map((key) => (
                        <td key={key} className="px-3 py-1.5 text-right font-mono text-slate-900 dark:text-white">
                          {supportReactions.reduce((sum, sr) => sum + (sr[key as keyof typeof sr] as number), 0).toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Summary Tab */}
              {tabularTab === 'summary' && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Analysis Statistics */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-500" /> Analysis Statistics
                    </h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Total Nodes', value: nodes.size.toString() },
                        { label: 'Total Members', value: members.size.toString() },
                        { label: 'Total DOF', value: (nodes.size * 6).toString() },
                        { label: 'Condition Number', value: analysisResults?.conditionNumber?.toExponential(2) ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{label}</span>
                          <span className="font-mono text-slate-900 dark:text-white">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Equilibrium Check */}
                    {analysisResults?.equilibriumCheck && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                          {analysisResults.equilibriumCheck.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          Equilibrium Check — {analysisResults.equilibriumCheck.pass ? 'PASS' : 'FAIL'}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="text-slate-500">Error: <span className="font-mono">{analysisResults.equilibriumCheck.error_percent.toFixed(4)}%</span></div>
                          <div className="text-slate-500">Residual: <span className="font-mono">[{analysisResults.equilibriumCheck.residual.map(v => v.toExponential(2)).join(', ')}]</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Max Values Summary */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-red-500" /> Maximum Values
                    </h3>
                    {forceSummary && (
                      <div className="space-y-1.5">
                        {[
                          { label: 'Max Axial Force', val: forceSummary.maxAxial.value, unit: 'kN', member: forceSummary.maxAxial.memberId },
                          { label: 'Max Shear (Vy)', val: forceSummary.maxShearY.value, unit: 'kN', member: forceSummary.maxShearY.memberId },
                          { label: 'Max Moment (Mz)', val: forceSummary.maxMomentZ.value, unit: 'kN·m', member: forceSummary.maxMomentZ.memberId },
                          { label: 'Max Displacement', val: maxDispPerDOF ? Math.max(Math.abs(maxDispPerDOF.maxDx.value), Math.abs(maxDispPerDOF.maxDy.value), Math.abs(maxDispPerDOF.maxDz.value)) * 1000 : 0, unit: 'mm', member: maxDispPerDOF?.maxDy.nodeId ?? '' },
                        ].map(({ label, val, unit, member }) => (
                          <div key={label} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded">
                            <span className="text-slate-500 dark:text-slate-400">{label}</span>
                            <div className="text-right">
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">{val.toFixed(2)} {unit}</span>
                              <span className="text-[9px] text-slate-400 ml-1">({member})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Detail Panel Modal */}
      <Dialog open={showMemberDetail && !!selectedMemberId && !!selectedMemberForces} onOpenChange={(open) => !open && setShowMemberDetail(false)}>
        <DialogContent className="max-w-[900px] w-[90vw] h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Member Force Details</DialogTitle>
          </DialogHeader>
          {showMemberDetail && selectedMemberId && selectedMemberForces &&
            (() => {
              const memberModel = members.get(selectedMemberId);
              const actualLength = memberModel
                ? getMemberLength(memberModel, nodes)
                : 5;

              // Classify support type at each end of the selected member
              const classifySupport = (nodeId: string | undefined): 'free' | 'pin' | 'roller' | 'fixed' => {
                if (!nodeId) return 'free';
                const nd = nodes.get(nodeId);
                if (!nd || !nd.restraints) return 'free';
                const rest = nd.restraints;
                const hasTrans = rest.fx || rest.fy || rest.fz;
                if (!hasTrans) return 'free';
                const hasMoment = rest.mx || rest.my || rest.mz;
                if (hasMoment) return 'fixed';
                // Pin vs roller: roller has only one translational restraint (fy only)
                const transCount = [rest.fx, rest.fy, rest.fz].filter(Boolean).length;
                return transCount <= 1 ? 'roller' : 'pin';
              };

              const startSup = classifySupport(memberModel?.startNodeId);
              const endSup = classifySupport(memberModel?.endNodeId);

              return (
                <MemberDetailPanel
                  memberId={selectedMemberId}
                  memberForces={selectedMemberForces}
                  memberLength={actualLength}
                  sectionId={memberModel?.sectionId || "Default"}
                  material="steel"
                  startSupport={startSup}
                  endSupport={endSup}
                  sectionProps={
                    memberModel
                      ? {
                          A: memberModel.A,
                          I: memberModel.I,
                          Iy: (memberModel as any).Iy,
                          width:
                            memberModel.dimensions?.width ??
                            memberModel.dimensions?.rectWidth,
                          depth:
                            memberModel.dimensions?.height ??
                            memberModel.dimensions?.rectHeight,
                          tf: memberModel.dimensions?.flangeThickness,
                          tw: memberModel.dimensions?.webThickness,
                          fy: (memberModel as any).fy,
                          sectionType: memberModel.sectionType,
                        }
                      : undefined
                  }
                  onClose={() => setShowMemberDetail(false)}
                  onNavigate={handleMemberNavigate}
                />
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
});

(ResultsToolbar as unknown as { displayName: string }).displayName = 'ResultsToolbar';

export default ResultsToolbar;
