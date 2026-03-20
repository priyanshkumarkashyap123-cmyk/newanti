/**
 * MomentLoadDialog.tsx — Apply Nodal Moments (Mx, My, Mz)
 *
 * Applies concentrated moments at selected nodes.
 * Units: kN·m (SI)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RotateCw, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

const MomentLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.momentLoadDialog || false;
  const onClose = () => setModal('momentLoadDialog', false);

  const { nodes, selectedIds, addLoad, loads } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      selectedIds: s.selectedIds,
      addLoad: s.addLoad,
      loads: s.loads,
    }))
  );

  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  const [mz, setMz] = useState(0);

  const selectedNodes = useMemo(
    () => Array.from(selectedIds).filter((id) => id.startsWith('N') && nodes.has(id)),
    [selectedIds, nodes]
  );

  const handleApply = useCallback(() => {
    if (selectedNodes.length === 0) return;
    for (const nodeId of selectedNodes) {
      const loadId = `ML_${nodeId}_${Date.now()}`;
      addLoad({
        id: loadId,
        nodeId,
        fx: 0,
        fy: 0,
        fz: 0,
        mx,
        my,
        mz,
      } as any);
    }
    onClose();
  }, [selectedNodes, mx, my, mz, addLoad]);

  const noNodes = selectedNodes.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-purple-500" />
            Apply Nodal Moment
          </DialogTitle>
          <DialogDescription>
            Apply concentrated moments at {selectedNodes.length || 'selected'} node(s). Positive follows the right-hand rule.
          </DialogDescription>
        </DialogHeader>

        {noNodes && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one node before applying moments.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Mx (kN·m)</Label>
              <Input type="number" value={mx} onChange={(e) => setMx(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
            <div>
              <Label className="text-xs">My (kN·m)</Label>
              <Input type="number" value={my} onChange={(e) => setMy(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
            <div>
              <Label className="text-xs">Mz (kN·m)</Label>
              <Input type="number" value={mz} onChange={(e) => setMz(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
          </div>

          {/* Preview */}
          <div className="p-2 rounded bg-[#131b2e] text-xs font-mono text-[#869ab8]">
            Resultant = {Math.sqrt(mx * mx + my * my + mz * mz).toFixed(2)} kN·m
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noNodes || (mx === 0 && my === 0 && mz === 0)}>
            Apply to {selectedNodes.length} node(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MomentLoadDialog;
export { MomentLoadDialog };
