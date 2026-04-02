/**
 * GeometryValidationUtils - Room geometry, overlap detection, and adjacency rules
 *
 * Handles:
 * - Rectangle overlap detection for collision avoidance
 * - Room adjacency checking with clearance gaps
 * - Furniture clearance validation
 * - Adjacency rules (rooms that should be near each other)
 * - Avoidance rules (rooms that should be far from each other)
 * - Material finish specifications per room type and budget
 */

import {
  PlacedRoom,
  RoomType,
  UserPreferences,
} from './types';
import { codeComplianceValidator } from './CodeComplianceValidator';

/**
 * Check if two rectangles overlap
 */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Check if two rooms are adjacent (with 0.5m gap tolerance)
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
 * Validate furniture clearance for a room
 *
 * Ensures rooms are large enough for their intended furniture:
 * - Bedroom: bed (2m×1.5m) + 0.6m clearance on 3 sides + wardrobe (0.6m deep)
 * - Living: sofa (0.9m deep) + 0.9m passage behind + TV wall 3m min
 * - Dining: table (1.2m×0.8m) + 0.75m chair pullback on each side
 * - Kitchen: 0.6m platform + 0.9m working space for L/U configurations
 * - Study: desk (1.2m×0.6m) + 0.75m chair + 0.6m movement
 */
export function validateFurnitureClearance(
  room: PlacedRoom,
): { valid: boolean; warnings: string[] } {
  return codeComplianceValidator.validateFurnitureClearance(room);
}

/**
 * Get adjacency preferences for a room type
 *
 * Returns rooms that should ideally be adjacent to this room
 * for efficient space planning and workflow.
 */
export function getAdjacencyRules(type: RoomType): RoomType[] {
  const rules: Partial<Record<RoomType, RoomType[]>> = {
    living:          ['dining', 'entrance_lobby', 'foyer', 'drawing_room', 'balcony', 'verandah'],
    dining:          ['kitchen', 'living', 'pantry', 'sit_out'],
    kitchen:         ['dining', 'utility', 'pantry', 'store', 'laundry'],
    master_bedroom:  ['walk_in_closet', 'dressing', 'bathroom', 'balcony'],
    bedroom:         ['bathroom', 'balcony', 'study'],
    guest_room:      ['bathroom', 'living'],
    childrens_room:  ['bathroom', 'study'],
    study:           ['library', 'bedroom', 'home_office'],
    home_office:     ['study', 'library'],
    library:         ['study', 'home_office'],
    entrance_lobby:  ['living', 'staircase', 'foyer', 'drawing_room'],
    foyer:           ['living', 'entrance_lobby', 'staircase'],
    drawing_room:    ['living', 'entrance_lobby', 'foyer'],
    pooja:           ['living', 'entrance_lobby', 'foyer'],
    staircase:       ['entrance_lobby', 'foyer', 'corridor', 'lift'],
    lift:            ['staircase', 'corridor', 'foyer'],
    utility:         ['kitchen', 'laundry', 'store'],
    laundry:         ['utility', 'kitchen', 'bathroom'],
    store:           ['kitchen', 'utility', 'pantry'],
    pantry:          ['kitchen', 'dining', 'store'],
    walk_in_closet:  ['master_bedroom', 'dressing'],
    dressing:        ['master_bedroom', 'walk_in_closet', 'bathroom'],
    servants_quarter:['kitchen', 'utility', 'garage'],
    parking:         ['entrance_lobby', 'garage', 'staircase'],
    garage:          ['parking', 'entrance_lobby'],
    balcony:         ['living', 'bedroom', 'master_bedroom'],
    terrace:         ['staircase', 'living'],
    gym:             ['bathroom', 'balcony'],
    home_theater:    ['living'],
    swimming_pool:   ['garden', 'gym'],
    garden:          ['sit_out', 'verandah', 'swimming_pool'],
    sit_out:         ['garden', 'dining', 'verandah'],
    verandah:        ['living', 'garden', 'sit_out'],
  };
  return rules[type] || [];
}

/**
 * Get avoidance rules for a room type
 *
 * Returns rooms that should NOT be adjacent to this room
 * due to noise, hygiene, vastu, or privacy concerns.
 */
export function getAvoidanceRules(type: RoomType): RoomType[] {
  const rules: Partial<Record<RoomType, RoomType[]>> = {
    kitchen:         ['toilet', 'bathroom', 'pooja', 'bedroom', 'master_bedroom'],
    pooja:           ['toilet', 'bathroom', 'kitchen', 'laundry'],
    master_bedroom:  ['kitchen', 'garage', 'parking', 'mechanical_room'],
    bedroom:         ['kitchen', 'garage', 'parking', 'mechanical_room'],
    childrens_room:  ['kitchen', 'garage', 'parking', 'mechanical_room'],
    guest_room:      ['kitchen', 'garage', 'servants_quarter'],
    dining:          ['toilet', 'bathroom', 'garage', 'parking'],
    living:          ['toilet', 'garage', 'parking', 'mechanical_room'],
    drawing_room:    ['toilet', 'kitchen', 'garage'],
    study:           ['kitchen', 'home_theater', 'gym'],
    home_theater:    ['study', 'bedroom', 'pooja'],
    swimming_pool:   ['electrical_panel', 'pooja'],
  };
  return rules[type] || [];
}

/**
 * Get floor finish specification for a room type
 *
 * Varies by budget level and room function
 */
export function getFloorFinish(type: RoomType, preferences: UserPreferences): string {
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
 * Get wall finish specification for a room type
 *
 * Varies by room function and budget level
 */
export function getWallFinish(type: RoomType, preferences: UserPreferences): string {
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
