/**
 * StructureWizard.tsx - Industry-Standard Parametric Structure Generator
 *
 * Generates ready-to-analyze structures following structural engineering conventions:
 * - One member per structural element (beam span, column lift, brace)
 * - Nodes only at support, connection, and load application points
 * - Distributed loads applied as member loads (UDL/UVL), not lumped nodal approximations
 * - Standard Indian/International steel section properties
 * - Support conditions per IS 800 / AISC 360 conventions
 *
 * References:
 * - IS 800:2007 - General construction in steel
 * - IS 875 Part 1-5 - Code of practice for design loads
 * - IS 1893:2016 - Seismic design criteria
 * - AISC 360-22 - Specification for Structural Steel Buildings
 */

import React from 'react';
import { FC, useState, useMemo, useCallback } from 'react';
import {
    Check, Sparkles, Triangle, Building2, Factory,
    Columns, Grid3X3, Ruler, ArrowDown, Zap, Shield
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';

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
// STANDARD SECTION PROPERTIES (IS 808)
// ============================================
// Each section: { E: Young's modulus (kN/m²), A: area (m²), I: Ixx (m⁴) }
// E = 200 GPa = 200e6 kN/m²

// ISMB 300: Standard I-beam for typical floor beams (span 4-8m)
const BEAM_ISMB300 = { E: 200e6, A: 0.00478, I: 8.603e-5 };
// ISMB 400: Heavy beam for longer spans / higher loads (span 6-12m)
const BEAM_ISMB400 = { E: 200e6, A: 0.00786, I: 2.0458e-4 };
// ISHB 300: Column section for low-rise frames (up to 5 stories)
const COL_ISHB300 = { E: 200e6, A: 0.00785, I: 1.2545e-4 };
// ISHB 400: Column section for medium-rise frames (5-10 stories)
const COL_ISHB400 = { E: 200e6, A: 0.01071, I: 2.8080e-4 };
// ISA 150x150x12: Equal angle for truss members and bracing
const BRACE_ISA150 = { E: 200e6, A: 0.003459, I: 7.18e-6 };
// Pipe 168.3x6.3: CHS for truss chords
const TRUSS_CHS168 = { E: 200e6, A: 0.003206, I: 1.087e-5 };

// Legacy aliases (backward compatibility)
const STEEL = BEAM_ISMB300;
const STEEL_BRACE = BRACE_ISA150;

// ============================================
// GENERATORS
// ============================================

function genSimplySupported(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const w = p.udl;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    // Industry standard: single beam member between two support nodes
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } },
        { id: 'N2', x: L, y: 0, z: 0, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } },
    );

    members.push({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', ...STEEL });

    if (w !== 0) {
        memberLoads.push({
            id: 'ML1', memberId: 'M1', type: 'UDL',
            w1: -w, w2: -w, direction: 'global_y',
        });
    }

    return { nodes, members, loads, memberLoads, name: 'Simply Supported Beam (' + L + 'm, ' + w + ' kN/m)' };
}

function genCantilever(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const P = p.tipLoad;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];

    // Industry standard: single cantilever member, fixed at root, free at tip
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: L, y: 0, z: 0 },
    );

    members.push({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', ...STEEL });

    if (P !== 0) {
        loads.push({ id: 'L1', nodeId: 'N2', type: 'nodal', fy: -P });
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

    // Industry standard: one node per support, one member per span
    for (let i = 0; i <= nSpans; i++) {
        const node: GeneratedNode = { id: 'N' + (i + 1), x: i * L, y: 0, z: 0 };
        if (i === 0) {
            node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        } else {
            node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        }
        nodes.push(node);
    }

    for (let i = 0; i < nSpans; i++) {
        members.push({
            id: 'M' + (i + 1),
            startNodeId: 'N' + (i + 1),
            endNodeId: 'N' + (i + 2),
            type: 'beam', ...STEEL
        });
    }

    if (w !== 0) {
        for (let i = 0; i < nSpans; i++) {
            memberLoads.push({
                id: 'ML' + (i + 1), memberId: 'M' + (i + 1), type: 'UDL',
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
    const memberLoads: GeneratedLoad[] = [];

    // Industry standard portal frame geometry:
    // - Rigid base connections (fixed) per IS 800 Clause 12
    // - Eave height at 75% of ridge height (typical pitch ~15°)
    // - Haunch at eave-knee connections implied by rigid joints
    const eaveH = height * 0.75;
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: 0, y: eaveH, z: 0 },
        { id: 'N3', x: span / 2, y: height, z: 0 },
        { id: 'N4', x: span, y: eaveH, z: 0 },
        { id: 'N5', x: span, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
    );

    members.push(
        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'column', ...COL_ISHB300 },
        { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', type: 'beam', ...BEAM_ISMB400 },
        { id: 'M3', startNodeId: 'N3', endNodeId: 'N4', type: 'beam', ...BEAM_ISMB400 },
        { id: 'M4', startNodeId: 'N4', endNodeId: 'N5', type: 'column', ...COL_ISHB300 },
    );

    // UDL applied as member loads on the rafter members (projected load, per IS 875)
    // w is given as kN/m on horizontal projection; applied to rafter members directly
    if (w !== 0) {
        memberLoads.push(
            { id: 'ML1', memberId: 'M2', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' },
            { id: 'ML2', memberId: 'M3', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' },
        );
    }

    return { nodes, members, loads, memberLoads, name: 'Portal Frame (' + span + 'm x ' + height + 'm)' };
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
    const memberLoads: GeneratedLoad[] = [];
    let nId = 1, mId = 1, mlId = 1;
    const nodeMap = new Map<string, string>();
    const is3D = nBaysY > 0;

    // --- NODE GENERATION ---
    // One node per column-beam intersection (industry standard grid)
    for (let floor = 0; floor <= nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix <= nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                const id = 'N' + (nId++);
                const key = floor + '-' + ix + '-' + iy;
                nodeMap.set(key, id);
                const node: GeneratedNode = { id, x: ix * bayW, y: floor * storyH, z: is3D ? iy * bayW : 0 };
                if (floor === 0) {
                    // Fixed base per IS 800 Clause 12 / AISC base plate design
                    node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
                }
                nodes.push(node);
            }
        }
    }

    // --- COLUMN MEMBERS ---
    // Use heavier section for taller buildings (>5 stories)
    const colProps = nStorys > 5 ? COL_ISHB400 : COL_ISHB300;
    for (let floor = 0; floor < nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix <= nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                members.push({
                    id: 'M' + (mId++),
                    startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                    endNodeId: nodeMap.get((floor + 1) + '-' + ix + '-' + iy)!,
                    type: 'column', ...colProps
                });
            }
        }
    }

    // --- BEAM MEMBERS (X-direction) ---
    // Using ISMB 400 for longer bays, ISMB 300 for shorter
    const beamProps = bayW >= 8 ? BEAM_ISMB400 : BEAM_ISMB300;
    const beamMemberIds: { memberId: string; floor: number }[] = [];
    for (let floor = 1; floor <= nStorys; floor++) {
        const yMax = is3D ? nBaysY : 0;
        for (let ix = 0; ix < nBaysX; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                const memberId = 'M' + (mId++);
                members.push({
                    id: memberId,
                    startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                    endNodeId: nodeMap.get(floor + '-' + (ix + 1) + '-' + iy)!,
                    type: 'beam', ...beamProps
                });
                beamMemberIds.push({ memberId, floor });
            }
        }
    }

    // --- BEAM MEMBERS (Y-direction for 3D) ---
    if (is3D) {
        for (let floor = 1; floor <= nStorys; floor++) {
            for (let ix = 0; ix <= nBaysX; ix++) {
                for (let iy = 0; iy < nBaysY; iy++) {
                    const memberId = 'M' + (mId++);
                    members.push({
                        id: memberId,
                        startNodeId: nodeMap.get(floor + '-' + ix + '-' + iy)!,
                        endNodeId: nodeMap.get(floor + '-' + ix + '-' + (iy + 1))!,
                        type: 'beam', ...beamProps
                    });
                    beamMemberIds.push({ memberId, floor });
                }
            }
        }
    }

    // --- GRAVITY LOADS (UDL on beams per IS 875) ---
    // Floor load applied as UDL on each beam, using tributary width
    // For 2D frames: full tributary width = bayWidth (slab spanning one way)
    // For 3D frames: each beam carries tributary width = bayWidth/2 from each side
    if (w !== 0) {
        const tributaryWidth = is3D ? bayW / 2 : 1; // 3D: half bay each side; 2D: per meter run
        const udlIntensity = w * tributaryWidth; // kN/m on beam

        for (const { memberId } of beamMemberIds) {
            memberLoads.push({
                id: 'ML' + (mlId++), memberId, type: 'UDL',
                w1: -udlIntensity, w2: -udlIntensity, direction: 'global_y',
            });
        }
    }

    const dimLabel = is3D ? (nBaysX + 'x' + nBaysY) : (nBaysX + '-bay');
    return { nodes, members, loads, memberLoads, name: nStorys + '-Story Building (' + dimLabel + ')' };
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
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    // Industry standard: single member, fixed end + roller end
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: L, y: 0, z: 0, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } },
    );

    members.push({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', ...STEEL });

    if (w !== 0) {
        memberLoads.push({ id: 'ML1', memberId: 'M1', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' });
    }

    return { nodes, members, loads, memberLoads, name: 'Propped Cantilever (' + L + 'm, ' + w + ' kN/m)' };
}

function genFixedBeam(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const w = p.udl;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    // Industry standard: single member, both ends fixed
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: L, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
    );

    members.push({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', ...STEEL });

    if (w !== 0) {
        memberLoads.push({ id: 'ML1', memberId: 'M1', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' });
    }

    return { nodes, members, loads, memberLoads, name: 'Fixed Beam (' + L + 'm, ' + w + ' kN/m)' };
}

function genOverhangingBeam(p: Record<string, number>): GeneratedStructure {
    const L = p.span;
    const overhang = p.overhang;
    const w = p.udl;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];

    // Industry standard: pin at left, roller at right end of main span, free overhang tip
    // 3 nodes: left support, right support, overhang tip
    // 2 members: main span + overhang cantilever
    nodes.push(
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } },
        { id: 'N2', x: L, y: 0, z: 0, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } },
        { id: 'N3', x: L + overhang, y: 0, z: 0 },
    );

    members.push(
        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', ...BEAM_ISMB300 },
        { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', type: 'beam', ...BEAM_ISMB300 },
    );

    if (w !== 0) {
        memberLoads.push(
            { id: 'ML1', memberId: 'M1', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' },
            { id: 'ML2', memberId: 'M2', type: 'UDL', w1: -w, w2: -w, direction: 'global_y' },
        );
    }

    return { nodes, members, loads, memberLoads, name: 'Overhanging Beam (' + L + 'm + ' + overhang + 'm)' };
}

function genPrattTruss(p: Record<string, number>): GeneratedStructure {
    const span = p.span;
    const height = p.height;
    const nPanels = Math.round(p.panels);
    const panelW = span / nPanels;
    const w = p.load;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    let nId = 1, mId = 1;

    // Pratt truss: verticals + diagonals sloping toward center
    // Bottom chord nodes
    for (let i = 0; i <= nPanels; i++) {
        const node: GeneratedNode = { id: 'N' + (nId++), x: i * panelW, y: 0, z: 0 };
        if (i === 0) node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        if (i === nPanels) node.restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        nodes.push(node);
    }

    // Top chord nodes
    const topOff = nPanels + 1;
    for (let i = 0; i <= nPanels; i++) {
        nodes.push({ id: 'N' + (nId++), x: i * panelW, y: height, z: 0 });
    }

    // Bottom chord
    for (let i = 0; i < nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (i + 2), type: 'brace', ...TRUSS_CHS168 });
    }
    // Top chord
    for (let i = 0; i < nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (topOff + i + 1), endNodeId: 'N' + (topOff + i + 2), type: 'brace', ...TRUSS_CHS168 });
    }
    // Verticals
    for (let i = 0; i <= nPanels; i++) {
        members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (topOff + i + 1), type: 'brace', ...BRACE_ISA150 });
    }
    // Diagonals (Pratt pattern: diagonals slope toward center under gravity)
    const mid = nPanels / 2;
    for (let i = 0; i < nPanels; i++) {
        if (i < mid) {
            // Left half: diagonal from bottom-right to top-left (tension under gravity)
            members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 2), endNodeId: 'N' + (topOff + i + 1), type: 'brace', ...BRACE_ISA150 });
        } else {
            // Right half: diagonal from bottom-left to top-right (tension under gravity)
            members.push({ id: 'M' + (mId++), startNodeId: 'N' + (i + 1), endNodeId: 'N' + (topOff + i + 2), type: 'brace', ...BRACE_ISA150 });
        }
    }

    // Joint loads on top chord (purlin loads)
    if (w !== 0) {
        for (let i = 0; i <= nPanels; i++) {
            const tributary = (i === 0 || i === nPanels) ? panelW / 2 : panelW;
            loads.push({ id: 'L' + (loads.length + 1), nodeId: 'N' + (topOff + i + 1), type: 'nodal', fy: -w * tributary });
        }
    }

    return { nodes, members, loads, memberLoads: [], name: 'Pratt Truss (' + span + 'm, H=' + height + 'm)' };
}

