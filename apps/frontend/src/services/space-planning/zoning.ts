import { ArchitecturalZone, ROOM_ZONE_MAP } from './constants';
import type { RoomType } from './types';

export type RoomZone = 'public' | 'private' | 'service' | 'circulation';

const PUBLIC_ROOMS: RoomType[] = [
  'living',
  'dining',
  'drawing_room',
  'entrance_lobby',
  'foyer',
  'guest_room',
  'pooja',
  'sit_out',
  'verandah',
];

const SERVICE_ROOMS: RoomType[] = [
  'kitchen',
  'pantry',
  'utility',
  'store',
  'laundry',
  'servants_quarter',
  'mechanical_room',
  'electrical_panel',
  'water_tank_room',
  'parking',
  'garage',
];

const CIRCULATION_ROOMS: RoomType[] = ['corridor', 'staircase', 'lift'];

/** Returns coarse zone used by legacy placement flow. */
export function getRoomZone(type: RoomType): RoomZone {
  if (PUBLIC_ROOMS.includes(type)) return 'public';
  if (SERVICE_ROOMS.includes(type)) return 'service';
  if (CIRCULATION_ROOMS.includes(type)) return 'circulation';
  return 'private';
}

/** Returns architectural zone map used by new placement pipeline. */
export function classifyRoomZone(type: RoomType): ArchitecturalZone {
  return ROOM_ZONE_MAP[type] ?? ArchitecturalZone.PRIVATE;
}

/** True for wet areas that benefit from plumbing clustering. */
export function isWetRoom(type: RoomType): boolean {
  return ['bathroom', 'toilet', 'kitchen', 'laundry', 'utility'].includes(type);
}

/** True for room types typically attached to parent bedrooms. */
export function isAttachedBath(type: RoomType): boolean {
  return type === 'bathroom' || type === 'toilet' || type === 'walk_in_closet' || type === 'dressing';
}