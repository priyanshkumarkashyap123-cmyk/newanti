/**
 * SectionAssignDialog.tsx — Assign Cross-Sections to Selected Members
 * 
 * Industry parity: STAAD Pro "Assign → Section", SAP2000 "Assign → Frame Sections",
 * ETABS "Assign → Frame → Frame Sections", RISA "Modify Members → Shape"
 * 
 * Supports standard section libraries (IS, AISC, BS, EN) and custom rectangular/circular sections.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import {
  Search, Ruler, RectangleHorizontal, Circle, Square, Check, AlertCircle, BoxSelect,
} from 'lucide-react';
import { useModelStore, type Member } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

interface SectionAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionShape = 'rectangular' | 'circular' | 'i-beam' | 'channel' | 'angle' | 'tube' | 'pipe' | 'tee';

interface SectionPreset {
  designation: string;
  shape: SectionShape;
  A: number;    // Area m²
  Ix: number;   // Major axis I (m⁴)
  Iy: number;   // Minor axis I (m⁴)
  J: number;    // Torsion constant (m⁴)
  depth: number; // mm
  width: number; // mm
  tw?: number;   // web thickness mm
  tf?: number;   // flange thickness mm
}

const STANDARD_SECTIONS: Record<string, SectionPreset[]> = {
  'IS (Indian Standard)': [
    { designation: 'ISMB 100', shape: 'i-beam', A: 11.4e-4, Ix: 257.5e-8, Iy: 40.8e-8, J: 1.1e-8, depth: 100, width: 75 },
    { designation: 'ISMB 150', shape: 'i-beam', A: 19.0e-4, Ix: 726.4e-8, Iy: 52.6e-8, J: 2.1e-8, depth: 150, width: 80 },
    { designation: 'ISMB 200', shape: 'i-beam', A: 32.3e-4, Ix: 2235.4e-8, Iy: 150.0e-8, J: 7.0e-8, depth: 200, width: 100 },
    { designation: 'ISMB 250', shape: 'i-beam', A: 47.6e-4, Ix: 5131.6e-8, Iy: 334.5e-8, J: 14.0e-8, depth: 250, width: 125 },
    { designation: 'ISMB 300', shape: 'i-beam', A: 58.9e-4, Ix: 8603.6e-8, Iy: 453.9e-8, J: 18.0e-8, depth: 300, width: 140 },
    { designation: 'ISMB 350', shape: 'i-beam', A: 66.7e-4, Ix: 13158.3e-8, Iy: 537.7e-8, J: 21.0e-8, depth: 350, width: 140 },
    { designation: 'ISMB 400', shape: 'i-beam', A: 78.5e-4, Ix: 20458.4e-8, Iy: 622.1e-8, J: 26.0e-8, depth: 400, width: 140 },
    { designation: 'ISMB 450', shape: 'i-beam', A: 92.3e-4, Ix: 30390.8e-8, Iy: 834.0e-8, J: 34.0e-8, depth: 450, width: 150 },
    { designation: 'ISMB 500', shape: 'i-beam', A: 110.7e-4, Ix: 45218.3e-8, Iy: 1369.8e-8, J: 48.0e-8, depth: 500, width: 180 },
    { designation: 'ISMB 600', shape: 'i-beam', A: 156.2e-4, Ix: 91813.0e-8, Iy: 3060.0e-8, J: 98.0e-8, depth: 600, width: 210 },
    { designation: 'ISMC 100', shape: 'channel', A: 11.7e-4, Ix: 186.7e-8, Iy: 25.7e-8, J: 1.1e-8, depth: 100, width: 50 },
    { designation: 'ISMC 150', shape: 'channel', A: 20.9e-4, Ix: 779.4e-8, Iy: 102.3e-8, J: 3.5e-8, depth: 150, width: 75 },
    { designation: 'ISMC 200', shape: 'channel', A: 28.2e-4, Ix: 1819.3e-8, Iy: 141.4e-8, J: 5.0e-8, depth: 200, width: 75 },
    { designation: 'ISMC 250', shape: 'channel', A: 37.2e-4, Ix: 3816.8e-8, Iy: 211.2e-8, J: 8.0e-8, depth: 250, width: 80 },
    { designation: 'ISMC 300', shape: 'channel', A: 45.6e-4, Ix: 6362.6e-8, Iy: 310.8e-8, J: 11.0e-8, depth: 300, width: 90 },
    { designation: 'ISA 50x50x6', shape: 'angle', A: 5.69e-4, Ix: 11.1e-8, Iy: 11.1e-8, J: 0.6e-8, depth: 50, width: 50 },
    { designation: 'ISA 75x75x8', shape: 'angle', A: 11.4e-4, Ix: 48.4e-8, Iy: 48.4e-8, J: 2.0e-8, depth: 75, width: 75 },
    { designation: 'ISA 100x100x10', shape: 'angle', A: 19.0e-4, Ix: 146.8e-8, Iy: 146.8e-8, J: 5.3e-8, depth: 100, width: 100 },
  ],
  'AISC (US Standard)': [
    { designation: 'W8x31', shape: 'i-beam', A: 59.0e-4, Ix: 11020.0e-8, Iy: 3720.0e-8, J: 36.0e-8, depth: 203, width: 203, tw: 7.2, tf: 11.0 },
    { designation: 'W10x49', shape: 'i-beam', A: 92.9e-4, Ix: 27430.0e-8, Iy: 9310.0e-8, J: 90.0e-8, depth: 254, width: 254, tw: 8.6, tf: 14.2 },
    { designation: 'W12x65', shape: 'i-beam', A: 123.2e-4, Ix: 53330.0e-8, Iy: 17430.0e-8, J: 150.0e-8, depth: 305, width: 305, tw: 9.9, tf: 15.4 },
    { designation: 'W14x90', shape: 'i-beam', A: 170.3e-4, Ix: 106030.0e-8, Iy: 33330.0e-8, J: 264.0e-8, depth: 356, width: 368, tw: 11.2, tf: 18.0 },
    { designation: 'W16x100', shape: 'i-beam', A: 189.7e-4, Ix: 155520.0e-8, Iy: 18580.0e-8, J: 260.0e-8, depth: 406, width: 264, tw: 11.7, tf: 19.9 },
    { designation: 'W18x119', shape: 'i-beam', A: 225.2e-4, Ix: 246050.0e-8, Iy: 25350.0e-8, J: 376.0e-8, depth: 457, width: 279, tw: 13.0, tf: 22.2 },
    { designation: 'W21x147', shape: 'i-beam', A: 278.7e-4, Ix: 418690.0e-8, Iy: 35560.0e-8, J: 540.0e-8, depth: 533, width: 292, tw: 14.5, tf: 25.4 },
    { designation: 'W24x176', shape: 'i-beam', A: 333.5e-4, Ix: 645490.0e-8, Iy: 47730.0e-8, J: 714.0e-8, depth: 610, width: 305, tw: 15.9, tf: 28.4 },
    { designation: 'HSS 6x6x3/8', shape: 'tube', A: 51.0e-4, Ix: 4530.0e-8, Iy: 4530.0e-8, J: 7370.0e-8, depth: 152, width: 152 },
    { designation: 'HSS 8x8x1/2', shape: 'tube', A: 90.3e-4, Ix: 14350.0e-8, Iy: 14350.0e-8, J: 22600.0e-8, depth: 203, width: 203 },
    { designation: 'Pipe 6 STD', shape: 'pipe', A: 34.7e-4, Ix: 2830.0e-8, Iy: 2830.0e-8, J: 5660.0e-8, depth: 168, width: 168 },
    { designation: 'Pipe 8 STD', shape: 'pipe', A: 47.4e-4, Ix: 6490.0e-8, Iy: 6490.0e-8, J: 12980.0e-8, depth: 219, width: 219 },
  ],
  'Eurocode (EN)': [
    { designation: 'HEA 200', shape: 'i-beam', A: 53.8e-4, Ix: 3692.0e-8, Iy: 1336.0e-8, J: 21.0e-8, depth: 190, width: 200, tw: 6.5, tf: 10.0 },
    { designation: 'HEA 300', shape: 'i-beam', A: 112.5e-4, Ix: 18260.0e-8, Iy: 6310.0e-8, J: 85.0e-8, depth: 290, width: 300, tw: 8.5, tf: 14.0 },
    { designation: 'HEB 200', shape: 'i-beam', A: 78.1e-4, Ix: 5696.0e-8, Iy: 2003.0e-8, J: 59.0e-8, depth: 200, width: 200, tw: 9.0, tf: 15.0 },
    { designation: 'HEB 300', shape: 'i-beam', A: 149.1e-4, Ix: 25170.0e-8, Iy: 8563.0e-8, J: 185.0e-8, depth: 300, width: 300, tw: 11.0, tf: 19.0 },
    { designation: 'IPE 200', shape: 'i-beam', A: 28.5e-4, Ix: 1943.0e-8, Iy: 142.0e-8, J: 7.0e-8, depth: 200, width: 100, tw: 5.6, tf: 8.5 },
    { designation: 'IPE 300', shape: 'i-beam', A: 53.8e-4, Ix: 8356.0e-8, Iy: 604.0e-8, J: 20.0e-8, depth: 300, width: 150, tw: 7.1, tf: 10.7 },
    { designation: 'IPE 400', shape: 'i-beam', A: 84.5e-4, Ix: 23130.0e-8, Iy: 1318.0e-8, J: 51.0e-8, depth: 400, width: 180, tw: 8.6, tf: 13.5 },
    { designation: 'UPN 200', shape: 'channel', A: 32.2e-4, Ix: 1910.0e-8, Iy: 148.0e-8, J: 6.0e-8, depth: 200, width: 75, tw: 8.5, tf: 11.5 },
  ],
};

const SHAPE_ICONS: Record<SectionShape, React.ReactNode> = {
  'rectangular': <RectangleHorizontal className="w-4 h-4" />,
  'circular': <Circle className="w-4 h-4" />,
  'i-beam': <BoxSelect className="w-4 h-4" />,
  'channel': <Square className="w-4 h-4" />,
  'angle': <Square className="w-4 h-4 rotate-45" />,
  'tube': <Square className="w-4 h-4" />,
  'pipe': <Circle className="w-4 h-4" />,
  'tee': <Square className="w-4 h-4" />,
};

export const SectionAssignDialog: React.FC<SectionAssignDialogProps> = ({ isOpen, onClose }) => {
  const { members, selectedIds, updateMember } = useModelStore(
    useShallow((s) => ({
      members: s.members,
      selectedIds: s.selectedIds,
      updateMember: s.updateMember,
    }))
  );

  const [tab, setTab] = useState<'library' | 'custom'>('library');
  const [standard, setStandard] = useState('IS (Indian Standard)');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<SectionPreset | null>(null);
  const [filterShape, setFilterShape] = useState<SectionShape | 'all'>('all');

  // Custom section
  const [customWidth, setCustomWidth] = useState(300);
  const [customDepth, setCustomDepth] = useState(500);
  const [customShape, setCustomShape] = useState<'rectangular' | 'circular'>('rectangular');

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  // Detect existing section from first selected member
  useEffect(() => {
    if (isOpen && selectedMembers.length > 0) {
      const first = selectedMembers[0];
      if (first.sectionId) {
        // Try to match to a standard section
        for (const [std, sections] of Object.entries(STANDARD_SECTIONS)) {
          const match = sections.find(s => s.designation === first.sectionId);
          if (match) {
            setStandard(std);
            setSelectedSection(match);
            setTab('library');
            return;
          }
        }
      }
      // Check custom dimensions
      if (first.dimensions) {
        setTab('custom');
        setCustomWidth((first.dimensions as any).width || 300);
        setCustomDepth((first.dimensions as any).depth || 500);
      }
    }
  }, [isOpen]);

  const filteredSections = useMemo(() => {
    const sections = STANDARD_SECTIONS[standard] || [];
    return sections.filter(s => {
      const matchesSearch = !searchQuery || s.designation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesShape = filterShape === 'all' || s.shape === filterShape;
      return matchesSearch && matchesShape;
    });
  }, [standard, searchQuery, filterShape]);

  const handleApplyLibrary = useCallback(() => {
    if (!selectedSection || selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, {
        sectionId: selectedSection.designation,
        sectionType: selectedSection.shape as any,
        A: selectedSection.A,
        I: selectedSection.Ix,
        Iy: selectedSection.Iy,
        Iz: selectedSection.Ix, // Major axis
        J: selectedSection.J,
        dimensions: {
          width: selectedSection.width,
          depth: selectedSection.depth,
          ...(selectedSection.tw ? { tw: selectedSection.tw, tf: selectedSection.tf } : {}),
        } as any,
      });
    });
    onClose();
  }, [selectedSection, selectedMembers, updateMember, onClose]);

  const handleApplyCustom = useCallback(() => {
    if (selectedMembers.length === 0) return;
    const w = customWidth / 1000; // mm to m
    const d = customDepth / 1000;
    let A: number, Ix: number, Iy: number, J: number;

    if (customShape === 'rectangular') {
      A = w * d;
      Ix = (w * d * d * d) / 12;
      Iy = (d * w * w * w) / 12;
      J = (w * d * (w * w + d * d)) / 12;
    } else {
      const r = d / 2;
      A = Math.PI * r * r;
      Ix = (Math.PI * r * r * r * r) / 4;
      Iy = Ix;
      J = (Math.PI * r * r * r * r) / 2;
    }

    selectedMembers.forEach(member => {
      updateMember(member.id, {
        sectionId: `Custom ${customShape === 'rectangular' ? `${customWidth}×${customDepth}` : `Ø${customDepth}`}`,
        sectionType: customShape as any,
        A, I: Ix, Iy, Iz: Ix, J,
        dimensions: { width: customWidth, depth: customDepth } as any,
      });
    });
    onClose();
  }, [customShape, customWidth, customDepth, selectedMembers, updateMember, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-500" />
            Assign Section
          </DialogTitle>
          <DialogDescription>
            Assign cross-section to {selectedMembers.length > 0 ? `${selectedMembers.length} selected member${selectedMembers.length > 1 ? 's' : ''}` : 'selected members'}.
            {selectedMembers.length === 0 && (
              <span className="text-amber-500 ml-1">Select members first.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#1a2333] mb-3">
          {(['library', 'custom'] as const).map(t => (
            <button type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium tracking-wide rounded-t-lg transition-colors ${
                tab === t
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-[#869ab8] hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'library' ? '📚 Section Library' : '✏️ Custom Section'}
            </button>
          ))}
        </div>

        {tab === 'library' ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Standard + Search */}
            <div className="flex gap-3">
              <div className="w-48">
                <Select value={standard} onValueChange={setStandard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(STANDARD_SECTIONS).map(std => (
                      <SelectItem key={std} value={std}>{std}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search sections..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterShape} onValueChange={v => setFilterShape(v as SectionShape | 'all')}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Shape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shapes</SelectItem>
                  <SelectItem value="i-beam">I-Beam</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                  <SelectItem value="angle">Angle</SelectItem>
                  <SelectItem value="tube">Tube/HSS</SelectItem>
                  <SelectItem value="pipe">Pipe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Section List */}
            <ScrollArea className="flex-1 border border-[#1a2333] rounded-lg">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSections.map(section => (
                  <button type="button"
                    key={section.designation}
                    onClick={() => setSelectedSection(section)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      selectedSection?.designation === section.designation
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                        : ''
                    }`}
                  >
                    <span className="text-slate-400">{SHAPE_ICONS[section.shape]}</span>
                    <div className="flex-1">
                      <span className="font-mono text-sm font-medium tracking-wide text-[#dae2fd]">
                        {section.designation}
                      </span>
                      <div className="flex gap-3 text-xs text-[#869ab8] mt-0.5">
                        <span>D={section.depth}mm</span>
                        <span>B={section.width}mm</span>
                        <span>A={(section.A * 1e4).toFixed(1)} cm²</span>
                        <span>Ix={(section.Ix * 1e8).toFixed(0)} cm⁴</span>
                      </div>
                    </div>
                    {selectedSection?.designation === section.designation && (
                      <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
                {filteredSections.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No sections match your search
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Selected preview */}
            {selectedSection && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                <span className="font-semibold text-blue-700 dark:text-blue-300">{selectedSection.designation}</span>
                <span className="mx-2 text-slate-400">|</span>
                <span className="text-[#869ab8]">
                  A = {(selectedSection.A * 1e4).toFixed(2)} cm² · Ix = {(selectedSection.Ix * 1e8).toFixed(1)} cm⁴ · Iy = {(selectedSection.Iy * 1e8).toFixed(1)} cm⁴
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              {(['rectangular', 'circular'] as const).map(shape => (
                <button type="button"
                  key={shape}
                  onClick={() => setCustomShape(shape)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    customShape === shape
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-[#1a2333] hover:border-slate-300'
                  }`}
                >
                  {shape === 'rectangular' ? <RectangleHorizontal className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  <span className="text-sm font-medium tracking-wide capitalize">{shape}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {customShape === 'rectangular' ? (
                <>
                  <div>
                    <Label>Width (mm)</Label>
                    <Input type="number" value={customWidth} onChange={e => setCustomWidth(+e.target.value)} min={10} max={2000} />
                  </div>
                  <div>
                    <Label>Depth (mm)</Label>
                    <Input type="number" value={customDepth} onChange={e => setCustomDepth(+e.target.value)} min={10} max={3000} />
                  </div>
                </>
              ) : (
                <div>
                  <Label>Diameter (mm)</Label>
                  <Input type="number" value={customDepth} onChange={e => setCustomDepth(+e.target.value)} min={10} max={3000} />
                </div>
              )}
            </div>

            {/* Preview of computed properties */}
            <div className="bg-[#131b2e] rounded-lg p-4 space-y-1 text-sm">
              <p className="font-medium tracking-wide text-[#adc6ff] mb-2">Computed Properties</p>
              {(() => {
                const w = customWidth / 1000, d = customDepth / 1000;
                const A = customShape === 'rectangular' ? w * d : Math.PI * (d / 2) ** 2;
                const Ix = customShape === 'rectangular' ? (w * d ** 3) / 12 : (Math.PI * (d / 2) ** 4) / 4;
                const Iy = customShape === 'rectangular' ? (d * w ** 3) / 12 : Ix;
                return (
                  <>
                    <p className="text-[#869ab8]">A = {(A * 1e4).toFixed(2)} cm²</p>
                    <p className="text-[#869ab8]">Ix = {(Ix * 1e8).toFixed(2)} cm⁴</p>
                    <p className="text-[#869ab8]">Iy = {(Iy * 1e8).toFixed(2)} cm⁴</p>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={tab === 'library' ? handleApplyLibrary : handleApplyCustom}
            disabled={selectedMembers.length === 0 || (tab === 'library' && !selectedSection)}
          >
            <Check className="w-4 h-4 mr-1" />
            Assign to {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
