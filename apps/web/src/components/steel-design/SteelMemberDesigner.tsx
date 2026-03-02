/**
 * ============================================================================
 * STEEL MEMBER DESIGNER COMPONENT
 * ============================================================================
 * 
 * Ultra-modern React component for structural steel member design.
 * Supports beams, columns, tension members, and built-up sections.
 * 
 * @version 1.0.0
 */


import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Ruler,
  ArrowRight,
  Download,
  RefreshCw,
  Layers,
  Box,
  Grid,
  Maximize2,
  Minus,
  RotateCw,
} from 'lucide-react';

// Types
type MemberType = 'beam' | 'column' | 'tension' | 'strut';
type SectionType = 'I-section' | 'channel' | 'angle' | 'tube' | 'pipe' | 'built-up';
type DesignCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';

interface SteelSection {
  name: string;
  type: SectionType;
  depth: number;
  width: number;
  tf: number;
  tw: number;
  area: number;
  Ixx: number;
  Iyy: number;
  Zxx: number;
  Zyy: number;
  rxx: number;
  ryy: number;
}

interface SteelFormData {
  memberType: MemberType;
  sectionType: SectionType;
  section: string;
  length: number;      // mm
  effectiveLength: number;
  // Loads
  axialForce: number;  // kN
  momentX: number;     // kN-m
  momentY: number;     // kN-m
  shearX: number;      // kN
  shearY: number;      // kN
  // Boundary conditions
  kx: number;
  ky: number;
  // Material
  code: DesignCode;
  steelGrade: string;
  fy: number;          // MPa
  fu: number;          // MPa
  // Factors
  safetyFactor: number;
}

// Standard Indian I-Sections
const INDIAN_SECTIONS: SteelSection[] = [
  { name: 'ISMB 100', type: 'I-section', depth: 100, width: 75, tf: 7.2, tw: 4.0, area: 1140, Ixx: 257.5, Iyy: 40.8, Zxx: 51.5, Zyy: 10.9, rxx: 47.5, ryy: 18.9 },
  { name: 'ISMB 150', type: 'I-section', depth: 150, width: 80, tf: 7.6, tw: 4.8, area: 1730, Ixx: 726.4, Iyy: 52.6, Zxx: 96.9, Zyy: 13.2, rxx: 64.8, ryy: 17.4 },
  { name: 'ISMB 200', type: 'I-section', depth: 200, width: 100, tf: 10.8, tw: 5.7, area: 3230, Ixx: 2235, Iyy: 150, Zxx: 223.5, Zyy: 30.0, rxx: 83.2, ryy: 21.5 },
  { name: 'ISMB 250', type: 'I-section', depth: 250, width: 125, tf: 12.5, tw: 6.9, area: 4740, Ixx: 5131, Iyy: 334, Zxx: 410.5, Zyy: 53.5, rxx: 104.1, ryy: 26.6 },
  { name: 'ISMB 300', type: 'I-section', depth: 300, width: 140, tf: 12.4, tw: 7.5, area: 5660, Ixx: 8603, Iyy: 453, Zxx: 573.6, Zyy: 64.7, rxx: 123.3, ryy: 28.3 },
  { name: 'ISMB 350', type: 'I-section', depth: 350, width: 140, tf: 14.2, tw: 8.1, area: 6670, Ixx: 13630, Iyy: 537, Zxx: 778.9, Zyy: 76.7, rxx: 143.0, ryy: 28.4 },
  { name: 'ISMB 400', type: 'I-section', depth: 400, width: 140, tf: 16.0, tw: 8.9, area: 7840, Ixx: 20458, Iyy: 622, Zxx: 1022.9, Zyy: 88.9, rxx: 161.5, ryy: 28.2 },
  { name: 'ISMB 450', type: 'I-section', depth: 450, width: 150, tf: 17.4, tw: 9.4, area: 9220, Ixx: 30390, Iyy: 834, Zxx: 1350.7, Zyy: 111.2, rxx: 181.5, ryy: 30.1 },
  { name: 'ISMB 500', type: 'I-section', depth: 500, width: 180, tf: 17.2, tw: 10.2, area: 11000, Ixx: 45218, Iyy: 1370, Zxx: 1808.7, Zyy: 152.2, rxx: 202.8, ryy: 35.3 },
  { name: 'ISMB 550', type: 'I-section', depth: 550, width: 190, tf: 19.3, tw: 11.2, area: 13200, Ixx: 64894, Iyy: 1833, Zxx: 2359.8, Zyy: 193.0, rxx: 221.8, ryy: 37.3 },
  { name: 'ISMB 600', type: 'I-section', depth: 600, width: 210, tf: 20.8, tw: 12.0, area: 15600, Ixx: 91800, Iyy: 2650, Zxx: 3060.0, Zyy: 252.4, rxx: 242.6, ryy: 41.2 },
];

