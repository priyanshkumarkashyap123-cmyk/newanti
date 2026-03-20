import type { Member, Node, ProjectInfo, AnalysisResults } from '../../store/model';
import {
  aggregateToReportData,
  createEmptyDetailingResult,
  type ConnectionDetail,
  type DesignCheck,
  type MemberForces,
  type NodeForces,
  type ProjectMetadata,
  type ReinforcementDetail,
  type UnifiedAnalysisResult,
  type UnifiedDesignResult,
  type UnifiedDetailingResult,
  type UnifiedReportData,
} from '../../data/UnifiedResultsModel';
import {
  MATERIALS_DATABASE,
  STEEL_SECTIONS,
  getMaterialById,
  getSectionById,
} from '../../data/SectionDatabase';
import { performSteelDesignCheck, type DesignParameters } from '../SteelDesignService';
import { UnifiedReportGenerator, type UnifiedReportConfig } from './UnifiedReportGenerator';

const DEFAULT_STEEL_SECTION_ID = 'W14x30';
const DEFAULT_STEEL_MATERIAL_ID = 'steel-a36';

const safeMax = (values: number[]): number =>
  values.length > 0 ? Math.max(...values.map((value) => Math.abs(value))) : 0;

const getMemberLengthM = (member: Member, nodes: Map<string, Node>): number => {
  const start = nodes.get(member.startNodeId);
  const end = nodes.get(member.endNodeId);

  if (!start || !end) {
    return 0;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const toProjectMetadata = (projectInfo: ProjectInfo): ProjectMetadata => ({
  projectName: projectInfo.name || 'BeamLab Project',
  clientName: projectInfo.client || 'Client',
  engineerName: projectInfo.engineer || 'Engineer',
  location: projectInfo.description || 'Project Site',
  date: projectInfo.date ? new Date(projectInfo.date) : new Date(),
  revision: projectInfo.rev || 'Rev 00',
  logo: undefined,
});

export const buildUnifiedAnalysisResult = (
  analysisResults: AnalysisResults,
  nodes: Map<string, Node>,
  members: Map<string, Member>,
): UnifiedAnalysisResult => {
  const nodeResults = new Map<string, NodeForces>();
  const memberResults = new Map<string, MemberForces>();

  let maxDisplacementValue = 0;
  let maxDisplacementNodeId = '';
  let maxDisplacementDirection: 'X' | 'Y' | 'Z' = 'X';

  analysisResults.displacements.forEach((disp, nodeId) => {
    const absDx = Math.abs(disp.dx);
    const absDy = Math.abs(disp.dy);
    const absDz = Math.abs(disp.dz);
    const maxLocal = Math.max(absDx, absDy, absDz);

    if (maxLocal > maxDisplacementValue) {
      maxDisplacementValue = maxLocal;
      maxDisplacementNodeId = nodeId;
      maxDisplacementDirection =
        maxLocal === absDx ? 'X' : maxLocal === absDy ? 'Y' : 'Z';
    }

    nodeResults.set(nodeId, {
      nodeid: nodeId,
      displacements: {
        dx: disp.dx,
        dy: disp.dy,
        dz: disp.dz,
      },
      reactions: analysisResults.reactions.get(nodeId)
        ? {
            fx: analysisResults.reactions.get(nodeId)!.fx,
            fy: analysisResults.reactions.get(nodeId)!.fy,
            fz: analysisResults.reactions.get(nodeId)!.fz,
            mx: analysisResults.reactions.get(nodeId)!.mx,
            my: analysisResults.reactions.get(nodeId)!.my,
            mz: analysisResults.reactions.get(nodeId)!.mz,
          }
        : undefined,
    });
  });

  let maxMemberForce = 0;
  let maxMemberForceId = '';
  let maxMemberForceType: 'axial' | 'shear' | 'moment' = 'axial';
  let maxStress = 0;
  let maxStressMemberId = '';

  analysisResults.memberForces.forEach((forces, memberId) => {
    const member = members.get(memberId);
    const length = member ? getMemberLengthM(member, nodes) : 0;
    const xValues = forces.diagramData?.x_values ?? [0, length];
    const axialValues = forces.diagramData?.axial ?? [forces.axial, forces.axial];
    const shearYValues = forces.diagramData?.shear_y ?? [forces.shearY, forces.shearY];
    const shearZValues = forces.diagramData?.shear_z ?? [forces.shearZ, forces.shearZ];
    const momentYValues = forces.diagramData?.moment_y ?? [forces.momentY, forces.momentY];
    const momentZValues = forces.diagramData?.moment_z ?? [forces.momentZ, forces.momentZ];
    const torsionValues = forces.diagramData?.torsion ?? [forces.torsion, forces.torsion];

    const axialMax = safeMax(axialValues);
    const shearMax = Math.max(safeMax(shearYValues), safeMax(shearZValues));
    const momentMax = Math.max(safeMax(momentYValues), safeMax(momentZValues));

    const governingValue = Math.max(axialMax, shearMax, momentMax);
    if (governingValue > maxMemberForce) {
      maxMemberForce = governingValue;
      maxMemberForceId = memberId;
      maxMemberForceType =
        governingValue === momentMax ? 'moment' : governingValue === shearMax ? 'shear' : 'axial';
    }

    const sectionAreaM2 = member?.A ?? 0;
    const stressMpa = sectionAreaM2 > 0 ? axialMax / (sectionAreaM2 * 1000) : 0;
    if (stressMpa > maxStress) {
      maxStress = stressMpa;
      maxStressMemberId = memberId;
    }

    memberResults.set(memberId, {
      memberId,
      sectionId: member?.sectionId,
      length,
      forces: {
        x_values: xValues,
        Fx: axialValues,
        Fy: shearYValues,
        Fz: shearZValues,
        Mx: torsionValues,
        My: momentYValues,
        Mz: momentZValues,
      },
      maxValues: {
        axial: axialMax,
        shearY: safeMax(shearYValues),
        shearZ: safeMax(shearZValues),
        momentY: safeMax(momentYValues),
        momentZ: safeMax(momentZValues),
      },
    });
  });

  const reactionRows = Array.from(analysisResults.reactions.entries()).map(([nodeId, reaction]) => ({
    nodeid: nodeId,
    displacements: { dx: 0, dy: 0, dz: 0 },
    reactions: {
      fx: reaction.fx,
      fy: reaction.fy,
      fz: reaction.fz,
      mx: reaction.mx,
      my: reaction.my,
      mz: reaction.mz,
    },
  }));

  const totalReactionFx = reactionRows.reduce((sum, row) => sum + (row.reactions?.fx ?? 0), 0);
  const totalReactionFy = reactionRows.reduce((sum, row) => sum + (row.reactions?.fy ?? 0), 0);
  const totalReactionFz = reactionRows.reduce((sum, row) => sum + (row.reactions?.fz ?? 0), 0);
  const maxReaction = reactionRows.reduce(
    (max, row) =>
      Math.max(
        max,
        Math.abs(row.reactions?.fx ?? 0),
        Math.abs(row.reactions?.fy ?? 0),
        Math.abs(row.reactions?.fz ?? 0),
      ),
    0,
  );

  return {
    analysisId: `analysis-${analysisResults.timestamp ?? Date.now()}`,
    timestamp: analysisResults.timestamp ? new Date(analysisResults.timestamp) : new Date(),
    loadCase: 'Static',
    analysisType: 'linear',
    status: analysisResults.completed ? 'complete' : 'pending',
    nodeResults,
    memberResults,
    reactions: {
      reactions: reactionRows,
      totalReactionFx,
      totalReactionFy,
      totalReactionFz,
      maxReaction,
    },
    maxDisplacement: {
      value: maxDisplacementValue,
      nodeId: maxDisplacementNodeId,
      direction: maxDisplacementDirection,
    },
    maxMemberForce: {
      value: maxMemberForce,
      memberId: maxMemberForceId,
      forceType: maxMemberForceType,
    },
    maxStress: {
      value: maxStress,
      memberId: maxStressMemberId,
    },
    error: undefined,
  };
};

const buildSteelDesignCheck = (
  member: Member,
  nodes: Map<string, Node>,
  analysisResults: AnalysisResults,
): DesignCheck | null => {
  const forces = analysisResults.memberForces.get(member.id);
  if (!forces) {
    return null;
  }

  const section = getSectionById(member.sectionId || DEFAULT_STEEL_SECTION_ID) || STEEL_SECTIONS[0];
  const material = getMaterialById(DEFAULT_STEEL_MATERIAL_ID) || MATERIALS_DATABASE[0];
  const memberLengthMm = getMemberLengthM(member, nodes) * 1000;

  const params: DesignParameters = {
    Lb: memberLengthMm,
    Lx: memberLengthMm,
    Ly: memberLengthMm,
    Kx: 1.0,
    Ky: 1.0,
    Cb: 1.0,
  };

  const steelResult = performSteelDesignCheck(
    member.id,
    section,
    material,
    {
      axial: forces.axial,
      shearY: forces.shearY,
      shearZ: forces.shearZ,
      momentY: forces.momentY,
      momentZ: forces.momentZ,
      torsion: forces.torsion,
    },
    params,
  );

  const deflection = Array.from(analysisResults.displacements.values()).reduce(
    (max, disp) => Math.max(max, Math.abs(disp.dy)),
    0,
  );
  const deflectionLimit = memberLengthMm / 250 / 1000;
  const utilization = steelResult.criticalRatio;

  return {
    memberId: member.id,
    sectionId: member.sectionId || section.id,
    designCode: 'AISC360',
    utilization,
    utilizationPercent: utilization * 100,
    status: utilization > 1 ? 'fail' : utilization > 0.8 ? 'warn' : 'pass',
    bendingCheck: {
      utilization: Math.max(steelResult.flexureXCheck?.ratio ?? 0, steelResult.flexureYCheck?.ratio ?? 0),
      clause: steelResult.flexureXCheck?.code || steelResult.flexureYCheck?.code || 'AISC 360-16 Chapter F',
    },
    shearCheck: {
      utilization: Math.max(steelResult.shearVyCheck?.ratio ?? 0, steelResult.shearVzCheck?.ratio ?? 0),
      clause: steelResult.shearVyCheck?.code || steelResult.shearVzCheck?.code || 'AISC 360-16 Chapter G',
    },
    axialCheck: {
      utilization: Math.max(steelResult.tensionCheck?.ratio ?? 0, steelResult.compressionCheck?.ratio ?? 0),
      clause: steelResult.tensionCheck?.code || steelResult.compressionCheck?.code || 'AISC 360-16 Chapter D/E',
    },
    deflectionCheck: {
      value: deflection,
      limit: deflectionLimit,
      status: deflection <= deflectionLimit ? 'pass' : 'fail',
    },
    recommendations: [
      steelResult.overallStatus === 'FAIL'
        ? `Increase section size from ${section.name} or reduce unsupported length.`
        : steelResult.overallStatus === 'WARNING'
          ? `Member ${member.id} is approaching capacity; review lateral restraint and section economy.`
          : `Member ${member.id} passes with acceptable reserve capacity.`,
    ],
    minSectionRequired: steelResult.overallStatus === 'FAIL' ? 'Select a larger rolled section' : undefined,
    optimizedSection: steelResult.overallStatus === 'PASS' && utilization < 0.5 ? section.name : undefined,
  };
};

export const buildUnifiedDesignAndDetailing = (
  analysisResults: AnalysisResults,
  nodes: Map<string, Node>,
  members: Map<string, Member>,
  projectInfo: ProjectInfo,
): {
  design: UnifiedDesignResult;
  detailing: UnifiedDetailingResult;
} => {
  const memberDesigns = new Map<string, DesignCheck>();

  members.forEach((member) => {
    const designCheck = buildSteelDesignCheck(member, nodes, analysisResults);
    if (designCheck) {
      memberDesigns.set(member.id, designCheck);
    }
  });

  const utilizations = Object.fromEntries(
    Array.from(memberDesigns.entries()).map(([memberId, check]) => [memberId, check.utilization]),
  );
  const utilizationValues = Object.values(utilizations);
  const criticalMembers = Array.from(memberDesigns.values())
    .filter((check) => check.utilization > 0.8)
    .map((check) => check.memberId);
  const failedMembers = Array.from(memberDesigns.values())
    .filter((check) => check.utilization > 1.0)
    .map((check) => check.memberId);

  const averageUtilization =
    utilizationValues.length > 0
      ? utilizationValues.reduce((sum, value) => sum + value, 0) / utilizationValues.length
      : 0;
  const maxUtilization = utilizationValues.length > 0 ? Math.max(...utilizationValues) : 0;
  const minUtilization = utilizationValues.length > 0 ? Math.min(...utilizationValues) : 0;

  const design: UnifiedDesignResult = {
    designId: `design-${Date.now()}`,
    timestamp: new Date(),
    designCode: 'AISC360',
    materialType: 'steel',
    status: memberDesigns.size > 0 ? 'complete' : 'not-run',
    memberDesigns,
    utilizations,
    criticalMembers,
    failedMembers,
    averageUtilization,
    maxUtilization,
    minUtilization,
    designSummary:
      memberDesigns.size > 0
        ? `${memberDesigns.size} steel members checked per AISC 360-16. Critical members: ${criticalMembers.length}. Failed members: ${failedMembers.length}.`
        : 'Design checks not yet run.',
    codeCompliance: failedMembers.length === 0,
    overallStatus: failedMembers.length > 0 ? 'fail' : criticalMembers.length > 0 ? 'warn' : 'pass',
  };

  const steelConnections = new Map<string, ConnectionDetail>();
  memberDesigns.forEach((check, memberId) => {
    steelConnections.set(memberId, {
      memberId,
      connectionType: 'bolted',
      bolts: {
        grade: '8.8',
        diameter: check.utilization > 0.9 ? 24 : 20,
        count: check.utilization > 0.9 ? 8 : 4,
        arrangement: check.utilization > 0.9 ? '2 rows × 4 cols' : '2 rows × 2 cols',
      },
      basePlate: {
        thickness: check.utilization > 0.9 ? 20 : 16,
        sizeX: 300,
        sizeY: 300,
        anchor: {
          count: 4,
          diameter: 20,
          embedDepth: 300,
        },
      },
    });
  });

  const detailing: UnifiedDetailingResult = {
    ...createEmptyDetailingResult(`detailing-${Date.now()}`, 'steel'),
    status: steelConnections.size > 0 ? 'complete' : 'not-run',
    steelConnections,
    schedules: {
      connections: {
        totalBolts: Array.from(steelConnections.values()).reduce(
          (sum, detail) => sum + (detail.bolts?.count ?? 0),
          0,
        ),
        boltGrades: {
          '8.8': Array.from(steelConnections.values()).reduce(
            (sum, detail) => sum + (detail.bolts?.count ?? 0),
            0,
          ),
        },
        totalWeldLength: 0,
        totalBasePlateArea:
          Array.from(steelConnections.values()).reduce(
            (sum, detail) =>
              sum + (((detail.basePlate?.sizeX ?? 0) * (detail.basePlate?.sizeY ?? 0)) / 1_000_000),
            0,
          ),
      },
    },
  };

  void projectInfo;

  return { design, detailing };
};

export const buildUnifiedReportData = (
  projectInfo: ProjectInfo,
  analysisResults: AnalysisResults,
  nodes: Map<string, Node>,
  members: Map<string, Member>,
  existingDesign?: UnifiedDesignResult,
  existingDetailing?: UnifiedDetailingResult,
): UnifiedReportData => {
  const analysis = buildUnifiedAnalysisResult(analysisResults, nodes, members);
  const generated =
    existingDesign && existingDetailing
      ? { design: existingDesign, detailing: existingDetailing }
      : buildUnifiedDesignAndDetailing(analysisResults, nodes, members, projectInfo);

  return aggregateToReportData(
    toProjectMetadata(projectInfo),
    analysis,
    generated.design,
    generated.detailing,
  );
};

export const downloadUnifiedReport = async (
  reportData: UnifiedReportData,
  config?: UnifiedReportConfig,
): Promise<void> => {
  const generator = new UnifiedReportGenerator();
  const pdfBytes = await generator.generateReport(reportData, config);
  const pdfBytesSafe = new Uint8Array(pdfBytes.byteLength);
  pdfBytesSafe.set(pdfBytes);
  const blob = new Blob([pdfBytesSafe.buffer], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportData.project.projectName.replace(/\s+/g, '_')}_Unified_Report.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
