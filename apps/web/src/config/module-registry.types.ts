/**
 * ModuleRegistry Types
 *
 * Defines the contract for frontend + backend module discovery and dispatch.
 * A single source of truth for adding new engineering member types without code changes.
 */

export type DesignCode = 'is_456' | 'is_800' | 'aci_318' | 'aisc_360' | 'ec2' | 'ec3' | 'nds_2018';
export type MemberKind = 'beam' | 'column' | 'slab' | 'footing' | 'staircase' | 'retaining_wall' | 'connection' | 'spring' | 'damper';

/**
 * Frontend: How to display and handle a member type in the UI
 */
export interface ModuleFrontendConfig {
  /** Route path template: '/design/:category' */
  routePath: string;
  
  /** Component to render (lazy-loaded) */
  componentPath: string;
  
  /** Schema registry key to load */
  schemaKey: string;
  
  /** Display metadata */
  label: string;
  description: string;
  icon: string;
  category: string;
  
  /** Access control */
  tier?: 'free' | 'pro' | 'enterprise';
  
  /** True if member type is form-based (uses MemberDesignTemplate) */
  isTemplate?: boolean;
}

/**
 * Backend: How to call the Rust solver for a member type
 */
export interface ModuleBackendConfig {
  /** API endpoint path: '/api/design/concrete/flexure' */
  endpoint: string;
  
  /** HTTP method */
  method: 'POST' | 'GET';
  
  /** Rust handler function name (for documentation/dispatch) */
  handlerFn: string;
  
  /** Which design code(s) this handler uses */
  designCodes: DesignCode[];
  
  /** Input request type name */
  requestType: string;
  
  /** Output response type name */
  responseType: string;
  
  /** Cache TTL in seconds (0 = no cache) */
  cacheTtl?: number;
}

/**
 * Central registry entry for a single module/member-type combo
 */
export interface ModuleRegistryEntry {
  /** Unique ID: 'concrete_beam', 'steel_column', etc. */
  id: string;
  
  /** Member type (beam, column, slab, ...) */
  memberKind: MemberKind;
  
  /** Material+code combo: 'concrete_is456', 'steel_is800', ... */
  designCode: DesignCode;
  
  /** Display name: 'RC Beam Design' */
  displayName: string;
  
  /** Short description */
  description: string;
  
  /** Frontend behavior */
  frontend: ModuleFrontendConfig;
  
  /** Backend API contract */
  backend: ModuleBackendConfig;
  
  /** Release status / feature flag */
  status: 'stable' | 'beta' | 'experimental' | 'deprecated';
  
  /** Date added (ISO string) */
  addedDate: string;
  
  /** Notes for future developers */
  notes?: string;
}

/**
 * The complete registry
 */
export interface ModuleRegistry {
  version: string;
  lastUpdated: string;
  entries: ModuleRegistryEntry[];
}

/**
 * Helper to look up entry by member kind + design code
 */
export function findRegistryEntry(
  registry: ModuleRegistry,
  memberKind: MemberKind,
  designCode: DesignCode,
): ModuleRegistryEntry | undefined {
  return registry.entries.find(
    (e) => e.memberKind === memberKind && e.designCode === designCode,
  );
}

/**
 * Helper to get all entries for a member kind across all design codes
 */
export function findEntriesByMember(
  registry: ModuleRegistry,
  memberKind: MemberKind,
): ModuleRegistryEntry[] {
  return registry.entries.filter((e) => e.memberKind === memberKind);
}

/**
 * Helper to get all entries for a design code
 */
export function findEntriesByDesignCode(
  registry: ModuleRegistry,
  designCode: DesignCode,
): ModuleRegistryEntry[] {
  return registry.entries.filter((e) => e.designCode === designCode);
}
