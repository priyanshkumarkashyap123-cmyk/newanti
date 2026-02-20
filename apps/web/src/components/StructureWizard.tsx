/**
 * StructureWizard.tsx - Modern Parametric Structure Generator
 *
 * Generates ready-to-analyze structures with geometry + supports + default loads.
 * Templates include the most common structural analysis cases.
 */

import { FC, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Check, Sparkles, Triangle, Building2, Factory,
    Columns, Grid3X3, Ruler, ArrowDown, Zap
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type StructureCategory = 'beam' | 'truss' | 'frame';

interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean; fy: boolean; fz: boolean;
        mx: boolean; my: boolean; mz: boolean;
    };
}

interface GeneratedMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    type: 'beam' | 'column' | 'brace';
    sectionId?: string;
    E?: number;
    A?: number;
    I?: number;
}

interface GeneratedLoad {
    id: string;
    nodeId?: string;
    memberId?: string;
    type: 'nodal' | 'UDL' | 'point';
    fx?: number;
    fy?: number;
    fz?: number;
    w1?: number;
    w2?: number;
    P?: number;
    a?: number;
    direction?: string;
}

export interface GeneratedStructure {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
    loads: GeneratedLoad[];
    memberLoads: GeneratedLoad[];
    name: string;
}

interface StructureWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (structure: GeneratedStructure) => void;
}

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

interface TemplateConfig {
    id: string;
    category: StructureCategory;
    name: string;
    description: string;
    icon: any;
    color: string;
    bgColor: string;
    params: ParamDef[];
    generate: (params: Record<string, number>) => GeneratedStructure;
}

interface ParamDef {
    key: string;
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    default: number;
}

// ============================================
// MATERIAL DEFAULTS (Steel ISMB 300)
// ============================================

const STEEL = { E: 200e6, A: 0.00478, I: 8.603e-5 };
const STEEL_COL = { E: 200e6, A: 0.00785, I: 1.696e-4 };
const STEEL_BRACE = { E: 200e6, A: 0.00217, I: 2.88e-5 };

// ============================================
// GENERATORS
// ============================================

function genSimplySupported(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const w = p.udl;
    const nSeg = Math.max(Math.round(L), 4);
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    for (let i = 0; i <= nSeg; i++) {
        const x = (i / nSeg) * L;
        const node: GeneratedNode = { id: 'N' + (i + 1), x, y: 0, z: 0 };
        if (i === 0) {
            node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        } else if (i === nSeg) {
            node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        }
        nodes.push(node);
    }

    for (let i = 0; i < nSeg; i++) {
        members.push({
            id: 'M' + (i + 1),
            startNodeId: 'N' + (i + 1),
            endNodeId: 'N' + (i + 2),
            type: 'beam', ...STEEL
        });
    }

    if (w !== 0) {
        const segLen = L / nSeg;
        for (let i = 0; i <= nSeg; i++) {
            const tributary = (i === 0 || i === nSeg) ? segLen / 2 : segLen;
            loads.push({ id: 'L' + (i + 1), nodeId: 'N' + (i + 1), type: 'nodal', fy: -w * tributary });
        }
        for (let i = 0; i < nSeg; i++) {
            memberLoads.push({
                id: 'ML' + (i + 1), memberId: 'M' + (i + 1), type: 'UDL',
                w1: -w, w2: -w, direction: 'global_y',
            });
        }
    }

    return { nodes, members, loads, memberLoads, name: 'Simply Supported Beam (' + L + 'm, ' + w + ' kN/m)' };
}

