/**
 * SupportDisplacementDialog.tsx — Prescribed Support Displacement / Settlement
 *
 * Apply prescribed displacements (settlement, rotation) at supported nodes.
 * Ref: Standard structural analysis — prescribed DOF values.
 * Units: mm for translations, rad for rotations.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowDownToLine, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

const SupportDisplacementDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.supportDisplacement || false;
  const onClose = () => setModal('supportDisplacement', false);

  const { nodes, selectedIds } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      selectedIds: s.selectedIds,
    }))
  );

  const [dx, setDx] = useState(0); // mm
  const [dy, setDy] = useState(0); // mm (negative = settlement)
  const [dz, setDz] = useState(0); // mm
  const [rx, setRx] = useState(0); // rad
  const [ry, setRy] = useState(0); // rad
  const [rz, setRz] = useState(0); // rad

  const selectedSupportNodes = useMemo(
    () =>
      Array.from(selectedIds)
        .filter((id) => id.startsWith('N') && nodes.has(id))
        .filter((id) => {
          const node = nodes.get(id);
          if (!node?.restraints) return false;
          const r = node.restraints;
          return r.fx || r.fy || r.fz || r.mx || r.my || r.mz;
        }),
    [selectedIds, nodes]
  );

  const handleApply = useCallback(() => {
    if (selectedSupportNodes.length === 0) return;
    const store = useModelStore.getState();
    for (const nodeId of selectedSupportNodes) {
      const node = store.nodes.get(nodeId);
      if (!node) continue;
      store.updateNode(nodeId, {
        ...node,
        prescribedDisplacement: { dx, dy, dz, rx, ry, rz },
      } as any);
    }
    onClose();
  }, [selectedSupportNodes, dx, dy, dz, rx, ry, rz]);

  const noSupportNodes = selectedSupportNodes.length === 0;
  const allZero = dx === 0 && dy === 0 && dz === 0 && rx === 0 && ry === 0 && rz === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-orange-500" />
            Support Displacement / Settlement
          </DialogTitle>
          <DialogDescription>
            Prescribe displacements at supported nodes. Negative Y = settlement (downward).
          </DialogDescription>
        </DialogHeader>

        {noSupportNodes && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select supported node(s). Only nodes with restraints can have prescribed displacements.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase tracking-wide">Translations (mm)</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Δx</Label>
              <Input type="number" value={dx} onChange={(e) => setDx(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
            <div>
              <Label className="text-xs">Δy</Label>
              <Input type="number" value={dy} onChange={(e) => setDy(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
            <div>
              <Label className="text-xs">Δz</Label>
              <Input type="number" value={dz} onChange={(e) => setDz(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
          </div>

          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase tracking-wide">Rotations (rad)</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">θx</Label>
              <Input type="number" value={rx} onChange={(e) => setRx(parseFloat(e.target.value) || 0)} step="0.001" />
            </div>
            <div>
              <Label className="text-xs">θy</Label>
              <Input type="number" value={ry} onChange={(e) => setRy(parseFloat(e.target.value) || 0)} step="0.001" />
            </div>
            <div>
              <Label className="text-xs">θz</Label>
              <Input type="number" value={rz} onChange={(e) => setRz(parseFloat(e.target.value) || 0)} step="0.001" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noSupportNodes || allZero}>
            Apply to {selectedSupportNodes.length} node(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupportDisplacementDialog;
