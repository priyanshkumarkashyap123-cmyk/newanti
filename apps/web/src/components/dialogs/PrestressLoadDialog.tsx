/**
 * PrestressLoadDialog.tsx — Pre-stress / Post-Tension Load
 *
 * Apply pre-stress (pre-tension or post-tension) forces on selected members.
 * Models as axial force + eccentricity → equivalent nodal moments.
 * Units: Force in kN, eccentricity in mm.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Cable, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

type PrestressType = 'pretension' | 'posttension';
type TendonProfile = 'straight' | 'parabolic';

const PrestressLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.prestressLoad || false;
  const onClose = () => setModal('prestressLoad', false);

  const { members, selectedIds, addMemberLoad } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      selectedIds: s.selectedIds,
      addMemberLoad: s.addMemberLoad,
    }))
  );

  const [prestressType, setPrestressType] = useState<PrestressType>('posttension');
  const [force, setForce] = useState(500);       // kN
  const [eccentricity, setEccentricity] = useState(100); // mm from centroid
  const [tendonProfile, setTendonProfile] = useState<TendonProfile>('parabolic');
  const [frictionLoss, setFrictionLoss] = useState(5); // % loss

  const selectedMembers = useMemo(
    () => Array.from(selectedIds).filter((id) => id.startsWith('M') && members.has(id)),
    [selectedIds, members]
  );

  const effectiveForce = force * (1 - frictionLoss / 100);
  const equivalentMoment = (effectiveForce * eccentricity) / 1000; // kN·m

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    for (const memberId of selectedMembers) {
      addMemberLoad({
        id: `PS_${memberId}_${Date.now()}`,
        memberId,
        type: 'prestress' as any,
        P: -effectiveForce, // Compression
        eccentricity,
        tendonProfile,
        prestressType,
      } as any);
    }
    onClose();
  }, [selectedMembers, effectiveForce, eccentricity, tendonProfile, prestressType, addMemberLoad]);

  const noMembers = selectedMembers.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cable className="w-5 h-5 text-violet-500" />
            Prestress / Post-Tension Load
          </DialogTitle>
          <DialogDescription>
            Apply prestressing force with tendon eccentricity on {selectedMembers.length || 'selected'} member(s).
          </DialogDescription>
        </DialogHeader>

        {noMembers && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one member first.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={prestressType} onValueChange={(v) => setPrestressType(v as PrestressType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pretension">Pre-Tension</SelectItem>
                  <SelectItem value="posttension">Post-Tension</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tendon Profile</Label>
              <Select value={tendonProfile} onValueChange={(v) => setTendonProfile(v as TendonProfile)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">Straight</SelectItem>
                  <SelectItem value="parabolic">Parabolic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Force P (kN)</Label>
              <Input type="number" value={force} onChange={(e) => setForce(parseFloat(e.target.value) || 0)} step="10" min="0" />
            </div>
            <div>
              <Label className="text-xs">Ecc. e (mm)</Label>
              <Input type="number" value={eccentricity} onChange={(e) => setEccentricity(parseFloat(e.target.value) || 0)} step="5" min="0" />
            </div>
            <div>
              <Label className="text-xs">Loss (%)</Label>
              <Input type="number" value={frictionLoss} onChange={(e) => setFrictionLoss(Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)))} step="1" min="0" max="50" />
            </div>
          </div>

          <div className="p-2 rounded bg-[#131b2e] text-xs text-[#869ab8] space-y-1">
            <div className="font-mono">Effective P = {effectiveForce.toFixed(1)} kN (after {frictionLoss}% loss)</div>
            <div className="font-mono">Equivalent M = P × e = {equivalentMoment.toFixed(2)} kN·m</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noMembers || force === 0}>
            Apply to {selectedMembers.length} member(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrestressLoadDialog;