function genCantilever(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const P = p.tipLoad;
    const nSeg = Math.max(Math.round(L), 4);
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];

    for (let i = 0; i <= nSeg; i++) {
        const x = (i / nSeg) * L;
        const node: GeneratedNode = { id: 'N' + (i + 1), x, y: 0, z: 0 };
        if (i === 0) {
            node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
        }
        nodes.push(node);
    }

    for (let i = 0; i < nSeg; i++) {
        members.push({ id: 'M' + (i + 1), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'beam', ...STEEL });
    }

    if (P !== 0) {
        loads.push({ id: 'L1', nodeId: 'N' + (nSeg + 1), type: 'nodal', fy: -P });
    }

    return { nodes, members, loads, memberLoads: [], name: 'Cantilever (' + L + 'm, P=' + P + ' kN)' };
}

function genContinuousBeam(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const nSpans = Math.round(p.spans);
    const w = p.udl;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];
    let nId = 1;
    let mId = 1;

    const segPerSpan = Math.max(4, Math.round(L));
    const totalSeg = segPerSpan * nSpans;

    for (let i = 0; i <= totalSeg; i++) {
        const x = (i / totalSeg) * L * nSpans;
        const node: GeneratedNode = { id: 'N' + (nId++), x, y: 0, z: 0 };
        if (i % segPerSpan === 0) {
            if (i === 0) {
                node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
            } else {
                node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
            }
        }
        nodes.push(node);
    }

    for (let i = 0; i < totalSeg; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'beam', ...STEEL });
    }

    if (w !== 0) {
        const segLen = (L * nSpans) / totalSeg;
        for (let i = 0; i <= totalSeg; i++) {
            const tributary = (i === 0 || i === totalSeg) ? segLen / 2 : segLen;
            loads.push({ id: 'L' + (i + 1), nodeId: 'N' + (i + 1), type: 'nodal', fy: -w * tributary });
        }
        for (let i = 0; i < totalSeg; i++) {
            memberLoads.push({
                id: 'ML' + (mId + i), memberId: 'M' + (i + 1), type: 'UDL',
                w1: -w, w2: -w, direction: 'global_y',
            });
        }
    }

    return { nodes, members, loads, memberLoads, name: 'Continuous Beam (' + nSpans + 'x' + L + 'm, ' + w + ' kN/m)' };
}

function genPortalFrame(p: Record<string, number>): GeneratedStructure {
    const span = p.span;
    const height = p.height;
    const w = p.udl;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];

    const eaveH = height * 0.75;
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: 0, y: eaveH, z: 0 },
        { id: 'N3', x: span / 2, y: height, z: 0 },
        { id: 'N4', x: span, y: eaveH, z: 0 },
        { id: 'N5', x: span, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
    );

    members.push(
        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'column', ...STEEL_COL },
        { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', type: 'beam', ...STEEL },
        { id: 'M3', startNodeId: 'N3', endNodeId: 'N4', type: 'beam', ...STEEL },
        { id: 'M4', startNodeId: 'N4', endNodeId: 'N5', type: 'column', ...STEEL_COL },
    );

    if (w !== 0) {
        const totalLoad = w * span;
        loads.push(
            { id: 'L1', nodeId: 'N2', type: 'nodal', fy: -totalLoad / 4 },
            { id: 'L2', nodeId: 'N3', type: 'nodal', fy: -totalLoad / 2 },
            { id: 'L3', nodeId: 'N4', type: 'nodal', fy: -totalLoad / 4 },
        );
    }

    return { nodes, members, loads, memberLoads: [], name: 'Portal Frame (' + span + 'm x ' + height + 'm)' };
}