function genBracedFrame(p: Record<string, number>): GeneratedStructure {
    const nStorys = Math.round(p.stories);
    const nBays = Math.round(p.bays);
    const storyH = p.storyHeight;
    const bayW = p.bayWidth;
    const w = p.floorLoad;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const loads: GeneratedLoad[] = [];
    const memberLoads: GeneratedLoad[] = [];
    let nId = 1, mId = 1, mlId = 1;
    const nodeMap = new Map<string, string>();

    // Concentrically Braced Frame (CBF) per IS 800 / AISC 341
    // X-bracing in all bays for maximum lateral stiffness

    // Nodes
    for (let floor = 0; floor <= nStorys; floor++) {
        for (let ix = 0; ix <= nBays; ix++) {
            const id = 'N' + (nId++);
            nodeMap.set(floor + '-' + ix, id);
            const node: GeneratedNode = { id, x: ix * bayW, y: floor * storyH, z: 0 };
            if (floor === 0) {
                node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
            }
            nodes.push(node);
        }
    }

    // Columns
    for (let floor = 0; floor < nStorys; floor++) {
        for (let ix = 0; ix <= nBays; ix++) {
            members.push({
                id: 'M' + (mId++),
                startNodeId: nodeMap.get(floor + '-' + ix)!,
                endNodeId: nodeMap.get((floor + 1) + '-' + ix)!,
                type: 'column', ...COL_ISHB300
            });
        }
    }

    // Beams
    const beamIds: string[] = [];
    for (let floor = 1; floor <= nStorys; floor++) {
        for (let ix = 0; ix < nBays; ix++) {
            const id = 'M' + (mId++);
            members.push({
                id,
                startNodeId: nodeMap.get(floor + '-' + ix)!,
                endNodeId: nodeMap.get(floor + '-' + (ix + 1))!,
                type: 'beam', ...BEAM_ISMB300
            });
            beamIds.push(id);
        }
    }

    // X-Bracing in each bay/story
    for (let floor = 0; floor < nStorys; floor++) {
        for (let ix = 0; ix < nBays; ix++) {
            // Diagonal 1: bottom-left to top-right
            members.push({
                id: 'M' + (mId++),
                startNodeId: nodeMap.get(floor + '-' + ix)!,
                endNodeId: nodeMap.get((floor + 1) + '-' + (ix + 1))!,
                type: 'brace', ...BRACE_ISA150
            });
            // Diagonal 2: bottom-right to top-left
            members.push({
                id: 'M' + (mId++),
                startNodeId: nodeMap.get(floor + '-' + (ix + 1))!,
                endNodeId: nodeMap.get((floor + 1) + '-' + ix)!,
                type: 'brace', ...BRACE_ISA150
            });
        }
    }

    // UDL on all beams (gravity load per IS 875)
    if (w !== 0) {
        for (const beamId of beamIds) {
            memberLoads.push({
                id: 'ML' + (mlId++), memberId: beamId, type: 'UDL',
                w1: -w, w2: -w, direction: 'global_y',
            });
        }
    }

    return { nodes, members, loads, memberLoads, name: nStorys + '-Story Braced Frame (' + nBays + '-bay)' };
}

