import { PlacedRoom, RoomType } from './types';
import { KITCHEN_LAYOUT } from './constants';

export class CodeComplianceValidator {
  /**
   * Validates minimum NBC dimensions for a room
   * Returns { valid: boolean, warnings: string[] }
   */
  public validateFurnitureClearance(room: PlacedRoom): { valid: boolean; warnings: string[] } {
    const rType = room.spec.type;
    const rW = room.width;
    const rH = room.height;
    const warnings: string[] = [];
    let valid = true;

    // Bedroom furniture clearance
    if (['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(rType)) {
      const bedW = rType === 'master_bedroom' ? 1.8 : 1.5; // King vs Queen
      const bedH = 2.0;
      const wardrobeDepth = 0.6;
      const clearance = 0.6; // Minimum passage around bed

      const minWidthNeeded = bedW + clearance * 2;
      const minHeightNeeded = bedH + clearance + wardrobeDepth;

      if (rW < minWidthNeeded) {
        warnings.push(`${rType}: ${rW}m width too narrow for bed (${bedW}m) + clearance. Need ${minWidthNeeded}m`);
        valid = false;
      }
      if (rH < minHeightNeeded) {
        warnings.push(`${rType}: ${rH}m depth insufficient for bed + wardrobe. Need ${minHeightNeeded}m`);
        valid = false;
      }

      const doorSide = room.doors.length > 0 ? room.doors[0].wallSide : null;
      if (doorSide === 'N' || doorSide === 'S') {
        const doorPos = room.doors.length > 0 ? room.doors[0].position || 0 : 0;
        const doorWidth = room.doors.length > 0 ? room.doors[0].width : 0.9;
        if (doorPos + doorWidth + 0.3 > rW - clearance) {
          warnings.push(`${rType}: door swing may conflict with bed placement`);
        }
      }
    }

    // Living room furniture clearance
    if (rType === 'living' || rType === 'drawing_room') {
      if (Math.min(rW, rH) < 3.0) {
        warnings.push(`${rType}: min 3.0m clear dimension needed for sofa + TV arrangement`);
        valid = false;
      }
      if (rW * rH < 14) {
        warnings.push(`${rType}: ${(rW * rH).toFixed(1)}m² may be insufficient for living furniture`);
      }
    }

    // Dining room furniture clearance
    if (rType === 'dining') {
      const tableH = 0.8;
      const chairPullback = 0.75;
      const minDimNeeded = tableH + chairPullback * 2; // 2.3m

      if (Math.min(rW, rH) < minDimNeeded) {
        warnings.push(`Dining: ${Math.min(rW, rH).toFixed(1)}m too narrow for dining table. Need ${minDimNeeded}m`);
        valid = false;
      }
    }

    // Kitchen clearance
    if (rType === 'kitchen') {
      const platformDepth = KITCHEN_LAYOUT?.PLATFORM_DEPTH || 0.6;
      const workingSpace = 0.9;
      const minWidth = platformDepth + workingSpace; // 1.5m

      if (Math.min(rW, rH) < minWidth) {
        warnings.push(`Kitchen: ${Math.min(rW, rH).toFixed(1)}m too narrow for platform + working space. Need ${minWidth}m`);
        valid = false;
      }

      if (rW * rH > 8) {
        const shortSide = Math.min(rW, rH);
        if (shortSide < 2.1) {
          warnings.push(`Kitchen: L-shaped layout needs min 2.1m width (have ${shortSide.toFixed(1)}m)`);
        }
      }
    }

    // Study/home office clearance
    if (rType === 'study' || rType === 'home_office') {
      const minDepth = 0.6 + 0.75 + 0.3; // 1.65m
      if (Math.min(rW, rH) < minDepth) {
        warnings.push(`${rType}: ${Math.min(rW, rH).toFixed(1)}m too narrow for desk + chair + shelf`);
        valid = false;
      }
    }

    return { valid, warnings };
  }
}

export const codeComplianceValidator = new CodeComplianceValidator();
