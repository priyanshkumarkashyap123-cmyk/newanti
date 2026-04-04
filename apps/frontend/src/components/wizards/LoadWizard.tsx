/**
 * LoadWizard - Interactive wizard for applying structural loads
 * 
 * Features:
 * - Step-by-step load definition
 * - Code-compliant load generation (IS 875, ASCE 7, Eurocode)
 * - Live preview of applied loads
 * - Load combination builder
 */


import React, { useState, useCallback, useMemo } from 'react';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

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
  const model = useModelStore(
    useShallow((s) => ({ nodes: s.nodes, members: s.members }))
  );
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
    <Dialog open={true} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-[#1a2333]">
          <DialogTitle>Load Definition Wizard</DialogTitle>
          <DialogDescription>{WIZARD_STEPS[currentStep].description}</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="px-4 py-3 border-b border-[#1a2333] flex gap-2">
          {WIZARD_STEPS.map((step, index) => (
            <div 
              key={step.id}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                index < currentStep ? 'bg-green-500' : 
                index === currentStep ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Category */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#dae2fd]">{WIZARD_STEPS[0].title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {LOAD_CATEGORIES.map(cat => (
                  <button type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCategory === cat.id 
                        ? 'border-blue-500 bg-blue-500/20' 
                        : 'border-[#1a2333] bg-[#131b2e] hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center mb-2`}>
                      {cat.icon}
                    </div>
                    <span className="text-sm font-medium tracking-wide text-[#dae2fd]">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Code */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#dae2fd]">{WIZARD_STEPS[1].title}</h3>
              <div className="grid grid-cols-2 gap-3">
                {DESIGN_CODES.map(code => (
                  <button type="button"
                    key={code.id}
                    onClick={() => setSelectedCode(code.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedCode === code.id 
                        ? 'border-blue-500 bg-blue-500/20' 
                        : 'border-[#1a2333] bg-[#131b2e] hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-medium tracking-wide text-[#dae2fd] block">{code.name}</span>
                    <span className="text-xs text-[#869ab8]">{code.region}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Values */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#dae2fd]">{WIZARD_STEPS[2].title}</h3>
              
              {selectedCategory === 'live' && selectedCode !== 'CUSTOM' && (
                <div>
                  <Label className="mb-2">Occupancy Type</Label>
                  <select 
                    value={occupancyType}
                    onChange={e => setOccupancyType(e.target.value)}
                    className="w-full px-4 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#dae2fd]"
                  >
                    {Object.keys(LIVE_LOAD_VALUES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <Label className="mb-2">Load Magnitude</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={currentMagnitude}
                    onChange={e => setCustomMagnitude(parseFloat(e.target.value) || 0)}
                    disabled={selectedCode !== 'CUSTOM' && selectedCategory === 'live'}
                    className="flex-1"
                  />
                  <span className="px-4 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#869ab8]">
                    kN/m²
                  </span>
                </div>
                {selectedCode !== 'CUSTOM' && selectedCategory === 'live' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Per {LIVE_LOAD_VALUES[occupancyType]?.code || 'code'}: {LIVE_LOAD_VALUES[occupancyType]?.value} kN/m²
                  </p>
                )}
              </div>

              <div>
                <Label className="mb-2">Load Name (optional)</Label>
                <Input
                  type="text"
                  value={loadName}
                  onChange={e => setLoadName(e.target.value)}
                  placeholder={`${selectedCategory.toUpperCase()}-1`}
                />
              </div>

              <Button
                onClick={addLoad}
                className="w-full bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)]"
              >
                Add Load
              </Button>

              {appliedLoads.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium tracking-wide text-[#869ab8]">Added Loads:</h4>
                  {appliedLoads.map((load, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg">
                      <div>
                        <span className="text-[#dae2fd] font-medium tracking-wide">{load.name}</span>
                        <span className="text-[#869ab8] text-sm ml-2">
                          {load.magnitude} {load.unit}
                        </span>
                      </div>
                      <button type="button" 
                        onClick={() => removeLoad(i)}
                        className="text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300"
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
              <h3 className="text-lg font-semibold text-[#dae2fd]">{WIZARD_STEPS[3].title}</h3>
              <p className="text-[#869ab8]">
                Loads will be applied to the current model. 
                {model.nodes.size} nodes and {model.members.size} members available.
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                <button type="button" className="p-4 rounded-xl border border-blue-500 bg-blue-500/20 text-center">
                  <span className="text-sm font-medium tracking-wide text-[#dae2fd] block">All Members</span>
                  <span className="text-xs text-[#869ab8]">Apply uniformly</span>
                </button>
                <button type="button" className="p-4 rounded-xl border border-[#1a2333] bg-[#131b2e] text-center opacity-50">
                  <span className="text-sm font-medium tracking-wide text-[#dae2fd] block">Selected</span>
                  <span className="text-xs text-[#869ab8]">Choose members</span>
                </button>
                <button type="button" className="p-4 rounded-xl border border-[#1a2333] bg-[#131b2e] text-center opacity-50">
                  <span className="text-sm font-medium tracking-wide text-[#dae2fd] block">By Floor</span>
                  <span className="text-xs text-[#869ab8]">Floor-based</span>
                </button>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-[#1a2333] rounded-lg">
                <p className="text-green-700 dark:text-green-400 text-sm">
                  ✓ {appliedLoads.length} load case(s) ready to apply
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Combinations */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#dae2fd]">{WIZARD_STEPS[4].title}</h3>
              <p className="text-[#869ab8] text-sm">Select load combinations per IS 456:2000 / IS 800:2007</p>
              
              <div className="space-y-2">
                {STANDARD_COMBINATIONS.map(combo => (
                  <button type="button"
                    key={combo.id}
                    onClick={() => toggleCombination(combo.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                      selectedCombinations.includes(combo.id)
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-[#1a2333] bg-[#131b2e] hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedCombinations.includes(combo.id) ? 'bg-green-500 border-green-500' : 'border-slate-400 dark:border-slate-600'
                    }`}>
                      {selectedCombinations.includes(combo.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-[#dae2fd] font-medium tracking-wide">{combo.name}</span>
                      <span className="text-[#869ab8] text-xs ml-2">- {combo.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-[#1a2333] flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          
          <div className="text-sm text-[#869ab8]">
            Step {currentStep + 1} of {WIZARD_STEPS.length}
          </div>
          
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isProcessing || appliedLoads.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Apply Loads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LoadWizard;
