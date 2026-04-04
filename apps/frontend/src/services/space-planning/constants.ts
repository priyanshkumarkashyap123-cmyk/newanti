/**
 * Shared constants for the space-planning module.
 * Extracted here so CodeComplianceValidator and SpacePlanningEngine can both import them.
 */

/** Kitchen working triangle — standard arrangement */
export const KITCHEN_LAYOUT = {
  PLATFORM_DEPTH: 0.6,         // 600mm counter depth (standard modular)
  PLATFORM_HEIGHT: 0.85,       // 850mm counter height (ergonomic)
  SILL_HEIGHT: 1.05,           // Window sill above platform
  TRIANGLE_MIN: 3.6,           // Min perimeter of working triangle
  TRIANGLE_MAX: 7.9,           // Max perimeter of working triangle
  SINK_TO_STOVE_MIN: 0.6,     // 600mm between sink & stove
  STOVE_WALL_CLEARANCE: 0.15, // 150mm from stove to side wall
  FRIDGE_CLEARANCE_SIDE: 0.05,// 50mm side clearance
  EXHAUST_HEIGHT: 2.1,         // Chimney/exhaust hood height
} as const;

/** Bathroom internal fixture zones — clearances per IS 2064 */
export const BATHROOM_ZONES = {
  WC_CLEARANCE_FRONT: 0.6,
  WC_CLEARANCE_SIDE: 0.3,
  WC_WIDTH: 0.4,
  WC_DEPTH: 0.7,
  BASIN_CLEARANCE_FRONT: 0.6,
  BASIN_WIDTH: 0.5,
  BASIN_DEPTH: 0.45,
  SHOWER_MIN_SIZE: 0.9,
  SHOWER_PREFERRED: 1.0,
  FLOOR_SLOPE: 1 / 100,
  DOOR_THRESHOLD_HEIGHT: 0.02,
} as const;

// Architectural zones for placement pipeline
export enum ArchitecturalZone {
  PUBLIC = 'public',
  PRIVATE = 'private',
  SERVICE = 'service',
  CIRCULATION = 'circulation',
}

// Maximum aspect ratio (length:width) per NBC for habitable rooms
export const MAX_ASPECT_RATIO: Partial<Record<import('./types').RoomType, number>> = {
  living: 2.0,
  dining: 2.0,
  kitchen: 2.5,
  master_bedroom: 2.0,
  bedroom: 2.0,
  bathroom: 2.5,
  toilet: 3.0,
  study: 2.0,
  drawing_room: 2.0,
  guest_room: 2.0,
  pooja: 1.5,
  home_office: 2.0,
  childrens_room: 2.0,
  entrance_lobby: 3.0,
  corridor: 10.0,
  staircase: 3.0,
};

// Minimum internal clear dimension (meters) per NBC
export const MIN_CLEAR_DIM: Partial<Record<import('./types').RoomType, { w: number; h: number }>> = {
  living: { w: 3.6, h: 3.6 },
  dining: { w: 3.0, h: 3.0 },
  kitchen: { w: 2.1, h: 2.4 },
  master_bedroom: { w: 3.0, h: 3.6 },
  bedroom: { w: 2.7, h: 3.0 },
  bathroom: { w: 1.5, h: 1.8 },
  toilet: { w: 0.9, h: 1.2 },
  corridor: { w: 1.0, h: 1.0 },
  staircase: { w: 0.9, h: 2.0 },
};

// Door clearance rules (meters)
export const DOOR_RULES = {
  MIN_CORNER_OFFSET: 0.1,
  MIN_DOOR_TO_DOOR: 0.3,
  SWING_CLEARANCE: 0.9,
  MIN_PASSAGE_WIDTH: 0.9,
  BATHROOM_DOOR_WIDTH: 0.75,
  BEDROOM_DOOR_WIDTH: 0.9,
  MAIN_ENTRY_WIDTH: 1.05,
  FIRE_DOOR_WIDTH: 0.9,
} as const;

// NBC 2016 minimum clear dimensions for architectural placement pipeline
export const NBC_MIN_DIMS: Partial<Record<import('./types').RoomType, { w: number; h: number }>> = {
  living: { w: 3.0, h: 3.0 },
  drawing_room: { w: 3.0, h: 3.0 },
  dining: { w: 3.0, h: 3.0 },
  master_bedroom: { w: 3.0, h: 3.0 },
  bedroom: { w: 2.7, h: 2.7 },
  kitchen: { w: 2.1, h: 1.8 },
  bathroom: { w: 1.2, h: 0.9 },
  toilet: { w: 1.0, h: 0.9 },
  corridor: { w: 1.0, h: 1.0 },
  staircase: { w: 1.0, h: 1.0 },
  foyer: { w: 1.5, h: 1.5 },
  entrance_lobby: { w: 1.5, h: 1.5 },
};

// Maps every room type to its architectural zone
export const ROOM_ZONE_MAP: Partial<Record<import('./types').RoomType, ArchitecturalZone>> = {
  // PUBLIC zone — near entrance
  living: ArchitecturalZone.PUBLIC,
  dining: ArchitecturalZone.PUBLIC,
  drawing_room: ArchitecturalZone.PUBLIC,
  foyer: ArchitecturalZone.PUBLIC,
  entrance_lobby: ArchitecturalZone.PUBLIC,
  study: ArchitecturalZone.PUBLIC,
  guest_room: ArchitecturalZone.PUBLIC,
  pooja: ArchitecturalZone.PUBLIC,
  sit_out: ArchitecturalZone.PUBLIC,
  verandah: ArchitecturalZone.PUBLIC,
  // PRIVATE zone — rear / upper floor
  master_bedroom: ArchitecturalZone.PRIVATE,
  bedroom: ArchitecturalZone.PRIVATE,
  bathroom: ArchitecturalZone.PRIVATE,
  toilet: ArchitecturalZone.PRIVATE,
  dressing: ArchitecturalZone.PRIVATE,
  walk_in_closet: ArchitecturalZone.PRIVATE,
  childrens_room: ArchitecturalZone.PRIVATE,
  home_office: ArchitecturalZone.PRIVATE,
  library: ArchitecturalZone.PRIVATE,
  gym: ArchitecturalZone.PRIVATE,
  home_theater: ArchitecturalZone.PRIVATE,
  // SERVICE zone
  kitchen: ArchitecturalZone.SERVICE,
  utility: ArchitecturalZone.SERVICE,
  laundry: ArchitecturalZone.SERVICE,
  store: ArchitecturalZone.SERVICE,
  garage: ArchitecturalZone.SERVICE,
  parking: ArchitecturalZone.SERVICE,
  pantry: ArchitecturalZone.SERVICE,
  servants_quarter: ArchitecturalZone.SERVICE,
  mechanical_room: ArchitecturalZone.SERVICE,
  electrical_panel: ArchitecturalZone.SERVICE,
  water_tank_room: ArchitecturalZone.SERVICE,
  // CIRCULATION
  corridor: ArchitecturalZone.CIRCULATION,
  staircase: ArchitecturalZone.CIRCULATION,
  lift: ArchitecturalZone.CIRCULATION,
};

// Geometric tolerances (meters)
export const DEFAULT_EDGE_TOL_M = 0.05;
export const DEFAULT_RECT_ADJACENCY_TOL_M = 0.02;
