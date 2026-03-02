/**
 * MaterialLibraryDialog.tsx — Material Library & Assignment
 * 
 * Industry parity: STAAD Pro "Define → Materials", SAP2000 "Define → Materials",
 * ETABS "Define → Material Properties", RISA "Materials" spreadsheet
 * 
 * Comprehensive material library with IS, ASTM, EN standards.
 * Supports Steel, Concrete, Timber, Aluminum, and custom materials.
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  Search, Check, Layers, Plus, Pencil,
} from 'lucide-react';
import { useModelStore } from '../../store/model';

interface MaterialLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'library' | 'assign' | 'properties'; // Controls which tab shows by default
}

interface MaterialDef {
  name: string;
  grade: string;
  category: 'steel' | 'concrete' | 'timber' | 'aluminum' | 'masonry' | 'custom';
  standard: string;
  E: number;       // kN/m² (Young's Modulus)
  G: number;       // kN/m² (Shear Modulus)
  fy?: number;     // kN/m² (Yield Strength)
  fu?: number;     // kN/m² (Ultimate Strength)
  fck?: number;    // kN/m² (Characteristic Compressive Strength — concrete)
  rho: number;     // kg/m³ (Density)
  nu: number;      // Poisson's Ratio
  alpha: number;   // Thermal expansion coefficient (per °C)
  color: string;   // Display color
}

const MATERIAL_DATABASE: MaterialDef[] = [
  // ── Indian Standard Steel ───────────────────────
  { name: 'Fe 250', grade: 'IS 2062 E250', category: 'steel', standard: 'IS', E: 2e8, G: 7.7e7, fy: 250000, fu: 410000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#3B82F6' },
  { name: 'Fe 345', grade: 'IS 2062 E350', category: 'steel', standard: 'IS', E: 2e8, G: 7.7e7, fy: 345000, fu: 490000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#2563EB' },
  { name: 'Fe 410', grade: 'IS 2062 E410', category: 'steel', standard: 'IS', E: 2e8, G: 7.7e7, fy: 410000, fu: 540000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#1D4ED8' },
  { name: 'TMT Fe 500', grade: 'IS 1786 Fe500', category: 'steel', standard: 'IS', E: 2e8, G: 7.7e7, fy: 500000, fu: 545000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#1E40AF' },
  // ── ASTM Steel ──────────────────────────────────
  { name: 'A36', grade: 'ASTM A36', category: 'steel', standard: 'ASTM', E: 2e8, G: 7.7e7, fy: 250000, fu: 400000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#60A5FA' },
  { name: 'A572 Gr.50', grade: 'ASTM A572', category: 'steel', standard: 'ASTM', E: 2e8, G: 7.7e7, fy: 345000, fu: 450000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#3B82F6' },
  { name: 'A992', grade: 'ASTM A992', category: 'steel', standard: 'ASTM', E: 2e8, G: 7.7e7, fy: 345000, fu: 450000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#2563EB' },
  { name: 'A500 Gr.B', grade: 'ASTM A500', category: 'steel', standard: 'ASTM', E: 2e8, G: 7.7e7, fy: 290000, fu: 400000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#1D4ED8' },
  // ── Eurocode Steel ──────────────────────────────
  { name: 'S235', grade: 'EN 10025 S235', category: 'steel', standard: 'EN', E: 2.1e8, G: 8.1e7, fy: 235000, fu: 360000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#818CF8' },
  { name: 'S275', grade: 'EN 10025 S275', category: 'steel', standard: 'EN', E: 2.1e8, G: 8.1e7, fy: 275000, fu: 430000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#6366F1' },
  { name: 'S355', grade: 'EN 10025 S355', category: 'steel', standard: 'EN', E: 2.1e8, G: 8.1e7, fy: 355000, fu: 510000, rho: 7850, nu: 0.3, alpha: 12e-6, color: '#4F46E5' },
  // ── Indian Standard Concrete ────────────────────
  { name: 'M20', grade: 'IS 456 M20', category: 'concrete', standard: 'IS', E: 2.24e7, G: 9.3e6, fck: 20000, rho: 2500, nu: 0.2, alpha: 10e-6, color: '#9CA3AF' },
  { name: 'M25', grade: 'IS 456 M25', category: 'concrete', standard: 'IS', E: 2.5e7, G: 1.04e7, fck: 25000, rho: 2500, nu: 0.2, alpha: 10e-6, color: '#6B7280' },
  { name: 'M30', grade: 'IS 456 M30', category: 'concrete', standard: 'IS', E: 2.74e7, G: 1.14e7, fck: 30000, rho: 2500, nu: 0.2, alpha: 10e-6, color: '#4B5563' },
  { name: 'M35', grade: 'IS 456 M35', category: 'concrete', standard: 'IS', E: 2.96e7, G: 1.23e7, fck: 35000, rho: 2500, nu: 0.2, alpha: 10e-6, color: '#374151' },
  { name: 'M40', grade: 'IS 456 M40', category: 'concrete', standard: 'IS', E: 3.16e7, G: 1.32e7, fck: 40000, rho: 2500, nu: 0.2, alpha: 10e-6, color: '#1F2937' },
  // ── ACI Concrete ────────────────────────────────
  { name: "f'c 3000 psi", grade: 'ACI 318', category: 'concrete', standard: 'ASTM', E: 2.06e7, G: 8.6e6, fck: 20684, rho: 2400, nu: 0.2, alpha: 10e-6, color: '#9CA3AF' },
  { name: "f'c 4000 psi", grade: 'ACI 318', category: 'concrete', standard: 'ASTM', E: 2.38e7, G: 9.9e6, fck: 27579, rho: 2400, nu: 0.2, alpha: 10e-6, color: '#6B7280' },
  { name: "f'c 5000 psi", grade: 'ACI 318', category: 'concrete', standard: 'ASTM', E: 2.66e7, G: 1.11e7, fck: 34474, rho: 2400, nu: 0.2, alpha: 10e-6, color: '#4B5563' },
  // ── Timber ──────────────────────────────────────
  { name: 'Teak (Group A)', grade: 'IS 883', category: 'timber', standard: 'IS', E: 1.26e7, G: 6.3e5, fy: 14000, rho: 660, nu: 0.3, alpha: 5e-6, color: '#92400E' },
  { name: 'Sal (Group A)', grade: 'IS 883', category: 'timber', standard: 'IS', E: 1.26e7, G: 6.3e5, fy: 14000, rho: 870, nu: 0.3, alpha: 5e-6, color: '#78350F' },
  { name: 'Douglas Fir', grade: 'NDS', category: 'timber', standard: 'ASTM', E: 1.2e7, G: 7.5e5, fy: 6900, rho: 500, nu: 0.3, alpha: 5e-6, color: '#A16207' },
  { name: 'Southern Pine', grade: 'NDS', category: 'timber', standard: 'ASTM', E: 1.1e7, G: 6.9e5, fy: 5500, rho: 560, nu: 0.3, alpha: 5e-6, color: '#854D0E' },
  // ── Aluminum ────────────────────────────────────
  { name: '6061-T6', grade: 'ASTM B308', category: 'aluminum', standard: 'ASTM', E: 6.9e7, G: 2.6e7, fy: 276000, fu: 310000, rho: 2700, nu: 0.33, alpha: 23.6e-6, color: '#E2E8F0' },
  { name: '6063-T5', grade: 'ASTM B221', category: 'aluminum', standard: 'ASTM', E: 6.9e7, G: 2.6e7, fy: 186000, fu: 207000, rho: 2700, nu: 0.33, alpha: 23.6e-6, color: '#CBD5E1' },
  // ── Masonry ─────────────────────────────────────
  { name: 'Brick (Class A)', grade: 'IS 1905', category: 'masonry', standard: 'IS', E: 5.5e6, G: 2.2e6, fck: 10000, rho: 1920, nu: 0.25, alpha: 6e-6, color: '#DC2626' },
];

const CATEGORY_COLORS: Record<string, string> = {
  steel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  concrete: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  timber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  aluminum: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  masonry: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  custom: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

export const MaterialLibraryDialog: React.FC<MaterialLibraryDialogProps> = ({ isOpen, onClose, mode = 'library' }) => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [activeTab, setActiveTab] = useState<'browse' | 'custom'>(mode === 'properties' ? 'custom' : 'browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStandard, setFilterStandard] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDef | null>(null);

  // Custom material fields
  const [customName, setCustomName] = useState('Custom Material');
  const [customE, setCustomE] = useState(200000000);
  const [customG, setCustomG] = useState(77000000);
  const [customRho, setCustomRho] = useState(7850);
  const [customNu, setCustomNu] = useState(0.3);
  const [customFy, setCustomFy] = useState(250000);
  const [customAlpha, setCustomAlpha] = useState(12e-6);

  const selectedMembers = useMemo(() =>
    Array.from(selectedIds).filter(id => members.has(id)).map(id => members.get(id)!),
    [selectedIds, members]
  );

  const filteredMaterials = useMemo(() => {
    return MATERIAL_DATABASE.filter(m => {
      const matchesSearch = !searchQuery ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.grade.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = filterCategory === 'all' || m.category === filterCategory;
      const matchesStd = filterStandard === 'all' || m.standard === filterStandard;
      return matchesSearch && matchesCat && matchesStd;
    });
  }, [searchQuery, filterCategory, filterStandard]);

  const handleAssign = useCallback((mat: MaterialDef) => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, {
        E: mat.E,
        G: mat.G,
        rho: mat.rho,
      });
    });
    onClose();
  }, [selectedMembers, updateMember, onClose]);

  const handleAssignCustom = useCallback(() => {
    if (selectedMembers.length === 0) return;
    selectedMembers.forEach(member => {
      updateMember(member.id, {
        E: customE,
        G: customG,
        rho: customRho,
      });
    });
    onClose();
  }, [selectedMembers, updateMember, onClose, customE, customG, customRho]);

  const formatEngineering = (val: number) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)} GPa`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} MPa`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)} kPa`;
    return `${val.toFixed(1)} Pa`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" />
            {mode === 'assign' ? 'Assign Material' : mode === 'properties' ? 'Material Properties' : 'Material Library'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'assign' 
              ? `Assign material to ${selectedMembers.length} selected member${selectedMembers.length !== 1 ? 's' : ''}.`
              : 'Browse, create, and manage engineering materials for your model.'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-3">
          {(['browse', 'custom'] as const).map(t => (
            <button type="button"
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === t
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'browse' ? '📚 Material Database' : '✏️ Custom Material'}
            </button>
          ))}
        </div>

        {activeTab === 'browse' ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="steel">Steel</SelectItem>
                  <SelectItem value="concrete">Concrete</SelectItem>
                  <SelectItem value="timber">Timber</SelectItem>
                  <SelectItem value="aluminum">Aluminum</SelectItem>
                  <SelectItem value="masonry">Masonry</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStandard} onValueChange={setFilterStandard}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Standard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Std.</SelectItem>
                  <SelectItem value="IS">IS</SelectItem>
                  <SelectItem value="ASTM">ASTM</SelectItem>
                  <SelectItem value="EN">EN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Material Grid */}
            <ScrollArea className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMaterials.map(mat => (
                  <button type="button"
                    key={mat.grade + mat.name}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      selectedMaterial?.name === mat.name && selectedMaterial?.grade === mat.grade
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: mat.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 dark:text-white">{mat.name}</span>
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[mat.category]}`}>
                          {mat.category}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{mat.grade}</span>
                        <span>E = {formatEngineering(mat.E)}</span>
                        <span>ρ = {mat.rho} kg/m³</span>
                        {mat.fy && <span>fy = {formatEngineering(mat.fy)}</span>}
                        {mat.fck && <span>fck = {formatEngineering(mat.fck)}</span>}
                      </div>
                    </div>
                    {selectedMaterial?.name === mat.name && selectedMaterial?.grade === mat.grade && (
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
                {filteredMaterials.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No materials match your search
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Selected properties detail */}
            {selectedMaterial && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Young&apos;s Modulus</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatEngineering(selectedMaterial.E)}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Shear Modulus</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatEngineering(selectedMaterial.G)}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Poisson&apos;s Ratio</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedMaterial.nu}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Density</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedMaterial.rho} kg/m³</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Thermal Coeff.</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedMaterial.alpha.toExponential(1)} /°C</span>
                </div>
                {selectedMaterial.fy && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Yield Strength</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatEngineering(selectedMaterial.fy)}</span>
                  </div>
                )}
                {selectedMaterial.fu && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Ult. Strength</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatEngineering(selectedMaterial.fu)}</span>
                  </div>
                )}
                {selectedMaterial.fck && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">fck</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatEngineering(selectedMaterial.fck)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Material Name</Label>
              <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. High-strength steel" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Young&apos;s Modulus E (kN/m²)</Label>
                <Input type="number" value={customE} onChange={e => setCustomE(+e.target.value)} />
              </div>
              <div>
                <Label>Shear Modulus G (kN/m²)</Label>
                <Input type="number" value={customG} onChange={e => setCustomG(+e.target.value)} />
              </div>
              <div>
                <Label>Poisson&apos;s Ratio ν</Label>
                <Input type="number" value={customNu} onChange={e => setCustomNu(+e.target.value)} step={0.01} min={0} max={0.5} />
              </div>
              <div>
                <Label>Density ρ (kg/m³)</Label>
                <Input type="number" value={customRho} onChange={e => setCustomRho(+e.target.value)} />
              </div>
              <div>
                <Label>Yield Strength fy (kN/m²)</Label>
                <Input type="number" value={customFy} onChange={e => setCustomFy(+e.target.value)} />
              </div>
              <div>
                <Label>Thermal α (/°C)</Label>
                <Input type="number" value={customAlpha} onChange={e => setCustomAlpha(+e.target.value)} step={1e-7} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {activeTab === 'browse' ? (
            <Button
              onClick={() => selectedMaterial && handleAssign(selectedMaterial)}
              disabled={!selectedMaterial || selectedMembers.length === 0}
            >
              <Check className="w-4 h-4 mr-1" />
              Assign to {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
            </Button>
          ) : (
            <Button
              onClick={handleAssignCustom}
              disabled={selectedMembers.length === 0}
            >
              <Check className="w-4 h-4 mr-1" />
              Assign Custom Material
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
