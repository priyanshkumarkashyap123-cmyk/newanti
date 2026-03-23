/**
 * MasterSlaveDialog.tsx — Master/Slave Joint Constraints
 *
 * STAAD.Pro parity: Defines kinematic constraints where slave node DOFs
 * are expressed as rigid-body functions of a master node.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface MasterSlaveDialogProps {
  open: boolean;
  onClose: () => void;
}

type DOFKey = 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz';
const DOF_KEYS: DOFKey[] = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const DOF_LABELS: Record<DOFKey, string> = {
  fx: 'FX', fy: 'FY', fz: 'FZ', mx: 'MX', my: 'MY', mz: 'MZ',
};

export const MasterSlaveDialog: React.FC<MasterSlaveDialogProps> = ({ open, onClose }) => {
  const { selectedIds, nodes, updateNode } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    nodes: s.nodes,
    updateNode: s.updateNode,
  }));

  const selectedNodeIds = Array.from(selectedIds).filter((id) => nodes.has(id));

  const [masterNodeId, setMasterNodeId] = useState<string>(selectedNodeIds[0] ?? '');
  const [coupledDOFs, setCoupledDOFs] = useState<Record<DOFKey, boolean>>({
    fx: true, fy: true, fz: true, mx: false, my: false, mz: false,
  });

  const toggleDOF = useCallback((dof: DOFKey) => {
    setCoupledDOFs((prev) => ({ ...prev, [dof]: !prev[dof] }));
  }, []);

  const slaveNodeIds = selectedNodeIds.filter((id) => id !== masterNodeId);

  const handleConfirm = useCallback(() => {
    if (selectedNodeIds.length < 2 || !masterNodeId) return;

    // Set master node constraint
    updateNode(masterNodeId, {
      masterSlaveConstraint: {
        role: 'master',
        coupledDOFs,
      },
    });

    // Set slave node constraints
    slaveNodeIds.forEach((id) => {
      updateNode(id, {
        masterSlaveConstraint: {
          role: 'slave',
          masterNodeId,
          coupledDOFs,
        },
      });
    });

    onClose();
  }, [selectedNodeIds.length, masterNodeId, coupledDOFs, slaveNodeIds, updateNode, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Master/Slave Joint Constraints</DialogTitle>
          <DialogDescription>
            {selectedNodeIds.length >= 2
              ? `Define master/slave constraints for ${selectedNodeIds.length} selected node(s).`
              : 'Select at least 2 nodes to define master/slave constraints.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Master Node</label>
            <select
              value={masterNodeId}
              onChange={(e) => setMasterNodeId(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              {selectedNodeIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            {slaveNodeIds.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Slave nodes: {slaveNodeIds.join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-2">Coupled DOFs</label>
            <div className="grid grid-cols-3 gap-2">
              {DOF_KEYS.map((dof) => (
                <label key={dof} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coupledDOFs[dof]}
                    onChange={() => toggleDOF(dof)}
                  />
                  <span className="text-sm">{DOF_LABELS[dof]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedNodeIds.length < 2 || !masterNodeId}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
