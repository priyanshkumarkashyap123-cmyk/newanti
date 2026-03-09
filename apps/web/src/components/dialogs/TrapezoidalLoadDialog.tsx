/**
 * TrapezoidalLoadDialog.tsx — Trapezoidal / Triangular Member Load
 *
 * Apply linearly varying distributed load (trapezoidal or triangular)
 * on selected members. w1 at start, w2 at end.
 * Units: kN/m
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TrendingDown, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

type LoadDirection = 'global_y' | 'global_x' | 'global_z' | 'local_y' | 'local_z';

const TrapezoidalLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.trapezoidalLoadDialog || false;
  const onClose = () => setModal('trapezoidalLoadDialog', false);

  const { members, selectedIds, addMemberLoad } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      selectedIds: s.selectedIds,
      addMemberLoad: s.addMemberLoad,
    }))
  );

  const [w1, setW1] = useState(-10);  // kN/m at start
  const [w2, setW2] = useState(-5);   // kN/m at end
  const [direction, setDirection] = useState<LoadDirection>('global_y');

  const selectedMembers = useMemo(
    () => Array.from(selectedIds).filter((id) => id.startsWith('M') && members.has(id)),
    [selectedIds, members]
  );

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    for (const memberId of selectedMembers) {
      addMemberLoad({
        id: `TRP_${memberId}_${Date.now()}`,
        memberId,
        type: 'trapezoidal' as any,
        w1,
        w2,
        direction,
      } as any);
    }
    onClose();
  }, [selectedMembers, w1, w2, direction, addMemberLoad]);

  const noMembers = selectedMembers.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-500" />
            Trapezoidal / Triangular Load
          </DialogTitle>
          <DialogDescription>
            Apply linearly varying distributed load on {selectedMembers.length || 'selected'} member(s).
          </DialogDescription>
        </DialogHeader>

        {noMembers && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one member first.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">w₁ at start (kN/m)</Label>
              <Input type="number" value={w1} onChange={(e) => setW1(parseFloat(e.target.value) || 0)} step="0.5" />
            </div>
            <div>
              <Label className="text-xs">w₂ at end (kN/m)</Label>
              <Input type="number" value={w2} onChange={(e) => setW2(parseFloat(e.target.value) || 0)} step="0.5" />
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

          {/* Visual preview */}
          <div className="p-3 rounded bg-slate-100 dark:bg-slate-800 flex items-end gap-1 h-16">
            <div className="flex-1 flex items-end justify-between">
              <div className="bg-blue-500/60 rounded-t" style={{ width: '8px', height: `${Math.min(Math.abs(w1) * 2, 48)}px` }} />
              <div className="flex-1 bg-blue-500/20 mx-0.5" style={{ height: '1px' }} />
              <div className="bg-blue-500/60 rounded-t" style={{ width: '8px', height: `${Math.min(Math.abs(w2) * 2, 48)}px` }} />
            </div>
          </div>
          <div className="text-[10px] text-slate-400 text-center">
            {w1 === 0 || w2 === 0 ? 'Triangular' : w1 === w2 ? 'Uniform (UDL)' : 'Trapezoidal'} load
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noMembers || (w1 === 0 && w2 === 0)}>
            Apply to {selectedMembers.length} member(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrapezoidalLoadDialog;