// ============================================
// TEMPLATE REGISTRY
// ============================================

const TEMPLATES: TemplateConfig[] = [
    {
        id: 'ss_beam', category: 'beam', name: 'Simply Supported Beam', icon: Ruler,
        description: 'Pin-roller beam with UDL — the classic benchmark case',
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
        description: 'Both ends fixed with UDL — zero slope at supports',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 1, max: 30, step: 0.5, default: 6 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genFixedBeam,
    },
    {
        id: 'propped_cantilever', category: 'beam', name: 'Propped Cantilever', icon: ArrowDown,
        description: 'Fixed + roller support with UDL — one degree indeterminate',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 1, max: 30, step: 0.5, default: 6 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genProppedCantilever,
    },
    {
        id: 'overhanging', category: 'beam', name: 'Overhanging Beam', icon: Ruler,
        description: 'Pin-roller beam with cantilever overhang beyond one support',
        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
        params: [
            { key: 'span', label: 'Main Span', unit: 'm', min: 2, max: 20, step: 0.5, default: 6 },
            { key: 'overhang', label: 'Overhang', unit: 'm', min: 0.5, max: 8, step: 0.5, default: 2 },
            { key: 'udl', label: 'UDL Intensity', unit: 'kN/m', min: 0, max: 100, step: 1, default: 10 },
        ],
        generate: genOverhangingBeam,
    },
    {
        id: 'continuous', category: 'beam', name: 'Continuous Beam', icon: Grid3X3,
        description: 'Multi-span beam with intermediate supports — indeterminate',
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
        description: 'Alternating diagonals — balanced, efficient for uniform loads',
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
        id: 'pratt_truss', category: 'truss', name: 'Pratt Truss', icon: Triangle,
        description: 'Verticals + tension diagonals — optimal for gravity loads',
        color: 'text-amber-400', bgColor: 'bg-amber-500/10',
        params: [
            { key: 'span', label: 'Span', unit: 'm', min: 6, max: 60, step: 2, default: 24 },
            { key: 'height', label: 'Height', unit: 'm', min: 1, max: 10, step: 0.5, default: 4 },
            { key: 'panels', label: 'Panels', unit: '', min: 4, max: 16, step: 2, default: 6 },
            { key: 'load', label: 'Top chord UDL', unit: 'kN/m', min: 0, max: 50, step: 1, default: 5 },
        ],
        generate: genPrattTruss,
    },
    {
        id: 'portal', category: 'frame', name: 'Portal Frame', icon: Factory,
        description: 'Industrial shed with pitched roof — UDL on rafters',
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
        description: 'Moment-resisting frame — UDL on beams, set baysY=0 for 2D',
        color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        params: [
            { key: 'stories', label: 'Stories', unit: '', min: 1, max: 15, step: 1, default: 3 },
            { key: 'baysX', label: 'Bays X', unit: '', min: 1, max: 8, step: 1, default: 2 },
            { key: 'baysY', label: 'Bays Y (0=2D)', unit: '', min: 0, max: 6, step: 1, default: 0 },
            { key: 'storyHeight', label: 'Story Height', unit: 'm', min: 2.5, max: 5, step: 0.5, default: 3.5 },
            { key: 'bayWidth', label: 'Bay Width', unit: 'm', min: 3, max: 10, step: 0.5, default: 6 },
            { key: 'floorLoad', label: 'Floor Load', unit: 'kN/m²', min: 0, max: 20, step: 1, default: 5 },
        ],
        generate: genBuildingFrame,
    },
    {
        id: 'braced_frame', category: 'frame', name: 'Braced Frame', icon: Shield,
        description: 'X-braced CBF — lateral stiffness per IS 800 / AISC 341',
        color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        params: [
            { key: 'stories', label: 'Stories', unit: '', min: 1, max: 10, step: 1, default: 3 },
            { key: 'bays', label: 'Bays', unit: '', min: 1, max: 6, step: 1, default: 2 },
            { key: 'storyHeight', label: 'Story Height', unit: 'm', min: 2.5, max: 5, step: 0.5, default: 3.5 },
            { key: 'bayWidth', label: 'Bay Width', unit: 'm', min: 3, max: 10, step: 0.5, default: 6 },
            { key: 'floorLoad', label: 'Floor UDL', unit: 'kN/m', min: 0, max: 50, step: 1, default: 10 },
        ],
        generate: genBracedFrame,
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
            <div className="w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
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
    const isFinitePoint = (...vals: number[]) => vals.every(v => Number.isFinite(v));

    const nodeById = new Map(structure.nodes.map(n => [n.id, n]));
    const memberById = new Map(structure.members.map(m => [m.id, m]));

    return (
        <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {/* Member lines */}
            {structure.members.map(m => {
                const n1 = nodeById.get(m.startNodeId);
                const n2 = nodeById.get(m.endNodeId);
                if (!n1 || !n2) return null;
                const x1 = tx(n1.x), y1 = ty(n1.y), x2 = tx(n2.x), y2 = ty(n2.y);
                if (!isFinitePoint(x1, y1, x2, y2)) return null;
                const col = m.type === 'column' ? '#60a5fa' : m.type === 'brace' ? '#fbbf24' : '#34d399';
                return (
                    <line key={m.id} x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={col} strokeWidth={2} strokeLinecap="round" />
                );
            })}

            {/* UDL arrows on members (industry-standard distributed load visualization) */}
            {structure.memberLoads.filter(ml => ml.type === 'UDL' && ml.memberId).slice(0, 30).map((ml, i) => {
                const member = memberById.get(ml.memberId || '');
                if (!member) return null;
                const n1 = nodeById.get(member.startNodeId);
                const n2 = nodeById.get(member.endNodeId);
                if (!n1 || !n2) return null;

                const x1 = tx(n1.x), y1 = ty(n1.y), x2 = tx(n2.x), y2 = ty(n2.y);
                if (!isFinitePoint(x1, y1, x2, y2)) return null;
                const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                if (!Number.isFinite(len) || len < 1e-6) return null;
                const nArrows = Math.max(3, Math.min(8, Math.round(len / 15)));
                const dir = (ml.w1 || 0) < 0 ? 1 : -1; // positive screen-y = downward
                const arrowLen = 12;
                const offset = 6; // offset from member line

                // Direction perpendicular to member (for UDL arrows)
                const dx = (x2 - x1) / len;
                const dy = (y2 - y1) / len;
                // Normal perpendicular (pointing "up" relative to member)
                const nx = -dy;
                const ny = dx;

                const arrows = [];
                for (let j = 0; j <= nArrows; j++) {
                    const t = j / nArrows;
                    const ax = x1 + (x2 - x1) * t;
                    const ay = y1 + (y2 - y1) * t;
                    // Arrow base offset from member
                    const bx = ax + nx * (offset + arrowLen) * dir;
                    const by = ay + ny * (offset + arrowLen) * dir;
                    // Arrow tip near member
                    const tipX = ax + nx * offset * dir;
                    const tipY = ay + ny * offset * dir;
                    if (!isFinitePoint(bx, by, tipX, tipY)) continue;
                    arrows.push(
                        <line key={'udl-line-' + i + '-' + j} x1={bx} y1={by} x2={tipX} y2={tipY}
                            stroke="#ef4444" strokeWidth={1} opacity={0.7} />,
                        <polygon key={'udl-tip-' + i + '-' + j}
                            points={tipX + ',' + tipY + ' ' + (tipX + nx * 3 * dir - dx * 2) + ',' + (tipY + ny * 3 * dir - dy * 2) + ' ' + (tipX + nx * 3 * dir + dx * 2) + ',' + (tipY + ny * 3 * dir + dy * 2)}
                            fill="#ef4444" opacity={0.7} />
                    );
                }
                // Connecting line at top of arrows
                const topStartX = x1 + nx * (offset + arrowLen) * dir;
                const topStartY = y1 + ny * (offset + arrowLen) * dir;
                const topEndX = x2 + nx * (offset + arrowLen) * dir;
                const topEndY = y2 + ny * (offset + arrowLen) * dir;
                if (!isFinitePoint(topStartX, topStartY, topEndX, topEndY)) return null;

                return (
                    <g key={'udl-' + i}>
                        <line x1={topStartX} y1={topStartY} x2={topEndX} y2={topEndY}
                            stroke="#ef4444" strokeWidth={1} opacity={0.7} />
                        {arrows}
                    </g>
                );
            })}

            {/* Node dots and supports */}
            {structure.nodes.map(n => {
                const hasSupport = n.restraints && (n.restraints.fx || n.restraints.fy);
                const isFixed = n.restraints && n.restraints.mx;
                const cx = tx(n.x);
                const cy = ty(n.y);
                if (!isFinitePoint(cx, cy)) return null;
                return (
                    <g key={n.id}>
                        <circle cx={cx} cy={cy} r={hasSupport ? 5 : 3}
                            fill={hasSupport ? '#f97316' : '#94a3b8'} />
                        {hasSupport && !isFixed && (
                            <polygon
                                points={cx + ',' + (cy + 6) + ' ' + (cx - 7) + ',' + (cy + 16) + ' ' + (cx + 7) + ',' + (cy + 16)}
                                fill="none" stroke="#f97316" strokeWidth={1.5}
                            />
                        )}
                        {hasSupport && isFixed && (
                            <rect x={cx - 7} y={cy + 3} width={14} height={4}
                                fill="#f97316" opacity={0.8} />
                        )}
                    </g>
                );
            })}

            {/* Nodal point load arrows */}
            {structure.loads.filter(l => l.fy && Math.abs(l.fy) > 0.01).slice(0, 20).map((l, i) => {
                const node = nodeById.get(l.nodeId || '');
                if (!node) return null;
                const cx = tx(node.x);
                const cy = ty(node.y);
                if (!isFinitePoint(cx, cy)) return null;
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
        const nodalLoad = preview.loads.reduce((s, l) => s + Math.abs(l.fy || 0), 0);
        // Calculate total load from member UDLs  (w × L for each member)
        const nodeById = new Map(preview.nodes.map(n => [n.id, n]));
        const memberById = new Map(preview.members.map(m => [m.id, m]));
        let udlLoad = 0;
        for (const ml of preview.memberLoads) {
            if (ml.type === 'UDL' && ml.memberId) {
                const member = memberById.get(ml.memberId);
                if (member) {
                    const n1 = nodeById.get(member.startNodeId);
                    const n2 = nodeById.get(member.endNodeId);
                    if (n1 && n2) {
                        const L = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2 + (n2.z - n1.z) ** 2);
                        udlLoad += Math.abs(ml.w1 || 0) * L;
                    }
                }
            }
        }
        const totalLoad = nodalLoad + udlLoad;
        return {
            nodes: preview.nodes.length,
            members: preview.members.length,
            supports: preview.nodes.filter(n => n.restraints && (n.restraints.fx || n.restraints.fy)).length,
            loads: preview.loads.length + preview.memberLoads.length,
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Structure Wizard</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">Choose a template, configure and generate</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

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
                                            ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20 shadow-lg'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent')
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
                                            : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/70')
                                    }
                                >
                                    <Icon className={'w-6 h-6 mb-2 ' + (active ? tmpl.color : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300')} />
                                    <h4 className="text-slate-900 dark:text-white font-semibold text-sm">{tmpl.name}</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{tmpl.description}</p>
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
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-400" /> Parameters
                            </h3>
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700/40">
                                {template.params.map(p => (
                                    <div key={p.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <Label className="text-xs text-slate-500 dark:text-slate-400">{p.label}</Label>
                                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
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
                                            className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                                            <span>{p.min}{p.unit ? (' ' + p.unit) : ''}</span>
                                            <span>{p.max}{p.unit ? (' ' + p.unit) : ''}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {stats && (
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { label: 'Nodes', value: String(stats.nodes) },
                                        { label: 'Members', value: String(stats.members) },
                                        { label: 'Supports', value: String(stats.supports) },
                                        { label: 'Loads', value: String(stats.loads) },
                                        { label: 'Total Load', value: stats.totalLoad + ' kN' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700/30">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{s.value}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Live Preview</h3>
                            <StructurePreview structure={preview} />
                            {preview && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{preview.name}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/50 sm:justify-between">
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={!preview}
                        className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 disabled:from-slate-400 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-700 text-white font-semibold"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate and Load
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StructureWizard;
