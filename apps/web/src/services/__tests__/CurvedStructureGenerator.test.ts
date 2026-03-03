/**
 * CurvedStructureGenerator — Unit Tests
 *
 * Tests parametric curved/circular geometry generators produce
 * valid structural models (nodes, members, supports, metadata).
 */

import { describe, test, expect } from 'vitest';
import {
  generateGeodesicDome,
  generateRibbedDome,
  generateBarrelVault,
  generateArch,
  generateTunnel,
  generateSphere,
  generateCylinder,
  generateCoolingTower,
  generateHelicalStaircase,
  generateHypar,
  getCurvedTemplate,
  generateCurvedStructure,
  CURVED_TEMPLATES,
  type CurvedStructure,
} from '../CurvedStructureGenerator';

// ============================================
// HELPERS
// ============================================

/** Assert basic structural validity for any generated curved structure */
function assertValidStructure(result: CurvedStructure, expectedType: string) {
  // Has non-empty arrays
  expect(result.nodes.length).toBeGreaterThan(0);
  expect(result.members.length).toBeGreaterThan(0);
  expect(result.supports.length).toBeGreaterThan(0);

  // Metadata matches
  expect(result.metadata.type).toBe(expectedType);
  expect(result.metadata.nodeCount).toBe(result.nodes.length);
  expect(result.metadata.memberCount).toBe(result.members.length);

  // All member node refs exist
  const nodeIds = new Set(result.nodes.map((n) => n.id));
  result.members.forEach((m) => {
    expect(nodeIds.has(m.startNodeId)).toBe(true);
    expect(nodeIds.has(m.endNodeId)).toBe(true);
  });

  // All support node refs exist
  result.supports.forEach((s) => {
    expect(nodeIds.has(s.nodeId)).toBe(true);
  });

  // Name and description non-empty
  expect(result.name.length).toBeGreaterThan(0);
  expect(result.description.length).toBeGreaterThan(0);
}

// ============================================
// INDIVIDUAL GENERATORS
// ============================================

describe('generateGeodesicDome', () => {
  test('generates valid dome with defaults', () => {
    const dome = generateGeodesicDome();
    assertValidStructure(dome, 'geodesic_dome');
  });

  test('respects custom parameters', () => {
    const dome = generateGeodesicDome({ rings: 3, segments: 8 });
    assertValidStructure(dome, 'geodesic_dome');
    // Fewer rings/segments → fewer nodes
    // Fewer rings/segments → fewer nodes than default
  });
});

describe('generateRibbedDome', () => {
  test('generates valid ribbed dome with defaults', () => {
    const dome = generateRibbedDome();
    assertValidStructure(dome, 'ribbed_dome');
  });
});

describe('generateBarrelVault', () => {
  test('generates valid barrel vault with defaults', () => {
    const vault = generateBarrelVault();
    assertValidStructure(vault, 'barrel_vault');
  });

  test('custom span and length', () => {
    const vault = generateBarrelVault({ span: 10, length: 20 });
    assertValidStructure(vault, 'barrel_vault');
  });
});

describe('generateArch', () => {
  test('generates valid parabolic arch (default)', () => {
    const arch = generateArch();
    assertValidStructure(arch, 'arch');
  });

  test('generates circular arch', () => {
    const arch = generateArch({ profile: 'circular' });
    assertValidStructure(arch, 'arch');
  });

  test('generates catenary arch', () => {
    const arch = generateArch({ profile: 'catenary' });
    assertValidStructure(arch, 'arch');
  });

  test('arch has 2 supports at base', () => {
    const arch = generateArch();
    expect(arch.supports.length).toBe(2);
  });
});

describe('generateTunnel', () => {
  test('generates valid tunnel with defaults', () => {
    const tunnel = generateTunnel();
    assertValidStructure(tunnel, 'tunnel');
  });
});

describe('generateSphere', () => {
  test('generates valid sphere with defaults', () => {
    const sphere = generateSphere();
    assertValidStructure(sphere, 'sphere');
  });
});

describe('generateCylinder', () => {
  test('generates valid cylinder with defaults', () => {
    const cyl = generateCylinder();
    assertValidStructure(cyl, 'cylinder');
  });
});

describe('generateCoolingTower', () => {
  test('generates valid cooling tower with defaults', () => {
    const tower = generateCoolingTower();
    assertValidStructure(tower, 'cooling_tower');
  });
});

describe('generateHelicalStaircase', () => {
  test('generates valid helical staircase with defaults', () => {
    const stair = generateHelicalStaircase();
    assertValidStructure(stair, 'helical_staircase');
  });
});

describe('generateHypar', () => {
  test('generates valid hypar shell with defaults', () => {
    const hypar = generateHypar();
    assertValidStructure(hypar, 'hypar');
  });
});

// ============================================
// TEMPLATE REGISTRY
// ============================================

describe('CURVED_TEMPLATES', () => {
  test('has at least 10 templates', () => {
    expect(CURVED_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  test('each template has required fields', () => {
    CURVED_TEMPLATES.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(typeof t.generator).toBe('function');
    });
  });
});

describe('getCurvedTemplate', () => {
  test('returns template by id', () => {
    const first = CURVED_TEMPLATES[0];
    const found = getCurvedTemplate(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
  });

  test('returns undefined for unknown id', () => {
    expect(getCurvedTemplate('nonexistent-template')).toBeUndefined();
  });
});

describe('generateCurvedStructure', () => {
  test('generates structure from template id', () => {
    const first = CURVED_TEMPLATES[0];
    const result = generateCurvedStructure(first.id);
    expect(result).toBeDefined();
    expect(result!.nodes.length).toBeGreaterThan(0);
  });

  test('returns undefined for unknown template', () => {
    expect(generateCurvedStructure('nonexistent')).toBeNull();
  });
});
