import { describe, it, expect } from 'vitest';
import {
  positiveNumber,
  nonNegativeNumber,
  percentage,
  email,
  password,
  uuid,
  coordinate,
  materialProperties,
  member,
  node,
  loadCase,
  analysisSettings,
  getValidationErrors,
  getFieldError,
  validateField,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

describe('positiveNumber', () => {
  it('accepts positive values', () => {
    expect(positiveNumber.safeParse(1).success).toBe(true);
    expect(positiveNumber.safeParse(0.001).success).toBe(true);
    expect(positiveNumber.safeParse(999999).success).toBe(true);
  });

  it('rejects 0', () => {
    expect(positiveNumber.safeParse(0).success).toBe(false);
  });

  it('rejects negative values', () => {
    expect(positiveNumber.safeParse(-1).success).toBe(false);
    expect(positiveNumber.safeParse(-0.001).success).toBe(false);
  });
});

describe('nonNegativeNumber', () => {
  it('accepts 0', () => {
    expect(nonNegativeNumber.safeParse(0).success).toBe(true);
  });

  it('rejects negatives', () => {
    expect(nonNegativeNumber.safeParse(-1).success).toBe(false);
    expect(nonNegativeNumber.safeParse(-0.01).success).toBe(false);
  });
});

describe('percentage', () => {
  it('accepts 0, 50, 100', () => {
    expect(percentage.safeParse(0).success).toBe(true);
    expect(percentage.safeParse(50).success).toBe(true);
    expect(percentage.safeParse(100).success).toBe(true);
  });

  it('rejects -1 and 101', () => {
    expect(percentage.safeParse(-1).success).toBe(false);
    expect(percentage.safeParse(101).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

describe('email', () => {
  it('accepts valid emails', () => {
    expect(email.safeParse('user@example.com').success).toBe(true);
    expect(email.safeParse('a.b+c@domain.co.uk').success).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(email.safeParse('notanemail').success).toBe(false);
    expect(email.safeParse('@missing.com').success).toBe(false);
  });

  it('requires non-empty string', () => {
    expect(email.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

describe('password', () => {
  it('requires min 8 chars', () => {
    expect(password.safeParse('Ab1!').success).toBe(false);
  });

  it('requires uppercase', () => {
    expect(password.safeParse('abcdefg1!').success).toBe(false);
  });

  it('requires lowercase', () => {
    expect(password.safeParse('ABCDEFG1!').success).toBe(false);
  });

  it('requires a number', () => {
    expect(password.safeParse('Abcdefgh!').success).toBe(false);
  });

  it('requires a special character', () => {
    expect(password.safeParse('Abcdefg1').success).toBe(false);
  });

  it('accepts a valid password', () => {
    expect(password.safeParse('Abcdef1!').success).toBe(true);
    expect(password.safeParse('Str0ng!Pass').success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UUID
// ---------------------------------------------------------------------------

describe('uuid', () => {
  it('accepts valid UUID', () => {
    expect(uuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    expect(uuid.safeParse('not-a-uuid').success).toBe(false);
    expect(uuid.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Structural Engineering: coordinate
// ---------------------------------------------------------------------------

describe('coordinate', () => {
  it('validates x, y, z numbers', () => {
    const result = coordinate.safeParse({ x: 1, y: 2.5, z: -3 });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(coordinate.safeParse({ x: 1, y: 2 }).success).toBe(false);
    expect(coordinate.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// materialProperties
// ---------------------------------------------------------------------------

describe('materialProperties', () => {
  const validMaterial = {
    name: 'Steel',
    E: 200000,
    nu: 0.3,
    fy: 250,
    fu: 400,
    density: 7850,
  };

  it('validates a complete object', () => {
    expect(materialProperties.safeParse(validMaterial).success).toBe(true);
  });

  it('rejects missing E', () => {
    const { E: _omitted, ...incomplete } = validMaterial;
    expect(materialProperties.safeParse(incomplete).success).toBe(false);
  });

  it('rejects nu > 0.5', () => {
    expect(
      materialProperties.safeParse({ ...validMaterial, nu: 0.6 }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// member
// ---------------------------------------------------------------------------

describe('member', () => {
  it('rejects same start and end node', () => {
    const result = member.safeParse({
      id: 'm1',
      startNode: 'n1',
      endNode: 'n1',
      section: 's1',
      material: 'mat1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain('Start and end nodes must be different');
    }
  });
});

// ---------------------------------------------------------------------------
// node
// ---------------------------------------------------------------------------

describe('node', () => {
  it('provides default z = 0', () => {
    const result = node.safeParse({ id: 'n1', x: 0, y: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.z).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// loadCase
// ---------------------------------------------------------------------------

describe('loadCase', () => {
  it('validates dead/live/wind types', () => {
    for (const type of ['dead', 'live', 'wind'] as const) {
      const result = loadCase.safeParse({
        id: 'lc1',
        name: 'Load Case 1',
        type,
        loads: [],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    const result = loadCase.safeParse({
      id: 'lc1',
      name: 'Load Case 1',
      type: 'invalid',
      loads: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// analysisSettings
// ---------------------------------------------------------------------------

describe('analysisSettings', () => {
  it('provides defaults for solver, tolerance, maxIterations, etc.', () => {
    const result = analysisSettings.safeParse({ type: 'linear' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.solver).toBe('direct');
      expect(result.data.tolerance).toBe(1e-6);
      expect(result.data.maxIterations).toBe(100);
      expect(result.data.includeShearDeformation).toBe(true);
      expect(result.data.includeGeometricNonlinearity).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Form validation helpers
// ---------------------------------------------------------------------------

describe('getValidationErrors', () => {
  it('extracts field errors from a failed parse', () => {
    const result = materialProperties.safeParse({ name: '', E: -1 });
    const errors = getValidationErrors(result);
    expect(typeof errors).toBe('object');
    // At least "name" or "E" should have errors
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it('returns empty object for successful parse', () => {
    const result = positiveNumber.safeParse(5);
    const errors = getValidationErrors(result);
    expect(errors).toEqual({});
  });
});

describe('getFieldError', () => {
  it('returns specific field error', () => {
    const result = materialProperties.safeParse({});
    const nameError = getFieldError(result, 'name');
    expect(typeof nameError).toBe('string');
  });

  it('returns undefined for valid parse', () => {
    const result = positiveNumber.safeParse(10);
    expect(getFieldError(result, 'anything')).toBeUndefined();
  });
});

describe('validateField', () => {
  it('returns valid for passing schema', () => {
    const res = validateField(positiveNumber, 5);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('returns error for failing schema', () => {
    const res = validateField(positiveNumber, -1);
    expect(res.valid).toBe(false);
    expect(typeof res.error).toBe('string');
  });
});
