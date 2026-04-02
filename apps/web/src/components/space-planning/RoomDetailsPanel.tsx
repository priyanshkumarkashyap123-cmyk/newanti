/**
 * RoomDetailsPanel.tsx
 * Displays detailed information about a selected room
 */

import { motion } from 'framer-motion';
import type { HousePlanProject, PlacedRoom } from '../../services/space-planning/types';
import { InfoItem } from './PanelUtilityComponents';

export const RoomDetailsPanel: React.FC<{
  room: PlacedRoom;
  project: HousePlanProject;
}> = ({ room, project }) => {
  const colorScheme = project.colorSchemes.find((cs) => cs.roomType === room.spec.type);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-canvas rounded-xl border border-border p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
        {room.spec.name}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <InfoItem
          label="Dimensions"
          value={`${room.width.toFixed(1)}m × ${room.height.toFixed(1)}m`}
        />
        <InfoItem label="Area" value={`${(room.width * room.height).toFixed(1)} sq.m`} />
        <InfoItem label="Ceiling Height" value={`${room.ceilingHeight}m`} />
        <InfoItem label="Wall Thickness" value={`${room.wallThickness * 1000}mm`} />
        <InfoItem label="Floor Finish" value={room.finishFloor} />
        <InfoItem label="Wall Finish" value={room.finishWall} />
        <InfoItem label="Ceiling Finish" value={room.finishCeiling} />
        <InfoItem label="Vastu Direction" value={room.spec.vastuDirection || 'N/A'} />
        <InfoItem label="Doors" value={`${room.doors.length}`} />
        <InfoItem label="Windows" value={`${room.windows.length}`} />
        {colorScheme && (
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-slate-400">Colors:</span>
            {[colorScheme.wallColor, colorScheme.floorColor, colorScheme.accentColor].map(
              (c, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded border border-slate-300"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ),
            )}
            <span className="text-[10px] text-slate-400">Mood: {colorScheme.mood}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