function genBuildingFrame(p: Record<string, number>): GeneratedStructure {
    const nStorys = Math.round(p.stories);
    const nBaysX = Math.round(p.baysX);
    const nBaysY = Math.round(p.baysY);
    const storyH = p.storyHeight;
    const bayW = p.bayWidth;
    const w = p.floorLoad;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    let nId = 1, mId = 1;
    const nodeMap = new Map<string, string>();
    const is3D = nBaysY > 0;

    for (let floor = 0; floor <= nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix <= nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                const id = 'N' + (nId++);
                const key = floor + '-' + ix + '-' + iy;
                nodeMap.set(key, id);
                const node: GeneratedNode = { id, x: ix * bayW, y: floor * storyH, z: is3D ? iy * bayW : 0 };
                if (floor === 0) {
                    node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
                }
                nodes.push(node);
            }
        }
    }

    for (let floor = 0; floor < nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix <= nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                members.push({
                    id: 'M' + (mId++),
                    startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                    endNodeId: nodeMap.get((floor + 1) + '-' + ix + '-' + iy)!,
                    type: 'column', ...STEEL_COL
                });
            }
        }
    }

    for (let floor = 1; floor <= nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix < nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                members.push({
                    id: 'M' + (mId++),
                    startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                    endNodeId: nodeMap.get(floor + '-' + (ix + 1) + '-' + iy)!,
                    type: 'beam', ...STEEL
                });
            }
        }
    }

    if (is3D) {
        for (let floor = 1; floor <= nStorys; floor++) {
            for (let ix = 0; ix <= nBaysX; ix++) {
                for (let iy = 0; iy < nBaysY; iy++) {
                    members.push({
                        id: 'M' + (mId++),
                        startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                        endNodeId: nodeMap.get(floor + '-' + ix + '-' + (iy + 1))!,
                        type: 'beam', ...STEEL
                    });
                }
            }
        }
    }

    if (w !== 0) {
        for (let floor = 1; floor <= nStorys; floor++) {
            const yMax = is3D ? nBaysY : 0;
            for (let ix = 0; ix <= nBaysX; ix++) {
                for (let iy = 0; iy <= yMax; iy++) {
                    const txRatio = (ix === 0 || ix === nBaysX) ? 0.5 : 1;
                    const tyRatio = is3D ? ((iy === 0 || iy === yMax) ? 0.5 : 1) : 1;
                    const tributaryArea = bayW * txRatio * (is3D ? bayW * tyRatio : 1);
                    const nodeId = nodeMap.get(floor + '-' + ix + '-' + iy);
                    if (nodeId) {
                        loads.push({ id: 'L' + (loads.length + 1), nodeId, type: 'nodal', fy: -w * tributaryArea });
                    }
                }
            }
        }
    }

    const dimLabel = is3D ? (nBaysX + 'x' + nBaysY) : (nBaysX + '-bay');
    return { nodes, members, loads, memberLoads: [], name: nStorys + '-Story Building (' + dimLabel + ')' };
}

function genTruss(p: Record<string, number>): GeneratedStructure {
    const span = p.span;
    const height = p.height;
    const nPanels = Math.round(p.panels);
    const panelW = span / nPanels;
    const w = p.load;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    let nId = 1, mId = 1;

    for (let i = 0; i <= nPanels; i++) {
        const node: GeneratedNode = { id: 'N' + (nId++), x: i * panelW, y: 0, z: 0 };
        if (i === 0) node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        if (i === nPanels) node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        nodes.push(node);
    }

    for (let i = 0; i <= nPanels; i++) {
        nodes.push({ id: 'N' + (nId++), x: i * panelW, y: height, z: 0 });
    }

    for (let i = 0; i < nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'brace', ...STEEL_BRACE });
    }

    const topOff = nPanels + 1;
    for (let i = 0; i < nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (topOff + i + 1), endNodeId: 'N' + (topOff + i + 2), type: 'brace', ...STEEL_BRACE });
    }

    for (let i = 0; i <= nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (topOff + i + 1), type: 'brace', ...STEEL_BRACE });
    }

    for (let i = 0; i < nPanels; i++) {
        if (i % 2 === 0) {
            members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (topOff + i + 2), type: 'brace', ...STEEL_BRACE });
        } else {
            members.push({ id: 'M' + (mId++), startNodeId: 'N' + (topOff + i + 1), endNodeId: 'N' + (i + 2), type: 'brace', ...STEEL_BRACE });
        }
    }

    if (w !== 0) {
        for (let i = 0; i <= nPanels; i++) {
            const tributary = (i === 0 || i === nPanels) ? panelW / 2 : panelW;
            loads.push({ id: 'L' + (loads.length + 1), nodeId: 'N' + (topOff + i + 1), type: 'nodal', fy: -w * tributary });
        }
    }

    return { nodes, members, loads, memberLoads: [], name: 'Warren Truss (' + span + 'm, H=' + height + 'm)' };
}

