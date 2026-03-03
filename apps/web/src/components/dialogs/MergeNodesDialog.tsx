/**
 * MergeNodesDialog.tsx — Merge Coincident/Close Nodes
 * 
 * Industry parity: STAAD Pro "Tools → Check/Merge Duplicate Nodes",
 * SAP2000 "Edit → Merge → Points", ETABS "Edit → Merge Duplicate Points",
 * RISA "Tools → Merge Nodes"
 * 
 * Finds and merges nodes that are within a specified tolerance distance.
 * Reconnects members to surviving nodes.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Check, GitMerge, Info, Search, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

interface MergeNodesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NodePair {
  node1Id: string;
  node2Id: string;
  distance: number;
  node1Label: string;
  node2Label: string;
}

export const MergeNodesDialog: React.FC<MergeNodesDialogProps> = ({ isOpen, onClose }) => {
  const { nodes, members, selectedIds } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      members: s.members,
      selectedIds: s.selectedIds,
    }))
  );

  const [tolerance, setTolerance] = useState(0.01); // meters
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [merged, setMerged] = useState(false);
  const [mergeCount, setMergeCount] = useState(0);

  // Find coincident node pairs
  const coincidentPairs = useMemo(() => {
    const nodeArr = Array.from(nodes.values());
    const pairs: NodePair[] = [];

    for (let i = 0; i < nodeArr.length; i++) {
      for (let j = i + 1; j < nodeArr.length; j++) {
        const n1 = nodeArr[i], n2 = nodeArr[j];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dz = n1.z - n2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist <= tolerance) {
          pairs.push({
            node1Id: n1.id,
            node2Id: n2.id,
            distance: dist,
            node1Label: `N${n1.id.substring(0, 6)}`,
            node2Label: `N${n2.id.substring(0, 6)}`,
          });
        }
      }
    }

    return pairs.sort((a, b) => a.distance - b.distance);
  }, [nodes, tolerance]);

  // Auto-select all pairs on tolerance change
  useMemo(() => {
    setSelectedPairs(new Set(coincidentPairs.map(p => `${p.node1Id}|${p.node2Id}`)));
    setMerged(false);
  }, [coincidentPairs]);

  const togglePair = (pairKey: string) => {
    const newSet = new Set(selectedPairs);
    if (newSet.has(pairKey)) {
      newSet.delete(pairKey);
    } else {
      newSet.add(pairKey);
    }
    setSelectedPairs(newSet);
  };

  const handleMerge = useCallback(() => {
    if (selectedPairs.size === 0) return;

    const currentNodes = new Map(useModelStore.getState().nodes);
    const currentMembers = new Map(useModelStore.getState().members);
    const nodeMapping = new Map<string, string>(); // oldId → survivingId
    let count = 0;

    // Process each selected pair
    selectedPairs.forEach(pairKey => {
      const [id1, id2] = pairKey.split('|');
      const n1 = currentNodes.get(id1);
      const n2 = currentNodes.get(id2);
      if (!n1 || !n2) return;

      // Survive the first node (or the one with restraints)
      const survive1 = (n1 as any).restraints ? id1 : (n2 as any).restraints ? id2 : id1;
      const remove = survive1 === id1 ? id2 : id1;

      // Follow existing mappings
      const actualSurvivor = nodeMapping.get(survive1) || survive1;
      nodeMapping.set(remove, actualSurvivor);

      // Update member references
      currentMembers.forEach((member, mid) => {
        let updated = false;
        let newStart = member.startNodeId;
        let newEnd = member.endNodeId;

        if (member.startNodeId === remove) {
          newStart = actualSurvivor;
          updated = true;
        }
        if (member.endNodeId === remove) {
          newEnd = actualSurvivor;
          updated = true;
        }

        if (updated) {
          // Don't create zero-length members
          if (newStart === newEnd) {
            currentMembers.delete(mid);
          } else {
            currentMembers.set(mid, { ...member, startNodeId: newStart, endNodeId: newEnd });
          }
        }
      });

      // Remove the duplicate node
      currentNodes.delete(remove);
      count++;
    });

    // Apply all changes at once
    useModelStore.setState({
      nodes: currentNodes,
      members: currentMembers,
    });

    setMergeCount(count);
    setMerged(true);
  }, [selectedPairs]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-500" />
            Merge Coincident Nodes
          </DialogTitle>
          <DialogDescription>
            Find and merge nodes within a specified tolerance distance.
            Members connected to removed nodes are automatically reconnected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Tolerance */}
          <div>
            <Label>Merge Tolerance (m)</Label>
            <div className="flex gap-3 items-center mt-1">
              <Input
                type="number"
                value={tolerance}
                onChange={e => setTolerance(Math.max(0.0001, +e.target.value))}
                step={0.001}
                min={0.0001}
                className="w-32 font-mono"
              />
              <div className="flex gap-1">
                {[0.001, 0.01, 0.05, 0.1].map(t => (
                  <button type="button"
                    key={t}
                    onClick={() => setTolerance(t)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      Math.abs(tolerance - t) < 1e-6
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {t}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              <Search className="w-4 h-4 inline mr-1" />
              Found <strong className="text-purple-600 dark:text-purple-400">{coincidentPairs.length}</strong> coincident pair{coincidentPairs.length !== 1 ? 's' : ''}
            </span>
            {coincidentPairs.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPairs(new Set(coincidentPairs.map(p => `${p.node1Id}|${p.node2Id}`)))}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedPairs(new Set())}>
                  Deselect All
                </Button>
              </div>
            )}
          </div>

          {/* Pair list */}
          <ScrollArea className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg min-h-[120px]">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {coincidentPairs.map(pair => {
                const key = `${pair.node1Id}|${pair.node2Id}`;
                const isSelected = selectedPairs.has(key);
                return (
                  <button type="button"
                    key={key}
                    onClick={() => togglePair(key)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-purple-500"
                    />
                    <div className="flex-1 text-sm">
                      <span className="font-mono text-slate-900 dark:text-white">{pair.node1Label}</span>
                      <span className="text-slate-400 mx-2">↔</span>
                      <span className="font-mono text-slate-900 dark:text-white">{pair.node2Label}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Δ = {pair.distance < 0.001 ? pair.distance.toExponential(2) : pair.distance.toFixed(4)} m
                    </span>
                  </button>
                );
              })}
              {coincidentPairs.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">
                  No coincident nodes found within tolerance
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Success message */}
          {merged && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
              <Check className="w-4 h-4" />
              Successfully merged {mergeCount} node pair{mergeCount !== 1 ? 's' : ''}.
            </div>
          )}

          {/* Warning */}
          {coincidentPairs.length > 10 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Large number of coincident pairs found. Consider reducing the tolerance or
                reviewing your model geometry. Merging too aggressively may collapse elements.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleMerge} disabled={selectedPairs.size === 0 || merged}>
            <GitMerge className="w-4 h-4 mr-1" />
            Merge {selectedPairs.size} Pair{selectedPairs.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
