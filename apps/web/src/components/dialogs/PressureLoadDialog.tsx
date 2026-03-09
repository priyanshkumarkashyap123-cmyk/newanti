/**
 * PressureLoadDialog.tsx — Area / Hydrostatic / Earth Pressure Load
 *
 * Apply pressure loads on plate elements or as equivalent member loads.
 * Supports uniform pressure, hydrostatic (linearly varying with depth),
 * and lateral earth pressure (Ka × γ × h).
 * Units: kN/m² (kPa)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Waves, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

type PressureType = 'uniform' | 'hydrostatic' | 'earth';

const PressureLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.pressureLoad || false;
  const onClose = () => setModal('pressureLoad', false);

  const { members, selectedIds, addMemberLoad } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      selectedIds: s.selectedIds,
      addMemberLoad: s.addMemberLoad,
    }))
  );

  const [pressureType, setPressureType] = useState<PressureType>('uniform');
  const [pressure, setPressure] = useState(5);       // kPa for uniform
  const [fluidDensity, setFluidDensity] = useState(9.81); // kN/m³ for hydrostatic (water)
  const [depth, setDepth] = useState(3);             // m
  const [Ka, setKa] = useState(0.33);               // Active earth pressure coefficient
  const [soilDensity, setSoilDensity] = useState(18); // kN/m³
  const [tributaryWidth, setTributaryWidth] = useState(1); // m

  const selectedMembers = useMemo(
    () => Array.from(selectedIds).filter((id) => id.startsWith('M') && members.has(id)),
    [selectedIds, members]
  );

  const computedPressure = useMemo(() => {
    switch (pressureType) {
      case 'uniform': return pressure;
      case 'hydrostatic': return fluidDensity * depth;
      case 'earth': return Ka * soilDensity * depth;
    }
  }, [pressureType, pressure, fluidDensity, depth, Ka, soilDensity]);

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    const w = computedPressure * tributaryWidth; // Convert kPa → kN/m
    for (const memberId of selectedMembers) {
      addMemberLoad({
        id: `PR_${memberId}_${Date.now()}`,
        memberId,
        type: pressureType === 'uniform' ? 'UDL' : 'trapezoidal',
        w1: pressureType === 'uniform' ? -w : 0,
        w2: -w,
        direction: 'global_y',
      } as any);
    }
    onClose();
  }, [selectedMembers, computedPressure, pressureType, tributaryWidth, addMemberLoad]);

  const noMembers = selectedMembers.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-cyan-500" />
            Pressure Load
          </DialogTitle>
          <DialogDescription>
            Apply uniform, hydrostatic, or earth pressure as equivalent member loads.
          </DialogDescription>
        </DialogHeader>

        {noMembers && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select member(s) to apply pressure load.
          </div>
        )}

        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-xs">Pressure Type</Label>
            <Select value={pressureType} onValueChange={(v) => setPressureType(v as PressureType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniform Pressure</SelectItem>
                <SelectItem value="hydrostatic">Hydrostatic (γ × h)</SelectItem>
                <SelectItem value="earth">Earth Pressure (Ka × γ × h)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pressureType === 'uniform' && (
            <div>
              <Label className="text-xs">Pressure (kN/m²)</Label>
              <Input type="number" value={pressure} onChange={(e) => setPressure(parseFloat(e.target.value) || 0)} step="0.5" />
            </div>
          )}

          {pressureType === 'hydrostatic' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">γ fluid (kN/m³)</Label>
                <Input type="number" value={fluidDensity} onChange={(e) => setFluidDensity(parseFloat(e.target.value) || 0)} step="0.1" />
              </div>
              <div>
                <Label className="text-xs">Depth h (m)</Label>
                <Input type="number" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value) || 0)} step="0.5" />
              </div>
            </div>
          )}

          {pressureType === 'earth' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Ka</Label>
                <Input type="number" value={Ka} onChange={(e) => setKa(parseFloat(e.target.value) || 0)} step="0.01" />
              </div>
              <div>
                <Label className="text-xs">γ soil (kN/m³)</Label>
                <Input type="number" value={soilDensity} onChange={(e) => setSoilDensity(parseFloat(e.target.value) || 0)} step="0.5" />
              </div>
              <div>
                <Label className="text-xs">h (m)</Label>
                <Input type="number" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value) || 0)} step="0.5" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Tributary Width (m)</Label>
            <Input type="number" value={tributaryWidth} onChange={(e) => setTributaryWidth(parseFloat(e.target.value) || 1)} step="0.5" min="0.1" />
          </div>

          <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
            Peak pressure = {computedPressure.toFixed(2)} kPa → equivalent UDL = {(computedPressure * tributaryWidth).toFixed(2)} kN/m
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={noMembers || computedPressure === 0}>
            Apply to {selectedMembers.length} member(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PressureLoadDialog;
