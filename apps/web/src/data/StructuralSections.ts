/**
 * StructuralSections.ts
 *
 * Compatibility wrapper that re-exports split structural section and
 * connection datasets from modular files.
 */

export type {
  SectionType,
  SectionDimensions,
  StructuralSection,
  ConnectionType,
  BoltGrade,
  WeldType,
  JointConnection,
} from './structural-sections/types';

import { BURJ_KHALIFA_SECTIONS } from './structural-sections/sections_burj_khalifa';
import { CHENAB_BRIDGE_SECTIONS } from './structural-sections/sections_chenab_bridge';
import { GOLDEN_GATE_SECTIONS } from './structural-sections/sections_golden_gate';
import { HOWRAH_BRIDGE_SECTIONS } from './structural-sections/sections_howrah_bridge';
import { BANDRA_WORLI_SECTIONS } from './structural-sections/sections_bandra_worli';
import { WARREN_TRUSS_SECTIONS } from './structural-sections/sections_warren_truss';
import { SIGNATURE_BRIDGE_SECTIONS } from './structural-sections/sections_signature_bridge';

export {
  JOINT_CONNECTIONS,
  getConnection,
  getChenabBridgeConnections,
  getBurjKhalifaConnections,
  getGoldenGateConnections,
} from './structural-sections/joint_connections';

export { BURJ_KHALIFA_SECTIONS };
export { CHENAB_BRIDGE_SECTIONS };
export { GOLDEN_GATE_SECTIONS };
export { HOWRAH_BRIDGE_SECTIONS };
export { BANDRA_WORLI_SECTIONS };
export { WARREN_TRUSS_SECTIONS };
export { SIGNATURE_BRIDGE_SECTIONS };

export const STRUCTURAL_SECTIONS = {
  ...BURJ_KHALIFA_SECTIONS,
  ...CHENAB_BRIDGE_SECTIONS,
  ...GOLDEN_GATE_SECTIONS,
  ...HOWRAH_BRIDGE_SECTIONS,
  ...BANDRA_WORLI_SECTIONS,
  ...WARREN_TRUSS_SECTIONS,
  ...SIGNATURE_BRIDGE_SECTIONS,
};

export function getSection(sectionId: string) {
  return STRUCTURAL_SECTIONS[sectionId as keyof typeof STRUCTURAL_SECTIONS];
}

export function getSectionsByType(type: string) {
  return Object.values(STRUCTURAL_SECTIONS).filter((section) => section.type === type);
}

export function getBurjKhalifaSections() {
  return BURJ_KHALIFA_SECTIONS;
}

export function getChenabBridgeSections() {
  return CHENAB_BRIDGE_SECTIONS;
}

export function getGoldenGateSections() {
  return GOLDEN_GATE_SECTIONS;
}

export function getHowrahBridgeSections() {
  return HOWRAH_BRIDGE_SECTIONS;
}

export function getBandraWorliSections() {
  return BANDRA_WORLI_SECTIONS;
}

export function getWarrenTrussSections() {
  return WARREN_TRUSS_SECTIONS;
}

export function getSignatureBridgeSections() {
  return SIGNATURE_BRIDGE_SECTIONS;
}
