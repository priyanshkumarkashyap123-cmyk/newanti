/**
 * PartialReleaseDialog.tsx — Partial Moment Release Assignment
 *
 * STAAD.Pro parity: Allows specifying partial (semi-rigid) releases for each
 * DOF at the start and end of selected members. Factor range: 0.001–0.999.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useModelStore } from '../../store/model';
import type { PartialReleaseDOF, PartialReleaseEndSpec } from '../../store/modelTypes';

export interface PartialReleaseDialogProps {
  open: boolean;
  onClose: () => void;
}

type DOFKey = 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz';
const DOF_KEYS: DOFKey[] = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const DOF_LABELS: Record<DOFKey, string> = {
  fx: 'FX', fy: 'FY', fz: 'FZ', mx: 'MX', my: 'MY', mz: 'MZ',
};

type EndKey = 'start' | 'end';

type ReleaseGrid = Record<EndKey, Record<DOFKey, PartialReleaseDOF>>;

function defaultGrid(): ReleaseGrid {
  const makeEnd = (): Record<DOFKey, PartialReleaseDOF> =>
    Object.fromEntries(DOF_KEYS.map((k) => [k, { mode: 'fixed' as const }])) as Record<DOFKey, PartialReleaseDOF>;
  return { start: makeEnd(), end: makeEnd() };
}

/** Validates a partial release factor. Returns error string or null. */
export function validatePartialReleaseFactor(v: number): { valid: boolean; error?: string } {
  // Use epsilon tolerance to handle 32-bit float representation differences
  const EPS = 1e-7;
  if (v < 0.001 - EPS || v > 0.999 + EPS) {
    return { valid: false, error: 'Factor must be between 0.001 and 0.999' };
  }
  return { valid: true };
}

export const PartialReleaseDialog: React.FC<PartialReleaseDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, updateMember } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    updateMember: s.updateMember,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [grid, setGrid] = useState<ReleaseGrid>(defaultGrid);
  const [factorErrors, setFactorErrors] = useState<Partial<Record<string, string>>>({});

  const setMode = useCallback((end: EndKey, dof: DOFKey, mode: PartialReleaseDOF['mode']) => {
    setGrid((prev) => ({
      ...prev,
      [end]: { ...prev[end], [dof]: { ...prev[end][dof], mode } },
    }));
  }, []);

  const setFactor = useCallback((end: EndKey, dof: DOFKey, raw: string) => {
    const key = `${end}_${dof}`;
    const v = parseFloat(raw);
    if (isNaN(v)) {
      setFactorErrors((prev) => ({ ...prev, [key]: 'Enter a valid number' }));
      return;
    }
    const result = validatePartialReleaseFactor(v);
    if (!result.valid) {
      setFactorErrors((prev) => ({ ...prev, [key]: result.error }));
    } else {
      setFactorErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setGrid((prev) => ({
        ...prev,
        [end]: { ...prev[end], [dof]: { ...prev[end][dof], factor: v } },
      }));
    }
  }, []);

  const hasErrors = Object.keys(factorErrors).length > 0;

  const handleConfirm = useCallback(() => {
    if (hasErrors || selectedMemberIds.length === 0) return;
    const spec: { start: PartialReleaseEndSpec; end: PartialReleaseEndSpec } = {
      start: {},
      end: {},
    };
    for (const dof of DOF_KEYS) {
      const s = grid.start[dof];
      if (s.mode !== 'fixed') spec.start[dof] = s;
      const e = grid.end[dof];
      if (e.mode !== 'fixed') spec.end[dof] = e;
    }
    selectedMemberIds.forEach((id) => updateMember(id, { partialReleases: spec }));
    onClose();
  }, [grid, hasErrors, selectedMemberIds, updateMember, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Partial Moment Releases</DialogTitle>
          <DialogDescription>
            {selectedMemberIds.length > 0
              ? `Assign partial releases to ${selectedMemberIds.length} selected member(s).`
              : 'No members selected. Select members first.'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#131b2e]">
                <th className="p-2 text-left">End</th>
                <th className="p-2 text-left">DOF</th>
                <th className="p-2 text-left">Fixed</th>
                <th className="p-2 text-left">Released</th>
                <th className="p-2 text-left">Partial</th>
                <th className="p-2 text-left">Factor (0.001–0.999)</th>
              </tr>
            </thead>
            <tbody>
              {(['start', 'end'] as EndKey[]).map((endKey) =>
                DOF_KEYS.map((dof, i) => {
                  const cell = grid[endKey][dof];
                  const errKey = `${endKey}_${dof}`;
                  return (
                    <tr key={`${endKey}_${dof}`} className="border-b border-[#1a2333]">
                      {i === 0 && (
                        <td className="p-2 font-semibold capitalize" rowSpan={6}>
                          {endKey}
                        </td>
                      )}
                      <td className="p-2">{DOF_LABELS[dof]}</td>
                      {(['fixed', 'released', 'partial'] as PartialReleaseDOF['mode'][]).map((mode) => (
                        <td key={mode} className="p-2">
                          <input
                            type="radio"
                            name={`${endKey}_${dof}`}
                            checked={cell.mode === mode}
                            onChange={() => setMode(endKey, dof, mode)}
                            className="cursor-pointer"
                          />
                        </td>
                      ))}
                      <td className="p-2">
                        {cell.mode === 'partial' && (
                          <div>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              max="0.999"
                              defaultValue={cell.factor ?? 0.5}
                              onChange={(e) => setFactor(endKey, dof, e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                            />
                            {factorErrors[errKey] && (
                              <p className="text-red-500 text-xs mt-1">{factorErrors[errKey]}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={hasErrors || selectedMemberIds.length === 0}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
