/**
 * ImperfectionAnalysisDialog.tsx — Imperfection Analysis (AISC 360 DAM)
 *
 * STAAD.Pro parity: Direct analysis method with notional loads and reduced stiffness.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface ImperfectionAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ImperfectionAnalysisDialog: React.FC<ImperfectionAnalysisDialogProps> = ({ open, onClose }) => {
  const { loadCases } = useModelStore((s) => ({ loadCases: s.loadCases }));

  const [notionalCoeff, setNotionalCoeff] = useState('0.002');
  const [stiffnessReduction, setStiffnessReduction] = useState('0.8');
  const [selectedLoadCaseIds, setSelectedLoadCaseIds] = useState<Set<string>>(new Set());

  const toggleLoadCase = useCallback((id: string) => {
    setSelectedLoadCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const params = {
      notionalLoadCoefficient: parseFloat(notionalCoeff),
      stiffnessReductionFactor: parseFloat(stiffnessReduction),
      loadCaseIds: Array.from(selectedLoadCaseIds),
    };
    document.dispatchEvent(new CustomEvent('trigger-imperfection-analysis', { detail: params }));
    onClose();
  }, [notionalCoeff, stiffnessReduction, selectedLoadCaseIds, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Imperfection Analysis (DAM)</DialogTitle>
          <DialogDescription>
            Direct Analysis Method per AISC 360 Chapter C — notional loads and reduced stiffness.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">
              Notional Load Coefficient α (default 0.002)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={notionalCoeff}
              onChange={(e) => setNotionalCoeff(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">
              Stiffness Reduction Factor τ (default 0.8)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={stiffnessReduction}
              onChange={(e) => setStiffnessReduction(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-2">Apply Notional Loads to Load Cases</label>
            <div className="border rounded p-3 max-h-40 overflow-y-auto space-y-1">
              {loadCases.length === 0 ? (
                <p className="text-slate-500 text-sm">No load cases defined.</p>
              ) : (
                loadCases.map((lc) => (
                  <label key={lc.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLoadCaseIds.has(lc.id)}
                      onChange={() => toggleLoadCase(lc.id)}
                    />
                    <span className="text-sm">{lc.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>
            Apply & Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
