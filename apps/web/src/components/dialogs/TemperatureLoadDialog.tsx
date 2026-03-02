/**
 * TemperatureLoadDialog.tsx — Thermal Loading
 * 
 * Industry parity: STAAD Pro "Loading → Temperature", SAP2000 "Load → Temperature",
 * ETABS "Assign → Frame → Temperature", RISA "Loads → Thermal"
 * 
 * Supports uniform temperature change and temperature gradient across depth.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Check, Thermometer, Info } from 'lucide-react';
import { useModelStore } from '../../store/model';

interface TemperatureLoadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TempLoadType = 'uniform' | 'gradient';

export const TemperatureLoadDialog: React.FC<TemperatureLoadDialogProps> = ({ isOpen, onClose }) => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [loadType, setLoadType] = useState<TempLoadType>('uniform');
  const [uniformDeltaT, setUniformDeltaT] = useState(20); // °C
  const [gradientTop, setGradientTop] = useState(30);       // °C at top fiber
  const [gradientBottom, setGradientBottom] = useState(10);  // °C at bottom fiber
  const [alpha, setAlpha] = useState(12e-6);                 // Thermal expansion coefficient

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      const existing = (member as any).temperatureLoad || {};
      updateMember(member.id, {
        ...(member as any),
        temperatureLoad: {
          type: loadType,
          uniformDeltaT: loadType === 'uniform' ? uniformDeltaT : undefined,
          gradientTop: loadType === 'gradient' ? gradientTop : undefined,
          gradientBottom: loadType === 'gradient' ? gradientBottom : undefined,
          alpha,
        },
      } as any);
    });
    onClose();
  }, [loadType, uniformDeltaT, gradientTop, gradientBottom, alpha, selectedMembers, updateMember, onClose]);

  // Computed axial strain / curvature preview
  const previewStrain = loadType === 'uniform'
    ? (alpha * uniformDeltaT * 1e6).toFixed(1)
    : (alpha * ((gradientTop + gradientBottom) / 2) * 1e6).toFixed(1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-500" />
            Temperature Load
          </DialogTitle>
          <DialogDescription>
            Apply thermal loading to {selectedMembers.length > 0 ? `${selectedMembers.length} selected member${selectedMembers.length > 1 ? 's' : ''}` : 'selected members'}.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Load Type */}
          <div>
            <Label>Load Type</Label>
            <Select value={loadType} onValueChange={v => setLoadType(v as TempLoadType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniform Temperature Change (ΔT)</SelectItem>
                <SelectItem value="gradient">Temperature Gradient (Top/Bottom)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadType === 'uniform' ? (
            <div>
              <Label>Temperature Change ΔT (°C)</Label>
              <Input
                type="number"
                value={uniformDeltaT}
                onChange={e => setUniformDeltaT(+e.target.value)}
                step={1}
                className="mt-1 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Positive = heating (expansion), Negative = cooling (contraction)</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Top Fiber Temp (°C)</Label>
                <Input
                  type="number"
                  value={gradientTop}
                  onChange={e => setGradientTop(+e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Bottom Fiber Temp (°C)</Label>
                <Input
                  type="number"
                  value={gradientBottom}
                  onChange={e => setGradientBottom(+e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          )}

          {/* Thermal coefficient */}
          <div>
            <Label>Thermal Expansion Coeff. α (/°C)</Label>
            <Input
              type="number"
              value={alpha}
              onChange={e => setAlpha(+e.target.value)}
              step={1e-7}
              className="mt-1 font-mono"
            />
            <div className="flex gap-2 mt-2">
              {[
                { label: 'Steel', val: 12e-6 },
                { label: 'Concrete', val: 10e-6 },
                { label: 'Aluminum', val: 23.6e-6 },
                { label: 'Timber', val: 5e-6 },
              ].map(mat => (
                <button
                  key={mat.label}
                  onClick={() => setAlpha(mat.val)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    Math.abs(alpha - mat.val) < 1e-8
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
            <span className="font-medium text-orange-700 dark:text-orange-300">Estimated Axial Strain: </span>
            <span className="font-mono text-orange-600 dark:text-orange-400">{previewStrain} με (microstrain)</span>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Uniform ΔT causes axial expansion/contraction. Temperature gradient causes bending
              (differential strain across depth). Per IS 456 / ASCE 7, thermal loads are typically
              combined with dead + live loads using appropriate load factors.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={selectedMembers.length === 0}>
            <Check className="w-4 h-4 mr-1" />
            Apply Temperature Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
