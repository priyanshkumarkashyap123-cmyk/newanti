/**
 * Professional Report Generator Analysis Data Helpers
 * Derives KPIs and summary tables from live analysis results
 */

import type { AnalysisResults, ModalResult } from '../../../store/model';

type NumericRecord = Record<string, number | undefined>;

function isEntry<T extends NumericRecord>(value: unknown): value is [string, T] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'object' && value[1] !== null;
}

export interface AnalysisTable {
  displacementRows: Array<{
    nodeId: string;
    dx: number;
    dy: number;
    dz: number;
    drift: number;
  }>;
  reactionRows: Array<{
    nodeId: string;
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
  }>;
  memberForceRows: Array<{
    memberId: string;
    axial: number;
    shearY: number;
    momentZ: number;
  }>;
}

export interface AnalysisKpis {
  maxDisp: AnalysisTable['displacementRows'][0] | undefined;
  maxReaction: AnalysisTable['reactionRows'][0] | undefined;
  criticalMember: AnalysisTable['memberForceRows'][0] | undefined;
  mode1Hz: number | undefined;
  analysisReady: boolean;
}

/**
 * Get absolute max value from array of numbers
 */
export function maxAbs(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((max, item) => Math.max(max, Math.abs(item)), 0);
}

/**
 * Format signed number with decimals
 */
export function formatSigned(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}`;
}

/**
 * Build analysis summary tables from live results
 */
export function buildAnalysisTables(
  analysisResults: AnalysisResults | null | undefined
): AnalysisTable {
  const displacementRows = (Array.from(analysisResults?.displacements?.entries?.() ?? []) as unknown[])
    .filter((entry): entry is [string, NumericRecord] => isEntry<NumericRecord>(entry))
    .map(([nodeId, d]) => ({
      nodeId,
      dx: d.dx ?? 0,
      dy: d.dy ?? 0,
      dz: d.dz ?? 0,
      drift: Math.sqrt((d.dx ?? 0) ** 2 + (d.dy ?? 0) ** 2 + (d.dz ?? 0) ** 2),
    }))
    .sort((a, b) => b.drift - a.drift);

  const reactionRows = (Array.from(analysisResults?.reactions?.entries?.() ?? []) as unknown[])
    .filter((entry): entry is [string, NumericRecord] => isEntry<NumericRecord>(entry))
    .map(([nodeId, r]) => ({
      nodeId,
      fx: r.fx ?? 0,
      fy: r.fy ?? 0,
      fz: r.fz ?? 0,
      mx: r.mx ?? 0,
      my: r.my ?? 0,
      mz: r.mz ?? 0,
    }))
    .sort((a, b) => Math.abs(b.fy) - Math.abs(a.fy));

  const memberForceRows = (Array.from(analysisResults?.memberForces?.entries?.() ?? []) as unknown[])
    .filter((entry): entry is [string, any] => isEntry<any>(entry))
    .map(([memberId, f]) => {
      const sx = f.startForces;
      const ex = f.endForces;
      const axial = maxAbs([sx?.axial ?? f.axial ?? 0, ex?.axial ?? f.axial ?? 0, f.axial ?? 0]);
      const shearY = maxAbs([sx?.shearY ?? f.shearY ?? 0, ex?.shearY ?? f.shearY ?? 0, f.shearY ?? 0]);
      const momentZ = maxAbs([sx?.momentZ ?? f.momentZ ?? 0, ex?.momentZ ?? f.momentZ ?? 0, f.momentZ ?? 0]);
      return { memberId, axial, shearY, momentZ };
    })
    .sort((a, b) => b.momentZ - a.momentZ);

  return { displacementRows, reactionRows, memberForceRows };
}

/**
 * Extract key performance indicators from analysis tables
 */
export function extractAnalysisKpis(
  analysisTables: AnalysisTable,
  analysisResults: AnalysisResults | null | undefined,
  modalResults: ModalResult | null | undefined
): AnalysisKpis {
  const maxDisp = analysisTables.displacementRows[0];
  const maxReaction = analysisTables.reactionRows[0];
  const criticalMember = analysisTables.memberForceRows[0];
  const mode1Hz = modalResults?.modes?.[0]?.frequency;

  const analysisReady = Boolean(
    analysisResults?.completed ||
    analysisTables.displacementRows.length > 0 ||
    analysisTables.reactionRows.length > 0 ||
    analysisTables.memberForceRows.length > 0,
  );

  return {
    maxDisp,
    maxReaction,
    criticalMember,
    mode1Hz,
    analysisReady,
  };
}
