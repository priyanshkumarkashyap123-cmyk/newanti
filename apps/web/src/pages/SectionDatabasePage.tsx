/**
 * Section Database Browser - Real IS 808 Sections
 * Connected to: apps/web/src/modules/data/ISSteelSections.ts
 * Contains ISMB, ISMC, ISA, SHS, RHS, CHS sections per IS standards
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import { useModelStore } from '../store/model';

// Import REAL section data from existing database
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

// UI type for display
type SectionStandard = 'ISMB' | 'ISMC' | 'ISA' | 'SHS' | 'RHS' | 'CHS';

interface SectionData {
  id: string;
  designation: string;
  standard: SectionStandard;
  depth: number;      // mm
  width: number;      // mm
  webThick: number;   // mm
  flangeThick: number; // mm
  area: number;       // mm² (converted to cm² for display)
  Ixx: number;        // mm⁴ (converted to cm⁴ for display)
  Iyy: number;        // mm⁴ (converted to cm⁴ for display)
  Zxx: number;        // mm³ (converted to cm³ for display)
  Zyy: number;        // mm³ (converted to cm³ for display)
  rxx: number;        // mm (converted to cm for display)
  ryy: number;        // mm (converted to cm for display)
  mass: number;       // kg/m
}

// Convert real IS section data to display format
function convertToDisplayFormat(section: ISteelSection, index: number): SectionData {
  return {
    id: String(index + 1),
    designation: section.designation,
    standard: section.type as SectionStandard,
    depth: section.depth,
    width: section.width,
    webThick: section.tw,
    flangeThick: section.tf,
    area: section.area / 100,      // mm² to cm²
    Ixx: section.Ixx / 10000,      // mm⁴ to cm⁴
    Iyy: section.Iyy / 10000,      // mm⁴ to cm⁴
    Zxx: section.Zxx / 1000,       // mm³ to cm³
    Zyy: section.Zyy / 1000,       // mm³ to cm³
    rxx: section.rxx / 10,         // mm to cm
    ryy: section.ryy / 10,         // mm to cm
    mass: section.mass
  };
}

// Build the REAL section database from imported data
const sectionDatabase: SectionData[] = [
  ...Object.values(ISMB_SECTIONS).map((s, i) => convertToDisplayFormat(s, i)),
  ...Object.values(ISMC_SECTIONS).map((s, i) => convertToDisplayFormat(s, i + 100)),
  ...Object.values(ISA_EQUAL_SECTIONS).map((s, i) => convertToDisplayFormat(s, i + 200)),
  ...Object.values(SHS_SECTIONS).map((s, i) => convertToDisplayFormat(s, i + 300)),
  ...Object.values(RHS_SECTIONS).map((s, i) => convertToDisplayFormat(s, i + 400)),
  ...Object.values(CHS_SECTIONS).map((s, i) => convertToDisplayFormat(s, i + 500)),
];

export const SectionDatabasePage: React.FC = () => {
  const members = useModelStore(s => s.members);
  const selectedIds = useModelStore(s => s.selectedIds);
  const updateMember = useModelStore(s => s.updateMember);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<SectionStandard | 'ALL'>('ALL');
  const [selectedSection, setSelectedSection] = useState<SectionData | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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

  // Real IS 808 section types (matching our database)
  const standards: SectionStandard[] = ['ISMB', 'ISMC', 'ISA', 'SHS', 'RHS', 'CHS'];

  // Section count by type for info display
  const sectionCounts = useMemo(() => ({
    ISMB: Object.keys(ISMB_SECTIONS).length,
    ISMC: Object.keys(ISMC_SECTIONS).length,
    ISA: Object.keys(ISA_EQUAL_SECTIONS).length,
    SHS: Object.keys(SHS_SECTIONS).length,
    RHS: Object.keys(RHS_SECTIONS).length,
    CHS: Object.keys(CHS_SECTIONS).length,
  }), []);

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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Section Database Browser
          </h1>
          <p className="text-slate-400 text-sm">
            Comprehensive steel section library - ISMB, AISC, IPE, British standards
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Search & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Bar */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sections (e.g., ISMB 200, W14x82, IPE 300)..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <button className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filter
                </button>
              </div>
            </div>

            {/* Standard Filter */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">Standard</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedStandard('ALL')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedStandard === 'ALL'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All Standards
                </button>
                {standards.map((std) => (
                  <button
                    key={std}
                    onClick={() => setSelectedStandard(std)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedStandard === std
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {std}
                  </button>
                ))}
              </div>
            </div>

            {/* Section List */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
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
                        : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
                    }`}
                    onClick={() => setSelectedSection(section)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-white">{section.designation}</h4>
                          <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                            {section.standard}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-slate-400">
                          <div>
                            <span className="text-slate-400">Depth:</span> {section.depth} mm
                          </div>
                          <div>
                            <span className="text-slate-400">Width:</span> {section.width} mm
                          </div>
                          <div>
                            <span className="text-slate-400">Mass:</span> {section.mass} kg/m
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveSection(section.id);
                        }}
                        className="p-2 hover:bg-slate-700 rounded transition-colors"
                      >
                        {savedSections.has(section.id) ? (
                          <BookmarkCheck className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Bookmark className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="lg:col-span-1">
            {selectedSection ? (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">{selectedSection.designation}</h2>
                  <button
                    onClick={() => exportSection(selectedSection)}
                    className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Cross Section Preview */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-purple-400">Cross Section</h3>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-lg flex items-center justify-center">
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
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Ruler className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-amber-400">Dimensions</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-400">Depth (h):</span>
                        <p className="text-white font-medium">{selectedSection.depth} mm</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Width (b):</span>
                        <p className="text-white font-medium">{selectedSection.width} mm</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Web (tw):</span>
                        <p className="text-white font-medium">{selectedSection.webThick} mm</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Flange (tf):</span>
                        <p className="text-white font-medium">{selectedSection.flangeThick} mm</p>
                      </div>
                    </div>
                  </div>

                  {/* Section Properties */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-semibold text-blue-400">Section Properties</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cross-sectional Area:</span>
                        <span className="text-white font-medium">{selectedSection.area} cm²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Moment of Inertia Ixx:</span>
                        <span className="text-white font-medium">{selectedSection.Ixx.toFixed(1)} cm⁴</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Moment of Inertia Iyy:</span>
                        <span className="text-white font-medium">{selectedSection.Iyy.toFixed(1)} cm⁴</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Section Modulus Zxx:</span>
                        <span className="text-white font-medium">{selectedSection.Zxx.toFixed(1)} cm³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Section Modulus Zyy:</span>
                        <span className="text-white font-medium">{selectedSection.Zyy.toFixed(1)} cm³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Radius of Gyration rxx:</span>
                        <span className="text-white font-medium">{selectedSection.rxx.toFixed(2)} cm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Radius of Gyration ryy:</span>
                        <span className="text-white font-medium">{selectedSection.ryy.toFixed(2)} cm</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-700">
                        <span className="text-slate-400">Mass per meter:</span>
                        <span className="text-white font-bold">{selectedSection.mass} kg/m</span>
                      </div>
                    </div>
                  </div>

                  {/* Use in Model Button */}
                  <button
                    onClick={() => applyToModel(selectedSection)}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all shadow-lg"
                  >
                    {selectedIds.size > 0 ? `Apply to ${selectedIds.size} Selected Members` : 'Apply to All Members'}
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-1">
                    {members.size} members in model
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 h-full">
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <Ruler className="w-16 h-16 text-slate-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-400 mb-2">No Section Selected</h3>
                  <p className="text-sm text-slate-400">
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
