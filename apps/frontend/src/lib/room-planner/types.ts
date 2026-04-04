/**
 * Interactive Room Planner - Type Definitions
 * 
 * Types for furniture, doors, validation rules, and canvas geometry
 * All dimensions in millimeters unless stated otherwise
 */

// ============================================
// FURNITURE TYPES & DIMENSIONS
// ============================================

export type FurnitureCategory = 
  | 'bed'
  | 'seating'
  | 'dining'
  | 'storage'
  | 'bathroom'
  | 'kitchen'
  | 'office'
  | 'decor';

export type FurnitureType =
  | 'single_bed'
  | 'double_bed'
  | 'queen_bed'
  | 'king_bed'
  | 'sofa'
  | 'loveseat'
  | 'armchair'
  | 'dining_table'
  | 'dining_chair'
  | 'desk'
  | 'coffee_table'
  | 'side_table'
  | 'wardrobe'
  | 'bookshelf'
  | 'tv_stand'
  | 'bathtub'
  | 'toilet'
  | 'sink'
  | 'shower_enclosure'
  | 'kitchen_cabinet'
  | 'countertop'
  | 'stove'
  | 'fridge'
  | 'lamp'
  | 'plant'
  | 'mirror';

/**
 * Standard furniture dimensions per ergonomic standards
 * Source: NBC (National Building Code of India), IS 4651, Neufert
 */
export const FURNITURE_DIMENSIONS: Record<FurnitureType, { width: number; depth: number; height: number; category: FurnitureCategory }> = {
  // Beds (all dimensions in mm)
  single_bed: { width: 1000, depth: 2000, height: 500, category: 'bed' },
  double_bed: { width: 1400, depth: 2000, height: 500, category: 'bed' },
  queen_bed: { width: 1600, depth: 2000, height: 500, category: 'bed' },
  king_bed: { width: 1800, depth: 2100, height: 500, category: 'bed' },

  // Seating
  sofa: { width: 2400, depth: 1000, height: 900, category: 'seating' },
  loveseat: { width: 1600, depth: 1000, height: 900, category: 'seating' },
  armchair: { width: 800, depth: 800, height: 900, category: 'seating' },

  // Dining
  dining_table: { width: 1000, depth: 1600, height: 750, category: 'dining' },
  dining_chair: { width: 500, depth: 600, height: 900, category: 'dining' },

  // Storage & Office
  desk: { width: 1200, depth: 600, height: 750, category: 'office' },
  coffee_table: { width: 1000, depth: 600, height: 450, category: 'decor' },
  side_table: { width: 600, depth: 600, height: 600, category: 'decor' },
  wardrobe: { width: 1200, depth: 600, height: 2200, category: 'storage' },
  bookshelf: { width: 800, depth: 300, height: 2000, category: 'storage' },
  tv_stand: { width: 1500, depth: 600, height: 500, category: 'storage' },

  // Bathroom & Kitchen
  bathtub: { width: 800, depth: 1700, height: 600, category: 'bathroom' },
  toilet: { width: 600, depth: 700, height: 800, category: 'bathroom' },
  sink: { width: 600, depth: 600, height: 900, category: 'bathroom' },
  shower_enclosure: { width: 900, depth: 900, height: 2200, category: 'bathroom' },
  kitchen_cabinet: { width: 600, depth: 600, height: 900, category: 'kitchen' },
  countertop: { width: 2400, depth: 600, height: 900, category: 'kitchen' },
  stove: { width: 700, depth: 700, height: 900, category: 'kitchen' },
  fridge: { width: 700, depth: 700, height: 1700, category: 'kitchen' },

  // Decor
  lamp: { width: 300, depth: 300, height: 600, category: 'decor' },
  plant: { width: 300, depth: 300, height: 1000, category: 'decor' },
  mirror: { width: 600, depth: 100, height: 1000, category: 'decor' },
};

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  x: number; // mm, canvas coordinates
  y: number; // mm
  width: number; // mm
  depth: number; // mm
  height: number; // mm
  rotation: number; // degrees (0, 90, 180, 270)
  color: string;
  label?: string;
}

// ============================================
// ROOM EDITOR GEOMETRY
// ============================================

export interface Room {
  id: string;
  name: string;
  x: number; // mm, top-left corner
  y: number; // mm
  width: number; // mm
  height: number; // mm
  color: string;
  wallThickness: number; // default 150mm
  roomType: string; // living, bedroom, kitchen, etc.
}

