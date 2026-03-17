/**
 * InactiveMemberDialog.tsx — Inactive Member Specification
 *
 * STAAD.Pro parity: Marks members as inactive for all load cases or
 * specific load cases (phased construction, progressive collapse).
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface InactiveMemberDialogProps {
  open: boolean;
  onClose: () => void;
}

export const InactiveMemberDialog: React.FC<InactiveMemberDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, loadCases, updateMember } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    loadCases: s.loadCases,
    updateMember: s.updateMember,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [scope, setScope] = useState<'global' | 'load_cases'>('global');
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
    if (selectedMemberIds.length === 0) return;
    const spec = scope === 'global'
      ? { scope: 'global' as const }
      : { scope: 'load_cases' as const, loadCaseIds: Array.from(selectedLoadCaseIds) };
    selectedMemberIds.forEach((id) => updateMember(id, { inactive: spec }));
    onClose();
  }, [selectedMemberIds, scope, selectedLoadCaseIds, updateMember, onClose]);

  const canConfirm =
    selectedMemberIds.length > 0 &&
    (scope === 'global' || selectedLoadCaseIds.size > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inactive Member</DialogTitle>
          <DialogDescription>
            {selectedMemberIds.length > 0
              ? `Mark ${selectedMemberIds.length} selected member(s) as inactive.`
              : 'No members selected. Select members first.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scope === 'global'}
                onChange={() => setScope('global')}
              />
              <span className="text-sm font-medium">All load cases (global)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scope === 'load_cases'}
                onChange={() => setScope('load_cases')}
              />
              <span className="text-sm font-medium">Selected load cases only</span>
            </label>
          </div>

          {scope === 'load_cases' && (
            <div className="border rounded p-3 max-h-48 overflow-y-auto space-y-1">
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
