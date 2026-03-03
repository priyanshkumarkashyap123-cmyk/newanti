/**
 * DivideMemberDialog.tsx — Divide Member into Multiple Segments
 * 
 * Industry parity: STAAD Pro "Tools → Divide Member", SAP2000 "Edit → Divide",
 * ETABS "Edit → Divide Frame", RISA "Modify → Split Member"
 * 
 * Divides a member into N equal segments or at specified relative positions.
 * Creates intermediate nodes and replaces the original member with N new members.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Check, Scissors, Info, Plus, Trash2 } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { v4 as uuidv4 } from 'uuid';

interface DivideMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DivideMode = 'equal' | 'custom';

export const DivideMemberDialog: React.FC<DivideMemberDialogProps> = ({ isOpen, onClose }) => {
  const { members, nodes, selectedIds, addNode, addMember, removeNode } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      nodes: s.nodes,
      selectedIds: s.selectedIds,
      addNode: s.addNode,
      addMember: s.addMember,
      removeNode: s.removeNode,
    }))
  );

  const [mode, setMode] = useState<DivideMode>('equal');
  const [numSegments, setNumSegments] = useState(2);
  const [customPositions, setCustomPositions] = useState<number[]>([0.5]); // Relative positions (0-1)

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  const addCustomPosition = () => {
    if (customPositions.length >= 9) return;
    const lastPos = customPositions[customPositions.length - 1] || 0;
    const newPos = Math.min(0.99, lastPos + 0.1);
    setCustomPositions([...customPositions, newPos].sort((a, b) => a - b));
  };

  const removeCustomPosition = (index: number) => {
    setCustomPositions(customPositions.filter((_, i) => i !== index));
  };

  const updateCustomPosition = (index: number, value: number) => {
    const updated = [...customPositions];
    updated[index] = Math.max(0.01, Math.min(0.99, value));
    setCustomPositions(updated.sort((a, b) => a - b));
  };

  const handleApply = useCallback(() => {
    if (selectedMembers.length === 0) return;

    const store = useModelStore.getState();

    selectedMembers.forEach(member => {
      const startNode = nodes.get(member.startNodeId);
      const endNode = nodes.get(member.endNodeId);
      if (!startNode || !endNode) return;

      // Calculate division points
      const positions: number[] = mode === 'equal'
        ? Array.from({ length: numSegments - 1 }, (_, i) => (i + 1) / numSegments)
        : [...customPositions];

      // Create intermediate nodes
      const intermediateNodeIds: string[] = [];
      positions.forEach(t => {
        const id = uuidv4();
        const newNode = {
          id,
          x: startNode.x + t * (endNode.x - startNode.x),
          y: startNode.y + t * (endNode.y - startNode.y),
          z: startNode.z + t * (endNode.z - startNode.z),
        };
        addNode(newNode);
        intermediateNodeIds.push(id);
      });

      // Create new members connecting the chain: start → int1 → int2 → ... → end
      const allNodeIds = [member.startNodeId, ...intermediateNodeIds, member.endNodeId];
      for (let i = 0; i < allNodeIds.length - 1; i++) {
        addMember({
          id: uuidv4(),
          startNodeId: allNodeIds[i],
          endNodeId: allNodeIds[i + 1],
          // Copy properties from original member
          E: member.E,
          A: member.A,
          I: member.I,
          Iy: member.Iy,
          Iz: member.Iz,
          J: member.J,
          G: member.G,
          rho: member.rho,
          sectionId: member.sectionId,
          sectionType: member.sectionType,
          dimensions: member.dimensions,
          betaAngle: member.betaAngle,
          releases: i === 0 ? { ...member.releases, fxEnd: false, fyEnd: false, fzEnd: false, mxEnd: false, myEnd: false, mzEnd: false, endMoment: false } as any :
                    i === allNodeIds.length - 2 ? { fxStart: false, fyStart: false, fzStart: false, mxStart: false, myStart: false, mzStart: false, startMoment: false, ...member.releases } as any :
                    undefined,
        });
      }

      // Remove original member (use the store's remove function)
      // We need to find and use removeMember - check if it exists
      const currentMembers = useModelStore.getState().members;
      const newMembers = new Map(currentMembers);
      newMembers.delete(member.id);
      useModelStore.setState({ members: newMembers });
    });

    onClose();
  }, [mode, numSegments, customPositions, selectedMembers, nodes, addNode, addMember, onClose]);

  // Preview positions
  const previewPositions = mode === 'equal'
    ? Array.from({ length: numSegments - 1 }, (_, i) => (i + 1) / numSegments)
    : customPositions;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-amber-500" />
            Divide Member
          </DialogTitle>
          <DialogDescription>
            Divide {selectedMembers.length > 0 ? `${selectedMembers.length} selected member${selectedMembers.length > 1 ? 's' : ''}` : 'selected members'} into segments.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selection */}
          <div className="flex gap-2">
            {(['equal', 'custom'] as const).map(m => (
              <button type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                  mode === m
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                }`}
              >
                {m === 'equal' ? '📏 Equal Segments' : '📐 Custom Points'}
              </button>
            ))}
          </div>

          {mode === 'equal' ? (
            <div>
              <Label>Number of Segments</Label>
              <div className="flex gap-3 items-center mt-1">
                <Input
                  type="number"
                  value={numSegments}
                  onChange={e => setNumSegments(Math.max(2, Math.min(20, +e.target.value)))}
                  min={2}
                  max={20}
                  step={1}
                  className="w-24 font-mono"
                />
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={numSegments}
                  onChange={e => setNumSegments(+e.target.value)}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-sm text-slate-500 font-mono w-12 text-right">{numSegments} seg</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Division Points (relative position 0–1)</Label>
              {customPositions.map((pos, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={pos}
                    onChange={e => updateCustomPosition(i, +e.target.value)}
                    min={0.01}
                    max={0.99}
                    step={0.05}
                    className="font-mono"
                  />
                  <span className="text-xs text-slate-500 w-16">({(pos * 100).toFixed(0)}%)</span>
                  <Button variant="ghost" size="sm" onClick={() => removeCustomPosition(i)} disabled={customPositions.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCustomPosition} disabled={customPositions.length >= 9}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Point
              </Button>
            </div>
          )}

          {/* Visual preview */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-center">
            <svg viewBox="0 0 300 40" className="w-full h-10">
              {/* Full member */}
              <line x1="20" y1="20" x2="280" y2="20" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
              {/* End nodes */}
              <circle cx="20" cy="20" r="4" fill="#10B981" />
              <circle cx="280" cy="20" r="4" fill="#10B981" />
              {/* Division points */}
              {previewPositions.map((t, i) => {
                const x = 20 + t * 260;
                return (
                  <g key={i}>
                    <line x1={x} y1="8" x2={x} y2="32" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3" />
                    <circle cx={x} cy="20" r="3" fill="#F59E0B" />
                    <text x={x} y="38" fontSize="6" fill="#94a3b8" textAnchor="middle">{(t * 100).toFixed(0)}%</text>
                  </g>
                );
              })}
              {/* Segment count */}
              <text x="150" y="10" fontSize="7" fill="#64748b" textAnchor="middle">
                {previewPositions.length + 1} segments
              </text>
            </svg>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Dividing creates intermediate nodes and replaces the original member with multiple
              new members. Member properties (section, material, orientation) are copied to all
              new segments. Existing loads on the member are NOT redistributed.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={selectedMembers.length === 0}>
            <Check className="w-4 h-4 mr-1" />
            Divide {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
