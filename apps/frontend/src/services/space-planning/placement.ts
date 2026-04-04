import type { PlacedRoom } from './types';
import type { ArchitecturalZone } from './constants';

/** Context shared across architectural placement pipeline stages */
export interface PlacementContext {
  corridorZone: { x: number; y: number; w: number; h: number };
  entranceSide: 'N' | 'S' | 'E' | 'W';
  placedByZone: Map<ArchitecturalZone, PlacedRoom[]>;
  wetWallX: number | null;
  wetWallY: number | null;
}