function genProppedCantilever(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const w = p.udl;
    const nSeg = Math.max(Math.round(L), 4);
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    for (let i = 0; i <= nSeg; i++) {
        const x = (i / nSeg) * L;
        const node: GeneratedNode = { id: 'N' + (i + 1), x, y: 0, z: 0 };
        if (i === 0) {
            node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
        } else if (i === nSeg) {
            node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        }
        nodes.push(node);
    }

    for (let i = 0; i < nSeg; i++) {
        members.push({ id: 'M' + (i + 1), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'beam', ...STEEL });
    }

    if (w !== 0) {
        const segLen = L / nSeg;
        for (let i = 0; i <= nSeg; i++) {
            const tributary = (i === 0 || i === nSeg) ? segLen / 2 : segLen;
            loads.push({ id: 'L' + (i + 1), nodeId: 'N' + (i + 1), type: 'nodal', fy: -w * tributary });
        }
        for (let i = 0; i < nSeg; i++) {
            memberLoads.push({ id: 'ML' + (i + 1), memberId: 'M' + (i + 1), type: 'UDL', w1: -w, w2: -w, direction: 'global_y' });
        }
    }

    return { nodes, members, loads, memberLoads, name: 'Propped Cantilever (' + L + 'm, ' + w + ' kN/m)' };
}

function genFixedBeam(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const w = p.udl;
    const nSeg = Math.max(Math.round(L), 4);
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    for (let i = 0; i <= nSeg; i++) {
        const x = (i / nSeg) * L;
        const node: GeneratedNode = { id: 'N' + (i + 1), x, y: 0, z: 0 };
        if (i === 0 || i === nSeg) {
            node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
        }
        nodes.push(node);
    }

    for (let i = 0; i < nSeg; i++) {
        members.push({ id: 'M' + (i + 1), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'beam', ...STEEL });
    }

    if (w !== 0) {
        const segLen = L / nSeg;
        for (let i = 0; i <= nSeg; i++) {
            const tributary = (i === 0 || i === nSeg) ? segLen / 2 : segLen;
            loads.push({ id: 'L' + (i + 1), nodeId: 'N' + (i + 1), type: 'nodal', fy: -w * tributary });
        }
        for (let i = 0; i < nSeg; i++) {
            memberLoads.push({ id: 'ML' + (i + 1), memberId: 'M' + (i + 1), type: 'UDL', w1: -w, w2: -w, direction: 'global_y' });
        }
    }

    return { nodes, members, loads, memberLoads, name: 'Fixed Beam (' + L + 'm, ' + w + ' kN/m)' };
}

// ============================================
// TEMPLATE REGISTRY
// ============================================

