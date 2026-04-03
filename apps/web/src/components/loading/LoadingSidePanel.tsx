import React, { useState, useMemo, useCallback } from 'react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { 
  Building2, 
  Wind, 
  Activity, 
  Snowflake, 
  ArrowDown, 
  AlertCircle,
  Download,
  Settings2,
  ListPlus,
  Play,
  ChevronRight,
  Calculator,
  CheckCircle2,
  MousePointer2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// ============================================
// TYPES
// ============================================

type LoadCategory = 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'special';
type DesignCode = 'IS_875' | 'ASCE_7' | 'EC1' | 'CUSTOM';

const LOAD_CATEGORIES: { id: LoadCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'dead', label: 'Dead Load', icon: <Building2 className="w-4 h-4" />, color: 'bg-slate-600' },
  { id: 'live', label: 'Live Load', icon: <ArrowDown className="w-4 h-4" />, color: 'bg-blue-600' },
  { id: 'wind', label: 'Wind Load', icon: <Wind className="w-4 h-4" />, color: 'bg-cyan-600' },
  { id: 'seismic', label: 'Seismic Load', icon: <Activity className="w-4 h-4" />, color: 'bg-orange-600' },
];

const DESIGN_CODES: { id: DesignCode; name: string; region: string }[] = [
  { id: 'IS_875', name: 'IS 875 / IS 1893', region: 'India' },
  { id: 'ASCE_7', name: 'ASCE 7-22', region: 'USA' },
  { id: 'CUSTOM', name: 'Custom Values', region: 'User Defined' },
];

const LIVE_LOAD_VALUES = {
  'Residential (2.0 kPa)': 2.0,
  'Office (2.5 kPa)': 2.5,
  'Assembly (4.0 kPa)': 4.0,
  'Storage (5.0 kPa)': 5.0,
  'Parking (2.5 kPa)': 2.5,
};

// ============================================
// PANEL COMPONENT
// ============================================

