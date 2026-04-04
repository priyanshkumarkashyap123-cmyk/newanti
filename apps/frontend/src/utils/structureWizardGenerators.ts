/**
 * structureWizardGenerators.ts — Exported generator functions for testing
 *
 * Re-exports the structure wizard generator functions for use in tests.
 * These are the same functions used in StructureWizard.tsx.
 */

export interface WizardNode {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface WizardMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
}

export interface WizardStructure {
  nodes: WizardNode[];
  members: WizardMember[];
}

// ─── King Post Truss ─────────────────────────────────────────────────────────

export function generateKingPost(params: { span: number; rise: number }): WizardStructure {
  const { span: L, rise: H } = params;
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: L, y: 0, z: 0 },
      { id: 'N3', x: L / 2, y: H, z: 0 },
      { id: 'N4', x: L / 2, y: 0, z: 0 },
    ],
    members: [
      { id: 'M1', startNodeId: 'N1', endNodeId: 'N3' },
      { id: 'M2', startNodeId: 'N3', endNodeId: 'N2' },
      { id: 'M3', startNodeId: 'N1', endNodeId: 'N2' },
      { id: 'M4', startNodeId: 'N3', endNodeId: 'N4' },
    ],
  };
}

// ─── Queen Post Truss ────────────────────────────────────────────────────────

export function generateQueenPost(params: { span: number; rise: number }): WizardStructure {
  const { span: L, rise: H } = params;
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: L, y: 0, z: 0 },
      { id: 'N3', x: L / 3, y: H, z: 0 },
      { id: 'N4', x: 2 * L / 3, y: H, z: 0 },
      { id: 'N5', x: L / 3, y: 0, z: 0 },
      { id: 'N6', x: 2 * L / 3, y: 0, z: 0 },
    ],
    members: [
      { id: 'M1', startNodeId: 'N1', endNodeId: 'N3' },
      { id: 'M2', startNodeId: 'N3', endNodeId: 'N4' },
      { id: 'M3', startNodeId: 'N4', endNodeId: 'N2' },
      { id: 'M4', startNodeId: 'N1', endNodeId: 'N5' },
      { id: 'M5', startNodeId: 'N5', endNodeId: 'N6' },
      { id: 'M6', startNodeId: 'N6', endNodeId: 'N2' },
      { id: 'M7', startNodeId: 'N3', endNodeId: 'N5' },
      { id: 'M8', startNodeId: 'N4', endNodeId: 'N6' },
    ],
  };
}

// ─── Scissors Truss ──────────────────────────────────────────────────────────

export function generateScissorsTruss(params: { span: number; rise: number; vaultHeight?: number }): WizardStructure {
  const { span: L, rise: H } = params;
  const vH = Math.min(params.vaultHeight ?? H / 3, H * 0.8);
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: L, y: 0, z: 0 },
      { id: 'N3', x: L / 2, y: H, z: 0 },
      { id: 'N4', x: L / 4, y: vH, z: 0 },
      { id: 'N5', x: 3 * L / 4, y: vH, z: 0 },
    ],
    members: [
      { id: 'M1', startNodeId: 'N1', endNodeId: 'N3' },
      { id: 'M2', startNodeId: 'N2', endNodeId: 'N3' },
      { id: 'M3', startNodeId: 'N1', endNodeId: 'N5' },
      { id: 'M4', startNodeId: 'N2', endNodeId: 'N4' },
      { id: 'M5', startNodeId: 'N4', endNodeId: 'N3' },
      { id: 'M6', startNodeId: 'N5', endNodeId: 'N3' },
      { id: 'M7', startNodeId: 'N4', endNodeId: 'N5' },
    ],
  };
}

// ─── Cylindrical Frame ───────────────────────────────────────────────────────

