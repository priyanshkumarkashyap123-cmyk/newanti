/**
 * Section Database Browser - Comprehensive Multi-Standard Steel Sections
 * Connected to: apps/web/src/modules/data/ISSteelSections.ts (IS 808)
 *               apps/web/src/data/SteelSectionDatabase.ts (AISC/EU/BS)
 * Contains 500+ sections: ISMB, ISMC, ISA, SHS, RHS, CHS, W-shapes, IPE, HE
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  Eye,
  Bookmark,
  BookmarkCheck,
  Info,
  Ruler,
  Database,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/FormInputs';
import { useModelStore } from '../store/model';

// Import IS section data
import {
  ISteelSection,
  getSectionsByType,
  getSectionByDesignation,
  findOptimalSection,
  SectionType,
  ISMB_SECTIONS,
  ISMC_SECTIONS,
  ISA_EQUAL_SECTIONS,
  SHS_SECTIONS,
  RHS_SECTIONS,
  CHS_SECTIONS
} from '../modules/data/ISSteelSections';

// Import comprehensive multi-standard database (AISC, EU, extra IS)
import {
  STEEL_SECTION_DATABASE,
  SteelSectionProperties,
  getSectionsByStandard,
  selectOptimalSection,
} from '../data/SteelSectionDatabase';

// UI type for display - expanded to include all standards
type SectionStandard = 'ISMB' | 'ISMC' | 'ISA' | 'SHS' | 'RHS' | 'CHS' | 'AISC-W' | 'IPE' | 'HEA' | 'HEB' | 'ISHB' | 'ISLB' | 'ISWB';

interface SectionData {
  id: string;
  designation: string;
  standard: SectionStandard;
  depth: number;      // mm
  width: number;      // mm
  webThick: number;   // mm
  flangeThick: number; // mm
  area: number;       // cm²
  Ixx: number;        // cm⁴
  Iyy: number;        // cm⁴
  Zxx: number;        // cm³
  Zyy: number;        // cm³
  rxx: number;        // cm
  ryy: number;        // cm
  mass: number;       // kg/m
  source: 'IS808' | 'Extended';
}

// Convert real IS section data to display format
function convertISToDisplay(section: ISteelSection, index: number): SectionData {
  return {
    id: `IS-${index}`,
    designation: section.designation,
    standard: section.type as SectionStandard,
    depth: section.depth,
    width: section.width,
    webThick: section.tw,
    flangeThick: section.tf,
    area: section.area / 100,
    Ixx: section.Ixx / 10000,
    Iyy: section.Iyy / 10000,
    Zxx: section.Zxx / 1000,
    Zyy: section.Zyy / 1000,
    rxx: section.rxx / 10,
    ryy: section.ryy / 10,
    mass: section.mass,
    source: 'IS808',
  };
}

// Convert extended database sections to display format
function convertExtendedToDisplay(section: SteelSectionProperties, index: number): SectionData {
  // Map type → standard display tag
  const stdMap: Record<string, SectionStandard> = {
    'AISC|Wide-Flange': 'AISC-W',
    'EU|I-Beam': 'IPE',
    'EU|H-Column': section.designation.startsWith('HEB') ? 'HEB' : 'HEA',
    'IS|H-Column': 'ISHB',
    'IS|Wide-Flange': 'ISWB',
  };
  const key = `${section.standard}|${section.type}`;
  const displayStd: SectionStandard = stdMap[key] || (section.designation.substring(0, 4).replace(/\s/g, '') as SectionStandard);

  return {
    id: `EXT-${index}`,
    designation: section.designation,
    standard: displayStd,
    depth: section.D,
    width: section.B,
    webThick: section.tw,
    flangeThick: section.tf,
    area: section.A / 100,
    Ixx: section.Ix,       // Already in cm⁴ × (10⁴/10⁴) from database
    Iyy: section.Iy,
    Zxx: section.Zx,
    Zyy: section.Zy,
    rxx: section.rx / 10,
    ryy: section.ry / 10,
    mass: section.weight,
    source: 'Extended',
  };
}

// Build combined section database (IS 808 primary + extended multi-standard)
const IS_DESIGNATIONS = new Set<string>();
const isSections: SectionData[] = [
  ...Object.values(ISMB_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i); }),
  ...Object.values(ISMC_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i + 100); }),
  ...Object.values(ISA_EQUAL_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i + 200); }),
  ...Object.values(SHS_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i + 300); }),
  ...Object.values(RHS_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i + 400); }),
  ...Object.values(CHS_SECTIONS).map((s, i) => { IS_DESIGNATIONS.add(s.designation); return convertISToDisplay(s, i + 500); }),
];

// Add extended sections (skip duplicates already in IS 808)
const extendedSections: SectionData[] = STEEL_SECTION_DATABASE
  .filter(s => !IS_DESIGNATIONS.has(s.designation))
  .map((s, i) => convertExtendedToDisplay(s, i));

const sectionDatabase: SectionData[] = [...isSections, ...extendedSections];

export const SectionDatabasePage: React.FC = () => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<SectionStandard | 'ALL'>('ALL');
  const [selectedSection, setSelectedSection] = useState<SectionData | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { document.title = 'Section Database | BeamLab'; }, []);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const applyToModel = useCallback((section: SectionData) => {
    const targets = selectedIds.size > 0
      ? Array.from(selectedIds)
      : Array.from(members.keys());
    if (targets.length === 0) {
      showToast('No members in model. Create a structure first.');
      return;
    }
    // Convert cm² → mm², cm⁴ → mm⁴
    const Amm2 = section.area * 100;
    const Imm4 = section.Ixx * 10000;
    // E for steel: 200,000 MPa → 200e6 kN/m² (model store units)
    const E_kN_m2 = 200e6;
    // Map standard → SectionType
    const typeMap: Record<string, string> = {
      'ISMB': 'I-BEAM', 'ISMC': 'C-CHANNEL', 'ISA': 'L-ANGLE',
      'SHS': 'TUBE', 'RHS': 'TUBE', 'CHS': 'CIRCLE'
    };
    targets.forEach((id: string) => {
      updateMember(id, {
        sectionId: section.designation,
        sectionType: (typeMap[section.standard] || 'I-BEAM') as any,
        A: Amm2,
        I: Imm4,
        E: E_kN_m2,
        dimensions: {
          height: section.depth,
          width: section.width,
          webThickness: section.webThick,
          flangeThickness: section.flangeThick,
        }
      });
    });
    const scope = selectedIds.size > 0 ? `${targets.length} selected` : `all ${targets.length}`;
    showToast(`Applied ${section.designation} to ${scope} members`);
  }, [members, selectedIds, updateMember, showToast]);

  // Real IS 808 + AISC + EU section types
  const standards: SectionStandard[] = ['ISMB', 'ISMC', 'ISA', 'SHS', 'RHS', 'CHS', 'AISC-W', 'IPE', 'HEA', 'HEB', 'ISHB', 'ISLB', 'ISWB'];

  // Section count by type for info display
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sectionDatabase) {
      counts[s.standard] = (counts[s.standard] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredSections = useMemo(() => {
    return sectionDatabase.filter(section => {
      const matchesSearch = section.designation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStandard = selectedStandard === 'ALL' || section.standard === selectedStandard;
      return matchesSearch && matchesStandard;
    });
  }, [searchQuery, selectedStandard]);

  const toggleSaveSection = (id: string) => {
    const newSaved = new Set(savedSections);
    if (newSaved.has(id)) {
      newSaved.delete(id);
    } else {
      newSaved.add(id);
    }
    setSavedSections(newSaved);
  };

  const exportSection = (section: SectionData) => {
    const data = JSON.stringify(section, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${section.designation.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header */}
      <div className="border-b border-[#1a2333] bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Section Database Browser
          </h1>
          <p className="text-[#869ab8] text-sm">
            {sectionDatabase.length} sections — IS 808, AISC W-shapes, European IPE/HE, and more
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Search & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Bar */}
            <div className="bg-[#0b1326] rounded-xl p-4 border border-[#1a2333]">
              <div className="flex gap-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sections (e.g., ISMB 200, W14x82, IPE 300)..."
                  leftIcon={<Search className="w-5 h-5" />}
                />
                <Button type="button" variant="default" size="lg" className="px-4">
                  <Filter className="w-5 h-5" />
                  Filter
                </Button>
              </div>
            </div>

            {/* Standard Filter */}
            <div className="bg-[#0b1326] rounded-xl p-6 border border-[#1a2333]">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">Standard</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button"
                  onClick={() => setSelectedStandard('ALL')}
                  variant={selectedStandard === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                >
                  All Standards
                </Button>
                {standards.map((std) => (
                  <Button type="button"
                    key={std}
                    onClick={() => setSelectedStandard(std)}
                    variant={selectedStandard === std ? 'default' : 'outline'}
                    size="sm"
                  >
                    {std}
                  </Button>
                ))}
              </div>
            </div>

            {/* Section List */}
            <div className="bg-[#0b1326] rounded-xl p-6 border border-[#1a2333]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#dae2fd]">
                  {filteredSections.length} sections found
                </h3>
                {savedSections.size > 0 && (
                  <span className="text-xs text-purple-400">
                    {savedSections.size} saved
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredSections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedSection?.id === section.id
                        ? 'bg-purple-900/30 border border-purple-500'
                        : 'bg-[#131b2e] hover:bg-slate-750 border border-transparent'
                    }`}
                    onClick={() => setSelectedSection(section)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-[#dae2fd]">{section.designation}</h4>
                          <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-[#adc6ff] rounded">
                            {section.standard}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-[#869ab8]">
                          <div>
                            <span className="text-[#869ab8]">Depth:</span> {section.depth} mm
                          </div>
                          <div>
                            <span className="text-[#869ab8]">Width:</span> {section.width} mm
                          </div>
                          <div>
                            <span className="text-[#869ab8]">Mass:</span> {section.mass} kg/m
                          </div>
                        </div>
                      </div>
                      
                      <Button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveSection(section.id);
                        }}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                      >
                        {savedSections.has(section.id) ? (
                          <BookmarkCheck className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Bookmark className="w-5 h-5 text-[#869ab8]" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="lg:col-span-1">
            {selectedSection ? (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-[#1a2333] sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-[#dae2fd]">{selectedSection.designation}</h2>
                  <Button type="button"
                    onClick={() => exportSection(selectedSection)}
                    variant="default"
                    size="icon"
                    className="h-9 w-9"
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Cross Section Preview */}
                  <div className="bg-[#131b2e] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-purple-400">Cross Section</h3>
                    </div>
                    <div className="aspect-square bg-[#0b1326] rounded-lg flex items-center justify-center">
                      {/* Simple I-section visualization */}
                      <div className="relative" style={{ width: '80%', height: '80%' }}>
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 bg-blue-500/30 border-2 border-blue-400"
                          style={{ 
                            width: '30%', 
                            height: '100%',
                            top: 0
                          }}
                        />
                        <div 
                          className="absolute left-0 bg-blue-500/30 border-2 border-blue-400"
                          style={{ 
                            width: '100%', 
                            height: '20%',
                            top: 0
                          }}
                        />
                        <div 
                          className="absolute left-0 bg-blue-500/30 border-2 border-blue-400"
                          style={{ 
                            width: '100%', 
                            height: '20%',
                            bottom: 0
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="bg-[#131b2e] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Ruler className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-amber-400">Dimensions</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#869ab8]">Depth (h):</span>
                        <p className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.depth} mm</p>
                      </div>
                      <div>
                        <span className="text-[#869ab8]">Width (b):</span>
                        <p className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.width} mm</p>
                      </div>
                      <div>
                        <span className="text-[#869ab8]">Web (tw):</span>
                        <p className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.webThick} mm</p>
                      </div>
                      <div>
                        <span className="text-[#869ab8]">Flange (tf):</span>
                        <p className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.flangeThick} mm</p>
                      </div>
                    </div>
                  </div>

                  {/* Section Properties */}
                  <div className="bg-[#131b2e] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-semibold text-blue-400">Section Properties</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Cross-sectional Area:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.area} cm²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Moment of Inertia Ixx:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.Ixx.toFixed(1)} cm⁴</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Moment of Inertia Iyy:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.Iyy.toFixed(1)} cm⁴</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Section Modulus Zxx:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.Zxx.toFixed(1)} cm³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Section Modulus Zyy:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.Zyy.toFixed(1)} cm³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Radius of Gyration rxx:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.rxx.toFixed(2)} cm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869ab8]">Radius of Gyration ryy:</span>
                        <span className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{selectedSection.ryy.toFixed(2)} cm</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#1a2333]">
                        <span className="text-[#869ab8]">Mass per meter:</span>
                        <span className="text-[#dae2fd] font-bold">{selectedSection.mass} kg/m</span>
                      </div>
                    </div>
                  </div>

                  {/* Use in Model Button */}
                  <Button
                    type="button"
                    onClick={() => applyToModel(selectedSection)}
                    className="w-full"
                    variant="premium"
                    size="lg"
                  >
                    {selectedIds.size > 0 ? `Apply to ${selectedIds.size} Selected Members` : 'Apply to All Members'}
                  </Button>
                  <p className="text-xs text-slate-500 text-center mt-1">
                    {members.size} members in model
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#0b1326] rounded-xl p-6 border border-[#1a2333] h-full">
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <Ruler className="w-16 h-16 text-slate-500 mb-4" />
                  <h3 className="text-lg font-semibold text-[#869ab8] mb-2">No Section Selected</h3>
                  <p className="text-sm text-[#869ab8]">
                    Click on a section from the list to view detailed properties
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          {toast}
        </div>
      )}
    </div>
  );
};

export default SectionDatabasePage;
