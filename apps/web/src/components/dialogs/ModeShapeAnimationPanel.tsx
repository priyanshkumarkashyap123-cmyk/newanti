/**
 * ModeShapeAnimationPanel.tsx — Mode Shape Animation
 *
 * STAAD.Pro parity: Animates mode shapes from modal analysis results.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface ModeShapeAnimationPanelProps {
  open: boolean;
  onClose: () => void;
}

export const ModeShapeAnimationPanel: React.FC<ModeShapeAnimationPanelProps> = ({ open, onClose }) => {
  const { modalResults, activeModeIndex, modeAmplitude, isAnimating } = useModelStore((s) => ({
    modalResults: s.modalResults,
    activeModeIndex: s.activeModeIndex,
    modeAmplitude: s.modeAmplitude,
    isAnimating: s.isAnimating,
  }));

  const setActiveModeIndex = useModelStore((s) => (s as any).setActiveModeIndex);
  const setModeAmplitude = useModelStore((s) => (s as any).setModeAmplitude);
  const setIsAnimating = useModelStore((s) => (s as any).setIsAnimating);

  const [speed, setSpeed] = useState(1.0);

  const handlePlay = useCallback(() => {
    if (setIsAnimating) setIsAnimating(true);
  }, [setIsAnimating]);

  const handlePause = useCallback(() => {
    if (setIsAnimating) setIsAnimating(false);
  }, [setIsAnimating]);

  const handleStep = useCallback(() => {
    if (setIsAnimating) setIsAnimating(false);
    // Step one frame — dispatch event to viewport
    document.dispatchEvent(new CustomEvent('mode-shape-step'));
  }, [setIsAnimating]);

  // Stop animation when dialog closes
  useEffect(() => {
    if (!open && setIsAnimating) {
      setIsAnimating(false);
    }
  }, [open, setIsAnimating]);

  const modes = modalResults?.modes ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mode Shape Animation</DialogTitle>
          <DialogDescription>
            Animate mode shapes from modal analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {modes.length === 0 ? (
            <p className="text-slate-500 text-sm">No modal results available. Run modal analysis first.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium tracking-wide tracking-wide mb-1">Select Mode</label>
                <div className="border rounded max-h-48 overflow-y-auto">
                  {modes.map((mode: any, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveModeIndex?.(i)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${activeModeIndex === i ? 'bg-blue-50 dark:bg-blue-900/20 font-medium tracking-wide tracking-wide' : ''}`}
                    >
                      Mode {i + 1}: {mode.frequency?.toFixed(3) ?? '—'} Hz
                      {mode.massParticipation !== undefined && (
                        <span className="text-xs text-slate-500 ml-2">
                          ({(mode.massParticipation * 100).toFixed(1)}% mass)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium tracking-wide tracking-wide mb-1">
                    Amplitude Scale: {modeAmplitude.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={modeAmplitude}
                    onChange={(e) => setModeAmplitude?.(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium tracking-wide tracking-wide mb-1">
                    Speed: {speed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePlay}
                  disabled={isAnimating}
                  className="flex-1"
                >
                  ▶ Play
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePause}
                  disabled={!isAnimating}
                  className="flex-1"
                >
                  ⏸ Pause
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStep}
                  className="flex-1"
                >
                  ⏭ Step
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
