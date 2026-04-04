/**
 * RoomValidationUtils - Adjacency rules, finish specification, and validation
 *
 * Extracted from SpacePlanningEngine.ts
 * Provides architect-grade room classification, spacing rules, and material specifications
 */

import type { PlacedRoom, RoomSpec, RoomType, SiteOrientation, UserPreferences } from './types';
import { codeComplianceValidator } from './CodeComplianceValidator';

// ============================================
// ADJACENCY & AVOIDANCE RULES
// ============================================

/**
 * Rooms this type should be adjacent to (preferred neighbors)
 */
function getAdjacencyRules(type: RoomType): RoomType[] {
  const rules: Partial<Record<RoomType, RoomType[]>> = {
    living: ['dining', 'entrance_lobby', 'foyer', 'drawing_room', 'balcony', 'verandah'],
    dining: ['kitchen', 'living', 'pantry', 'sit_out'],
    kitchen: ['dining', 'utility', 'pantry', 'store', 'laundry'],
    master_bedroom: ['walk_in_closet', 'dressing', 'bathroom', 'balcony'],
    bedroom: ['bathroom', 'balcony', 'study'],
    guest_room: ['bathroom', 'living'],
    childrens_room: ['bathroom', 'study'],
    study: ['library', 'bedroom', 'home_office'],
    home_office: ['study', 'library'],
    library: ['study', 'home_office'],
    entrance_lobby: ['living', 'staircase', 'foyer', 'drawing_room'],
    foyer: ['living', 'entrance_lobby', 'staircase'],
    drawing_room: ['living', 'entrance_lobby', 'foyer'],
    pooja: ['living', 'entrance_lobby', 'foyer'],
    staircase: ['entrance_lobby', 'foyer', 'corridor', 'lift'],
    lift: ['staircase', 'corridor', 'foyer'],
    utility: ['kitchen', 'laundry', 'store'],
    laundry: ['utility', 'kitchen', 'bathroom'],
    store: ['kitchen', 'utility', 'pantry'],
    pantry: ['kitchen', 'dining', 'store'],
    walk_in_closet: ['master_bedroom', 'dressing'],
    dressing: ['master_bedroom', 'walk_in_closet', 'bathroom'],
    servants_quarter: ['kitchen', 'utility', 'garage'],
    parking: ['entrance_lobby', 'garage', 'staircase'],
    garage: ['parking', 'entrance_lobby'],
    balcony: ['living', 'bedroom', 'master_bedroom'],
    terrace: ['staircase', 'living'],
    gym: ['bathroom', 'balcony'],
    home_theater: ['living'],
    swimming_pool: ['garden', 'gym'],
    garden: ['sit_out', 'verandah', 'swimming_pool'],
    sit_out: ['garden', 'dining', 'verandah'],
    verandah: ['living', 'garden', 'sit_out'],
  };
  return (rules[type] || []);
}

/**
 * Rooms this type should NOT be adjacent to (avoid neighbors)
 * Based on noise, hygiene, vastu, and privacy considerations
 */
function getAvoidanceRules(type: RoomType): RoomType[] {
  const rules: Partial<Record<RoomType, RoomType[]>> = {
    kitchen: ['toilet', 'bathroom', 'pooja', 'bedroom', 'master_bedroom'],
    pooja: ['toilet', 'bathroom', 'kitchen', 'laundry'],
    master_bedroom: ['kitchen', 'garage', 'parking', 'mechanical_room'],
    bedroom: ['kitchen', 'garage', 'parking', 'mechanical_room'],
    childrens_room: ['kitchen', 'garage', 'parking', 'mechanical_room'],
    guest_room: ['kitchen', 'garage', 'servants_quarter'],
    dining: ['toilet', 'bathroom', 'garage', 'parking'],
    living: ['toilet', 'garage', 'parking', 'mechanical_room'],
    drawing_room: ['toilet', 'kitchen', 'garage'],
    study: ['kitchen', 'home_theater', 'gym'],
    home_theater: ['study', 'bedroom', 'pooja'],
    swimming_pool: ['electrical_panel', 'pooja'],
  };
  return rules[type] || [];
}

