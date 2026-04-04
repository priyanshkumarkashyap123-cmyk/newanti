/**
 * FloorLoadDialog.tsx — Floor Load Generator
 *
 * STAAD.Pro parity: Generates floor loads using two-way yield-line or
 * one-way distribution algorithms.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';
import {
  computeFloorLoadYieldLine,
  isClosedPolygon,
  type FloorDistributionMethod,
} from '../../utils/loadGenerators';

export interface FloorLoadDialogProps {
  open: boolean;
  onClose: () => void;
}

export const FloorLoadDialog: React.FC<FloorLoadDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, nodes, loadCases, activeLoadCaseId, addMemberLoad } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    nodes: s.nodes,
    loadCases: s.loadCases,
    activeLoadCaseId: s.activeLoadCaseId,
    addMemberLoad: s.addMemberLoad,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [pressure, setPressure] = useState('');
  const [method, setMethod] = useState<FloorDistributionMethod>('two_way_yield_line');
  const [pressureError, setPressureError] = useState('');
  const [polygonError, setPolygonError] = useState('');

  // Check polygon closure
  const memberEndpoints = useMemo(
    () =>
      selectedMemberIds.map((id) => {
        const m = members.get(id)!;
        return [m.startNodeId, m.endNodeId] as [string, string];
      }),
    [selectedMemberIds, members],
  );

  const polygonClosed = useMemo(
    () => selectedMemberIds.length >= 3 && isClosedPolygon(memberEndpoints),
    [selectedMemberIds.length, memberEndpoints],
  );

  const handlePressureChange = useCallback((raw: string) => {
    setPressure(raw);
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) {
      setPressureError('Enter a positive pressure value (kN/m²)');
    } else {
      setPressureError('');
    }
  }, []);

  const handleConfirm = useCallback(() => {
    const p = parseFloat(pressure);
    if (isNaN(p) || p <= 0 || !polygonClosed) return;

    const nodePositions = new Map(
      Array.from(nodes.entries()).map(([id, n]) => [id, { x: n.x, z: n.z }]),
    );

    const result = computeFloorLoadYieldLine(
      selectedMemberIds,
      memberEndpoints,
      nodePositions,
      p,
      method,
    );

    if (result.error) {
      setPolygonError(result.error);
      return;
    }

    // Add member loads to the active load case
    result.beamLoads.forEach(({ memberId, udl }) => {
      addMemberLoad({
        id: `FL_${memberId}_${Date.now()}`,
        memberId,
        type: 'UDL',
        w1: -udl, // Downward
        w2: -udl,
        direction: 'global_y',
      });
    });

    onClose();
  }, [pressure, polygonClosed, nodes, selectedMemberIds, memberEndpoints, method, addMemberLoad, onClose]);

  const canConfirm = !pressureError && polygonClosed && parseFloat(pressure) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Floor Load Generator</DialogTitle>
          <DialogDescription>
            Select boundary beam members forming a closed polygon, then specify the floor pressure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-[#869ab8]">
              Selected boundary beams: <strong>{selectedMemberIds.length}</strong>
              {selectedMemberIds.length >= 3 && (
                <span className={polygonClosed ? ' text-green-600' : ' text-red-500'}>
                  {' '}({polygonClosed ? '✓ Closed polygon' : '✗ Not a closed polygon'})
                </span>
              )}
            </p>
            {polygonError && <p className="text-red-500 text-xs mt-1">{polygonError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Floor Pressure (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={pressure}
              onChange={(e) => handlePressureChange(e.target.value)}
              placeholder="e.g. 3.5"
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
            {pressureError && <p className="text-red-500 text-xs mt-1">{pressureError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Distribution Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as FloorDistributionMethod)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="two_way_yield_line">Two-Way Yield-Line</option>
              <option value="one_way_x">One-Way (X direction)</option>
              <option value="one_way_z">One-Way (Z direction)</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Generate Loads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
