/**
 * MemberOffsetsDialog.tsx — Member End Offsets (Rigid End Zones)
 * 
 * Industry parity: STAAD Pro "Member Offset", SAP2000 "Frame → End Offsets/Rigid Zones",
 * ETABS "Frame → Insertion Point", RISA "Member → Rigid End Zones"
 * 
 * Offsets define the physical distance from the connection point to the member end.
 * Used for eccentric connections, deep beam-column joints, etc.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Check, MoveHorizontal, Info } from 'lucide-react';
import { useModelStore } from '../../store/model';

interface MemberOffsetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OffsetValues {
  startX: number; startY: number; startZ: number;
  endX: number;   endY: number;   endZ: number;
}

const DEFAULT_OFFSETS: OffsetValues = {
  startX: 0, startY: 0, startZ: 0,
  endX: 0, endY: 0, endZ: 0,
};

export const MemberOffsetsDialog: React.FC<MemberOffsetsDialogProps> = ({ isOpen, onClose }) => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [offsets, setOffsets] = useState<OffsetValues>({ ...DEFAULT_OFFSETS });
  const [rigidZoneFactor, setRigidZoneFactor] = useState(1.0);

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  // Initialize from first selected member
  useEffect(() => {
    if (isOpen && selectedMembers.length > 0) {
      const m = selectedMembers[0];
      setOffsets({
        startX: m.startOffset?.x ?? 0,
        startY: m.startOffset?.y ?? 0,
        startZ: m.startOffset?.z ?? 0,
        endX: m.endOffset?.x ?? 0,
        endY: m.endOffset?.y ?? 0,
        endZ: m.endOffset?.z ?? 0,
      });
    }
  }, [isOpen]);

  const updateOffset = (key: keyof OffsetValues, value: number) => {
    setOffsets(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, {
        startOffset: {
          x: offsets.startX * rigidZoneFactor,
          y: offsets.startY * rigidZoneFactor,
          z: offsets.startZ * rigidZoneFactor,
        },
        endOffset: {
          x: offsets.endX * rigidZoneFactor,
          y: offsets.endY * rigidZoneFactor,
          z: offsets.endZ * rigidZoneFactor,
        },
      });
    });
    onClose();
  }, [offsets, rigidZoneFactor, selectedMembers, updateMember, onClose]);

  const hasAnyOffset = Object.values(offsets).some(v => v !== 0);

  const OffsetInputs: React.FC<{ end: 'Start' | 'End' }> = ({ end }) => {
    const prefix = end.toLowerCase() as 'start' | 'end';
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${end === 'Start' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
          {end} End Offset
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {(['X', 'Y', 'Z'] as const).map(axis => {
            const key = `${prefix}${axis}` as keyof OffsetValues;
            const colorMap = { X: 'text-red-500', Y: 'text-green-500', Z: 'text-blue-500' };
            return (
              <div key={key}>
                <Label className="text-xs">
                  <span className={`font-mono font-bold ${colorMap[axis]}`}>{axis}</span> (m)
                </Label>
                <Input
                  type="number"
                  value={offsets[key]}
                  onChange={e => updateOffset(key, +e.target.value)}
                  step={0.01}
                  className="font-mono text-sm"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="w-5 h-5 text-cyan-500" />
            Member End Offsets
          </DialogTitle>
          <DialogDescription>
            Set rigid end zone offsets for {selectedMembers.length > 0 ? `${selectedMembers.length} selected member${selectedMembers.length > 1 ? 's' : ''}` : 'selected members'}.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Visual hint */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-center">
            <svg viewBox="0 0 300 60" className="w-full h-16">
              {/* Full member line */}
              <line x1="30" y1="30" x2="270" y2="30" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
              {/* Start offset zone */}
              {hasAnyOffset && (
                <>
                  <rect x="30" y="20" width="40" height="20" fill="#10B981" opacity="0.15" rx="2" />
                  <rect x="230" y="20" width="40" height="20" fill="#F97316" opacity="0.15" rx="2" />
                </>
              )}
              {/* Active member line */}
              <line x1={hasAnyOffset ? 70 : 30} y1="30" x2={hasAnyOffset ? 230 : 270} y2="30" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
              {/* Nodes */}
              <circle cx="30" cy="30" r="5" fill="#10B981" />
              <circle cx="270" cy="30" r="5" fill="#F97316" />
              {/* Labels */}
              <text x="30" y="52" fontSize="8" fill="#10B981" textAnchor="middle">Start Node</text>
              <text x="270" y="52" fontSize="8" fill="#F97316" textAnchor="middle">End Node</text>
              {hasAnyOffset && (
                <>
                  <text x="50" y="15" fontSize="7" fill="#64748b" textAnchor="middle">Rigid Zone</text>
                  <text x="250" y="15" fontSize="7" fill="#64748b" textAnchor="middle">Rigid Zone</text>
                </>
              )}
            </svg>
          </div>

          {/* Start / End Offset Inputs */}
          <div className="grid grid-cols-2 gap-6">
            <OffsetInputs end="Start" />
            <OffsetInputs end="End" />
          </div>

          {/* Rigid Zone Factor */}
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Rigid Zone Factor (0.0 – 1.0)</Label>
            <div className="flex gap-3 items-center mt-1">
              <Input
                type="number"
                value={rigidZoneFactor}
                onChange={e => setRigidZoneFactor(Math.max(0, Math.min(1, +e.target.value)))}
                step={0.1}
                min={0}
                max={1}
                className="w-24 font-mono"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={rigidZoneFactor}
                onChange={e => setRigidZoneFactor(+e.target.value)}
                className="flex-1 accent-cyan-500"
              />
              <span className="text-xs text-slate-500 font-mono w-10 text-right">{(rigidZoneFactor * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              End offsets model rigid zones at beam-column joints. The rigid zone factor (0–1) determines
              what fraction of the joint is considered infinitely stiff. Factor = 1.0 means fully rigid offsets; 
              0.5 means half the offset length is rigid (common default per ACI/AISC).
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => { setOffsets({ ...DEFAULT_OFFSETS }); setRigidZoneFactor(1.0); }}>
            Clear All
          </Button>
          <Button onClick={handleApply} disabled={selectedMembers.length === 0}>
            <Check className="w-4 h-4 mr-1" />
            Apply Offsets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
