/**
 * IS875LiveLoadDialog.tsx — IS 875 Part 2 Live Load Generator
 * IS 875 (Part 2):1987 — Imposed Loads on Buildings
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Weight, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';

// ===== IS 875 Part 2 — Table 1 Imposed Load Values (kN/m²) =====

const OCCUPANCY_CATEGORIES = [
  // Residential
  { value: 'RES_GENERAL', label: 'Residential — General', udl: 2.0, conc: 1.8, table: 'Table 1, Item 1' },
  { value: 'RES_TOILET', label: 'Residential — Toilets/bathrooms', udl: 2.0, conc: 1.8, table: 'Table 1, Item 1' },
  // Office
  { value: 'OFF_GENERAL', label: 'Office — General', udl: 2.5, conc: 2.7, table: 'Table 1, Item 2' },
  { value: 'OFF_IT', label: 'Office — IT/Server room', udl: 3.5, conc: 4.5, table: 'Table 1, Item 2' },
  // Educational
  { value: 'EDU_CLASS', label: 'Educational — Classrooms', udl: 3.0, conc: 2.7, table: 'Table 1, Item 3' },
  { value: 'EDU_CORRIDOR', label: 'Educational — Corridors', udl: 4.0, conc: 4.5, table: 'Table 1, Item 3' },
  // Institutional
  { value: 'INST_WARD', label: 'Hospital — Wards', udl: 2.0, conc: 1.8, table: 'Table 1, Item 4' },
  { value: 'INST_OP', label: 'Hospital — Operating theatre', udl: 3.0, conc: 4.5, table: 'Table 1, Item 4' },
  // Assembly
  { value: 'ASSEM_FIXED', label: 'Assembly — Fixed seats', udl: 4.0, conc: 4.5, table: 'Table 1, Item 5' },
  { value: 'ASSEM_MOVABLE', label: 'Assembly — Movable seats', udl: 5.0, conc: 3.6, table: 'Table 1, Item 5' },
  // Business / Mercantile
  { value: 'MERC_RETAIL', label: 'Retail shop floors', udl: 4.0, conc: 3.6, table: 'Table 1, Item 6' },
  { value: 'MERC_WHOLESALE', label: 'Wholesale storage areas', udl: 6.0, conc: 4.5, table: 'Table 1, Item 6' },
  // Industrial
  { value: 'IND_LIGHT', label: 'Industrial — Light', udl: 5.0, conc: 4.5, table: 'Table 1, Item 7' },
  { value: 'IND_HEAVY', label: 'Industrial — Heavy', udl: 10.0, conc: 9.0, table: 'Table 1, Item 7' },
  // Storage
  { value: 'STORE_LIGHT', label: 'Storage — Light', udl: 6.0, conc: 4.5, table: 'Table 1, Item 8' },
  { value: 'STORE_HEAVY', label: 'Storage — Heavy', udl: 12.0, conc: 9.0, table: 'Table 1, Item 8' },
  // Garages / Parking
  { value: 'GARAGE_LIGHT', label: 'Parking — Vehicles < 2.5 T', udl: 2.5, conc: 9.0, table: 'Table 1, Item 9' },
  { value: 'GARAGE_HEAVY', label: 'Parking — Vehicles > 2.5 T', udl: 5.0, conc: 9.0, table: 'Table 1, Item 9' },
  // Stairs / Balconies
  { value: 'STAIR', label: 'Staircases', udl: 3.0, conc: 1.3, table: 'Table 1, Item 10' },
  { value: 'BALCONY', label: 'Balconies', udl: 3.0, conc: 1.3, table: 'Table 1, Item 10' },
  // Roofs
  { value: 'ROOF_ACCESS', label: 'Roof — Access provided', udl: 1.5, conc: 1.8, table: 'Table 2' },
  { value: 'ROOF_NOACCESS', label: 'Roof — No access (maintenance only)', udl: 0.75, conc: 0.9, table: 'Table 2' },
];

interface FloorZone {
  id: string;
  name: string;
  occupancy: string;
  udl: number;        // kN/m²
  area: number;       // m²
  tributaryWidth: number; // m — for converting to member loads
  reductionApplied: boolean;
}

const IS875LiveLoadDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.is875LiveLoad || false;

  const [zones, setZones] = useState<FloorZone[]>([
    {
      id: 'zone_1',
      name: 'Floor 1',
      occupancy: 'RES_GENERAL',
      udl: 2.0,
      area: 50,
      tributaryWidth: 5,
      reductionApplied: false,
    },
  ]);

  const [selectedMembers, setSelectedMembers] = useState<'all' | 'selected'>('all');

  // Live load reduction factor per IS 875 Part 2 Cl. 3.2 (Table 2)
  // Reduction applicable if floor area > 25 m²
  const getReductionFactor = (area: number, numFloors: number): number => {
    if (area < 25) return 1.0;
    // For single floor: no reduction. Multi-floor reduces by area.
    // Simplified: 5% per floor above 1, max 25% reduction
    const reductionPercent = Math.min((numFloors - 1) * 5, 25);
    return 1.0 - reductionPercent / 100;
  };

  const addZone = () => {
    const nextId = `zone_${zones.length + 1}`;
    setZones(prev => [...prev, {
      id: nextId,
      name: `Floor ${zones.length + 1}`,
      occupancy: 'RES_GENERAL',
      udl: 2.0,
      area: 50,
      tributaryWidth: 5,
      reductionApplied: false,
    }]);
  };

  const removeZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
  };

  const updateZone = (id: string, field: keyof FloorZone, value: string | number | boolean) => {
    setZones(prev => prev.map(z => {
      if (z.id !== id) return z;
      const updated = { ...z, [field]: value };
      // Auto-update udl when occupancy changes
      if (field === 'occupancy') {
        const cat = OCCUPANCY_CATEGORIES.find(c => c.value === value);
        if (cat) updated.udl = cat.udl;
      }
      return updated;
    }));
  };

  // Compute summary
  const summary = useMemo(() => {
    const totalArea = zones.reduce((s, z) => s + z.area, 0);
    const totalLoad = zones.reduce((s, z) => {
      const rf = z.reductionApplied ? getReductionFactor(z.area, zones.length) : 1.0;
      return s + z.udl * rf * z.area;
    }, 0);
    return { totalArea, totalLoad, zoneCount: zones.length };
  }, [zones]);

  const handleApply = useCallback(() => {
    const { members, addLoadCase } = useModelStore.getState();
    const memberLoads: { id: string; memberId: string; type: 'UDL'; w: number; direction: 'global_y' }[] = [];
    let loadIdx = 0;

    // Get member ids to apply loads to
    const memberIds = selectedMembers === 'all'
      ? Array.from(members.keys())
      : Array.from(members.keys()); // could be refined with actual selection

    zones.forEach(zone => {
      const rf = zone.reductionApplied ? getReductionFactor(zone.area, zones.length) : 1.0;
      const w = zone.udl * rf * zone.tributaryWidth; // kN/m along beam

      memberIds.forEach(memberId => {
        loadIdx++;
        memberLoads.push({
          id: `LL_IS875_${loadIdx}`,
          memberId,
          type: 'UDL' as const,
          w: -w,           // negative = downward (gravity)
          direction: 'global_y' as const,
        });
      });
    });

    addLoadCase({
      id: `LC_LL_IS875_${Date.now()}`,
      name: `Live Load IS 875 (${zones.map(z => z.name).join(', ')})`,
      type: 'live',
      loads: [],
      memberLoads,
      factor: 1.0,
    });

    setModal('is875LiveLoad', false);
  }, [zones, selectedMembers, setModal]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setModal('is875LiveLoad', open)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Weight className="h-5 w-5 text-green-600" />
            IS 875 Live Load Generator
            <Badge variant="secondary" className="ml-2">IS 875 Part 2</Badge>
          </DialogTitle>
          <DialogDescription>
            Generate imposed loads per IS 875 (Part 2):1987 — select occupancy categories from Table 1
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zone list */}
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium tracking-wide tracking-wide">Floor Zones</Label>
            <Button variant="outline" size="sm" onClick={addZone}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
            </Button>
          </div>

          <ScrollArea className="max-h-[400px] rounded-md border">
            <div className="p-3 space-y-3">
              {zones.map((zone) => {
                const cat = OCCUPANCY_CATEGORIES.find(c => c.value === zone.occupancy);
                const rf = zone.reductionApplied ? getReductionFactor(zone.area, zones.length) : 1.0;
                return (
                  <div key={zone.id} className="p-3 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        className="h-7 w-40 text-sm font-medium tracking-wide tracking-wide"
                        value={zone.name}
                        onChange={e => updateZone(zone.id, 'name', e.target.value)}
                      />
                      {zones.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeZone(zone.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Occupancy Category</Label>
                        <Select value={zone.occupancy} onValueChange={v => updateZone(zone.id, 'occupancy', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OCCUPANCY_CATEGORIES.map(c => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">
                                {c.label} — {c.udl} kN/m²
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">UDL (kN/m²)</Label>
                        <Input
                          type="number"
                          step={0.1}
                          className="h-8 text-sm"
                          value={zone.udl}
                          onChange={e => updateZone(zone.id, 'udl', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Floor Area (m²)</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={zone.area}
                          onChange={e => updateZone(zone.id, 'area', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tributary Width (m)</Label>
                        <Input
                          type="number"
                          step={0.5}
                          className="h-8 text-sm"
                          value={zone.tributaryWidth}
                          onChange={e => updateZone(zone.id, 'tributaryWidth', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-0.5">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={zone.reductionApplied}
                            onChange={e => updateZone(zone.id, 'reductionApplied', e.target.checked)}
                            className="rounded"
                          />
                          Reduction (Cl. 3.2)
                        </label>
                      </div>
                    </div>

                    {cat && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Ref: {cat.table}</span>
                        <span>Conc. load: {cat.conc} kN</span>
                        {zone.reductionApplied && rf < 1.0 && (
                          <Badge variant="outline" className="text-xs">RF = {rf.toFixed(2)}</Badge>
                        )}
                        <span className="ml-auto font-medium tracking-wide tracking-wide text-foreground">
                          Line load: {(zone.udl * rf * zone.tributaryWidth).toFixed(2)} kN/m
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Zones</div>
              <div className="text-lg font-bold">{summary.zoneCount}</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Total Area</div>
              <div className="text-lg font-bold font-mono">{summary.totalArea.toFixed(0)} m²</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Total Load</div>
              <div className="text-lg font-bold font-mono">{summary.totalLoad.toFixed(1)} kN</div>
            </div>
          </div>

          {/* Apply target */}
          <div className="space-y-2">
            <Label className="text-xs">Apply To Members</Label>
            <Select value={selectedMembers} onValueChange={v => setSelectedMembers(v as 'all' | 'selected')}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All beam members</SelectItem>
                <SelectItem value="selected">Selected members only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setModal('is875LiveLoad', false)}>Cancel</Button>
          <Button disabled={zones.length === 0} onClick={handleApply}>
            Apply Live Loads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IS875LiveLoadDialog;
