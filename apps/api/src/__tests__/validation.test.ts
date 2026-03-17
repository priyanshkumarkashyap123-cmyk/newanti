/**
 * Zod Validation Middleware Tests
 *
 * Tests the validateBody() middleware factory and all exported schemas
 * from src/middleware/validation.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import {
  validateBody,
  validateQuery,
  analyzeRequestSchema,
  steelDesignSchema,
  concreteBeamSchema,
  concreteColumnSchema,
  connectionDesignSchema,
  foundationDesignSchema,
  pDeltaSchema,
  modalSchema,
  bucklingSchema,
  cableSchema,
  spectrumSchema,
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  createProjectSchema,
  updateProjectSchema,
  userLoginSchema,
  recordAnalysisSchema,
  checkModelLimitsSchema,
  recordExportSchema,
  adminUpgradeSchema,
  billingInitiateSchema,
  billingCreateOrderSchema,
  billingVerifySchema,
  razorpayVerifySchema,
  recordConsentSchema,
  createAiSessionSchema,
  updateAiSessionSchema,
  addAiMessageSchema,
} from '../../src/middleware/validation.js';

// ============================================
// Mock Express helpers
// ============================================

const mockReq = (body: unknown) => ({ body } as Request);

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockQueryReq = (query: unknown) => ({ query } as unknown as Request);

// ============================================
// validateBody() middleware
// ============================================

describe('validateBody', () => {
  const simpleSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
    email: z.string().email().optional(),
  });

  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  // Test 1
  it('calls next() for valid body', () => {
    const req = mockReq({ name: 'Alice', age: 30 });
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  // Test 2
  it('replaces req.body with parsed/coerced data', () => {
    const coercingSchema = z.object({
      count: z.coerce.number(),
      active: z.coerce.boolean(),
    });
    const req = mockReq({ count: '42', active: 'true' });
    const res = mockRes();
    const middleware = validateBody(coercingSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
  });

  // Test 3
  it('returns 400 for invalid body', () => {
    const req = mockReq({ name: '', age: -5 });
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  // Test 4
  it('error response has structured details', () => {
    const req = mockReq({ name: 123, age: 'not-a-number' });
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
            code: expect.any(String),
          }),
        ]),
      }),
    );
  });

  // Test 5
  it('handles missing required fields', () => {
    const req = mockReq({});
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const paths = jsonArg.details.map((d: any) => d.path);
    expect(paths).toContain('name');
    expect(paths).toContain('age');
  });

  // Test 6
  it('handles wrong types', () => {
    const req = mockReq({ name: 42, age: 'hello' });
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  // Test 7
  it('handles empty body (undefined/null)', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const middleware = validateBody(simpleSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  // Test 12
  it('works with nested objects', () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          bio: z.string().optional(),
        }),
      }),
    });
    const req = mockReq({ user: { profile: { name: 'Bob' } } });
    const res = mockRes();
    const middleware = validateBody(nestedSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.user.profile.name).toBe('Bob');
  });

  // Test 13
  it('returns multiple validation errors at once', () => {
    const multiFieldSchema = z.object({
      a: z.string(),
      b: z.number(),
      c: z.boolean(),
    });
    const req = mockReq({ a: 123, b: 'wrong', c: 'not-bool' });
    const res = mockRes();
    const middleware = validateBody(multiFieldSchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonArg.details.length).toBeGreaterThanOrEqual(3);
  });

  // Test 14
  it('schema coercion works (string numbers → numbers)', () => {
    const coerceSchema = z.object({
      value: z.coerce.number(),
    });
    const req = mockReq({ value: '99.5' });
    const res = mockRes();
    const middleware = validateBody(coerceSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.value).toBe(99.5);
  });

  // Test 15
  it('optional fields use defaults', () => {
    const defaultsSchema = z.object({
      name: z.string(),
      role: z.string().optional().default('user'),
      active: z.boolean().optional().default(true),
    });
    const req = mockReq({ name: 'Test' });
    const res = mockRes();
    const middleware = validateBody(defaultsSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.role).toBe('user');
    expect(req.body.active).toBe(true);
  });
});

// ============================================
// Analysis Schema (analyzeRequestSchema)
// ============================================

describe('analyzeRequestSchema', () => {
  const validNodes = [
    { id: '1', x: 0, y: 0 },
    { id: '2', x: 5, y: 3 },
  ];
  const validMembers = [{ id: '1', startNodeId: '1', endNodeId: '2' }];
  const validLoads = [{ nodeId: '2', fy: -10000 }];

  // Test 8
  it('validates valid node data', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
      loads: validLoads,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes).toHaveLength(2);
      expect(result.data.nodes[0].id).toBe('1');
      expect(result.data.nodes[0].x).toBe(0);
    }
  });

  // Test 9
  it('validates valid member data (startId !== endId)', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: [{ id: 'm1', startNodeId: '1', endNodeId: '2' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.members[0].startNodeId).toBe('1');
      expect(result.data.members[0].endNodeId).toBe('2');
    }
  });

  // Test 10
  it('rejects member with same start/end node', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: [{ id: '1', startNodeId: '1', endNodeId: '1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(', ');
      expect(msg).toContain('Start and end nodes cannot be the same');
    }
  });

  // Test 11
  it('validates loads with defaults', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // loads default to empty array
      expect(result.data.loads).toEqual([]);
      // dofPerNode defaults to 3
      expect(result.data.dofPerNode).toBe(3);
    }
  });

  it('transforms string/number node ids to string', () => {
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
      expect(result.data.members[0].id).toBe('1');
    }
  });

  it('rejects fewer than 2 nodes', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: [{ id: '1', x: 0, y: 0 }],
      members: validMembers,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty members array', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: [],
    });
    expect(result.success).toBe(false);
  });

  it('fills member defaults (E, A, I)', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.members[0].E).toBe(200e6);
      expect(result.data.members[0].A).toBe(0.01);
      expect(result.data.members[0].I).toBe(1e-4);
    }
  });

  it('rejects non-finite coordinates (NaN/Infinity)', () => {
    const r1 = analyzeRequestSchema.safeParse({
      nodes: [
        { id: '1', x: NaN, y: 0 },
        { id: '2', x: 5, y: 0 },
      ],
      members: validMembers,
    });
    expect(r1.success).toBe(false);

    const r2 = analyzeRequestSchema.safeParse({
      nodes: [
        { id: '1', x: Infinity, y: 0 },
        { id: '2', x: 5, y: 0 },
      ],
      members: validMembers,
    });
    expect(r2.success).toBe(false);
  });

  it('accepts valid property assignment payload', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
      propertyAssignments: [
        {
          id: 'PA-1',
          name: 'Rect RC Beam Property',
          sectionType: 'RECTANGLE',
          dimensions: { rectWidth: 0.3, rectHeight: 0.6 },
          mechanics: {
            area_m2: 0.18,
            iyy_m4: 0.0054,
            izz_m4: 0.00135,
            j_m4: 0.0002,
          },
          material: {
            id: 'M25',
            family: 'concrete',
            E_kN_m2: 25_000_000,
            nu: 0.2,
            fck_mpa: 25,
          },
          assignment: {
            mode: 'selected',
            memberIds: ['1'],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects property assignment with unknown member reference', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
      propertyAssignments: [
        {
          id: 'PA-2',
          name: 'Unknown member test',
          sectionType: 'RECTANGLE',
          dimensions: { rectWidth: 0.3, rectHeight: 0.6 },
          mechanics: {
            area_m2: 0.18,
            iyy_m4: 0.0054,
            izz_m4: 0.00135,
            j_m4: 0.0002,
          },
          material: {
            id: 'M25',
            family: 'concrete',
            E_kN_m2: 25_000_000,
            nu: 0.2,
          },
          assignment: {
            mode: 'selected',
            memberIds: ['M404'],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('unknown memberId'))).toBe(true);
    }
  });

  it('rejects contradictory tension/compression-only flags', () => {
    const result = analyzeRequestSchema.safeParse({
      nodes: validNodes,
      members: validMembers,
      propertyAssignments: [
        {
          id: 'PA-3',
          name: 'Invalid behavior flags',
          sectionType: 'RECTANGLE',
          dimensions: { rectWidth: 0.3, rectHeight: 0.6 },
          mechanics: {
            area_m2: 0.18,
            iyy_m4: 0.0054,
            izz_m4: 0.00135,
            j_m4: 0.0002,
          },
          material: {
            id: 'M25',
            family: 'concrete',
            E_kN_m2: 25_000_000,
            nu: 0.2,
          },
          behavior: {
            tensionOnly: true,
            compressionOnly: true,
          },
          assignment: {
            mode: 'selected',
            memberIds: ['1'],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// Exported Schema Smoke Tests
// ============================================

describe('steelDesignSchema', () => {
  it('accepts valid steel design input', () => {
    const result = steelDesignSchema.safeParse({
      code: 'IS800',
      section: {
        name: 'ISMB 300',
        area: 58.1,
        depth: 300,
        width: 140,
        webThickness: 7.7,
        flangeThickness: 13.1,
        Iy: 8603,
        Iz: 453.9,
        ry: 12.2,
        rz: 2.8,
      },
      geometry: { length: 5000 },
      forces: { N: 100, Vy: 50, Vz: 30, My: 200, Mz: 80 },
      material: { fy: 250, fu: 410 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.designMethod).toBe('LRFD');
      expect(result.data.material.E).toBe(200000);
    }
  });

  it('rejects missing required fields', () => {
    const result = steelDesignSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('concreteBeamSchema', () => {
  it('accepts valid concrete beam input', () => {
    const result = concreteBeamSchema.safeParse({
      section: { width: 300, depth: 600, effectiveDepth: 550 },
      forces: { Mu: 200, Vu: 100 },
      material: { fck: 30, fy: 500 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.section.cover).toBe(40); // default
    }
  });
});

describe('concreteColumnSchema', () => {
  it('accepts valid concrete column input', () => {
    const result = concreteColumnSchema.safeParse({
      section: { width: 400, depth: 400 },
      forces: { Pu: 1500, Mux: 100, Muy: 80 },
      geometry: { unsupportedLength: 3500 },
      material: { fck: 40, fy: 500 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.geometry.effectiveLengthFactor).toBe(1.0);
    }
  });
});

describe('connectionDesignSchema', () => {
  it('accepts valid connection design input', () => {
    const result = connectionDesignSchema.safeParse({
      type: 'bolted_shear',
      forces: { shear: 200 },
      bolt: { diameter: 20, grade: '8.8' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid connection type', () => {
    const result = connectionDesignSchema.safeParse({
      type: 'invalid_type',
      forces: { shear: 100 },
    });
    expect(result.success).toBe(false);
  });
});

describe('foundationDesignSchema', () => {
  it('accepts valid foundation design input', () => {
    const result = foundationDesignSchema.safeParse({
      type: 'isolated',
      loads: [{ P: 500 }],
      columnSize: { width: 400, depth: 400 },
      soil: { bearingCapacity: 200 },
      material: { fck: 25, fy: 500 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loads[0].Mx).toBe(0); // default
    }
  });
});

describe('pDeltaSchema', () => {
  const advancedBase = {
    nodes: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 5, y: 3 },
    ],
    members: [{ id: 1, startNode: 1, endNode: 2, E: 200e6, A: 0.01, I: 1e-4 }],
    supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
    loads: [{ nodeId: 2, fy: -10000 }],
  };

  it('accepts valid p-delta input with defaults', () => {
    const result = pDeltaSchema.safeParse(advancedBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options.maxIterations).toBe(10);
      expect(result.data.options.tolerance).toBe(1e-4);
    }
  });
});

describe('modalSchema', () => {
  it('accepts valid modal analysis input', () => {
    const result = modalSchema.safeParse({
      nodes: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 5, y: 0 },
      ],
      members: [{ id: 1, startNode: 1, endNode: 2, E: 200e6, A: 0.01, I: 1e-4 }],
      supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numModes).toBe(5);
      expect(result.data.massType).toBe('lumped');
    }
  });
});

describe('bucklingSchema', () => {
  it('accepts valid buckling analysis input', () => {
    const result = bucklingSchema.safeParse({
      nodes: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 0, y: 5 },
      ],
      members: [{ id: 1, startNode: 1, endNode: 2, E: 200e6, A: 0.01, I: 1e-4 }],
      supports: [{ nodeId: 1, fx: true, fy: true, fz: true }],
      loads: [{ nodeId: 2, fy: -1000 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numModes).toBe(3);
    }
  });
});

describe('Auth schemas', () => {
  it('signUpSchema accepts valid signup', () => {
    const result = signUpSchema.safeParse({
      email: 'User@Example.COM',
      password: 'StrongPass1',
      firstName: 'John',
      lastName: 'Doe',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com'); // lowercased & trimmed
    }
  });

  it('signUpSchema rejects weak password', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
      firstName: 'A',
      lastName: 'B',
    });
    expect(result.success).toBe(false);
  });

  it('signInSchema accepts valid signin and defaults rememberMe', () => {
    const result = signInSchema.safeParse({
      email: 'user@test.com',
      password: 'anything',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(false);
    }
  });

  it('forgotPasswordSchema validates email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('resetPasswordSchema requires token and strong password', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 'tok', password: 'weak' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 'tok', password: 'Strong1x' }).success,
    ).toBe(true);
  });

  it('changePasswordSchema requires both fields', () => {
    expect(changePasswordSchema.safeParse({}).success).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'NewPass1x',
      }).success,
    ).toBe(true);
  });

  it('verifyEmailSchema requires 6-char code', () => {
    expect(
      verifyEmailSchema.safeParse({ userId: 'u1', code: '12345' }).success,
    ).toBe(false);
    expect(
      verifyEmailSchema.safeParse({ userId: 'u1', code: '123456' }).success,
    ).toBe(true);
  });

  it('updateProfileSchema allows partial updates', () => {
    expect(updateProfileSchema.safeParse({ firstName: 'New' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });
});

describe('Project schemas', () => {
  it('createProjectSchema requires name', () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
    const result = createProjectSchema.safeParse({ name: 'My Project' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual({}); // default
    }
  });

  it('updateProjectSchema requires at least one field', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ name: 'Updated' }).success).toBe(true);
  });
});

describe('Activity & Admin schemas', () => {
  it('recordAnalysisSchema validates counts', () => {
    expect(
      recordAnalysisSchema.safeParse({ nodeCount: 100, memberCount: 50 }).success,
    ).toBe(true);
    expect(
      recordAnalysisSchema.safeParse({ nodeCount: -1, memberCount: 0 }).success,
    ).toBe(false);
  });

  it('adminUpgradeSchema validates tier enum', () => {
    expect(
      adminUpgradeSchema.safeParse({ email: 'a@b.com', tier: 'pro' }).success,
    ).toBe(true);
    expect(
      adminUpgradeSchema.safeParse({ email: 'a@b.com', tier: 'invalid' }).success,
    ).toBe(false);
  });

  it('recordConsentSchema validates consent type', () => {
    expect(
      recordConsentSchema.safeParse({ consentType: 'privacy' }).success,
    ).toBe(true);
    expect(
      recordConsentSchema.safeParse({ consentType: 'unknown' }).success,
    ).toBe(false);
  });
});

describe('Billing schemas', () => {
  it('billingInitiateSchema accepts valid payload', () => {
    const result = billingInitiateSchema.safeParse({
      email: 'Buyer@Example.com',
      planType: 'monthly',
      planId: 'business',
      checkoutPlanId: 'business_monthly',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('buyer@example.com');
    }
  });

  it('billingInitiateSchema rejects invalid checkout plan id', () => {
    const result = billingInitiateSchema.safeParse({
      email: 'buyer@example.com',
      planType: 'monthly',
      checkoutPlanId: 'enterprise_monthly',
    });
    expect(result.success).toBe(false);
  });

  it('billingCreateOrderSchema requires valid planType', () => {
    expect(
      billingCreateOrderSchema.safeParse({
        email: 'buyer@example.com',
        planType: 'yearly',
        planId: 'pro',
      }).success,
    ).toBe(true);

    expect(
      billingCreateOrderSchema.safeParse({
        email: 'buyer@example.com',
        planType: 'weekly',
      }).success,
    ).toBe(false);
  });

  it('billingVerifySchema requires merchantTransactionId', () => {
    expect(
      billingVerifySchema.safeParse({
        merchantTransactionId: 'BL_123',
        checkoutPlanId: 'pro_monthly',
      }).success,
    ).toBe(true);

    expect(
      billingVerifySchema.safeParse({
        checkoutPlanId: 'pro_monthly',
      }).success,
    ).toBe(false);
  });

  it('razorpayVerifySchema enforces required signature fields', () => {
    expect(
      razorpayVerifySchema.safeParse({
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: 'sig_123',
        planType: 'monthly',
        checkoutPlanId: 'pro_monthly',
      }).success,
    ).toBe(true);

    expect(
      razorpayVerifySchema.safeParse({
        razorpayOrderId: 'order_abc',
        planType: 'monthly',
      }).success,
    ).toBe(false);
  });
});

describe('AI session schemas', () => {
  it('createAiSessionSchema requires name', () => {
    expect(createAiSessionSchema.safeParse({ name: 'Session 1' }).success).toBe(true);
    expect(createAiSessionSchema.safeParse({}).success).toBe(false);
  });

  it('addAiMessageSchema validates role and content', () => {
    expect(
      addAiMessageSchema.safeParse({ role: 'user', content: 'Hello' }).success,
    ).toBe(true);
    expect(
      addAiMessageSchema.safeParse({ role: 'invalid', content: 'Hi' }).success,
    ).toBe(false);
    expect(
      addAiMessageSchema.safeParse({ role: 'user', content: '' }).success,
    ).toBe(false);
  });
});

// ============================================
// validateQuery() middleware
// ============================================

describe('validateQuery', () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  });

  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it('calls next() for valid query params', () => {
    const req = mockQueryReq({ page: '2', limit: '50' });
    const res = mockRes();
    const middleware = validateQuery(querySchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 400 for invalid query params', () => {
    const req = mockQueryReq({ page: 'abc' });
    const res = mockRes();
    const middleware = validateQuery(querySchema);

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Query validation failed',
      }),
    );
  });
});
