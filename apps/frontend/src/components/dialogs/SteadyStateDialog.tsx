/**
 * SteadyStateDialog.tsx — Steady-State Harmonic Response Analysis
 *
 * STAAD.Pro parity: Harmonic response analysis for rotating machinery excitation.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';

export interface SteadyStateDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SteadyStateDialog: React.FC<SteadyStateDialogProps> = ({ open, onClose }) => {
  const [freqMin, setFreqMin] = useState('0.1');
  const [freqMax, setFreqMax] = useState('50');
  const [freqStep, setFreqStep] = useState('0.5');
  const [damping, setDamping] = useState('0.05');
  const [excitationNode, setExcitationNode] = useState('');
  const [excitationDOF, setExcitationDOF] = useState('FY');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      const params = {
        freqMin: parseFloat(freqMin),
        freqMax: parseFloat(freqMax),
        freqStep: parseFloat(freqStep),
        damping: parseFloat(damping),
        excitationNode,
        excitationDOF,
      };
      document.dispatchEvent(new CustomEvent('trigger-steady-state', { detail: params }));
      onClose();
    } finally {
      setIsRunning(false);
    }
  }, [freqMin, freqMax, freqStep, damping, excitationNode, excitationDOF, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Steady-State Harmonic Response</DialogTitle>
          <DialogDescription>
            Compute amplitude and phase response for rotating machinery excitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Min Freq (Hz)', value: freqMin, set: setFreqMin },
              { label: 'Max Freq (Hz)', value: freqMax, set: setFreqMax },
              { label: 'Step (Hz)', value: freqStep, set: setFreqStep },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium tracking-wide mb-1">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Damping Ratio</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={damping}
              onChange={(e) => setDamping(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium tracking-wide mb-1">Excitation Node ID</label>
              <input
                type="text"
                value={excitationNode}
                onChange={(e) => setExcitationNode(e.target.value)}
                placeholder="e.g. N5"
                className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide mb-1">DOF</label>
              <select
                value={excitationDOF}
                onChange={(e) => setExcitationDOF(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="FX">FX</option>
                <option value="FY">FY</option>
                <option value="FZ">FZ</option>
                <option value="MX">MX</option>
                <option value="MY">MY</option>
                <option value="MZ">MZ</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Analysis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
