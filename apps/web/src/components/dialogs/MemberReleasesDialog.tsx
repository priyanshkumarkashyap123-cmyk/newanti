/**
 * MemberReleasesDialog.tsx — Member End Releases (Pins/Hinges)
 * 
 * Industry parity: STAAD Pro "Member Release", SAP2000 "Assign → Frame → Releases",
 * ETABS "Assign → Frame → Releases/Partial Fixity", RISA "Member → Releases"
 * 
 * Controls the fixity conditions at each end of a member for all 6 DOFs.
 * Release = true means that DOF is freed (moment release = pin, force release = slot).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Check, Unlink, Info } from 'lucide-react';
import { useModelStore } from '../../store/model';

interface MemberReleasesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReleaseState {
  fxStart: boolean; fyStart: boolean; fzStart: boolean;
  mxStart: boolean; myStart: boolean; mzStart: boolean;
  fxEnd: boolean;   fyEnd: boolean;   fzEnd: boolean;
  mxEnd: boolean;   myEnd: boolean;   mzEnd: boolean;
}

const DEFAULT_RELEASES: ReleaseState = {
  fxStart: false, fyStart: false, fzStart: false,
  mxStart: false, myStart: false, mzStart: false,
  fxEnd: false, fyEnd: false, fzEnd: false,
  mxEnd: false, myEnd: false, mzEnd: false,
};

const PRESETS: { label: string; desc: string; releases: Partial<ReleaseState> }[] = [
  {
    label: 'Fixed-Fixed',
    desc: 'Both ends fully fixed (rigid frame)',
    releases: { ...DEFAULT_RELEASES },
  },
  {
    label: 'Pin-Pin',
    desc: 'Both ends pinned (truss member)',
    releases: {
      ...DEFAULT_RELEASES,
      mxStart: true, myStart: true, mzStart: true,
      mxEnd: true, myEnd: true, mzEnd: true,
    },
  },
  {
    label: 'Pin-Fixed',
    desc: 'Start pinned, end fixed',
    releases: {
      ...DEFAULT_RELEASES,
      mxStart: true, myStart: true, mzStart: true,
    },
  },
  {
    label: 'Fixed-Pin',
    desc: 'Start fixed, end pinned',
    releases: {
      ...DEFAULT_RELEASES,
      mxEnd: true, myEnd: true, mzEnd: true,
    },
  },
  {
    label: 'Mz Release (2D Pin-Pin)',
    desc: 'Only Mz released at both ends (2D truss)',
    releases: {
      ...DEFAULT_RELEASES,
      mzStart: true, mzEnd: true,
    },
  },
  {
    label: 'Axial Release (Start)',
    desc: 'Start end free to slide axially',
    releases: {
      ...DEFAULT_RELEASES,
      fxStart: true,
    },
  },
];

const DOF_LABELS = {
  fx: { label: 'Fx', desc: 'Axial', color: 'red' },
  fy: { label: 'Fy', desc: 'Shear Y', color: 'green' },
  fz: { label: 'Fz', desc: 'Shear Z', color: 'blue' },
  mx: { label: 'Mx', desc: 'Torsion', color: 'red' },
  my: { label: 'My', desc: 'Bend. Y', color: 'green' },
  mz: { label: 'Mz', desc: 'Bend. Z', color: 'blue' },
};

export const MemberReleasesDialog: React.FC<MemberReleasesDialogProps> = ({ isOpen, onClose }) => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [releases, setReleases] = useState<ReleaseState>({ ...DEFAULT_RELEASES });

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  // Initialize from first selected member
  useEffect(() => {
    if (isOpen && selectedMembers.length > 0) {
      const existing = selectedMembers[0].releases;
      if (existing) {
        setReleases({
          fxStart: existing.fxStart ?? false,
          fyStart: existing.fyStart ?? false,
          fzStart: existing.fzStart ?? false,
          mxStart: existing.mxStart ?? false,
          myStart: existing.myStart ?? false,
          mzStart: existing.mzStart ?? (existing.startMoment ?? false),
          fxEnd: existing.fxEnd ?? false,
          fyEnd: existing.fyEnd ?? false,
          fzEnd: existing.fzEnd ?? false,
          mxEnd: existing.mxEnd ?? false,
          myEnd: existing.myEnd ?? false,
          mzEnd: existing.mzEnd ?? (existing.endMoment ?? false),
        });
      } else {
        setReleases({ ...DEFAULT_RELEASES });
      }
    }
  }, [isOpen]);

  const toggleRelease = (key: keyof ReleaseState) => {
    setReleases(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (preset: Partial<ReleaseState>) => {
    setReleases({ ...DEFAULT_RELEASES, ...preset });
  };

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, {
        releases: {
          ...releases,
          // Legacy compatibility
          startMoment: releases.mzStart,
          endMoment: releases.mzEnd,
        },
      });
    });
    onClose();
  }, [releases, selectedMembers, updateMember, onClose]);

  const ReleaseGrid: React.FC<{ end: 'Start' | 'End' }> = ({ end }) => {
    const suffix = end;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${end === 'Start' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
          {end} End (Node {end === 'Start' ? 'i' : 'j'})
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(DOF_LABELS) as [string, { label: string; desc: string; color: string }][]).map(([dof, info]) => {
            const key = `${dof}${suffix}` as keyof ReleaseState;
            const isReleased = releases[key];
            return (
              <button type="button"
                key={key}
                onClick={() => toggleRelease(key)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-xs ${
                  isReleased
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <span className="font-mono font-bold text-sm">{info.label}</span>
                <span className="text-[10px] opacity-70">{info.desc}</span>
                <span className={`text-[10px] font-semibold ${isReleased ? 'text-red-500' : 'text-emerald-500'}`}>
                  {isReleased ? 'RELEASED' : 'FIXED'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlink className="w-5 h-5 text-red-500" />
            Member End Releases
          </DialogTitle>
          <DialogDescription>
            Set fixity conditions at each end of {selectedMembers.length > 0 ? `${selectedMembers.length} selected member${selectedMembers.length > 1 ? 's' : ''}` : 'selected members'}.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Presets */}
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">Quick Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(preset => (
                <button type="button"
                  key={preset.label}
                  onClick={() => applyPreset(preset.releases)}
                  title={preset.desc}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-slate-700 dark:text-slate-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start / End Release Grids */}
          <div className="grid grid-cols-2 gap-4">
            <ReleaseGrid end="Start" />
            <ReleaseGrid end="End" />
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Released</strong> = DOF is free (e.g., moment release creates a pin/hinge).
              <strong className="ml-1">Fixed</strong> = DOF is rigid (transfers force/moment through the connection).
              Truss members typically have all moments released at both ends.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => setReleases({ ...DEFAULT_RELEASES })}>
            Reset All
          </Button>
          <Button onClick={handleApply} disabled={selectedMembers.length === 0}>
            <Check className="w-4 h-4 mr-1" />
            Apply Releases
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