const TEMPLATES: TemplateConfig[] = [
    {
        id: 'ss_beam', category: 'beam', name: 'Simply Supported Beam', icon: Ruler,
        description: 'Pin-roller beam with UDL - the classic benchmark',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 1, max: 30, step: 0.5, default: 6 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genSimplySupported,
    },
    {
        id: 'cantilever', category: 'beam', name: 'Cantilever Beam', icon: ArrowDown,
        description: 'Fixed support with tip point load',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Length', unit: 'm', min: 1, max: 20, step: 0.5, default: 4 },
            { key: 'tipLoad', label: 'Tip Load', unit: 'kN', min: 0, max: 200, step: 5, default: 20 },
        ],
        generate: genCantilever,
    },
    {
        id: 'fixed_beam', category: 'beam', name: 'Fixed Beam', icon: Columns,
        description: 'Both ends fixed with UDL',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 1, max: 30, step: 0.5, default: 6 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genFixedBeam,
    },
    {
        id: 'propped_cantilever', category: 'beam', name: 'Propped Cantilever', icon: ArrowDown,
        description: 'Fixed + roller support with UDL',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 1, max: 30, step: 0.5, default: 6 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genProppedCantilever,
    },
    {
        id: 'continuous', category: 'beam', name: 'Continuous Beam', icon: Grid3X3,
        description: 'Multi-span beam with intermediate supports',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span per bay', unit: 'm', min: 2, max: 15, step: 0.5, default: 5 },
            { key: 'spans', label: 'Number of spans', unit: '', min: 2, max: 6, step: 1, default: 3 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genContinuousBeam,
    },
    {
        id: 'truss', category: 'truss', name: 'Warren Truss', icon: Triangle,
        description: 'Alternating diagonals - balanced and efficient',
        color: 'text-amber-400', bgColor: 'bg-amber-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 6, max: 60, step: 2, default: 24 },
            { key: 'height', label: 'Height', unit: 'm', min: 1, max: 10, step: 0.5, default: 4 },
            { key: 'panels', label: 'Panels', unit: '', min: 4, max: 16, step: 1, default: 6 },
            { key: 'load', label: 'Top chord UDL', unit: 'kN/m', min: 0, max: 50, step: 1, default: 5 },
        ],
        generate: genTruss,
    },
    {
        id: 'portal', category: 'frame', name: 'Portal Frame', icon: Factory,
        description: 'Industrial shed with pitched roof',
        color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 6, max: 40, step: 1, default: 15 },
            { key: 'height', label: 'Ridge Height', unit: 'm', min: 4, max: 15, step: 0.5, default: 8 },
            { key: 'udl', label: 'Roof Load', unit: 'kN/m', min: 0, max: 30, step: 1, default: 5 },
        ],
        generate: genPortalFrame,
    },
    {
        id: 'building', category: 'frame', name: 'Multi-Story Frame', icon: Building2,
        description: 'Steel frame building - set baysY=0 for pure 2D',
        color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        params: [
            { key: 'stories', label: 'Stories', unit: '', min: 1, max: 15, step: 1, default: 3 },
            { key: 'baysX', label: 'Bays X', unit: '', min: 1, max: 8, step: 1, default: 2 },
            { key: 'baysY', label: 'Bays Y (0=2D)', unit: '', min: 0, max: 6, step: 1, default: 0 },
            { key: 'storyHeight', label: 'Story Height', unit: 'm', min: 2.5, max: 5, step: 0.5, default: 3.5 },
            { key: 'bayWidth', label: 'Bay Width', unit: 'm', min: 3, max: 10, step: 0.5, default: 6 },
            { key: 'floorLoad', label: 'Floor Load', unit: 'kN/m2', min: 0, max: 20, step: 1, default: 5 },
        ],
        generate: genBuildingFrame,
    },
];

const CATEGORY_INFO: Record<StructureCategory, { name: string; icon: any; color: string }> = {
    beam: { name: 'Beams', icon: Ruler, color: 'text-emerald-400' },
    truss: { name: 'Trusses', icon: Triangle, color: 'text-amber-400' },
    frame: { name: 'Frames', icon: Building2, color: 'text-blue-400' },
};

// ============================================
// SVG PREVIEW
// ============================================

