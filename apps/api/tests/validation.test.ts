/**
 * Zod Validation Schema Tests
 *
 * Validates that all API input schemas correctly accept valid data
 * and reject malformed/malicious payloads. CRITICAL for a structural
 * engineering API where invalid inputs can produce dangerous results.
 */

import { describe, it, expect } from 'vitest';
import {
    analyzeRequestSchema,
    steelDesignSchema,
    concreteBeamSchema,
    concreteColumnSchema,
    connectionDesignSchema,
    foundationDesignSchema,
    pDeltaSchema,
    modalSchema,
    bucklingSchema,
} from '../src/middleware/validation.js';

// ============================================
// Analysis Schema
// ============================================

describe('analyzeRequestSchema', () => {
    const validPayload = {
        nodes: [
            { id: '1', x: 0, y: 0 },
            { id: '2', x: 5, y: 0 },
        ],
        members: [
            { id: '1', startNodeId: '1', endNodeId: '2' },
        ],
        loads: [
            { nodeId: '2', fy: -10000 },
        ],
    };

    it('should accept a valid analysis request', () => {
        const result = analyzeRequestSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
    });

    it('should fill defaults for optional fields', () => {
        const result = analyzeRequestSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.dofPerNode).toBe(3);
            expect(result.data.members[0].E).toBe(200e6);
            expect(result.data.members[0].A).toBe(0.01);
        }
    });

    it('should reject fewer than 2 nodes', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            nodes: [{ id: '1', x: 0, y: 0 }],
        });
        expect(result.success).toBe(false);
    });

    it('should reject zero members', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            members: [],
        });
        expect(result.success).toBe(false);
    });

    it('should reject member with same start and end node', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            members: [{ id: '1', startNodeId: '1', endNodeId: '1' }],
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-finite coordinates (NaN)', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            nodes: [
                { id: '1', x: NaN, y: 0 },
                { id: '2', x: 5, y: 0 },
            ],
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-finite coordinates (Infinity)', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            nodes: [
                { id: '1', x: Infinity, y: 0 },
                { id: '2', x: 5, y: 0 },
            ],
        });
        expect(result.success).toBe(false);
    });

    it('should reject negative E (elastic modulus)', () => {
        const result = analyzeRequestSchema.safeParse({
            ...validPayload,
            members: [{ id: '1', startNodeId: '1', endNodeId: '2', E: -200e6 }],
        });
        expect(result.success).toBe(false);
    });

    it('should coerce numeric IDs to strings', () => {
        const result = analyzeRequestSchema.safeParse({
            nodes: [
                { id: 1, x: 0, y: 0 },
                { id: 2, x: 5, y: 0 },
            ],
            members: [{ id: 1, startNodeId: 1, endNodeId: 2 }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.nodes[0].id).toBe('1');
            expect(result.data.members[0].startNodeId).toBe('1');
        }
    });

    it('should reject completely empty body', () => {
        expect(analyzeRequestSchema.safeParse({}).success).toBe(false);
        expect(analyzeRequestSchema.safeParse(null).success).toBe(false);
        expect(analyzeRequestSchema.safeParse(undefined).success).toBe(false);
    });
});

// ============================================
// Steel Design Schema
// ============================================

describe('steelDesignSchema', () => {
    const validPayload = {
        code: 'IS800',
        section: {
            name: 'ISHB 300',
            area: 58.5e-4,
            depth: 300,
            width: 250,
            webThickness: 7.6,
            flangeThickness: 10.6,
            Iy: 12545e-8,
            Iz: 2194e-8,
            ry: 127.7,
            rz: 53.1,
        },
        geometry: { length: 6000, effectiveLengthY: 6000 },
        forces: { N: -500000, Vy: 20000, Vz: 0, My: 150e6, Mz: 0 },
        material: { fy: 250, fu: 410 },
    };

    it('should accept a valid steel design request', () => {
        expect(steelDesignSchema.safeParse(validPayload).success).toBe(true);
    });

    it('should reject invalid code', () => {
        expect(steelDesignSchema.safeParse({ ...validPayload, code: 'INVALID' }).success).toBe(false);
    });

    it('should reject negative section area', () => {
        const result = steelDesignSchema.safeParse({
            ...validPayload,
            section: { ...validPayload.section, area: -1 },
        });
        expect(result.success).toBe(false);
    });

    it('should default designMethod to LRFD', () => {
        const result = steelDesignSchema.safeParse(validPayload);
        if (result.success) {
            expect(result.data.designMethod).toBe('LRFD');
        }
    });
});

// ============================================
// Concrete Beam Schema
// ============================================

