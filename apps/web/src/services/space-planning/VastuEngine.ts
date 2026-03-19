/**
 * VastuEngine - Comprehensive Vastu Shastra Analysis
 *
 * 35+ years architectural wisdom encoded:
 * - 8 cardinal directions mapped to elements, planets, deities
 * - Room placement validation per Vastu Purusha Mandala
 * - Color, material, and element recommendations
 * - Astrological considerations for entries, water elements, fire zones
 */

import type {
  CardinalDirection,
  VastuZone,
  VastuAnalysis,
  VastuViolation,
  RoomType,
  PlacedRoom,
  SiteOrientation,
  FloorPlan,
  ColorScheme,
} from './types';

// ============================================
// VASTU PURUSHA MANDALA - ZONE DEFINITIONS
// ============================================

const VASTU_ZONES: VastuZone[] = [
  {
    direction: 'N',
    element: 'water',
    planet: 'Mercury (Budh)',
    deity: 'Kubera (Lord of Wealth)',
    recommendedRooms: ['living', 'entrance_lobby', 'drawing_room', 'balcony', 'sit_out'],
    avoidRooms: ['kitchen', 'toilet', 'store', 'garage'],
    colors: ['#2563EB', '#3B82F6', '#60A5FA', '#DBEAFE', '#FFFFFF'], // Blues, White
    materials: ['marble', 'glass', 'mirror'],
  },
  {
    direction: 'NE',
    element: 'water',
    planet: 'Jupiter (Guru)',
    deity: 'Ishanya (Lord Shiva)',
    recommendedRooms: ['pooja', 'study', 'library', 'entrance_lobby', 'balcony'],
    avoidRooms: ['toilet', 'kitchen', 'store', 'staircase', 'garage', 'servants_quarter'],
    colors: ['#F9FAFB', '#FDE68A', '#FEF3C7', '#FFFBEB', '#DBEAFE'], // Light Yellow, White
    materials: ['marble', 'glass', 'lightweight materials'],
  },
  {
    direction: 'E',
    element: 'air',
    planet: 'Sun (Surya)',
    deity: 'Indra (King of Gods)',
    recommendedRooms: ['living', 'dining', 'bathroom', 'entrance_lobby', 'balcony', 'study'],
    avoidRooms: ['toilet', 'garage', 'store'],
    colors: ['#FFFFFF', '#FEF3C7', '#ECFDF5', '#F0FDF4'], // White, Light Green
    materials: ['wood', 'glass', 'natural stone'],
  },
  {
    direction: 'SE',
    element: 'fire',
    planet: 'Venus (Shukra)',
    deity: 'Agni (Fire God)',
    recommendedRooms: ['kitchen', 'electrical_panel', 'mechanical_room'],
    avoidRooms: ['master_bedroom', 'bedroom', 'pooja', 'water_tank_room', 'swimming_pool'],
    colors: ['#EF4444', '#F97316', '#FB923C', '#FED7AA', '#FECACA'], // Red, Orange
    materials: ['granite', 'ceramic', 'fire-resistant materials'],
  },
  {
    direction: 'S',
    element: 'earth',
    planet: 'Mars (Mangal)',
    deity: 'Yama (Lord of Death/Dharma)',
    recommendedRooms: ['store', 'garage', 'utility', 'workshop'],
    avoidRooms: ['entrance_lobby', 'pooja', 'water_tank_room'],
    colors: ['#DC2626', '#991B1B', '#7F1D1D', '#FCA5A5'], // Deep Red
    materials: ['brick', 'heavy materials', 'stone'],
  },
  {
    direction: 'SW',
    element: 'earth',
    planet: 'Rahu (North Node)',
    deity: 'Nairutya (Demon)',
    recommendedRooms: ['master_bedroom', 'store', 'walk_in_closet', 'dressing'],
    avoidRooms: ['pooja', 'entrance_lobby', 'bathroom', 'kitchen', 'childrens_room'],
    colors: ['#92400E', '#B45309', '#D97706', '#FDE68A', '#FBBF24'], // Earth tones, Brown
    materials: ['heavy materials', 'stone', 'teak wood'],
  },
  {
    direction: 'W',
    element: 'space',
    planet: 'Saturn (Shani)',
    deity: 'Varuna (Water God)',
    recommendedRooms: ['dining', 'childrens_room', 'study', 'staircase', 'store'],
    avoidRooms: [],
    colors: ['#1E3A5F', '#374151', '#4B5563', '#D1D5DB'], // Blue, Grey
    materials: ['metal', 'concrete', 'stone'],
  },
  {
    direction: 'NW',
    element: 'air',
    planet: 'Moon (Chandra)',
    deity: 'Vayu (Wind God)',
    recommendedRooms: ['guest_room', 'bathroom', 'garage', 'servants_quarter', 'living'],
    avoidRooms: ['master_bedroom', 'pooja', 'store'],
    colors: ['#F9FAFB', '#E5E7EB', '#D1D5DB', '#DBEAFE'], // White, Light Grey
    materials: ['light materials', 'aluminum', 'glass'],
  },
];

