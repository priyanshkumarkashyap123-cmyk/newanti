/**
 * SnowLoadDialog.tsx — Snow Load Generator
 *
 * STAAD.Pro parity: Generates snow loads per ASCE 7-22 or IS 875 Part 4.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';
import {
  computeSnowLoad,
  type SnowCode,
  type ASCE7SnowParams,
  type IS875SnowParams,
} from '../../utils/loadGenerators';

export interface SnowLoadDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SnowLoadDialog: React.FC<SnowLoadDialogProps> = ({ open, onClose }) => {
  const { selectedIds, members, addMemberLoad } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    addMemberLoad: s.addMemberLoad,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));

  const [code, setCode] = useState<SnowCode>('ASCE7');

  // ASCE 7 params
  const [pg, setPg] = useState('1.0');
  const [Ce, setCe] = useState('1.0');
  const [Ct, setCt] = useState('1.0');
  const [Is, setIs] = useState('1.0');
  const [slope, setSlope] = useState('0');

  // IS 875 params
  const [basicSnow, setBasicSnow] = useState('1.0');
  const [shapeCoeff, setShapeCoeff] = useState('1.0');
  const [exposureRed, setExposureRed] = useState('1.0');

  const computedLoad = (() => {
    try {
      if (code === 'ASCE7') {
        const params: ASCE7SnowParams = {
          pg: parseFloat(pg),
          Ce: parseFloat(Ce),
          Ct: parseFloat(Ct),
          Is: parseFloat(Is),
          roofSlope: parseFloat(slope),
        };
        if (Object.values(params).some(isNaN)) return null;
        return computeSnowLoad('ASCE7', params);
      } else {
        const params: IS875SnowParams = {
          basicSnowLoad: parseFloat(basicSnow),
          shapeCoefficient: parseFloat(shapeCoeff),
          exposureReduction: parseFloat(exposureRed),
        };
        if (Object.values(params).some(isNaN)) return null;
        return computeSnowLoad('IS875_4', params);
      }
    } catch {
      return null;
    }
  })();

  const handleConfirm = useCallback(() => {
    if (!computedLoad || selectedMemberIds.length === 0) return;
    const udl = computedLoad.designLoad;
    selectedMemberIds.forEach((id) => {
      addMemberLoad({
        id: `SL_${id}_${Date.now()}`,
        memberId: id,
        type: 'UDL',
        w1: -udl,
        w2: -udl,
        direction: 'global_y',
      });
    });
    onClose();
  }, [computedLoad, selectedMemberIds, addMemberLoad, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Snow Load Generator</DialogTitle>
          <DialogDescription>
            Generate snow loads per ASCE 7-22 or IS 875 Part 4.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium tracking-wide mb-1">Design Code</label>
            <select
              value={code}
              onChange={(e) => setCode(e.target.value as SnowCode)}
              className="w-full px-3 py-2 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            >
              <option value="ASCE7">ASCE 7-22</option>
              <option value="IS875_4">IS 875 Part 4</option>
            </select>
          </div>

          {code === 'ASCE7' ? (
            <div className="space-y-3">
              {[
                { label: 'Ground Snow Load pg (kN/m²)', value: pg, set: setPg },
                { label: 'Exposure Factor Ce', value: Ce, set: setCe },
                { label: 'Thermal Factor Ct', value: Ct, set: setCt },
                { label: 'Importance Factor Is', value: Is, set: setIs },
                { label: 'Roof Slope (degrees)', value: slope, set: setSlope },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium tracking-wide mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Basic Snow Load S0 (kN/m²)', value: basicSnow, set: setBasicSnow },
                { label: 'Shape Coefficient μ', value: shapeCoeff, set: setShapeCoeff },
                { label: 'Exposure Reduction k1', value: exposureRed, set: setExposureRed },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium tracking-wide mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                  />
                </div>
              ))}
            </div>
          )}

          {computedLoad && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 text-sm">
              <p className="font-medium tracking-wide">Design Snow Load: {computedLoad.designLoad.toFixed(3)} kN/m²</p>
              {computedLoad.flatRoofLoad !== undefined && (
                <p className="text-xs text-slate-500">Flat roof load pf: {computedLoad.flatRoofLoad.toFixed(3)} kN/m²</p>
              )}
              {computedLoad.slopeFactor !== undefined && (
                <p className="text-xs text-slate-500">Slope factor Cs: {computedLoad.slopeFactor.toFixed(3)}</p>
              )}
            </div>
          )}

          <p className="text-sm text-[#869ab8]">
            Will apply to <strong>{selectedMemberIds.length}</strong> selected member(s).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!computedLoad || selectedMemberIds.length === 0}
          >
            Apply Snow Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
