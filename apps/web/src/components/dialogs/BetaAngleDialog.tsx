/**
 * BetaAngleDialog.tsx — Member Orientation (Beta/Roll Angle)
 * 
 * Industry parity: STAAD Pro "Member Properties → Beta Angle",
 * SAP2000 "Local Axes → Rotation", ETABS "Frame → Local Axes",
 * RISA "Member → Beta Angle"
 * 
 * Controls the rotation of a member's local axes about its longitudinal axis.
 * Beta = 0° means major axis vertical; Beta = 90° rotates member 90° about its axis.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RotateCw, Check, Info } from 'lucide-react';
import { useModelStore } from '../../store/model';

interface BetaAngleDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_ANGLES = [
  { label: '0°', value: 0, desc: 'Default orientation (major axis vertical)' },
  { label: '30°', value: 30, desc: 'Rotated 30° about member axis' },
  { label: '45°', value: 45, desc: 'Rotated 45° about member axis' },
  { label: '60°', value: 60, desc: 'Rotated 60° about member axis' },
  { label: '90°', value: 90, desc: 'Web horizontal (weak-axis bending in vertical plane)' },
  { label: '180°', value: 180, desc: 'Inverted orientation' },
];

export const BetaAngleDialog: React.FC<BetaAngleDialogProps> = ({ isOpen, onClose }) => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [betaAngle, setBetaAngle] = useState(0);

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  // Initialize from first selected member
  useEffect(() => {
    if (isOpen && selectedMembers.length > 0) {
      setBetaAngle(selectedMembers[0].betaAngle ?? 0);
    }
  }, [isOpen]);

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, { betaAngle });
    });
    onClose();
  }, [betaAngle, selectedMembers, updateMember, onClose]);

  // SVG preview of member cross-section rotation
  const previewAngle = betaAngle;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-violet-500" />
            Member Orientation (Beta Angle)
          </DialogTitle>
          <DialogDescription>
            Set the rotation of the member&apos;s local axes about its longitudinal axis.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Visual Preview */}
          <div className="flex justify-center">
            <div className="w-40 h-40 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-32 h-32">
                {/* Grid */}
                <line x1="10" y1="50" x2="90" y2="50" stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="2" />
                <line x1="50" y1="10" x2="50" y2="90" stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="2" />
                {/* Rotated I-beam cross section */}
                <g transform={`rotate(${previewAngle}, 50, 50)`}>
                  {/* Web */}
                  <rect x="48" y="25" width="4" height="50" fill="#3B82F6" opacity="0.8" rx="0.5" />
                  {/* Top flange */}
                  <rect x="35" y="23" width="30" height="5" fill="#3B82F6" opacity="0.9" rx="0.5" />
                  {/* Bottom flange */}
                  <rect x="35" y="72" width="30" height="5" fill="#3B82F6" opacity="0.9" rx="0.5" />
                </g>
                {/* Axis labels */}
                <text x="92" y="53" fontSize="6" fill="#94a3b8" textAnchor="start">Y</text>
                <text x="50" y="8" fontSize="6" fill="#94a3b8" textAnchor="middle">Z</text>
              </svg>
              <span className="absolute bottom-1 right-2 text-xs text-slate-400 font-mono">{betaAngle}°</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">Quick Presets</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_ANGLES.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setBetaAngle(preset.value)}
                  title={preset.desc}
                  className={`py-2 text-xs font-mono rounded-lg border transition-colors ${
                    betaAngle === preset.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input */}
          <div>
            <Label>Custom Angle (degrees)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                value={betaAngle}
                onChange={e => setBetaAngle(+e.target.value)}
                min={-360}
                max={360}
                step={1}
                className="font-mono"
              />
              <input
                type="range"
                min={-180}
                max={180}
                value={betaAngle}
                onChange={e => setBetaAngle(+e.target.value)}
                className="flex-1 accent-violet-500"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Beta angle rotates the member&apos;s local y-z axes about its longitudinal (x) axis.
              A value of 0° places the major axis (strong axis) in the global vertical plane.
              90° rotates the section so the web is horizontal.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={selectedMembers.length === 0}>
            <Check className="w-4 h-4 mr-1" />
            Apply to {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