export function generateCylindricalFrame(params: {
  radius: number;
  height: number;
  nBays: number;
  nStories: number;
}): WizardStructure {
  const { radius: R, height: H, nBays, nStories } = params;
  const nodes: WizardNode[] = [];
  const members: WizardMember[] = [];
  let nId = 1, mId = 1;
  const nodeMap = new Map<string, string>();

  for (let floor = 0; floor <= nStories; floor++) {
    for (let bay = 0; bay < nBays; bay++) {
      const theta = (2 * Math.PI * bay) / nBays;
      const id = 'N' + (nId++);
      nodeMap.set(`${floor}-${bay}`, id);
      nodes.push({ id, x: R * Math.cos(theta), y: (floor / nStories) * H, z: R * Math.sin(theta) });
    }
  }
  for (let floor = 0; floor < nStories; floor++) {
    for (let bay = 0; bay < nBays; bay++) {
      members.push({ id: 'M' + (mId++), startNodeId: nodeMap.get(`${floor}-${bay}`)!, endNodeId: nodeMap.get(`${floor + 1}-${bay}`)! });
    }
  }
  for (let floor = 1; floor <= nStories; floor++) {
    for (let bay = 0; bay < nBays; bay++) {
      members.push({ id: 'M' + (mId++), startNodeId: nodeMap.get(`${floor}-${bay}`)!, endNodeId: nodeMap.get(`${floor}-${(bay + 1) % nBays}`)! });
    }
  }
  return { nodes, members };
}

// ─── Spherical Surface ───────────────────────────────────────────────────────

export function generateSphericalSurface(params: {
  radius: number;
  nMeridional: number;
  nParallel: number;
}): WizardStructure {
  const { radius: R, nMeridional, nParallel } = params;
  const nodes: WizardNode[] = [];
  const members: WizardMember[] = [];
  let nId = 1, mId = 1;
  const nodeMap = new Map<string, string>();

  for (let i = 0; i <= nMeridional; i++) {
    const phi = (Math.PI * i) / nMeridional;
    for (let j = 0; j < nParallel; j++) {
      const theta = (2 * Math.PI * j) / nParallel;
      const id = 'N' + (nId++);
      nodeMap.set(`${i}-${j}`, id);
      nodes.push({ id, x: R * Math.sin(phi) * Math.cos(theta), y: R * Math.cos(phi), z: R * Math.sin(phi) * Math.sin(theta) });
    }
  }
  for (let i = 0; i < nMeridional; i++) {
    for (let j = 0; j < nParallel; j++) {
      members.push({ id: 'M' + (mId++), startNodeId: nodeMap.get(`${i}-${j}`)!, endNodeId: nodeMap.get(`${i + 1}-${j}`)! });
    }
  }
  for (let i = 1; i < nMeridional; i++) {
    for (let j = 0; j < nParallel; j++) {
      members.push({ id: 'M' + (mId++), startNodeId: nodeMap.get(`${i}-${j}`)!, endNodeId: nodeMap.get(`${i}-${(j + 1) % nParallel}`)! });
    }
  }
  return { nodes, members };
}

// ─── Unified generator for testing ──────────────────────────────────────────

export type TemplateId = 'kingPost' | 'queenPost' | 'scissors' | 'cylindrical' | 'spherical';

export function generateTemplate(
  template: TemplateId,
  params: Record<string, number>,
): WizardStructure {
  switch (template) {
    case 'kingPost':
      return generateKingPost({ span: params.span ?? 8, rise: params.rise ?? 2 });
    case 'queenPost':
      return generateQueenPost({ span: params.span ?? 10, rise: params.rise ?? 2.5 });
    case 'scissors':
      return generateScissorsTruss({ span: params.span ?? 10, rise: params.rise ?? 3, vaultHeight: params.vaultHeight });
    case 'cylindrical':
      return generateCylindricalFrame({
        radius: params.radius ?? 6,
        height: params.height ?? 10,
        nBays: Math.max(3, params.panels ?? 6),
        nStories: Math.max(1, params.nStories ?? 3),
      });
    case 'spherical':
      return generateSphericalSurface({
        radius: params.radius ?? 8,
        nMeridional: Math.max(3, params.panels ?? 6),
        nParallel: Math.max(3, params.nParallel ?? 8),
      });
    default:
      return { nodes: [], members: [] };
  }
}