function StructurePreview({ structure }: { structure: GeneratedStructure | null }) {
    if (!structure || structure.nodes.length === 0) {
        return (
            <div className="w-full h-48 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-500 text-sm">
                Configure parameters to see preview
            </div>
        );
    }

    const xs = structure.nodes.map(n => n.x);
    const ys = structure.nodes.map(n => n.y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const pad = 40;
    const W = 400, H = 200;
    const rangeX = xMax - xMin || 1;
    const rangeY = yMax - yMin || 1;
    const scale = Math.min((W - 2 * pad) / rangeX, (H - 2 * pad) / rangeY);

    const tx = (x: number) => pad + (x - xMin) * scale + ((W - 2 * pad) - rangeX * scale) / 2;
    const ty = (y: number) => H - pad - (y - yMin) * scale - ((H - 2 * pad) - rangeY * scale) / 2;

    const nodeById = new Map(structure.nodes.map(n => [n.id, n]));

    return (
        <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full h-48 rounded-xl bg-slate-800/60 border border-slate-700/50">
            {structure.members.map(m => {
                const n1 = nodeById.get(m.startNodeId);
                const n2 = nodeById.get(m.endNodeId);
                if (!n1 || !n2) return null;
                const col = m.type === 'column' ? '#60a5fa' : m.type === 'brace' ? '#fbbf24' : '#34d399';
                return (
                    <line key={m.id} x1={tx(n1.x)} y1={ty(n1.y)} x2={tx(n2.x)} y2={ty(n2.y)}
                        stroke={col} strokeWidth={2} strokeLinecap="round" />
                );
            })}
            {structure.nodes.map(n => {
                const hasSupport = n.restraints && (n.restraints.fx || n.restraints.fy);
                return (
                    <g key={n.id}>
                        <circle cx={tx(n.x)} cy={ty(n.y)} r={hasSupport ? 5 : 3}
                            fill={hasSupport ? '#f97316' : '#94a3b8'} />
                        {hasSupport && (
                            <polygon
                                points={tx(n.x) + ',' + (ty(n.y) + 6) + ' ' + (tx(n.x) - 7) + ',' + (ty(n.y) + 16) + ' ' + (tx(n.x) + 7) + ',' + (ty(n.y) + 16)}
                                fill="none" stroke="#f97316" strokeWidth={1.5}
                            />
                        )}
                    </g>
                );
            })}
            {structure.loads.filter(l => l.fy && Math.abs(l.fy) > 0.01).slice(0, 20).map((l, i) => {
                const node = nodeById.get(l.nodeId || '');
                if (!node) return null;
                const cx = tx(node.x);
                const cy = ty(node.y);
                const dir = (l.fy || 0) < 0 ? 1 : -1;
                return (
                    <g key={'load-' + i}>
                        <line x1={cx} y1={cy - 18 * dir} x2={cx} y2={cy - 4 * dir} stroke="#ef4444" strokeWidth={1.5} />
                        <polygon points={cx + ',' + (cy - 2 * dir) + ' ' + (cx - 3) + ',' + (cy - 7 * dir) + ' ' + (cx + 3) + ',' + (cy - 7 * dir)} fill="#ef4444" />
                    </g>
                );
            })}
        </svg>
    );
}

// ============================================
// MAIN COMPONENT
// ============================================

export const StructureWizard: FC<StructureWizardProps> = ({ isOpen, onClose, onGenerate }) => {
    const [selectedCategory, setSelectedCategory] = useState<StructureCategory>('beam');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ss_beam');
    const [paramValues, setParamValues] = useState<Record<string, number>>({});

    const categoryTemplates = useMemo(
        () => TEMPLATES.filter(t => t.category === selectedCategory),
        [selectedCategory]
    );

    const template = useMemo(
        () => TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0],
        [selectedTemplateId]
    );

    const effectiveParams = useMemo(() => {
        const defaults: Record<string, number> = {};
        template.params.forEach(p => { defaults[p.key] = p.default; });
        return { ...defaults, ...paramValues };
    }, [template, paramValues]);

    const preview = useMemo(() => {
        try {
            return template.generate(effectiveParams);
        } catch {
            return null;
        }
    }, [template, effectiveParams]);

    const stats = useMemo(() => {
        if (!preview) return null;
        const totalLoad = preview.loads.reduce((s, l) => s + Math.abs(l.fy || 0), 0);
        return {
            nodes: preview.nodes.length,
            members: preview.members.length,
            supports: preview.nodes.filter(n => n.restraints && (n.restraints.fx || n.restraints.fy)).length,
            totalLoad: totalLoad.toFixed(1),
        };
    }, [preview]);

    const handleSelectCategory = useCallback((cat: StructureCategory) => {
        setSelectedCategory(cat);
        const first = TEMPLATES.find(t => t.category === cat);
        if (first) {
            setSelectedTemplateId(first.id);
            setParamValues({});
        }
    }, []);

    const handleSelectTemplate = useCallback((id: string) => {
        setSelectedTemplateId(id);
        setParamValues({});
    }, []);

    const handleParamChange = useCallback((key: string, value: number) => {
        setParamValues(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleGenerate = useCallback(() => {
        if (preview) {
            onGenerate(preview);
            onClose();
        }
    }, [preview, onGenerate, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Structure Wizard</h2>
                                <p className="text-xs text-slate-400">Choose a template, configure and generate</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Category Tabs */}
                        <div className="flex gap-2">
                            {(Object.keys(CATEGORY_INFO) as StructureCategory[]).filter(c => TEMPLATES.some(t => t.category === c)).map(cat => {
                                const info = CATEGORY_INFO[cat];
                                const Icon = info.icon;
                                const active = selectedCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => handleSelectCategory(cat)}
                                        className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ' +
                                            (active
                                                ? 'bg-white/10 text-white border border-white/20 shadow-lg'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent')
                                        }
                                    >
                                        <Icon className={'w-4 h-4 ' + (active ? info.color : '')} />
                                        {info.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Template Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {categoryTemplates.map(tmpl => {
                                const Icon = tmpl.icon;
                                const active = selectedTemplateId === tmpl.id;
                                return (
                                    <button
                                        key={tmpl.id}
                                        onClick={() => handleSelectTemplate(tmpl.id)}
                                        className={'relative p-4 rounded-xl border text-left transition-all group ' +
                                            (active
                                                ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                                                : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70')
                                        }
                                    >
                                        <Icon className={'w-6 h-6 mb-2 ' + (active ? tmpl.color : 'text-slate-500 group-hover:text-slate-300')} />
                                        <h4 className="text-white font-semibold text-sm">{tmpl.name}</h4>
                                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{tmpl.description}</p>
                                        {active && (
                                            <div className="absolute top-2 right-2">
                                                <Check className="w-4 h-4 text-emerald-400" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Parameters + Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-400" /> Parameters
                                </h3>
                                <div className="space-y-3 bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                                    {template.params.map(p => (
                                        <div key={p.key}>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-slate-400">{p.label}</label>
                                                <span className="text-xs font-mono text-slate-300">
                                                    {effectiveParams[p.key]}{p.unit ? (' ' + p.unit) : ''}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={p.min}
                                                max={p.max}
                                                step={p.step}
                                                value={effectiveParams[p.key]}
                                                onChange={e => handleParamChange(p.key, parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                                <span>{p.min}{p.unit ? (' ' + p.unit) : ''}</span>
                                                <span>{p.max}{p.unit ? (' ' + p.unit) : ''}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {stats && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Nodes', value: String(stats.nodes) },
                                            { label: 'Members', value: String(stats.members) },
                                            { label: 'Supports', value: String(stats.supports) },
                                            { label: 'Total Load', value: stats.totalLoad + ' kN' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700/30">
                                                <div className="text-sm font-bold text-white">{s.value}</div>
                                                <div className="text-[10px] text-slate-400">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-300">Live Preview</h3>
                                <StructurePreview structure={preview} />
                                {preview && (
                                    <p className="text-xs text-slate-500 text-center">{preview.name}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={!preview}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl flex items-center gap-2 shadow-lg transition-all"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate and Load
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default StructureWizard;
