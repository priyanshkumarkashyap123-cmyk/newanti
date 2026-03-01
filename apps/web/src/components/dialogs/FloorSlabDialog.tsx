/**
 * FloorSlabDialog.tsx — One-click Floor Slab Creation
 *
 * Workflow:
 *   1. User specifies Y level (floor height)
 *   2. System auto-detects rectangular panels from beam geometry
 *   3. User sets slab thickness, material, and optional area load
 *   4. Creates Plate elements for each panel + FloorLoad in store
 *
 * Similar to ETABS "Define → Floor/Roof Area Load" + auto-meshing
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Layers, Grid3X3, Plus, AlertTriangle, Eye } from 'lucide-react';
import { useModelStore } from '../../store/model';
import type { Plate, FloorLoad } from '../../store/model';
import { detectPanels, type NodeInfo, type MemberInfo, type DetectedPanel } from '../../services/floorLoadDistributor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';

interface FloorSlabDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FloorSlabDialog: React.FC<FloorSlabDialogProps> = ({ isOpen, onClose }) => {
  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);
  const addPlate = useModelStore((s) => s.addPlate);
  const addFloorLoad = useModelStore((s) => s.addFloorLoad);
  const getNextPlateId = useModelStore((s) => s.getNextPlateId);

  // Form state
  const [yLevel, setYLevel] = useState<number>(3);
  const [thickness, setThickness] = useState<number>(0.15); // 150mm default
  const [material, setMaterial] = useState<'concrete' | 'steel' | 'custom'>('concrete');
  const [pressure, setPressure] = useState<number>(-5); // -5 kN/m² default (downward)
  const [applyLoad, setApplyLoad] = useState<boolean>(true);
  const [distribution, setDistribution] = useState<string>('auto');

  // Auto-detect available Y levels from node positions
  const availableYLevels = useMemo(() => {
    const ySet = new Set<number>();
    for (const node of nodes.values()) {
      ySet.add(Math.round(node.y * 1000) / 1000);
    }
    return [...ySet].sort((a, b) => a - b);
  }, [nodes]);

  // Build node/member arrays for panel detection
  const nodeArray: NodeInfo[] = useMemo(() =>
    Array.from(nodes.values()).map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z ?? 0 })),
    [nodes],
  );

  const memberArray: MemberInfo[] = useMemo(() =>
    Array.from(members.values()).map((m) => ({ id: m.id, startNodeId: m.startNodeId, endNodeId: m.endNodeId })),
    [members],
  );

  // Detect panels at current Y level
  const detectedPanels: DetectedPanel[] = useMemo(() => {
    if (nodeArray.length === 0 || memberArray.length === 0) return [];
    const dummyFloorLoad = {
      id: 'detect',
      pressure: 0,
      yLevel,
      xMin: -Infinity,
      xMax: Infinity,
      zMin: -Infinity,
      zMax: Infinity,
    };
    return detectPanels(memberArray, new Map(nodeArray.map((n) => [n.id, n])), yLevel, dummyFloorLoad);
  }, [nodeArray, memberArray, yLevel]);

  // Find nodes at corners of each panel (for plate creation)
  const findCornerNodes = useCallback((panel: DetectedPanel): [string, string, string, string] | null => {
    const tolerance = 0.05;
    const candidates = nodeArray.filter((n) => Math.abs(n.y - yLevel) < tolerance);

    const findNode = (x: number, z: number): string | undefined =>
      candidates.find((n) => Math.abs(n.x - x) < tolerance && Math.abs(n.z - z) < tolerance)?.id;

    const n1 = findNode(panel.xMin, panel.zMin);
    const n2 = findNode(panel.xMax, panel.zMin);
    const n3 = findNode(panel.xMax, panel.zMax);
    const n4 = findNode(panel.xMin, panel.zMax);

    if (n1 && n2 && n3 && n4) return [n1, n2, n3, n4];
    return null;
  }, [nodeArray, yLevel]);

  // Material properties
  const getMaterialProps = (mat: string) => {
    switch (mat) {
      case 'concrete': return { E: 25e6, nu: 0.2 }; // M25 concrete
      case 'steel': return { E: 200e6, nu: 0.3 };
      default: return { E: 25e6, nu: 0.2 };
    }
  };

  // Create slabs + floor loads
  const handleCreate = useCallback(() => {
    const matProps = getMaterialProps(material);
    let platesCreated = 0;
    let loadsCreated = 0;

    for (const panel of detectedPanels) {
      const cornerNodes = findCornerNodes(panel);
      if (!cornerNodes) continue;

      // Create Plate element
      const plateId = getNextPlateId();
      const plate: Plate = {
        id: plateId,
        nodeIds: cornerNodes,
        thickness,
        E: matProps.E,
        nu: matProps.nu,
        pressure: applyLoad ? pressure : undefined,
        materialType: material,
      };
      addPlate(plate);
      platesCreated++;

      // Create FloorLoad for analysis pipeline
      if (applyLoad) {
        const floorLoad: FloorLoad = {
          id: `FL-${plateId}`,
          pressure,
          yLevel,
          xMin: panel.xMin,
          xMax: panel.xMax,
          zMin: panel.zMin,
          zMax: panel.zMax,
          distributionOverride: distribution === 'auto' ? undefined : distribution as any,
        };
        addFloorLoad(floorLoad);
        loadsCreated++;
      }
    }

    if (platesCreated > 0) {
// console.log(`[FloorSlab] Created ${platesCreated} plates and ${loadsCreated} floor loads at Y=${yLevel}`);
      onClose();
    }
  }, [detectedPanels, findCornerNodes, material, thickness, pressure, applyLoad, distribution, yLevel, addPlate, addFloorLoad, getNextPlateId, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Layers size={20} className="text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Floor Slab</DialogTitle>
              <DialogDescription>Auto-detect panels & create slabs with area loads</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Y Level Selection */}
          <div className="space-y-2">
            <Label>Floor Level (Y)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={yLevel}
                onChange={(e) => setYLevel(parseFloat(e.target.value) || 0)}
                step={0.5}
              />
              <span className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">m</span>
            </div>
            {availableYLevels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Quick select:</span>
                {availableYLevels.map((y) => (
                  <Button
                    key={y}
                    variant={Math.abs(y - yLevel) < 0.001 ? 'default' : 'outline'}
                    size="sm"
                    className={`h-6 text-xs ${Math.abs(y - yLevel) < 0.001 ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    onClick={() => setYLevel(y)}
                  >
                    Y = {y}m
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Panel Detection Results */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={16} className="text-purple-500 dark:text-purple-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Detected Panels</span>
              <span className="ml-auto px-2 py-0.5 bg-purple-100 dark:bg-purple-600/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                {detectedPanels.length} found
              </span>
            </div>
            {detectedPanels.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {detectedPanels.map((panel, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 px-2 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded">
                    <Grid3X3 size={12} className="text-purple-500 dark:text-purple-400 shrink-0" />
                    <span className="font-mono">
                      {panel.Lx.toFixed(2)}m × {panel.Lz.toFixed(2)}m
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      ({panel.distribution.replace(/_/g, ' ')})
                    </span>
                    <span className="ml-auto text-slate-500 dark:text-slate-400">
                      AR {panel.aspectRatio.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                <span>No rectangular panels found at Y = {yLevel}m. Ensure beams form closed rectangles at this level.</span>
              </div>
            )}
          </div>

          {/* Slab Properties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Thickness</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={thickness * 1000}
                  onChange={(e) => setThickness((parseFloat(e.target.value) || 150) / 1000)}
                  step={10}
                  min={50}
                />
                <span className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">mm</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as any)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
              >
                <option value="concrete">Concrete (M25)</option>
                <option value="steel">Steel (Fe250)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Area Load */}
          <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <Checkbox
                id="applyLoad"
                checked={applyLoad}
                onCheckedChange={(checked) => setApplyLoad(checked === true)}
              />
              <Label htmlFor="applyLoad" className="cursor-pointer">
                Apply Area Load (distributed to beams during analysis)
              </Label>
            </div>
            {applyLoad && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Pressure (kN/m²)</Label>
                  <Input
                    type="number"
                    value={pressure}
                    onChange={(e) => setPressure(parseFloat(e.target.value) || 0)}
                    step={0.5}
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Negative = downward (gravity)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Distribution</Label>
                  <select
                    value={distribution}
                    onChange={(e) => setDistribution(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                  >
                    <option value="auto">Auto (IS 456)</option>
                    <option value="one_way">One-Way</option>
                    <option value="two_way_triangular">Two-Way Triangular</option>
                    <option value="two_way_trapezoidal">Two-Way Trapezoidal</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {detectedPanels.length} panel{detectedPanels.length !== 1 ? 's' : ''} ·
            {applyLoad ? ` ${Math.abs(pressure)} kN/m² load` : ' no load'} ·
            {thickness * 1000}mm {material}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={detectedPanels.length === 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
            >
              <Plus size={16} className="mr-2" />
              Create {detectedPanels.length} Slab{detectedPanels.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
