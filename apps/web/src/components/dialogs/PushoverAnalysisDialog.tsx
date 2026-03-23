/**
 * PushoverAnalysisDialog.tsx — Nonlinear Static Pushover Analysis
 *
 * STAAD.Pro parity: Incremental lateral load application with plastic hinge formation.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';

export interface PushoverAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
}

type LoadPattern = 'uniform' | 'triangular' | 'modal';

export const PushoverAnalysisDialog: React.FC<PushoverAnalysisDialogProps> = ({ open, onClose }) => {
  const [loadPattern, setLoadPattern] = useState<LoadPattern>('triangular');
  const [targetDisp, setTargetDisp] = useState('0.1');
  const [hingeProps, setHingeProps] = useState('default');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      const params = {
        loadPattern,
        targetDisplacement: parseFloat(targetDisp),
        hingeProperties: hingeProps,
      };
      document.dispatchEvent(new CustomEvent('trigger-pushover', { detail: params }));
      onClose();
    } finally {
      setIsRunning(false);
    }
  }, [loadPattern, targetDisp, hingeProps, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pushover Analysis</DialogTitle>
          <DialogDescription>
            Nonlinear static analysis with incremental lateral load and plastic hinge formation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Load Pattern</label>
            <select
              value={loadPattern}
              onChange={(e) => setLoadPattern(e.target.value as LoadPattern)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="uniform">Uniform</option>
              <option value="triangular">Triangular (inverted)</option>
              <option value="modal">Modal (first mode)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Target Displacement (m)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetDisp}
              onChange={(e) => setTargetDisp(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Plastic Hinge Properties</label>
            <select
              value={hingeProps}
              onChange={(e) => setHingeProps(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="default">Default (FEMA 356)</option>
              <option value="asce41">ASCE 41-17</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Pushover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
