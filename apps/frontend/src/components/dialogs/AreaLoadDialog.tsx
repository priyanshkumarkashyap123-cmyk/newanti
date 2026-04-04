/**
 * AreaLoadDialog.tsx — Area Load / One-Way Load Generator
 *
 * STAAD.Pro parity: Generates one-way tributary area loads on beams.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';
import { computeAreaLoadUDL } from '../../utils/loadGenerators';

export interface AreaLoadDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AreaLoadDialog: React.FC<AreaLoadDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, nodes, addMemberLoad } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    nodes: s.nodes,
    addMemberLoad: s.addMemberLoad,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [pressure, setPressure] = useState('');
  const [spanDirection, setSpanDirection] = useState<'X' | 'Z'>('X');
  const [pressureError, setPressureError] = useState('');

  const handlePressureChange = useCallback((raw: string) => {
    setPressure(raw);
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) {
      setPressureError('Enter a positive pressure value (kN/m²)');
    } else {
      setPressureError('');
    }
  }, []);

  // Compute tributary widths for selected beams
  const tributaryWidths = useMemo(() => {
    const widths = new Map<string, number>();
    if (selectedMemberIds.length === 0) return widths;

    // Get positions of all selected beams
    const beamPositions = selectedMemberIds.map((id) => {
      const m = members.get(id)!;
      const n1 = nodes.get(m.startNodeId);
      const n2 = nodes.get(m.endNodeId);
      if (!n1 || !n2) return null;
      // Midpoint position in the span direction
      const mid = spanDirection === 'X'
        ? (n1.z + n2.z) / 2  // position in Z for X-spanning beams
        : (n1.x + n2.x) / 2; // position in X for Z-spanning beams
      return { id, mid };
    }).filter(Boolean) as { id: string; mid: number }[];

    // Sort by position
    beamPositions.sort((a, b) => a.mid - b.mid);

    // Compute tributary widths
    for (let i = 0; i < beamPositions.length; i++) {
      const prev = i > 0 ? beamPositions[i - 1].mid : beamPositions[i].mid;
      const next = i < beamPositions.length - 1 ? beamPositions[i + 1].mid : beamPositions[i].mid;
      const leftGap = (beamPositions[i].mid - prev) / 2;
      const rightGap = (next - beamPositions[i].mid) / 2;
      widths.set(beamPositions[i].id, leftGap + rightGap);
    }

    return widths;
  }, [selectedMemberIds, members, nodes, spanDirection]);

  const handleConfirm = useCallback(() => {
    const p = parseFloat(pressure);
    if (isNaN(p) || p <= 0 || selectedMemberIds.length === 0) return;

    selectedMemberIds.forEach((id) => {
      const width = tributaryWidths.get(id) ?? 1.0; // fallback 1m
      const udl = computeAreaLoadUDL(p, width);
      addMemberLoad({
        id: `AL_${id}_${Date.now()}`,
        memberId: id,
        type: 'UDL',
        w1: -udl,
        w2: -udl,
        direction: 'global_y',
      });
    });

    onClose();
  }, [pressure, selectedMemberIds, tributaryWidths, addMemberLoad, onClose]);

  const canConfirm = !pressureError && selectedMemberIds.length > 0 && parseFloat(pressure) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Area Load Generator</DialogTitle>
          <DialogDescription>
            Apply one-way tributary area loads to selected beams.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-[#869ab8]">
              Selected beams: <strong>{selectedMemberIds.length}</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Pressure (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={pressure}
              onChange={(e) => handlePressureChange(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
            {pressureError && <p className="text-red-500 text-xs mt-1">{pressureError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Span Direction</label>
            <select
              value={spanDirection}
              onChange={(e) => setSpanDirection(e.target.value as 'X' | 'Z')}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="X">X (load spans in X direction)</option>
              <option value="Z">Z (load spans in Z direction)</option>
            </select>
          </div>

          {selectedMemberIds.length > 0 && parseFloat(pressure) > 0 && (
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium tracking-wide">Preview UDLs:</p>
              {selectedMemberIds.slice(0, 5).map((id) => {
                const w = tributaryWidths.get(id) ?? 1.0;
                const udl = computeAreaLoadUDL(parseFloat(pressure) || 0, w);
                return (
                  <p key={id}>{id}: {udl.toFixed(2)} kN/m (trib. width: {w.toFixed(2)} m)</p>
                );
              })}
              {selectedMemberIds.length > 5 && <p>...and {selectedMemberIds.length - 5} more</p>}
            </div>
          )}
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
