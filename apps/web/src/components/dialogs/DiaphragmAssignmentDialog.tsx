/**
 * DiaphragmAssignmentDialog.tsx — Diaphragm Assignment
 *
 * STAAD.Pro parity: Assigns rigid, semi-rigid, or flexible diaphragm
 * constraints to selected floor nodes.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';
import type { DiaphragmType, DiaphragmPlane, DiaphragmSpec } from '../../store/modelTypes';

export interface DiaphragmAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
}

export const DiaphragmAssignmentDialog: React.FC<DiaphragmAssignmentDialogProps> = ({ open, onClose }) => {
  const { selectedIds, nodes, updateNode, addDiaphragm } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    nodes: s.nodes,
    updateNode: s.updateNode,
    addDiaphragm: s.addDiaphragm,
  }));

  const selectedNodeIds = Array.from(selectedIds).filter((id) => nodes.has(id));

  const [type, setType] = useState<DiaphragmType>('rigid');
  const [plane, setPlane] = useState<DiaphragmPlane>('XY');
  const [storyLabel, setStoryLabel] = useState('');

  const handleConfirm = useCallback(() => {
    if (selectedNodeIds.length < 2) return;
    const id = `D${Date.now()}`;
    const spec: DiaphragmSpec = {
      id,
      type,
      plane,
      storyLabel: storyLabel || `Story-${id}`,
      nodeIds: selectedNodeIds,
    };
    addDiaphragm(spec);
    // Set diaphragmId on each selected node
    selectedNodeIds.forEach((nodeId) => updateNode(nodeId, { diaphragmId: id } as any));
    onClose();
  }, [selectedNodeIds, type, plane, storyLabel, addDiaphragm, updateNode, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Diaphragm Assignment</DialogTitle>
          <DialogDescription>
            {selectedNodeIds.length >= 2
              ? `Assign diaphragm to ${selectedNodeIds.length} selected node(s).`
              : 'Select at least 2 nodes to assign a diaphragm.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Diaphragm Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DiaphragmType)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="rigid">Rigid</option>
              <option value="semi-rigid">Semi-Rigid</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Diaphragm Plane</label>
            <select
              value={plane}
              onChange={(e) => setPlane(e.target.value as DiaphragmPlane)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="XY">XY (horizontal floor)</option>
              <option value="XZ">XZ</option>
              <option value="YZ">YZ</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Story Label</label>
            <input
              type="text"
              value={storyLabel}
              onChange={(e) => setStoryLabel(e.target.value)}
              placeholder="e.g. Floor 1, Level 2"
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selectedNodeIds.length < 2}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