export const LoadingSidePanel: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1 State
  const [selectedCategory, setSelectedCategory] = useState<LoadCategory>('live');
  const [selectedCode, setSelectedCode] = useState<DesignCode>('IS_875');

  // Step 2 State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedValue, setGeneratedValue] = useState<number | null>(null);
  const [formulaUsed, setFormulaUsed] = useState<string | null>(null);
  
  // Param states for Generation
  const [occupancyRule, setOccupancyRule] = useState<string>('Office (2.5 kPa)');
  const [windSpeed, setWindSpeed] = useState<number>(39.0);
  const [seismicZone, setSeismicZone] = useState<number>(3);
  
  // Workspace state
  const { selectedIds, addMemberLoad, members, setStoreTool } = useModelStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      addMemberLoad: s.addMemberLoad,
      members: s.members,
      setStoreTool: s.setTool
    }))
  );

  const selectedMembers = useMemo(() => 
    Array.from(selectedIds)
      .map(id => members.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m),
    [selectedIds, members]
  );

  // ─── ACTIONS ───

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedValue(null);
    setFormulaUsed(null);

    // Simulate API call to backend Python auto_loads.py
    await new Promise(r => setTimeout(r, 600));

    if (selectedCode === 'CUSTOM') {
      setGeneratedValue(10);
      setFormulaUsed('Custom user-defined uniform load');
    } else if (selectedCategory === 'live') {
      const val = LIVE_LOAD_VALUES[occupancyRule as keyof typeof LIVE_LOAD_VALUES] || 2.5;
      setGeneratedValue(val);
      setFormulaUsed(`IS 875 (Part 2) Table 1: Occupancy category uniform parameter mapping`);
    } else if (selectedCategory === 'wind') {
      // Dummy math for IS 875 Part 3
      const Vb = windSpeed;
      const Vz = Vb * 1.0 * 1.0 * 1.0;
      const Pz = 0.6 * (Vz * Vz);
      setGeneratedValue(Number((Pz / 1000).toFixed(2))); // N/m² -> kN/m²
      setFormulaUsed(`IS 875 (Part 3) Cl. 6.2: Vz = Vb(k1·k2·k3). Cl. 7.2: Pz = 0.6Vz²`);
    } else if (selectedCategory === 'seismic') {
      // Dummy math for IS 1893
      const Z = [0.10, 0.16, 0.24, 0.36][seismicZone - 2] || 0.16;
      const I = 1.0;
      const R = 5.0; // SMRF
      const Ah = (Z / 2) * (I / R) * 2.5; // Assuming Sa/g = 2.5 for short period
      setGeneratedValue(Number(Ah.toFixed(3)));
      setFormulaUsed(`IS 1893 (Part 1) Cl. 6.4.2: Ah = (Z/2)·(I/R)·(Sa/g). Using Z curve = ${Z}, R = ${R}, I = ${I}`);
    }

    setIsGenerating(false);
    setStep(3);
  };

  const handleAssign = () => {
    if (generatedValue === null || selectedMembers.length === 0) return;

    selectedMembers.forEach(m => {
      addMemberLoad({
        id: crypto.randomUUID(),
        memberId: m.id,
        type: 'UDL',
        w1: -generatedValue,
        w2: -generatedValue,
        direction: selectedCategory === 'wind' || selectedCategory === 'seismic' ? 'global_x' : 'global_y',
        startPos: 0,
        endPos: 1,
        loadCaseId: selectedCategory.toUpperCase()
      });
    });

    // Option to reset after assignment
    setStep(1);
    setStoreTool('select');
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-slate-900/95 border-r border-[#1a2333] shadow-lg animate-in fade-in slide-in-from-left-4">
      {/* Header */}
      <div className="p-4 border-b border-[#1a2333]/60 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-500" />
          Load Wizard
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Code-compliant load generation & assignment.
        </p>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-[#1a2333]/60 flex gap-2 shrink-0 bg-slate-50 dark:bg-slate-800/30">
        {[1, 2, 3].map((s) => (
          <div 
            key={s}
            className={cn(
              "flex-1 h-1.5 rounded-full transition-all duration-300",
              s < step ? "bg-cyan-500" : 
              s === step ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
            )}
          />
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 eng-scroll flex flex-col gap-6">
        
        {/* STEP 1: Code & Category */}
        <div className={cn("transition-opacity duration-300", step !== 1 && "opacity-40 pointer-events-none")}>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300">1</span>
            Selection
          </h3>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Design Code</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {DESIGN_CODES.map(code => (
                  <button type="button"
                    key={code.id}
                    onClick={() => { setSelectedCode(code.id); setStep(1); }}
                    className={cn(
                      "px-3 py-2 rounded-md border text-left text-xs transition-all flex items-center justify-between",
                      selectedCode === code.id 
                        ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500/50 text-cyan-700 dark:text-cyan-400 font-medium"
                        : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                    )}
                  >
                    <span>{code.name}</span>
                    <span className="text-[10px] text-slate-400">{code.region}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Load Category</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {LOAD_CATEGORIES.map(cat => (
                  <button type="button"
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setStep(2); }}
                    className={cn(
                      "px-3 py-2 rounded-md border text-left text-xs transition-all flex flex-col gap-1.5",
                      selectedCategory === cat.id 
                        ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400 font-medium"
                        : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                    )}
                  >
                    <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white", cat.color)}>
                      {cat.icon}
                    </div>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: Generation */}
        {(step === 2 || step === 3) && (
          <div className={cn("transition-opacity duration-300", step !== 2 && "opacity-40 pointer-events-none")}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300">2</span>
              Generation parameters
            </h3>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-3 mb-3">
              {selectedCategory === 'live' && (
                <div>
                  <Label className="text-xs mb-1 block">Occupancy Type</Label>
                  <select 
                    value={occupancyRule}
                    onChange={e => setOccupancyRule(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500"
                  >
                    {Object.keys(LIVE_LOAD_VALUES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCategory === 'wind' && (
                <div>
                  <Label className="text-xs mb-1 block">Basic Wind Speed Vb (m/s)</Label>
                  <Input 
                    type="number" 
                    value={windSpeed} 
                    onChange={e => setWindSpeed(Number(e.target.value))} 
                    className="h-8 text-xs" 
                  />
                  <div className="mt-1 flex gap-2 text-[10px] text-slate-400">
                    <span>Delhi: 47</span> | <span>Mumbai: 44</span> | <span>Chennai: 44</span>
                  </div>
                </div>
              )}

              {selectedCategory === 'seismic' && (
                <div>
                  <Label className="text-xs mb-1 block">Seismic Zone</Label>
                  <select 
                    value={seismicZone}
                    onChange={e => setSeismicZone(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={2}>Zone II (0.10)</option>
                    <option value={3}>Zone III (0.16)</option>
                    <option value={4}>Zone IV (0.24)</option>
                    <option value={5}>Zone V (0.36)</option>
                  </select>
                </div>
              )}

              {selectedCategory === 'dead' && (
                <div className="text-xs text-slate-500">
                  Dead load is auto-calculated entirely by the Rust DSM solver during analysis phase. You can apply additional line loads directly as custom.
                </div>
              )}
            </div>

            <Button 
              size="sm" 
              className="w-full h-8 text-xs bg-[#4d8eff] hover:bg-[#3b72cc] text-white shadow-md shadow-blue-500/20"
              onClick={handleGenerate}
              disabled={isGenerating || selectedCategory === 'dead'}
            >
              {isGenerating ? (
                <>
                  <Calculator className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5 mr-1.5" />
                  Generate Force Vectors
                </>
              )}
            </Button>

            {generatedValue !== null && formulaUsed && step >= 2 && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                    Generated Result
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedCategory === 'seismic' ? `Ah = ${generatedValue}g` : `${generatedValue} kN/m²`}
                </div>
                <div className="mt-2 text-[9px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed bg-white/50 dark:bg-slate-900/50 p-1.5 rounded">
                  {formulaUsed}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Assignment */}
        {step === 3 && (
          <div className="transition-opacity duration-300">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300">3</span>
              Assignment
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <MousePointer2 className="w-4 h-4 shrink-0 text-slate-400" />
                <p>Select application targets (members) in the 2D orthographic canvas.</p>
              </div>

              <div className={cn(
                "p-2.5 rounded border transition-colors",
                selectedMembers.length > 0 
                  ? "bg-green-50 dark:bg-green-500/10 border-green-500/30" 
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              )}>
                <div className="flex items-center justify-between text-xs">
                  <span className={selectedMembers.length > 0 ? "text-green-700 dark:text-green-400 font-medium" : "text-slate-500"}>
                    {selectedMembers.length} Members Selected
                  </span>
                  {selectedMembers.length === 0 && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setStoreTool('select')}>
                      Enable Box Select
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Button 
              size="sm" 
              className="w-full mt-3 h-8 text-xs bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white focus:ring-slate-500"
              disabled={selectedMembers.length === 0 || generatedValue === null}
              onClick={handleAssign}
            >
              Assign Generated Loads
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
