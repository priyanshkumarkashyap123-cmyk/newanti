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
