import type { Member, MemberLoad, NodeLoad, LoadCase } from '../../store/model';
import type { NodeDisplacementRow, MemberForceRow, ReactionRow, DesignResult } from './reportTypes';

export interface ReportNodeGridRow {
  id: string;
  x: number;
  y: number;
  z: number;
  restraint: string;
}

export interface ReportMemberGridRow {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId: string;
  material: string;
}

export interface ReportLoadGridRow {
  id: string;
  nodeId?: string;
  memberId?: string;
  type: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
  w1?: number;
  w2?: number;
  direction?: string;
  factor?: number;
}

export const toNodeGridRows = (nodes: Array<{ id: string; x: number; y: number; z: number; restraints?: Record<string, boolean> }>): ReportNodeGridRow[] =>
  nodes.map((node) => {
    const restraintCodes = Object.entries(node.restraints || {})
      .filter(([, value]) => value)
      .map(([key]) => key.replace('r', 'R').toUpperCase())
      .join(', ');

    return { id: node.id, x: node.x, y: node.y, z: node.z, restraint: restraintCodes || 'Free' };
  });

export const toMemberGridRows = (members: Member[]): ReportMemberGridRow[] =>
  members.map((member) => ({
    id: member.id,
    startNodeId: member.startNodeId ?? '—',
    endNodeId: member.endNodeId ?? '—',
    sectionId: member.sectionId || '—',
    material: 'Steel',
  }));

export const toNodalLoadGridRows = (loads: NodeLoad[]): ReportLoadGridRow[] =>
  loads.map((load) => ({
    id: load.id || load.nodeId || '—',
    nodeId: load.nodeId,
    type: 'Nodal',
    fx: load.fx,
    fy: load.fy,
    fz: load.fz,
    mx: load.mx,
    my: load.my,
    mz: load.mz,
  }));

export const toMemberLoadGridRows = (loads: MemberLoad[]): ReportLoadGridRow[] =>
  loads.map((load, index) => ({
    id: load.id || String(index),
    memberId: load.memberId,
    type: load.type,
    w1: load.w1 ?? load.P,
    w2: load.type === 'UVL' ? load.w2 : undefined,
    direction: (load.direction || '').replace(/_/g, ' '),
  }));

export const toLoadCaseRows = (loadCases: LoadCase[]) =>
  loadCases.map((lc) => ({
    id: lc.id,
    name: lc.name,
    type: (lc.type || '').replace(/_/g, ' '),
    factor: lc.factor ?? 1,
  }));
