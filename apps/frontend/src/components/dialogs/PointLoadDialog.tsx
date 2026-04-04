/**
 * PointLoadDialog.tsx — Concentrated Point Load on Member
 *
 * Apply a concentrated force at a specified distance along a member.
 * Units: P in kN, distance 'a' as ratio (0–1) or absolute (m).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowDown, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

type LoadDirection = 'global_y' | 'global_x' | 'global_z' | 'local_y' | 'local_z';

const PointLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.pointLoadDialog || false;
  const onClose = () => setModal('pointLoadDialog', false);

  const { members, selectedIds, addMemberLoad } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      selectedIds: s.selectedIds,
      addMemberLoad: s.addMemberLoad,
    }))
  );

  const [P, setP] = useState(-10);     // kN (negative = downward)
  const [a, setA] = useState(0.5);     // distance ratio 0–1
  const [direction, setDirection] = useState<LoadDirection>('global_y');

  const selectedMembers = useMemo(
    () => Array.from(selectedIds).filter((id) => id.startsWith('M') && members.has(id)),
    [selectedIds, members]
  );

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    for (const memberId of selectedMembers) {
      addMemberLoad({
        id: `PL_${memberId}_${Date.now()}`,
        memberId,
        type: 'point' as any,
        P,
        a,
        direction,
      } as any);
    }
    onClose();
  }, [selectedMembers, P, a, direction, addMemberLoad]);

  const noMembers = selectedMembers.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-red-500" />
            Concentrated Point Load
          </DialogTitle>
          <DialogDescription>
            Apply a point load at a position along {selectedMembers.length || 'selected'} member(s).
          </DialogDescription>
        </DialogHeader>

        {noMembers && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one member first.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">P (kN)</Label>
              <Input type="number" value={P} onChange={(e) => setP(parseFloat(e.target.value) || 0)} step="1" />
              <p className="text-[10px] text-slate-400 mt-0.5">Negative = downward</p>
            </div>
            <div>
              <Label className="text-xs">Position (0–1)</Label>
              <Input
                type="number"
                value={a}
                onChange={(e) => setA(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                step="0.05"
                min="0"
                max="1"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">0 = start, 1 = end</p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as LoadDirection)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global_y">Global Y (Gravity)</SelectItem>
                <SelectItem value="global_x">Global X</SelectItem>
                <SelectItem value="global_z">Global Z</SelectItem>
                <SelectItem value="local_y">Local y</SelectItem>
                <SelectItem value="local_z">Local z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Position preview bar */}
          <div className="relative h-4 rounded bg-slate-200 dark:bg-slate-700">
            <div
              className="absolute top-0 h-full w-1 bg-red-500 rounded-full"
              style={{ left: `${a * 100}%`, transform: 'translateX(-50%)' }}
            />
            <div className="absolute -top-5 text-[9px] text-red-400 font-mono" style={{ left: `${a * 100}%`, transform: 'translateX(-50%)' }}>
              {P} kN
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noMembers || P === 0}>
            Apply to {selectedMembers.length} member(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PointLoadDialog;