// ============================================
// ROOM-DIRECTION IDEAL MAPPING
// ============================================

const IDEAL_ROOM_DIRECTIONS: Record<RoomType, CardinalDirection[]> = {
  living: ['N', 'NE', 'E'],
  dining: ['W', 'E', 'S'],
  kitchen: ['SE'],
  master_bedroom: ['SW'],
  bedroom: ['S', 'W', 'NW'],
  bathroom: ['E', 'NW', 'W'],
  toilet: ['NW', 'W', 'S'],
  pooja: ['NE'],
  study: ['NE', 'E', 'N'],
  home_office: ['N', 'NE', 'E'],
  store: ['SW', 'S', 'W'],
  utility: ['S', 'SW', 'W'],
  laundry: ['S', 'SW', 'W'],
  garage: ['NW', 'SE', 'W'],
  parking: ['NW', 'SE', 'W'],
  balcony: ['N', 'E', 'NE'],
  terrace: ['N', 'E'],
  corridor: ['N', 'E', 'W', 'S'],
  staircase: ['S', 'W', 'SW'],
  lift: ['S', 'W'],
  entrance_lobby: ['N', 'E', 'NE'],
  drawing_room: ['N', 'NE', 'E'],
  guest_room: ['NW', 'W'],
  servants_quarter: ['NW', 'W', 'S'],
  pantry: ['SE', 'W'],
  gym: ['SW', 'S'],
  home_theater: ['SW', 'W', 'S'],
  swimming_pool: ['NE', 'N'],
  garden: ['N', 'E', 'NE'],
  sit_out: ['N', 'E', 'NE'],
  verandah: ['N', 'E'],
  foyer: ['N', 'E', 'NE'],
  walk_in_closet: ['SW', 'W'],
  dressing: ['SW', 'W'],
  childrens_room: ['W', 'NW'],
  library: ['NE', 'E', 'N'],
  workshop: ['S', 'SW'],
  basement: ['S', 'SW', 'W'],
  mechanical_room: ['S', 'SW'],
  electrical_panel: ['SE'],
  water_tank_room: ['NE', 'N'],
};

// ============================================
// MAIN VASTU ENGINE
// ============================================

export class VastuEngine {
  /**
   * Get all Vastu zones with their properties
   */
  getZones(): VastuZone[] {
    return VASTU_ZONES;
  }

  /**
   * Get ideal direction for a room type
   */
  getIdealDirection(roomType: RoomType): CardinalDirection[] {
    return IDEAL_ROOM_DIRECTIONS[roomType] || ['N'];
  }

  /**
   * Get Vastu zone for a direction
   */
  getZone(direction: CardinalDirection): VastuZone {
    return VASTU_ZONES.find((z) => z.direction === direction) || VASTU_ZONES[0];
  }

