/**
 * ResponseSpectrumDialog.tsx — Response Spectrum Analysis
 *
 * STAAD.Pro parity: Modal superposition analysis using a design spectrum.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';

export type SpectrumCode = 'IS1893' | 'ASCE7' | 'EN1998';
export type ModalCombination = 'SRSS' | 'CQC';

export interface ResponseSpectrumDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ResponseSpectrumDialog: React.FC<ResponseSpectrumDialogProps> = ({ open, onClose }) => {
  const [spectrumCode, setSpectrumCode] = useState<SpectrumCode>('IS1893');
  const [combination, setCombination] = useState<ModalCombination>('CQC');
  const [numModes, setNumModes] = useState('6');
  const [scaleX, setScaleX] = useState('1.0');
  const [scaleY, setScaleY] = useState('1.0');
  const [scaleZ, setScaleZ] = useState('0.0');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      const params = {
        spectrumCode,
        combination,
        numModes: parseInt(numModes),
        scaleX: parseFloat(scaleX),
        scaleY: parseFloat(scaleY),
        scaleZ: parseFloat(scaleZ),
      };
      // Dispatch to analysis execution hook via custom event
      document.dispatchEvent(new CustomEvent('trigger-response-spectrum', { detail: params }));
      onClose();
    } finally {
      setIsRunning(false);
    }
  }, [spectrumCode, combination, numModes, scaleX, scaleY, scaleZ, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Response Spectrum Analysis</DialogTitle>
          <DialogDescription>
            Modal superposition analysis using a design spectrum (SRSS/CQC combination).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Design Spectrum</label>
            <select
              value={spectrumCode}
              onChange={(e) => setSpectrumCode(e.target.value as SpectrumCode)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="IS1893">IS 1893:2016</option>
              <option value="ASCE7">ASCE 7-22</option>
              <option value="EN1998">EN 1998-1 (Eurocode 8)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modal Combination</label>
            <select
              value={combination}
              onChange={(e) => setCombination(e.target.value as ModalCombination)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="CQC">CQC (Complete Quadratic Combination)</option>
              <option value="SRSS">SRSS (Square Root of Sum of Squares)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Number of Modes</label>
            <input
              type="number"
              min="1"
              max="100"
              value={numModes}
              onChange={(e) => setNumModes(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Scale X', value: scaleX, set: setScaleX },
              { label: 'Scale Y', value: scaleY, set: setScaleY },
              { label: 'Scale Z', value: scaleZ, set: setScaleZ },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium mb-1">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
            ))}
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
