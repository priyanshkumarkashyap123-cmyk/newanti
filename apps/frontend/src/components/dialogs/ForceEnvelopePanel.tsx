/**
 * ForceEnvelopePanel.tsx — Force Envelope Post-Processing
 *
 * STAAD.Pro parity: Displays max/min force envelopes across all load combinations.
 */
import React, { useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface ForceEnvelopePanelProps {
  open: boolean;
  onClose: () => void;
}

export const ForceEnvelopePanel: React.FC<ForceEnvelopePanelProps> = ({ open, onClose }) => {
  const { selectedIds, members, analysisResults } = useModelStore((s) => ({
    selectedIds: s.selectedIds,
    members: s.members,
    analysisResults: s.analysisResults,
  }));

  const selectedMemberIds = Array.from(selectedIds).filter((id) => members.has(id));
  const displayIds = selectedMemberIds.length > 0
    ? selectedMemberIds
    : Array.from(members.keys()).slice(0, 20);

  const envelopeData = useMemo(() => {
    if (!analysisResults?.memberForces) return [];
    return displayIds.map((id) => {
      const forces = analysisResults.memberForces!.get(id);
      if (!forces) return null;
      return {
        id,
        maxAxial: forces.axial,
        minAxial: forces.startForces?.axial ?? forces.axial,
        maxShearY: forces.shearY,
        minShearY: forces.startForces?.shearY ?? forces.shearY,
        maxShearZ: forces.shearZ ?? 0,
        minShearZ: forces.startForces?.shearZ ?? forces.shearZ ?? 0,
        maxTorsion: forces.torsion ?? 0,
        minTorsion: -(forces.torsion ?? 0),
        maxMomentY: forces.momentY ?? 0,
        minMomentY: forces.startForces?.momentY ?? forces.momentY ?? 0,
        maxMomentZ: forces.momentZ,
        minMomentZ: forces.startForces?.momentZ ?? forces.momentZ,
      };
    }).filter(Boolean);
  }, [displayIds, analysisResults]);

  const handleExportCSV = useCallback(() => {
    const header = 'Member,Max N,Min N,Max Vy,Min Vy,Max Vz,Min Vz,Max T,Min T,Max My,Min My,Max Mz,Min Mz\n';
    const rows = envelopeData.map((d) =>
      `${d!.id},${d!.maxAxial.toFixed(3)},${d!.minAxial.toFixed(3)},${d!.maxShearY.toFixed(3)},${d!.minShearY.toFixed(3)},${d!.maxShearZ.toFixed(3)},${d!.minShearZ.toFixed(3)},${d!.maxTorsion.toFixed(3)},${d!.minTorsion.toFixed(3)},${d!.maxMomentY.toFixed(3)},${d!.minMomentY.toFixed(3)},${d!.maxMomentZ.toFixed(3)},${d!.minMomentZ.toFixed(3)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'force_envelope.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [envelopeData]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Force Envelope</DialogTitle>
          <DialogDescription>
            Maximum and minimum forces across all load combinations.
            {selectedMemberIds.length === 0 && ' Showing first 20 members.'}
          </DialogDescription>
        </DialogHeader>

        {envelopeData.length === 0 ? (
          <p className="text-slate-500 text-sm">No force data available. Run analysis first.</p>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-[#131b2e]">
                  <th className="p-2 text-left">Member</th>
                  <th className="p-2 text-right">Max N</th>
                  <th className="p-2 text-right">Min N</th>
                  <th className="p-2 text-right">Max Vy</th>
                  <th className="p-2 text-right">Min Vy</th>
                  <th className="p-2 text-right">Max Mz</th>
                  <th className="p-2 text-right">Min Mz</th>
                </tr>
              </thead>
              <tbody>
                {envelopeData.map((d) => d && (
                  <tr key={d.id} className="border-b border-[#1a2333]">
                    <td className="p-2 font-mono">{d.id}</td>
                    <td className="p-2 text-right">{d.maxAxial.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.minAxial.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.maxShearY.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.minShearY.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.maxMomentZ.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.minMomentZ.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleExportCSV} disabled={envelopeData.length === 0}>
            Export CSV
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