// ============================================
// FINISH SPECIFICATIONS
// ============================================

/**
 * Determine floor finish for a room based on type and budget preference
 */
function getFloorFinish(type: RoomType, preferences: UserPreferences): string {
  if (preferences.budget === 'luxury') {
    switch (type) {
      case 'living':
      case 'dining':
      case 'master_bedroom':
        return 'Italian Marble';
      case 'kitchen':
        return 'Granite';
      case 'bathroom':
      case 'toilet':
        return 'Anti-skid Ceramic';
      case 'pooja':
        return 'White Marble';
      default:
        return 'Vitrified Tiles (600×600)';
    }
  }

  switch (type) {
    case 'living':
    case 'dining':
      return 'Vitrified Tiles (600×600)';
    case 'kitchen':
      return 'Ceramic Tiles (anti-skid)';
    case 'bathroom':
    case 'toilet':
      return 'Anti-skid Ceramic Tiles';
    case 'parking':
    case 'garage':
      return 'VDF Concrete Flooring';
    default:
      return 'Ceramic Tiles (600×600)';
  }
}

/**
 * Determine wall finish for a room based on type and budget preference
 */
function getWallFinish(type: RoomType, preferences: UserPreferences): string {
  switch (type) {
    case 'bathroom':
    case 'toilet':
      return 'Ceramic Wall Tiles (up to 7ft)';
    case 'kitchen':
      return 'Ceramic Dado Tiles (2ft above platform)';
    case 'pooja':
      return 'Marble Cladding';
    default:
      return preferences.budget === 'luxury' ? 'Textured Paint' : 'Acrylic Emulsion Paint';
  }
}

// ============================================
// SPATIAL VALIDATION
// ============================================

/**
 * Check if two rectangular regions overlap
 */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Check if two rooms are adjacent (within ~0.5m)
 */
export function areRoomsAdjacent(a: PlacedRoom, b: PlacedRoom): boolean {
  const gap = 0.5;
  return !(
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  );
}

/**
 * Validate that a room has adequate furniture clearance
 * Delegates to CodeComplianceValidator for detailed checks
 */
export function validateFurnitureClearance(room: PlacedRoom): { valid: boolean; warnings: string[] } {
  return codeComplianceValidator.validateFurnitureClearance(room);
}

// ============================================
// ROOM CATEGORIZATION
// ============================================

/**
 * Sort rooms by priority for placement order
 * Architect priority: public → private → service → utility
 */
export function sortRoomsByPriority(rooms: RoomSpec[], _orientation: SiteOrientation): RoomSpec[] {
  const ZONE_ORDER: Record<string, number> = {
    entrance_lobby: 0, foyer: 0,
    living: 1, drawing_room: 1,
    dining: 2,
    kitchen: 3, pantry: 4, utility: 4, store: 4,
    master_bedroom: 5, bedroom: 6, childrens_room: 6, guest_room: 6,
    study: 7, home_office: 7, library: 7,
    bathroom: 8, toilet: 8, walk_in_closet: 8, dressing: 8,
    pooja: 9,
    staircase: 10, lift: 10, corridor: 10,
    laundry: 11, servants_quarter: 11, mechanical_room: 11,
    parking: 12, garage: 12,
    balcony: 13, terrace: 13,
  };

  const priorityOrder: Record<string, number> = {
    essential: 0,
    important: 1,
    desirable: 2,
    optional: 3,
  };

  return [...rooms].sort((a, b) => {
    // Attached baths placed immediately after their parent bedroom
    // Essential rooms first, then by zone order, then by area (larger first)
    const pa = priorityOrder[a.priority] ?? 10;
    const pb = priorityOrder[b.priority] ?? 10;
    if (pa !== pb) return pa - pb;

    const za = ZONE_ORDER[a.type] ?? 20;
    const zb = ZONE_ORDER[b.type] ?? 20;
    if (za !== zb) return za - zb;

    return (b.preferredArea || 0) - (a.preferredArea || 0);
  });
}