  private getDoorGlobalCenter(room: any, door: any): { x: number; y: number } {
    const cx = door.position + door.width / 2;
    switch (door.wallSide) {
      case 'N': return { x: room.x + cx, y: room.y };
      case 'S': return { x: room.x + cx, y: room.y + room.height };
      case 'E': return { x: room.x + room.width, y: room.y + cx };
      case 'W': return { x: room.x, y: room.y + cx };
      default: return { x: room.x, y: room.y };
    }
  }

  private areDoorsFacing(r1: any, d1: any, r2: any, d2: any): boolean {
    const opp: Record<string, string> = { 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E' };
    if (opp[d1.wallSide] !== d2.wallSide) return false;

    const c1 = this.getDoorGlobalCenter(r1, d1);
    const c2 = this.getDoorGlobalCenter(r2, d2);

    if (d1.wallSide === 'N' || d1.wallSide === 'S') {
      const xDiff = Math.abs(c1.x - c2.x);
      const yDiff = Math.abs(c1.y - c2.y);
      return xDiff < (d1.width + d2.width) / 2 && yDiff < 4;
    } else {
      const yDiff = Math.abs(c1.y - c2.y);
      const xDiff = Math.abs(c1.x - c2.x);
      return yDiff < (d1.width + d2.width) / 2 && xDiff < 4;
    }
  }

  /**
   * Analyze full floor plan for Vastu compliance
   */
  analyzePlan(floorPlans: FloorPlan[], orientation: SiteOrientation): VastuAnalysis {
    const violations: VastuViolation[] = [];
    let totalScore = 100;

    for (const plan of floorPlans) {
      // Check for bedroom doors facing each other directly and proximity
      const bedroomTypes = ['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'];
      const bedrooms = plan.rooms.filter((r) => bedroomTypes.includes(r.spec.type as any));
      // also include guest_bedroom if present as it was there previously
      const allBedrooms = plan.rooms.filter((r) => bedroomTypes.includes(r.spec.type as any) || r.spec.type === 'guest_room' as any);
      
      for (let i = 0; i < allBedrooms.length; i++) {
        for (let j = i + 1; j < allBedrooms.length; j++) {
          const b1 = allBedrooms[i];
          const b2 = allBedrooms[j];
          for (const d1 of b1.doors || []) {
            for (const d2 of b2.doors || []) {
              if (this.areDoorsFacing(b1, d1, b2, d2)) {
                totalScore -= 4;
                violations.push({
                  id: `vastu-doors-${b1.id}-${b2.id}`,
                  severity: 'minor',
                  room: b1.spec.name + ' & ' + b2.spec.name,
                  issue: `Doors of ${b1.spec.name} and ${b2.spec.name} are facing each other directly, which can cause energy conflicts.`,
                  recommendation: `Reposition one of the doors to avoid direct alignment.`,
                  direction: this.getRoomDirection(b1, plan),
                });
              }
              
              const c1 = this.getDoorGlobalCenter(b1, d1);
              const c2 = this.getDoorGlobalCenter(b2, d2);
              const dist = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
              if (dist < 1.5) {
                totalScore -= 5;
                violations.push({
                  id: `arch-doors-dist-${b1.id}-${b2.id}`,
                  severity: 'major',
                  room: b1.spec.name + ' & ' + b2.spec.name,
                  issue: `Doors of ${b1.spec.name} and ${b2.spec.name} are too close (${dist.toFixed(1)}m). Architecture dictates keeping bedroom entrances separated for privacy.`,
                  recommendation: `Separate the entrances by at least 1.5m so they do not look directly into each other.`,
                  direction: this.getRoomDirection(b1, plan),
                });
              }
            }
          }
        }
      }

      for (const room of plan.rooms) {
        const roomDirection = this.getRoomDirection(room, plan);
        const idealDirections = IDEAL_ROOM_DIRECTIONS[room.spec.type];

        if (idealDirections && !idealDirections.includes(roomDirection)) {
          const zone = this.getZone(roomDirection);
          const severity = zone.avoidRooms.includes(room.spec.type) ? 'critical' : 'minor';
          const scoreDeduction = severity === 'critical' ? 10 : 3;
          totalScore -= scoreDeduction;

          violations.push({
            id: `vastu-${room.id}`,
            severity,
            room: room.spec.name,
            issue: `${room.spec.name} is placed in the ${roomDirection} direction. Ideal: ${idealDirections.join(', ')}`,
            recommendation: `Move ${room.spec.name} to ${idealDirections[0]} direction for better Vastu compliance.`,
            direction: roomDirection,
          });
        }
      }
    }

    // Check entrance
    const entranceAuspicious = ['N', 'E', 'NE'].includes(orientation.mainEntryDirection);
    if (!entranceAuspicious) {
      totalScore -= 8;
      violations.push({
        id: 'vastu-entrance',
        severity: 'major',
        room: 'Main Entrance',
        issue: `Main entrance faces ${orientation.mainEntryDirection}. Ideal: N, E, or NE.`,
        recommendation:
          'Consider placing the main entrance in the North, East, or Northeast direction.',
        direction: orientation.mainEntryDirection,
      });
    }

    // Check staircase
    const staircaseRooms = floorPlans.flatMap((fp) =>
      fp.rooms.filter((r) => r.spec.type === 'staircase'),
    );
    const staircaseCompliant =
      staircaseRooms.length === 0 ||
      staircaseRooms.every((s) =>
        ['S', 'W', 'SW'].includes(this.getRoomDirection(s, floorPlans[0])),
      );
    if (!staircaseCompliant) totalScore -= 5;

    // Check kitchen
    const kitchens = floorPlans.flatMap((fp) => fp.rooms.filter((r) => r.spec.type === 'kitchen'));
    const kitchenCompliant =
      kitchens.length === 0 ||
      kitchens.some((k) => this.getRoomDirection(k, floorPlans[0]) === 'SE');
    if (!kitchenCompliant) totalScore -= 7;

    // Check master bedroom
    const masters = floorPlans.flatMap((fp) =>
      fp.rooms.filter((r) => r.spec.type === 'master_bedroom'),
    );
    const masterBedCompliant =
      masters.length === 0 || masters.some((m) => this.getRoomDirection(m, floorPlans[0]) === 'SW');
    if (!masterBedCompliant) totalScore -= 5;

    // Check toilet
    const toilets = floorPlans.flatMap((fp) =>
      fp.rooms.filter((r) => r.spec.type === 'toilet' || r.spec.type === 'bathroom'),
    );
    const toiletCompliant =
      toilets.length === 0 ||
      toilets.every((t) => !['NE', 'N', 'E'].includes(this.getRoomDirection(t, floorPlans[0])));
    if (!toiletCompliant) totalScore -= 6;

    // Check pooja
    const poojas = floorPlans.flatMap((fp) => fp.rooms.filter((r) => r.spec.type === 'pooja'));
    const poojaCompliant =
      poojas.length === 0 || poojas.some((p) => this.getRoomDirection(p, floorPlans[0]) === 'NE');
    if (!poojaCompliant) totalScore -= 5;

    const recommendations = this.generateRecommendations(violations, orientation);

    return {
      zones: VASTU_ZONES,
      overallScore: Math.max(0, Math.min(100, totalScore)),
      violations,
      recommendations,
      entranceAuspicious,
      staircaseCompliant,
      kitchenCompliant,
      masterBedCompliant,
      toiletCompliant,
      poojaCompliant,
      waterElements: [
        { direction: 'NE', compliant: true },
        { direction: 'N', compliant: true },
      ],
    };
  }

  /**
   * Get recommended colors for a room based on its direction
   */
  getColorRecommendations(roomType: RoomType, direction: CardinalDirection): ColorScheme {
    const zone = this.getZone(direction);
    const primaryColor = zone.colors[0] || '#FFFFFF';
    const accentColor = zone.colors[1] || '#3B82F6';

    return {
      roomType,
      wallColor: zone.colors[3] || '#F9FAFB',
      ceilingColor: '#FFFFFF',
      floorColor: zone.colors[2] || '#D1D5DB',
      accentColor,
      vastuCompatible: true,
      direction,
      mood: this.getMoodForElement(zone.element),
    };
  }

  /**
   * Determine room direction relative to center of plot
   */
  private getRoomDirection(room: PlacedRoom, plan: FloorPlan): CardinalDirection {
    const allRooms = plan.rooms;
    if (allRooms.length === 0) return 'N';

    // Center of the floor plan
    const maxX = Math.max(...allRooms.map((r) => r.x + r.width));
    const maxY = Math.max(...allRooms.map((r) => r.y + r.height));
    const centerX = maxX / 2;
    const centerY = maxY / 2;

    // Center of room
    const roomCX = room.x + room.width / 2;
    const roomCY = room.y + room.height / 2;

    // Angle from center
    const angle = (Math.atan2(centerY - roomCY, roomCX - centerX) * 180) / Math.PI;
    return this.angleToDirection(angle);
  }

  private angleToDirection(angle: number): CardinalDirection {
    // Normalize to 0-360
    const normalized = ((angle % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'E';
    if (normalized >= 22.5 && normalized < 67.5) return 'NE';
    if (normalized >= 67.5 && normalized < 112.5) return 'N';
    if (normalized >= 112.5 && normalized < 157.5) return 'NW';
    if (normalized >= 157.5 && normalized < 202.5) return 'W';
    if (normalized >= 202.5 && normalized < 247.5) return 'SW';
    if (normalized >= 247.5 && normalized < 292.5) return 'S';
    return 'SE';
  }

  private getMoodForElement(element: string): 'calm' | 'energetic' | 'warm' | 'cool' | 'neutral' {
    switch (element) {
      case 'water':
        return 'calm';
      case 'fire':
        return 'energetic';
      case 'earth':
        return 'warm';
      case 'air':
        return 'cool';
      default:
        return 'neutral';
    }
  }

  private generateRecommendations(
    violations: VastuViolation[],
    orientation: SiteOrientation,
  ): string[] {
    const recs: string[] = [];

    // General recommendations
    recs.push(
      'Keep the center (Brahmasthan) of the house open and clutter-free for positive energy flow.',
    );
    recs.push(`Plot faces ${orientation.plotFacing} — plan room placement accordingly.`);

    if (!['N', 'E', 'NE'].includes(orientation.mainEntryDirection)) {
      recs.push('Consider a secondary entrance from North or East to invite positive energy.');
    }

    recs.push('Northeast should be the lightest and most open part of the house.');
    recs.push('Southwest should be the heaviest — place master bedroom, heavy furniture here.');
    recs.push('Slope of land/roof should ideally be from SW (high) to NE (low).');
    recs.push('Water features (fountain, bore well) work best in the Northeast.');
    recs.push('Avoid placing mirrors on the South or West walls of bedrooms.');
    recs.push('Sleep with head pointing South or East for restful sleep.');
    recs.push('Kitchen cooking platform should face East; cook should face East while cooking.');

    // Specific violations
    for (const v of violations.filter((v) => v.severity === 'critical')) {
      recs.push(`CRITICAL: ${v.recommendation}`);
    }

    return recs;
  }
}

export const vastuEngine = new VastuEngine();


// Update Vastu defaults checking for privacy or bedroom proximity
export const PRIVACY_RULES = {
  RESTRICTED_CONNECTIONS: [
    ['master_bedroom', 'bedroom'],
    ['bedroom', 'bedroom'],
    ['master_bedroom', 'childrens_room']
  ]
};