const STEEL_GRADES: { grade: string; fy: number; fu: number }[] = [
  { grade: 'E250 (Fe 410W A)', fy: 250, fu: 410 },
  { grade: 'E300 (Fe 440)', fy: 300, fu: 440 },
  { grade: 'E350 (Fe 490)', fy: 350, fu: 490 },
  { grade: 'E410 (Fe 540)', fy: 410, fu: 540 },
  { grade: 'E450 (Fe 570)', fy: 450, fu: 570 },
];

const defaultFormData: SteelFormData = {
  memberType: 'beam',
  sectionType: 'I-section',
  section: 'ISMB 300',
  length: 6000,
  effectiveLength: 6000,
  axialForce: 0,
  momentX: 150,
  momentY: 0,
  shearX: 100,
  shearY: 0,
  kx: 1.0,
  ky: 1.0,
  code: 'IS800',
  steelGrade: 'E250 (Fe 410W A)',
  fy: 250,
  fu: 410,
  safetyFactor: 1.1,
};

export default function SteelMemberDesigner() {
  const [formData, setFormData] = useState<SteelFormData>(defaultFormData);
  const [result, setResult] = useState<any | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'drawing'>('input');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    section: true,
    loads: true,
    boundary: true,
    material: false,
  });

  // Get selected section properties
  const selectedSection = useMemo(() => {
    return INDIAN_SECTIONS.find(s => s.name === formData.section) || INDIAN_SECTIONS[4];
  }, [formData.section]);

  // Handle form changes
  const handleChange = useCallback((field: keyof SteelFormData, value: number | string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Update fy and fu when steel grade changes
      if (field === 'steelGrade') {
        const grade = STEEL_GRADES.find(g => g.grade === value);
        if (grade) {
          newData.fy = grade.fy;
          newData.fu = grade.fu;
        }
      }
      
      // Update effective length when kx, ky, or length changes
      if (field === 'length' || field === 'kx') {
        const length = field === 'length' ? value as number : prev.length;
        newData.effectiveLength = length * newData.kx;
      }
      
      return newData;
    });
  }, []);

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Run design calculation
  const runDesign = useCallback(async () => {
    setIsCalculating(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const sect = selectedSection;
    const gamma_m0 = formData.safetyFactor;
    const fy = formData.fy;
    const fu = formData.fu;

    // Section classification
    const epsilonFlange = Math.sqrt(250 / fy);
    const flangeRatio = (sect.width / 2) / sect.tf;
    const webRatio = (sect.depth - 2 * sect.tf) / sect.tw;
    
    const flangeClass = flangeRatio <= 9.4 * epsilonFlange ? 'Plastic' :
                      flangeRatio <= 10.5 * epsilonFlange ? 'Compact' :
                      flangeRatio <= 15.7 * epsilonFlange ? 'Semi-compact' : 'Slender';
    
    const webClass = webRatio <= 84 * epsilonFlange ? 'Plastic' :
                   webRatio <= 105 * epsilonFlange ? 'Compact' :
                   webRatio <= 126 * epsilonFlange ? 'Semi-compact' : 'Slender';

    // Moment capacity (assuming plastic/compact section)
    const Zpx = sect.Zxx * 1.12; // Approximate plastic modulus
    const Md = (Zpx * fy / gamma_m0) / 1000; // kN-m

    // Shear capacity
    const Av = sect.depth * sect.tw; // Shear area for I-section
    const Vd = (Av * (fy / Math.sqrt(3))) / (gamma_m0 * 1000); // kN

    // Axial capacity (compression)
    const slendernessX = (formData.effectiveLength / sect.rxx);
    const slendernessY = (formData.effectiveLength / sect.ryy);
    const slenderness = Math.max(slendernessX, slendernessY);
    const lambda_nondim = slenderness * Math.sqrt(fy / (Math.PI * Math.PI * 200000));
    
    // Buckling reduction factor (IS 800 method)
    const alpha = 0.34; // Imperfection factor for rolled sections
    const phi = 0.5 * (1 + alpha * (lambda_nondim - 0.2) + lambda_nondim * lambda_nondim);
    const chi = 1 / (phi + Math.sqrt(phi * phi - lambda_nondim * lambda_nondim));
    const Pd = (chi * sect.area * fy / gamma_m0) / 1000; // kN

    // Interaction check
    const P_ratio = formData.axialForce / Pd;
    const M_ratio = formData.momentX / Md;
    const V_ratio = formData.shearX / Vd;
    const interactionRatio = P_ratio + M_ratio + 0.5 * V_ratio;

    const designResult = {
      status: interactionRatio <= 1.0 ? 'safe' : 'unsafe',
      section: sect,
      classification: {
        flange: flangeClass,
        web: webClass,
        overall: flangeClass === 'Slender' || webClass === 'Slender' ? 'Slender' : 
                 flangeClass === 'Semi-compact' || webClass === 'Semi-compact' ? 'Semi-compact' :
                 flangeClass === 'Compact' || webClass === 'Compact' ? 'Compact' : 'Plastic',
      },
      slenderness: {
        x: slendernessX.toFixed(1),
        y: slendernessY.toFixed(1),
        governing: slenderness.toFixed(1),
        nonDimensional: lambda_nondim.toFixed(2),
      },
      capacity: {
        moment: { design: Md.toFixed(1), applied: formData.momentX, utilization: (M_ratio * 100).toFixed(1) },
        shear: { design: Vd.toFixed(1), applied: formData.shearX, utilization: (V_ratio * 100).toFixed(1) },
        axial: { design: Pd.toFixed(1), applied: formData.axialForce, utilization: (P_ratio * 100).toFixed(1) },
      },
      interaction: {
        ratio: (interactionRatio * 100).toFixed(1),
        status: interactionRatio <= 1.0 ? 'OK' : 'FAIL',
      },
      deflection: {
        maxAllowed: (formData.length / 300).toFixed(1),
        calculated: ((5 * formData.momentX * formData.length * formData.length) / (384 * 200000 * sect.Ixx / 1e4) * 1000).toFixed(2),
        status: 'OK',
      },
    };

    setResult(designResult);
    setActiveTab('results');
    setIsCalculating(false);
  }, [formData, selectedSection]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-blue-100 dark:via-blue-950 to-slate-50 dark:to-slate-900">
      {/* Header */}
      <header className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                <Ruler className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Steel Member Designer</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Beams, columns, tension & compression members</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl p-1">
              {(['input', 'results', 'drawing'] as const).map((tab) => (
                <button type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Input Form */}
              <div className="lg:col-span-2 space-y-4">
                {/* Member Type */}
                <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Member Type</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {(['beam', 'column', 'tension', 'strut'] as MemberType[]).map((type) => (
                      <button type="button"
                        key={type}
                        onClick={() => handleChange('memberType', type)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.memberType === type
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className={`w-12 h-12 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                          formData.memberType === type ? 'bg-blue-500/20' : 'bg-slate-200 dark:bg-slate-700'
                        }`}>
                          {type === 'beam' && <Minus className="w-6 h-6 text-blue-400" />}
                          {type === 'column' && <Maximize2 className="w-6 h-6 text-blue-400 rotate-90" />}
                          {type === 'tension' && <ArrowRight className="w-6 h-6 text-blue-400" />}
                          {type === 'strut' && <RotateCw className="w-6 h-6 text-blue-400" />}
                        </div>
                        <p className={`text-sm font-medium text-center ${
                          formData.memberType === type ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section Selection */}
                <CollapsibleSection
                  title="Section Properties"
                  expanded={expandedSections.section}
                  onToggle={() => toggleSection('section')}
                  accentColor="blue"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Section Type</label>
                        <select
                          value={formData.sectionType}
                          onChange={(e) => handleChange('sectionType', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="I-section">I-Section (ISMB)</option>
                          <option value="channel">Channel (ISMC)</option>
                          <option value="angle">Angle (ISA)</option>
                          <option value="tube">Rectangular Tube</option>
                          <option value="pipe">Circular Pipe</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Section</label>
                        <select
                          value={formData.section}
                          onChange={(e) => handleChange('section', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                        >
                          {INDIAN_SECTIONS.map((s) => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Section properties display */}
                    <div className="grid grid-cols-4 gap-3 p-4 bg-slate-700/30 rounded-xl">
                      <PropertyCard label="Area" value={selectedSection.area} unit="mm²" />
                      <PropertyCard label="Ixx" value={selectedSection.Ixx.toFixed(0)} unit="cm⁴" />
                      <PropertyCard label="Iyy" value={selectedSection.Iyy.toFixed(0)} unit="cm⁴" />
                      <PropertyCard label="Zxx" value={selectedSection.Zxx.toFixed(1)} unit="cm³" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Member Length"
                        value={formData.length}
                        onChange={(v) => handleChange('length', v)}
                        unit="mm"
                        accentColor="blue"
                      />
                      <InputField
                        label="Effective Length Factor (K)"
                        value={formData.kx}
                        onChange={(v) => handleChange('kx', v)}
                        unit=""
                        accentColor="blue"
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Loads */}
                <CollapsibleSection
                  title="Applied Loads"
                  expanded={expandedSections.loads}
                  onToggle={() => toggleSection('loads')}
                  accentColor="blue"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <InputField
                      label="Axial Force (P)"
                      value={formData.axialForce}
                      onChange={(v) => handleChange('axialForce', v)}
                      unit="kN"
                      accentColor="blue"
                    />
                    <InputField
                      label="Moment X (Mx)"
                      value={formData.momentX}
                      onChange={(v) => handleChange('momentX', v)}
                      unit="kN-m"
                      accentColor="blue"
                    />
                    <InputField
                      label="Moment Y (My)"
                      value={formData.momentY}
                      onChange={(v) => handleChange('momentY', v)}
                      unit="kN-m"
                      accentColor="blue"
                    />
                    <InputField
                      label="Shear X (Vx)"
                      value={formData.shearX}
                      onChange={(v) => handleChange('shearX', v)}
                      unit="kN"
                      accentColor="blue"
                    />
                    <InputField
                      label="Shear Y (Vy)"
                      value={formData.shearY}
                      onChange={(v) => handleChange('shearY', v)}
                      unit="kN"
                      accentColor="blue"
                    />
                  </div>
                </CollapsibleSection>

                {/* Material */}
                <CollapsibleSection
                  title="Material Properties"
                  expanded={expandedSections.material}
                  onToggle={() => toggleSection('material')}
                  accentColor="blue"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Steel Grade</label>
                      <select
                        value={formData.steelGrade}
                        onChange={(e) => handleChange('steelGrade', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                      >
                        {STEEL_GRADES.map((g) => (
                          <option key={g.grade} value={g.grade}>{g.grade}</option>
                        ))}
                      </select>
                    </div>
                    <InputField
                      label="Yield Strength (fy)"
                      value={formData.fy}
                      onChange={(v) => handleChange('fy', v)}
                      unit="MPa"
                      accentColor="blue"
                    />
                    <InputField
                      label="Ultimate Strength (fu)"
                      value={formData.fu}
                      onChange={(v) => handleChange('fu', v)}
                      unit="MPa"
                      accentColor="blue"
                    />
                  </div>
                </CollapsibleSection>

                {/* Design Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runDesign}
                  disabled={isCalculating}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl text-white font-semibold text-lg shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Designing...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Design Member
                    </>
                  )}
                </motion.button>
              </div>

              {/* Preview Panel */}
              <div className="space-y-4">
                <SectionPreview section={selectedSection} />
                <MemberSummary formData={formData} section={selectedSection} />
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SteelResultsPanel result={result} />
            </motion.div>
          )}

          {activeTab === 'drawing' && result && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SteelDrawing formData={formData} result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function CollapsibleSection({ 
  title, 
  expanded, 
  onToggle, 
  children,
  accentColor = 'blue',
}: { 
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accentColor?: 'blue' | 'emerald';
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      <button type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  unit,
  accentColor = 'blue',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  accentColor?: 'blue' | 'emerald';
}) {
  const ringColor = accentColor === 'blue' ? 'focus:ring-blue-500/50' : 'focus:ring-emerald-500/50';
  
  return (
    <div>
      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full px-3 py-2 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg text-slate-900 dark:text-white pr-12 focus:outline-none focus:ring-2 ${ringColor}`}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function PropertyCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold text-blue-400">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{unit}</p>
    </div>
  );
}

function SectionPreview({ section }: { section: SteelSection }) {
  const svgWidth = 300;
  const svgHeight = 250;
  const scale = 0.5;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  
  const d = section.depth * scale;
  const bf = section.width * scale;
  const tf = section.tf * scale;
  const tw = section.tw * scale;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{section.name}</h3>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full bg-slate-50/50 dark:bg-slate-900/50 rounded-xl">
        {/* Grid */}
        <defs>
          <pattern id="grid-steel" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-steel)" />
        
        {/* I-Section */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          {/* Top flange */}
          <rect x={-bf/2} y={-d/2} width={bf} height={tf} fill="#3b82f6" stroke="#60a5fa" strokeWidth="1" />
          {/* Web */}
          <rect x={-tw/2} y={-d/2 + tf} width={tw} height={d - 2*tf} fill="#3b82f6" stroke="#60a5fa" strokeWidth="1" />
          {/* Bottom flange */}
          <rect x={-bf/2} y={d/2 - tf} width={bf} height={tf} fill="#3b82f6" stroke="#60a5fa" strokeWidth="1" />
        </g>
        
        {/* Dimensions */}
        <g className="fill-blue-400 text-xs">
          <text x={centerX} y={centerY + d/2 + 30} textAnchor="middle">
            bf = {section.width} mm
          </text>
          <text x={centerX + bf/2 + 30} y={centerY} textAnchor="middle" transform={`rotate(90, ${centerX + bf/2 + 30}, ${centerY})`}>
            d = {section.depth} mm
          </text>
        </g>
      </svg>
    </div>
  );
}

function MemberSummary({ formData, section }: { formData: SteelFormData; section: SteelSection }) {
  const slendernessX = formData.effectiveLength / section.rxx;
  const slendernessY = formData.effectiveLength / section.ryy;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Effective Length</span>
          <span className="text-slate-900 dark:text-white font-medium">{formData.effectiveLength} mm</span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Slenderness (λx)</span>
          <span className="text-slate-900 dark:text-white font-medium">{slendernessX.toFixed(1)}</span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Slenderness (λy)</span>
          <span className="text-slate-900 dark:text-white font-medium">{slendernessY.toFixed(1)}</span>
        </div>
        <div className={`flex justify-between p-3 rounded-lg border ${
          slendernessY <= 180 
            ? 'bg-blue-500/10 border-blue-500/30' 
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <span className={slendernessY <= 180 ? 'text-blue-300' : 'text-yellow-300'}>Slenderness Check</span>
          <span className={`font-bold ${slendernessY <= 180 ? 'text-blue-300' : 'text-yellow-300'}`}>
            {slendernessY <= 180 ? 'OK' : 'High'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SteelResultsPanel({ result }: { result: any }) {
  const isDesignOk = result.status === 'safe';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Card */}
      <div className={`col-span-1 lg:col-span-3 p-6 rounded-2xl ${
        isDesignOk
          ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30'
          : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30'
      }`}>
        <div className="flex items-center gap-4">
          {isDesignOk ? (
            <CheckCircle className="w-12 h-12 text-blue-400" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-red-400" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isDesignOk ? 'Design OK' : 'Design Needs Revision'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {result.section.name} - {result.classification.overall} section
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Interaction Ratio</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{result.interaction.ratio}%</p>
          </div>
        </div>
      </div>

      {/* Section Classification */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Section Classification</h3>
        <div className="space-y-2">
          <ResultRow label="Flange" value={result.classification.flange} />
          <ResultRow label="Web" value={result.classification.web} />
          <ResultRow label="Overall" value={result.classification.overall} status={result.classification.overall !== 'Slender' ? 'safe' : 'warning'} />
        </div>
      </div>

      {/* Slenderness */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Slenderness</h3>
        <div className="space-y-2">
          <ResultRow label="λx" value={result.slenderness.x} />
          <ResultRow label="λy" value={result.slenderness.y} />
          <ResultRow label="Governing" value={result.slenderness.governing} />
          <ResultRow label="Non-dimensional (λ̄)" value={result.slenderness.nonDimensional} />
        </div>
      </div>

      {/* Capacity Checks */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Capacity Checks</h3>
        <div className="space-y-2">
          <ResultRow 
            label="Moment" 
            value={`${result.capacity.moment.utilization}%`}
            status={parseFloat(result.capacity.moment.utilization) <= 100 ? 'safe' : 'unsafe'}
          />
          <ResultRow 
            label="Shear" 
            value={`${result.capacity.shear.utilization}%`}
            status={parseFloat(result.capacity.shear.utilization) <= 100 ? 'safe' : 'unsafe'}
          />
          <ResultRow 
            label="Axial" 
            value={`${result.capacity.axial.utilization}%`}
            status={parseFloat(result.capacity.axial.utilization) <= 100 ? 'safe' : 'unsafe'}
          />
        </div>
      </div>

      {/* Detailed Capacities */}
      <div className="col-span-1 lg:col-span-3 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Detailed Capacities</h3>
        <div className="grid grid-cols-3 gap-6">
          <CapacityCard
            title="Moment Capacity"
            design={result.capacity.moment.design}
            applied={result.capacity.moment.applied}
            unit="kN-m"
            utilization={parseFloat(result.capacity.moment.utilization)}
          />
          <CapacityCard
            title="Shear Capacity"
            design={result.capacity.shear.design}
            applied={result.capacity.shear.applied}
            unit="kN"
            utilization={parseFloat(result.capacity.shear.utilization)}
          />
          <CapacityCard
            title="Axial Capacity"
            design={result.capacity.axial.design}
            applied={result.capacity.axial.applied}
            unit="kN"
            utilization={parseFloat(result.capacity.axial.utilization)}
          />
        </div>
      </div>

      {/* Export Buttons */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-900 dark:text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Drawing
        </motion.button>
      </div>
    </div>
  );
}

function ResultRow({ 
  label, 
  value, 
  status 
}: { 
  label: string; 
  value: string;
  status?: 'safe' | 'unsafe' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm">{label}</span>
      <span className={`font-medium ${
        status === 'safe' ? 'text-blue-400' : 
        status === 'unsafe' ? 'text-red-400' : 
        status === 'warning' ? 'text-yellow-400' :
        'text-slate-900 dark:text-white'
      }`}>
        {value}
      </span>
    </div>
  );
}

function CapacityCard({
  title,
  design,
  applied,
  unit,
  utilization,
}: {
  title: string;
  design: string;
  applied: number;
  unit: string;
  utilization: number;
}) {
  return (
    <div className="p-4 bg-slate-700/30 rounded-xl">
      <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">{title}</h4>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Applied</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{applied} {unit}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Design</p>
          <p className="text-xl font-bold text-blue-400">{design} {unit}</p>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            utilization <= 80 ? 'bg-blue-500' :
            utilization <= 100 ? 'bg-yellow-500' :
            'bg-red-500'
          }`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">{utilization}% utilized</p>
    </div>
  );
}

function SteelDrawing({ formData, result }: { formData: SteelFormData; result: any }) {
  const section = result.section;
  
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Member Drawing</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cross Section */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4">
          <h4 className="text-lg font-semibold text-blue-400 mb-4">Cross Section</h4>
          <svg viewBox="0 0 400 350" className="w-full h-80">
            <defs>
              <pattern id="steel-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#3b82f6" strokeWidth="1" />
              </pattern>
            </defs>
            
            {/* Grid */}
            <rect width="100%" height="100%" fill="#0f172a" />
            
            <g transform="translate(200, 175)">
              {/* I-Section with hatch */}
              <rect x={-section.width * 0.4} y={-section.depth * 0.4} 
                    width={section.width * 0.8} height={section.tf * 0.8} 
                    fill="url(#steel-hatch)" stroke="#60a5fa" strokeWidth="2" />
              <rect x={-section.tw * 0.4} y={-section.depth * 0.4 + section.tf * 0.8} 
                    width={section.tw * 0.8} height={(section.depth - 2 * section.tf) * 0.8} 
                    fill="url(#steel-hatch)" stroke="#60a5fa" strokeWidth="2" />
              <rect x={-section.width * 0.4} y={section.depth * 0.4 - section.tf * 0.8} 
                    width={section.width * 0.8} height={section.tf * 0.8} 
                    fill="url(#steel-hatch)" stroke="#60a5fa" strokeWidth="2" />
              
              {/* Dimension lines */}
              <line x1={-section.width * 0.4} y1={section.depth * 0.4 + 20} 
                    x2={section.width * 0.4} y2={section.depth * 0.4 + 20} 
                    stroke="#f59e0b" strokeWidth="1" markerEnd="url(#arrowhead)" markerStart="url(#arrowhead)" />
              <text x="0" y={section.depth * 0.4 + 40} textAnchor="middle" className="fill-yellow-400 text-xs">
                bf = {section.width}
              </text>
              
              <line x1={section.width * 0.4 + 20} y1={-section.depth * 0.4} 
                    x2={section.width * 0.4 + 20} y2={section.depth * 0.4} 
                    stroke="#f59e0b" strokeWidth="1" />
              <text x={section.width * 0.4 + 40} y="0" textAnchor="middle" className="fill-yellow-400 text-xs" transform={`rotate(90, ${section.width * 0.4 + 40}, 0)`}>
                d = {section.depth}
              </text>
            </g>
          </svg>
        </div>
        
        {/* Elevation */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4">
          <h4 className="text-lg font-semibold text-blue-400 mb-4">Elevation</h4>
          <svg viewBox="0 0 400 350" className="w-full h-80">
            <rect width="100%" height="100%" fill="#0f172a" />
            
            {/* Member outline */}
            <rect x="50" y="100" width="300" height={section.depth * 0.4} 
                  fill="none" stroke="#60a5fa" strokeWidth="2" />
            
            {/* Flanges */}
            <rect x="50" y="100" width="300" height={section.tf * 0.4} fill="#3b82f6" opacity="0.5" />
            <rect x="50" y={100 + section.depth * 0.4 - section.tf * 0.4} width="300" height={section.tf * 0.4} fill="#3b82f6" opacity="0.5" />
            
            {/* Supports */}
            <polygon points="40,200 60,200 50,220" fill="#94a3b8" />
            <polygon points="340,200 360,200 350,220" fill="#94a3b8" />
            
            {/* Length dimension */}
            <line x1="50" y1="250" x2="350" y2="250" stroke="#f59e0b" strokeWidth="1" />
            <text x="200" y="270" textAnchor="middle" className="fill-yellow-400 text-xs">
              L = {formData.length} mm
            </text>
            
            {/* Section name */}
            <text x="200" y={100 + section.depth * 0.2} textAnchor="middle" className="fill-white text-sm font-bold">
              {section.name}
            </text>
          </svg>
        </div>
      </div>
      
      {/* Section Properties Table */}
      <div className="mt-6 p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl">
        <h4 className="text-lg font-semibold text-blue-400 mb-4">Section Properties</h4>
        <div className="grid grid-cols-6 gap-4">
          <PropertyTableCell label="Area" value={section.area} unit="mm²" />
          <PropertyTableCell label="Ixx" value={section.Ixx} unit="cm⁴" />
          <PropertyTableCell label="Iyy" value={section.Iyy} unit="cm⁴" />
          <PropertyTableCell label="Zxx" value={section.Zxx} unit="cm³" />
          <PropertyTableCell label="rxx" value={section.rxx} unit="mm" />
          <PropertyTableCell label="ryy" value={section.ryy} unit="mm" />
        </div>
      </div>
    </div>
  );
}

function PropertyTableCell({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="text-center p-3 bg-slate-700/30 rounded-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{unit}</p>
    </div>
  );
}
