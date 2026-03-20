/**
 * PropertyReductionDialog.tsx — Property Reduction Factors
 *
 * STAAD.Pro parity: Applies scalar multipliers to section properties
 * for cracked-section behaviour (AISC DAM, seismic).
 * Factor range: 0.01–1.00.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface PropertyReductionDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Validates a property reduction factor. Returns error string or null. */
export function validateReductionFactor(v: number): { valid: boolean; error?: string } {
  if (v < 0.01 - 1e-9 || v > 1.0 + 1e-9) {
    return { valid: false, error: 'Factor must be between 0.01 and 1.00' };
  }
  return { valid: true };
}

type FactorKey = 'rax' | 'rix' | 'riy' | 'riz';
const FACTOR_DEFS: { key: FactorKey; label: string; description: string }[] = [
  { key: 'rax', label: 'RAX', description: 'Axial area multiplier' },
  { key: 'rix', label: 'RIX', description: 'Torsional inertia multiplier' },
  { key: 'riy', label: 'RIY', description: 'Weak-axis bending inertia multiplier' },
  { key: 'riz', label: 'RIZ', description: 'Strong-axis bending inertia multiplier' },
];

export const PropertyReductionDialog: React.FC<PropertyReductionDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, updateMember } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    updateMember: s.updateMember,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [values, setValues] = useState<Partial<Record<FactorKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<FactorKey, string>>>({});

  const handleChange = useCallback((key: FactorKey, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
    if (raw === '' || raw === undefined) {
      setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    const v = parseFloat(raw);
    if (isNaN(v)) {
      setErrors((prev) => ({ ...prev, [key]: 'Enter a valid number' }));
      return;
    }
    const result = validateReductionFactor(v);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, [key]: result.error }));
    } else {
      setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  const handleConfirm = useCallback(() => {
    if (hasErrors || selectedMemberIds.length === 0) return;
    const factors: Record<string, number> = {};
    for (const { key } of FACTOR_DEFS) {
      const raw = values[key];
      if (raw !== undefined && raw !== '') {
        const v = parseFloat(raw);
        if (!isNaN(v)) factors[key] = v;
      }
    }
    if (Object.keys(factors).length === 0) return;
    selectedMemberIds.forEach((id) =>
      updateMember(id, { propertyReductionFactors: factors })
    );
    onClose();
  }, [hasErrors, selectedMemberIds, values, updateMember, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Property Reduction Factors</DialogTitle>
          <DialogDescription>
            {selectedMemberIds.length > 0
              ? `Apply reduction factors to ${selectedMemberIds.length} selected member(s). Leave blank to keep existing values.`
              : 'No members selected. Select members first.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {FACTOR_DEFS.map(({ key, label, description }) => (
            <div key={key}>
              <label className="block text-sm font-medium tracking-wide tracking-wide mb-1">
                {label} — <span className="text-slate-500 font-normal">{description}</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1.00"
                placeholder="0.01 – 1.00"
                value={values[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
              />
              {errors[key] && (
                <p className="text-red-500 text-xs mt-1">{errors[key]}</p>
              )}
            </div>
          ))}
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