export type DoorSwingDirection = 'left' | 'right' | 'both' | 'sliding';

export interface Door {
  id: string;
  x: number; // mm, center position
  y: number; // mm
  width: number; // mm (typical 900mm)
  height: number; // mm (typical 2100mm)
  wallSide: 'top' | 'right' | 'bottom' | 'left'; // which wall is door on
  swingAngle: number; // 90° by default, 120° for comfort
  swingDirection: DoorSwingDirection;
  roomId: string;
  color: string;
  label?: string;
}

export interface Window {
  id: string;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  wallSide: 'top' | 'right' | 'bottom' | 'left';
  roomId: string;
  sillHeight: number; // mm from floor
  color: string;
  label?: string;
}

export interface WalkPath {
  id: string;
  points: Array<{ x: number; y: number }>; // mm coordinates
  width: number; // minimum 750mm per NBC
  minClearance: number; // mm
  validated: boolean;
}

// ============================================
// VALIDATION RULES & RESULTS
// ============================================

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'clearance' | 'egress' | 'ergonomic' | 'code' | 'efficiency';
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  objectIds: string[]; // furniture/door IDs involved
  location: { x: number; y: number }; // mm
  affectedArea?: { x: number; y: number; width: number; height: number };
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  timestamp: number;
}

// ============================================
// CANVAS STATE & INTERACTION
// ============================================

export type CanvasToolMode = 
  | 'select'
  | 'draw_room'
  | 'place_door'
  | 'place_window'
  | 'place_furniture'
  | 'draw_path';

export type SelectionType = 'room' | 'furniture' | 'door' | 'window' | 'path' | 'none';

export interface CanvasSelection {
  type: SelectionType;
  objectId?: string;
  isDragging: boolean;
  dragStartX?: number;
  dragStartY?: number;
  isResizing?: boolean;
  resizeHandle?: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
}

export interface CanvasState {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: FurnitureItem[];
  walkPaths: WalkPath[];
  selection: CanvasSelection;
  toolMode: CanvasToolMode;
  zoom: number; // percentage (100 = 1:1)
  panX: number; // mm
  panY: number; // mm
  showGrid: boolean;
  gridSpacing: number; // mm (200 = 200mm grid)
  snapToGrid: boolean;
}

// ============================================
// CLEARANCE & GEOMETRY CALCULATIONS
// ============================================

/**
 * Door swing clearance requirements (in mm)
 * Per NBC & IS codes
 */
export const CLEARANCE_STANDARDS = {
  DOOR_SWING_ARC: 120, // degrees - comfortable swing arc
  DOOR_REACH_MM: 900, // mm - how far door swing extends into room
  MIN_CIRCULATION_WIDTH: 750, // mm - minimum walkway width per NBC
  MIN_FURNITURE_CLEARANCE: 150, // mm - distance from doors/windows to furniture
  BED_ACCESS_CLEARANCE: 800, // mm - min access on 3 sides of bed
  WHEELCHAIR_TURNING: 1500, // mm - diameter for accessibility
  FURNITURE_TO_WALL: 100, // mm - comfortable spacing
  DOORSWING_TO_FURNITURE: 200, // mm - clearance for proper swing
};

/**
 * Snapping grid options (in mm)
 */
export const SNAP_GRIDS = {
  FINE: 50, // 50mm increments
  STANDARD: 200, // 200mm (architectural standard)
  COARSE: 500, // 500mm
  NONE: 0,
};

/**
 * Canvas zoom levels (percentage)
 */
export const ZOOM_LEVELS = {
  MIN: 25,
  MAX: 400,
  DEFAULT: 100,
  FIT_TO_SCREEN: 'fit',
};

// ============================================
// EXPORT & SAVE FORMATS
// ============================================

export interface RoomPlanData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scale: number; // mm per pixel
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: FurnitureItem[];
  walkPaths: WalkPath[];
  validationResult?: ValidationResult;
  metadata?: {
    project?: string;
    address?: string;
    architect?: string;
    scale?: string; // e.g., "1:100"
  };
}

export interface ExportOptions {
  format: 'json' | 'svg' | 'png' | 'pdf';
  includeValidation: boolean;
  showDimensions: boolean;
  showGrid: boolean;
  scale?: number; // mm per pixel
}