describe('concreteBeamSchema', () => {
    const validPayload = {
        section: { width: 300, depth: 500, effectiveDepth: 450 },
        forces: { Mu: 200e6, Vu: 100e3 },
        material: { fck: 30, fy: 500 },
    };

    it('should accept a valid concrete beam request', () => {
        expect(concreteBeamSchema.safeParse(validPayload).success).toBe(true);
    });

    it('should default cover to 40mm', () => {
        const result = concreteBeamSchema.safeParse(validPayload);
        if (result.success) {
            expect(result.data.section.cover).toBe(40);
        }
    });

    it('should reject zero width', () => {
        const result = concreteBeamSchema.safeParse({
            ...validPayload,
            section: { ...validPayload.section, width: 0 },
        });
        expect(result.success).toBe(false);
    });
});

// ============================================
// Concrete Column Schema
// ============================================

describe('concreteColumnSchema', () => {
    it('should accept valid column data', () => {
        const result = concreteColumnSchema.safeParse({
            section: { width: 400, depth: 400 },
            forces: { Pu: 2000e3, Mux: 150e6, Muy: 100e6 },
            geometry: { unsupportedLength: 3500 },
            material: { fck: 40, fy: 500 },
        });
        expect(result.success).toBe(true);
    });
});

// ============================================
// Connection Design Schema
// ============================================

describe('connectionDesignSchema', () => {
    it('should accept a bolted shear connection', () => {
        const result = connectionDesignSchema.safeParse({
            type: 'bolted_shear',
            forces: { shear: 100e3 },
            bolt: { diameter: 20, grade: '8.8' },
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid connection type', () => {
        const result = connectionDesignSchema.safeParse({
            type: 'magic_connection',
            forces: { shear: 100e3 },
        });
        expect(result.success).toBe(false);
    });
});

// ============================================
// Foundation Design Schema
// ============================================

describe('foundationDesignSchema', () => {
    it('should accept an isolated footing', () => {
        const result = foundationDesignSchema.safeParse({
            type: 'isolated',
            loads: [{ P: 500e3 }],
            columnSize: { width: 400, depth: 400 },
            soil: { bearingCapacity: 200 },
            material: { fck: 25, fy: 500 },
        });
        expect(result.success).toBe(true);
    });

    it('should reject empty loads array', () => {
        const result = foundationDesignSchema.safeParse({
            type: 'isolated',
            loads: [],
            columnSize: { width: 400, depth: 400 },
            soil: { bearingCapacity: 200 },
            material: { fck: 25, fy: 500 },
        });
        expect(result.success).toBe(false);
    });
});

// ============================================
// P-Delta Schema
// ============================================

describe('pDeltaSchema', () => {
    const validPayload = {
        nodes: [
            { id: 1, x: 0, y: 0 },
            { id: 2, x: 0, y: 3 },
        ],
        members: [
            { id: 1, startNode: 1, endNode: 2, E: 200e9, A: 0.01, I: 1e-4 },
        ],
        supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
        loads: [{ nodeId: 2, fx: 10000, fy: -50000 }],
    };

    it('should accept valid P-Delta input', () => {
        expect(pDeltaSchema.safeParse(validPayload).success).toBe(true);
    });

    it('should default maxIterations to 10', () => {
        const result = pDeltaSchema.safeParse(validPayload);
        if (result.success) {
            expect(result.data.options?.maxIterations).toBe(10);
        }
    });
});

// ============================================
// Modal Schema
// ============================================

describe('modalSchema', () => {
    it('should accept valid modal analysis input', () => {
        const result = modalSchema.safeParse({
            nodes: [
                { id: 1, x: 0, y: 0 },
                { id: 2, x: 0, y: 3 },
            ],
            members: [
                { id: 1, startNode: 1, endNode: 2, E: 200e9, A: 0.01, I: 1e-4 },
            ],
            supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.numModes).toBe(5);
            expect(result.data.massType).toBe('lumped');
        }
    });
});

// ============================================
// Buckling Schema
// ============================================

describe('bucklingSchema', () => {
    it('should accept valid buckling analysis input', () => {
        const result = bucklingSchema.safeParse({
            nodes: [
                { id: 1, x: 0, y: 0 },
                { id: 2, x: 0, y: 3 },
            ],
            members: [
                { id: 1, startNode: 1, endNode: 2, E: 200e9, A: 0.01, I: 1e-4 },
            ],
            supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
            loads: [{ nodeId: 2, fy: -100000 }],
        });
        expect(result.success).toBe(true);
    });

    it('should reject missing loads for buckling', () => {
        const result = bucklingSchema.safeParse({
            nodes: [
                { id: 1, x: 0, y: 0 },
                { id: 2, x: 0, y: 3 },
            ],
            members: [
                { id: 1, startNode: 1, endNode: 2, E: 200e9, A: 0.01, I: 1e-4 },
            ],
            supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
            loads: [],
        });
        expect(result.success).toBe(false);
    });
});
