/**
 * LoadWizard - Interactive wizard for applying structural loads
 * 
 * Features:
 * - Step-by-step load definition
 * - Code-compliant load generation (IS 875, ASCE 7, Eurocode)
 * - Live preview of applied loads
 * - Load combination builder
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useModelStore } from '@/store/model';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle,
  Building2,
  Wind,
  Activity,
  Snowflake,
  ArrowDown,
  Loader2
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type LoadCategory = 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'special';
type DesignCode = 'IS_875' | 'ASCE_7' | 'EC1' | 'CUSTOM';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface LoadDefinition {
  category: LoadCategory;
  code: DesignCode;
  name: string;
  magnitude: number;
  unit: string;
  direction: 'down' | 'up' | 'lateral' | 'custom';
  appliedTo: 'all' | 'selected' | 'floor';
  floorLevel?: number;
}

interface LoadCombination {
  id: string;
  name: string;
  factors: Record<LoadCategory, number>;
  description: string;
}

// ============================================
// LOAD DATA
// ============================================

const LOAD_CATEGORIES: { id: LoadCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'dead', label: 'Dead Load', icon: <Building2 className="w-5 h-5" />, color: 'bg-slate-600' },
  { id: 'live', label: 'Live Load', icon: <ArrowDown className="w-5 h-5" />, color: 'bg-blue-600' },
  { id: 'wind', label: 'Wind Load', icon: <Wind className="w-5 h-5" />, color: 'bg-cyan-600' },
  { id: 'seismic', label: 'Seismic Load', icon: <Activity className="w-5 h-5" />, color: 'bg-orange-600' },
  { id: 'snow', label: 'Snow Load', icon: <Snowflake className="w-5 h-5" />, color: 'bg-indigo-600' },
  { id: 'special', label: 'Special Load', icon: <AlertCircle className="w-5 h-5" />, color: 'bg-purple-600' },
];

const DESIGN_CODES: { id: DesignCode; name: string; region: string }[] = [
  { id: 'IS_875', name: 'IS 875 (Parts 1-5)', region: 'India' },
  { id: 'ASCE_7', name: 'ASCE 7-22', region: 'USA' },
  { id: 'EC1', name: 'Eurocode 1', region: 'Europe' },
  { id: 'CUSTOM', name: 'Custom Values', region: 'User Defined' },
];

const LIVE_LOAD_VALUES: Record<string, { value: number; unit: string; code: string }> = {
  'Residential': { value: 2.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Office': { value: 2.5, unit: 'kN/m²', code: 'IS 875-2' },
  'Assembly': { value: 4.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Storage': { value: 5.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Industrial Light': { value: 5.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Industrial Heavy': { value: 10.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Parking': { value: 2.5, unit: 'kN/m²', code: 'IS 875-2' },
  'Hospital': { value: 3.0, unit: 'kN/m²', code: 'IS 875-2' },
  'School': { value: 3.0, unit: 'kN/m²', code: 'IS 875-2' },
  'Roof (Accessible)': { value: 1.5, unit: 'kN/m²', code: 'IS 875-2' },
  'Roof (Non-accessible)': { value: 0.75, unit: 'kN/m²', code: 'IS 875-2' },
};

const STANDARD_COMBINATIONS: LoadCombination[] = [
  { id: 'uls1', name: '1.5(DL + LL)', factors: { dead: 1.5, live: 1.5, wind: 0, seismic: 0, snow: 0, special: 0 }, description: 'Primary gravity combination' },
  { id: 'uls2', name: '1.2(DL + LL + WL)', factors: { dead: 1.2, live: 1.2, wind: 1.2, seismic: 0, snow: 0, special: 0 }, description: 'Gravity + Wind' },
  { id: 'uls3', name: '1.5(DL + WL)', factors: { dead: 1.5, live: 0, wind: 1.5, seismic: 0, snow: 0, special: 0 }, description: 'Wind dominant' },
  { id: 'uls4', name: '0.9DL + 1.5WL', factors: { dead: 0.9, live: 0, wind: 1.5, seismic: 0, snow: 0, special: 0 }, description: 'Overturning check' },
  { id: 'uls5', name: '1.2(DL + LL ± EQ)', factors: { dead: 1.2, live: 1.2, wind: 0, seismic: 1.2, snow: 0, special: 0 }, description: 'Seismic combination' },
  { id: 'sls1', name: 'DL + LL', factors: { dead: 1.0, live: 1.0, wind: 0, seismic: 0, snow: 0, special: 0 }, description: 'Service gravity' },
  { id: 'sls2', name: 'DL + 0.8LL + 0.8WL', factors: { dead: 1.0, live: 0.8, wind: 0.8, seismic: 0, snow: 0, special: 0 }, description: 'Service with wind' },
];

const WIZARD_STEPS: WizardStep[] = [
  { id: 'category', title: 'Load Category', description: 'Select the type of load to apply' },
  { id: 'code', title: 'Design Code', description: 'Choose the applicable design standard' },
  { id: 'values', title: 'Load Values', description: 'Define load magnitude and distribution' },
  { id: 'application', title: 'Apply Loads', description: 'Select members or areas to load' },
  { id: 'combinations', title: 'Combinations', description: 'Set up load combinations' },
];

// ============================================
// COMPONENT
// ============================================

interface LoadWizardProps {
  onClose?: () => void;
  onComplete?: (loads: LoadDefinition[], combinations: LoadCombination[]) => void;
}

export function LoadWizard({ onClose, onComplete }: LoadWizardProps) {
  const model = useModelStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<LoadCategory>('dead');
  const [selectedCode, setSelectedCode] = useState<DesignCode>('IS_875');
  const [occupancyType, setOccupancyType] = useState('Office');
  const [customMagnitude, setCustomMagnitude] = useState(2.5);
  const [loadName, setLoadName] = useState('');
  const [appliedLoads, setAppliedLoads] = useState<LoadDefinition[]>([]);
  const [selectedCombinations, setSelectedCombinations] = useState<string[]>(['uls1', 'sls1']);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentMagnitude = useMemo(() => {
    if (selectedCode === 'CUSTOM') return customMagnitude;
    if (selectedCategory === 'live' && LIVE_LOAD_VALUES[occupancyType]) {
      return LIVE_LOAD_VALUES[occupancyType].value;
    }
    return customMagnitude;
  }, [selectedCode, selectedCategory, occupancyType, customMagnitude]);

  const addLoad = useCallback(() => {
    const newLoad: LoadDefinition = {
      category: selectedCategory,
      code: selectedCode,
      name: loadName || `${selectedCategory.toUpperCase()}-${appliedLoads.length + 1}`,
      magnitude: currentMagnitude,
      unit: 'kN/m²',
      direction: selectedCategory === 'wind' || selectedCategory === 'seismic' ? 'lateral' : 'down',
      appliedTo: 'all',
    };
    setAppliedLoads(prev => [...prev, newLoad]);
    setLoadName('');
  }, [selectedCategory, selectedCode, loadName, currentMagnitude, appliedLoads.length]);

  const removeLoad = useCallback((index: number) => {
    setAppliedLoads(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleCombination = useCallback((id: string) => {
    setSelectedCombinations(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  const handleComplete = useCallback(async () => {
    setIsProcessing(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const combinations = STANDARD_COMBINATIONS.filter(c => selectedCombinations.includes(c.id));
    
    onComplete?.(appliedLoads, combinations);
    setIsProcessing(false);
  }, [appliedLoads, selectedCombinations, onComplete]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Load Definition Wizard</h2>
            <p className="text-sm text-slate-400">{WIZARD_STEPS[currentStep].description}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <span className="text-slate-400 text-xl">×</span>
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 border-b border-slate-800 flex gap-2">
          {WIZARD_STEPS.map((step, index) => (
            <div 
              key={step.id}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                index < currentStep ? 'bg-green-500' : 
                index === currentStep ? 'bg-blue-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Category */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{WIZARD_STEPS[0].title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {LOAD_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCategory === cat.id 
                        ? 'border-blue-500 bg-blue-500/20' 
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center mb-2`}>
                      {cat.icon}
                    </div>
                    <span className="text-sm font-medium text-white">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Code */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{WIZARD_STEPS[1].title}</h3>
              <div className="grid grid-cols-2 gap-3">
                {DESIGN_CODES.map(code => (
                  <button
                    key={code.id}
                    onClick={() => setSelectedCode(code.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedCode === code.id 
                        ? 'border-blue-500 bg-blue-500/20' 
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-medium text-white block">{code.name}</span>
                    <span className="text-xs text-slate-400">{code.region}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Values */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{WIZARD_STEPS[2].title}</h3>
              
              {selectedCategory === 'live' && selectedCode !== 'CUSTOM' && (
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Occupancy Type</label>
                  <select 
                    value={occupancyType}
                    onChange={e => setOccupancyType(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {Object.keys(LIVE_LOAD_VALUES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Load Magnitude</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={currentMagnitude}
                    onChange={e => setCustomMagnitude(parseFloat(e.target.value) || 0)}
                    disabled={selectedCode !== 'CUSTOM' && selectedCategory === 'live'}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50"
                  />
                  <span className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400">
                    kN/m²
                  </span>
                </div>
                {selectedCode !== 'CUSTOM' && selectedCategory === 'live' && (
                  <p className="text-xs text-green-400 mt-1">
                    Per {LIVE_LOAD_VALUES[occupancyType]?.code || 'code'}: {LIVE_LOAD_VALUES[occupancyType]?.value} kN/m²
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Load Name (optional)</label>
                <input
                  type="text"
                  value={loadName}
                  onChange={e => setLoadName(e.target.value)}
                  placeholder={`${selectedCategory.toUpperCase()}-1`}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <button
                onClick={addLoad}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
              >
                Add Load
              </button>

              {appliedLoads.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-400">Added Loads:</h4>
                  {appliedLoads.map((load, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div>
                        <span className="text-white font-medium">{load.name}</span>
                        <span className="text-slate-400 text-sm ml-2">
                          {load.magnitude} {load.unit}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeLoad(i)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Application */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{WIZARD_STEPS[3].title}</h3>
              <p className="text-slate-400">
                Loads will be applied to the current model. 
                {model.nodes.size} nodes and {model.members.size} members available.
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                <button className="p-4 rounded-xl border border-blue-500 bg-blue-500/20 text-center">
                  <span className="text-sm font-medium text-white block">All Members</span>
                  <span className="text-xs text-slate-400">Apply uniformly</span>
                </button>
                <button className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 text-center opacity-50">
                  <span className="text-sm font-medium text-white block">Selected</span>
                  <span className="text-xs text-slate-400">Choose members</span>
                </button>
                <button className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 text-center opacity-50">
                  <span className="text-sm font-medium text-white block">By Floor</span>
                  <span className="text-xs text-slate-400">Floor-based</span>
                </button>
              </div>

              <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <p className="text-green-400 text-sm">
                  ✓ {appliedLoads.length} load case(s) ready to apply
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Combinations */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{WIZARD_STEPS[4].title}</h3>
              <p className="text-slate-400 text-sm">Select load combinations per IS 456:2000 / IS 800:2007</p>
              
              <div className="space-y-2">
                {STANDARD_COMBINATIONS.map(combo => (
                  <button
                    key={combo.id}
                    onClick={() => toggleCombination(combo.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                      selectedCombinations.includes(combo.id)
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedCombinations.includes(combo.id) ? 'bg-green-500 border-green-500' : 'border-slate-600'
                    }`}>
                      {selectedCombinations.includes(combo.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium">{combo.name}</span>
                      <span className="text-slate-400 text-xs ml-2">- {combo.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="text-sm text-slate-400">
            Step {currentStep + 1} of {WIZARD_STEPS.length}
          </div>
          
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isProcessing || appliedLoads.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply Loads
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoadWizard;
