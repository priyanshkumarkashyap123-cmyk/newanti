/**
 * SectionForcesPanel.tsx — Section Forces at Fractional Positions
 *
 * STAAD.Pro parity: Displays internal forces at user-specified fractional
 * positions (0.0–1.0) along a selected member.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface SectionForcesPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Validates a fractional position value. */
export function validateFractionalPosition(f: number): { valid: boolean; error?: string } {
  if (f < 0.0 || f > 1.0) {
    return { valid: false, error: 'Position must be between 0.0 and 1.0' };
  }
  return { valid: true };
}

const MAX_POSITIONS = 20;

export const SectionForcesPanel: React.FC<SectionForcesPanelProps> = ({ open, onClose }) => {
  const { selectedIds, members, analysisResults } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    analysisResults: s.analysisResults,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));
  const memberId = selectedMemberIds[0] ?? null;

  const [positions, setPositions] = useState<string[]>(['0.0', '0.25', '0.5', '0.75', '1.0']);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const handlePositionChange = useCallback((index: number, raw: string) => {
    setPositions((prev) => {
      const next = [...prev];
      next[index] = raw;
      return next;
    });
    const v = parseFloat(raw);
    if (isNaN(v)) {
      setErrors((prev) => ({ ...prev, [index]: 'Enter a valid number' }));
      return;
    }
    const result = validateFractionalPosition(v);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, [index]: result.error! }));
    } else {
      setErrors((prev) => { const n = { ...prev }; delete n[index]; return n; });
    }
  }, []);

  const addPosition = useCallback(() => {
    if (positions.length < MAX_POSITIONS) {
      setPositions((prev) => [...prev, '']);
    }
  }, [positions.length]);

  const removePosition = useCallback((index: number) => {
    setPositions((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const n = { ...prev };
      delete n[index];
      return n;
    });
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  // Get member forces from analysis results if available
  const memberForces = memberId && analysisResults?.memberForces?.get(memberId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Section Forces at Fractional Positions</DialogTitle>
          <DialogDescription>
            {memberId
              ? `Member ${memberId} — specify up to ${MAX_POSITIONS} fractional positions (0.0 = start, 1.0 = end).`
              : 'Select a member to view section forces.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {positions.map((pos, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={pos}
                  onChange={(e) => handlePositionChange(i, e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                  placeholder="0.0 – 1.0"
                />
                <button
                  type="button"
                  onClick={() => removePosition(i)}
                  className="text-red-500 hover:text-red-700 text-xs px-1"
                >
                  ✕
                </button>
                {errors[i] && (
                  <span className="text-red-500 text-xs">{errors[i]}</span>
                )}
              </div>
            ))}
          </div>

          {positions.length < MAX_POSITIONS && (
            <Button variant="outline" size="sm" onClick={addPosition}>
              + Add Position
            </Button>
          )}

          {memberForces && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="p-2 text-left">Position</th>
                    <th className="p-2 text-right">N (kN)</th>
                    <th className="p-2 text-right">Vy (kN)</th>
                    <th className="p-2 text-right">Vz (kN)</th>
                    <th className="p-2 text-right">T (kN·m)</th>
                    <th className="p-2 text-right">My (kN·m)</th>
                    <th className="p-2 text-right">Mz (kN·m)</th>
                  </tr>
                </thead>
                <tbody>
                  {positions
                    .filter((_, i) => !errors[i])
                    .map((pos, i) => {
                      const f = parseFloat(pos);
                      if (isNaN(f)) return null;
                      // Interpolate forces from diagram data if available
                      const diag = memberForces.diagramData;
                      let n = memberForces.axial;
                      let vy = memberForces.shearY;
                      let vz = memberForces.shearZ ?? 0;
                      let t = memberForces.torsion ?? 0;
                      let my = memberForces.momentY ?? 0;
                      let mz = memberForces.momentZ;
                      if (diag && diag.x_values.length > 1) {
                        const idx = Math.round(f * (diag.x_values.length - 1));
                        n = diag.axial[idx] ?? n;
                        vy = diag.shear_y[idx] ?? vy;
                        vz = diag.shear_z[idx] ?? vz;
                        t = diag.torsion[idx] ?? t;
                        my = diag.moment_y[idx] ?? my;
                        mz = diag.moment_z[idx] ?? mz;
                      }
                      return (
                        <tr key={i} className="border-b border-slate-200 dark:border-slate-700">
                          <td className="p-2">{f.toFixed(3)}</td>
                          <td className="p-2 text-right">{n.toFixed(2)}</td>
                          <td className="p-2 text-right">{vy.toFixed(2)}</td>
                          <td className="p-2 text-right">{vz.toFixed(2)}</td>
                          <td className="p-2 text-right">{t.toFixed(2)}</td>
                          <td className="p-2 text-right">{my.toFixed(2)}</td>
                          <td className="p-2 text-right">{mz.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {!memberForces && memberId && (
            <p className="text-slate-500 text-sm">Run analysis to view section forces.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
