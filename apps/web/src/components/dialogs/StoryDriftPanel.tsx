/**
 * StoryDriftPanel.tsx — Story Drift Post-Processing
 *
 * STAAD.Pro parity: Displays inter-story drift ratios after analysis.
 * Highlights rows exceeding the user-specified drift limit.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useModelStore } from '../../store/model';

export interface StoryDriftPanelProps {
  open: boolean;
  onClose: () => void;
  driftLimit?: number; // default 1/400
}

/** Checks if a drift ratio exceeds the limit. */
export function isDriftExceeded(driftRatio: number, limit: number): boolean {
  return driftRatio > limit;
}

interface StoryData {
  label: string;
  height: number;
  displacement: number;
  driftRatio: number;
}

export const StoryDriftPanel: React.FC<StoryDriftPanelProps> = ({
  open,
  onClose,
  driftLimit = 1 / 400,
}) => {
  const { analysisResults, nodes } = useModelStore((s) => ({
    analysisResults: s.analysisResults,
    nodes: s.nodes,
  }));

  const [limit, setLimit] = useState(driftLimit);

  // Compute story drift from analysis results
  const storyData = useMemo<StoryData[]>(() => {
    if (!analysisResults?.displacements) return [];

    // Group nodes by Y level (story)
    const yLevels = new Map<number, string[]>();
    for (const [id, node] of nodes) {
      const y = Math.round(node.y * 100) / 100; // round to cm
      if (!yLevels.has(y)) yLevels.set(y, []);
      yLevels.get(y)!.push(id);
    }

    const sortedLevels = Array.from(yLevels.keys()).sort((a, b) => a - b);
    const stories: StoryData[] = [];

    for (let i = 1; i < sortedLevels.length; i++) {
      const y = sortedLevels[i];
      const yPrev = sortedLevels[i - 1];
      const height = y - yPrev;

      // Average lateral displacement at this level
      const nodeIds = yLevels.get(y) ?? [];
      let totalDisp = 0;
      let count = 0;
      for (const id of nodeIds) {
        const disp = analysisResults.displacements.get(id);
        if (disp) {
          const dx = Array.isArray(disp) ? disp[0] : (disp as any).DX ?? 0;
          totalDisp += Math.abs(dx);
          count++;
        }
      }
      const avgDisp = count > 0 ? totalDisp / count : 0;

      // Previous level displacement
      const prevNodeIds = yLevels.get(yPrev) ?? [];
      let prevTotalDisp = 0;
      let prevCount = 0;
      for (const id of prevNodeIds) {
        const disp = analysisResults.displacements.get(id);
        if (disp) {
          const dx = Array.isArray(disp) ? disp[0] : (disp as any).DX ?? 0;
          prevTotalDisp += Math.abs(dx);
          prevCount++;
        }
      }
      const prevAvgDisp = prevCount > 0 ? prevTotalDisp / prevCount : 0;

      const interstoryDisp = Math.abs(avgDisp - prevAvgDisp);
      const driftRatio = height > 0 ? interstoryDisp / height : 0;

      stories.push({
        label: `Level ${i} (y=${y.toFixed(2)}m)`,
        height,
        displacement: interstoryDisp * 1000, // mm
        driftRatio,
      });
    }

    return stories;
  }, [analysisResults, nodes]);

  const handleExportCSV = useCallback(() => {
    const header = 'Story,Height (m),Displacement (mm),Drift Ratio,Exceeds Limit\n';
    const rows = storyData.map((s) =>
      `${s.label},${s.height.toFixed(3)},${s.displacement.toFixed(2)},${s.driftRatio.toFixed(6)},${isDriftExceeded(s.driftRatio, limit) ? 'YES' : 'NO'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story_drift.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [storyData, limit]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Story Drift</DialogTitle>
          <DialogDescription>
            Inter-story drift ratios from analysis results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium tracking-wide tracking-wide">Drift Limit (H/n):</label>
            <input
              type="number"
              step="0.0001"
              value={limit}
              onChange={(e) => setLimit(parseFloat(e.target.value) || 1 / 400)}
              className="w-32 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
            />
            <span className="text-xs text-slate-500">
              (H/400 = {(1 / 400).toFixed(5)}, H/200 = {(1 / 200).toFixed(5)})
            </span>
          </div>

          {storyData.length === 0 ? (
            <p className="text-slate-500 text-sm">No story data available. Run analysis first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#131b2e]">
                    <th className="p-2 text-left">Story</th>
                    <th className="p-2 text-right">Height (m)</th>
                    <th className="p-2 text-right">Δ (mm)</th>
                    <th className="p-2 text-right">Drift Ratio</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {storyData.map((s, i) => {
                    const exceeded = isDriftExceeded(s.driftRatio, limit);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-[#1a2333] ${exceeded ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                      >
                        <td className="p-2">{s.label}</td>
                        <td className="p-2 text-right">{s.height.toFixed(3)}</td>
                        <td className="p-2 text-right">{s.displacement.toFixed(2)}</td>
                        <td className="p-2 text-right">{s.driftRatio.toFixed(6)}</td>
                        <td className="p-2 text-center">
                          {exceeded ? (
                            <span className="text-red-600 font-medium tracking-wide tracking-wide">⚠ Exceeds</span>
                          ) : (
                            <span className="text-green-600">✓ OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleExportCSV} disabled={storyData.length === 0}>
            Export CSV
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
