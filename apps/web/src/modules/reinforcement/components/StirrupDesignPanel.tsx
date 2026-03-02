/**
 * Stirrup Design Panel
 * Interactive UI for shear reinforcement design
 */


import React, { useState, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import * as Separator from '@radix-ui/react-separator';
import { 
  ChevronDown, 
  Check, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Calculator,
  FileText,
  Settings
} from 'lucide-react';

import { 
  StirrupDesignCalculator,
  stirrupCalculator 
} from '../calculators/StirrupDesignCalculator';
import {
  ConcreteDesignCode,
  RebarGrade,
  USBarSize,
  MetricBarSize,
  StirrupType,
  MemberType,
  SeismicCategory,
  BarCoating,
  ShearDesignInput,
  StirrupDesignResult,
  getBarData,
  US_BAR_DATA,
  METRIC_BAR_DATA
} from '../types/ReinforcementTypes';

// ============================================================================
// Component
// ============================================================================

export function StirrupDesignPanel() {
  // Form state
  const [designCode, setDesignCode] = useState<ConcreteDesignCode>(ConcreteDesignCode.ACI_318_19);
  const [memberType, setMemberType] = useState<MemberType>(MemberType.BEAM);
  const [seismicCategory, setSeismicCategory] = useState<SeismicCategory>(SeismicCategory.SDC_B);
  const [stirrupType, setStirrupType] = useState<StirrupType>(StirrupType.TWO_LEGGED);
  
  // Material inputs
  const [fc, setFc] = useState<number>(4000); // psi or MPa
  const [fy, setFy] = useState<number>(60000); // psi or MPa
  const [fyt, setFyt] = useState<number>(60000); // Stirrup yield strength
  
  // Geometry inputs
  const [width, setWidth] = useState<number>(12); // inches or mm
  const [depth, setDepth] = useState<number>(24); // inches or mm
  const [effectiveDepth, setEffectiveDepth] = useState<number>(21.5);
  const [clearCover, setClearCover] = useState<number>(1.5);
  
  // Load inputs
  const [Vu, setVu] = useState<number>(50); // kips or kN
  const [Mu, setMu] = useState<number>(100); // kip-ft or kN-m
  const [Nu, setNu] = useState<number>(0); // axial load
  
  // Stirrup selection
  const [selectedBarSize, setSelectedBarSize] = useState<string>('#4');
  
  // Calculation result
  const [result, setResult] = useState<StirrupDesignResult | null>(null);
  
  // Determine if using metric
  const isMetric = designCode === ConcreteDesignCode.EUROCODE_2 || 
                   designCode === ConcreteDesignCode.IS_456_2000;
  
  // Get bar data for selected size
  const barData = useMemo(() => {
    const data = isMetric ? METRIC_BAR_DATA : US_BAR_DATA;
    return data.find(bar => bar.size === selectedBarSize);
  }, [selectedBarSize, isMetric]);
  
  // Calculate stirrup area
  const stirrupArea = useMemo(() => {
    if (!barData) return 0;
    const numLegs = stirrupType === StirrupType.TWO_LEGGED ? 2 : 
                    stirrupType === StirrupType.FOUR_LEGGED ? 4 : 6;
    const area = isMetric ? barData.area_mm2 : barData.area_in2;
    return area * numLegs;
  }, [barData, stirrupType, isMetric]);

  // Handle calculation
  const handleCalculate = () => {
    if (!barData) return;
    
    const input: ShearDesignInput = {
      factoredShear: Vu,
      factoredAxial: Nu,
      webWidth: width,
      effectiveDepth: effectiveDepth,
      totalDepth: depth,
      concrete: {
        compressiveStrength: fc,
        grade: `C${fc}`,
        elasticModulus: 4700 * Math.sqrt(fc),
        tensileStrength: 0.62 * Math.sqrt(fc),
        density: 2400,
        aggregateType: isMetric ? 'NORMAL' : 'NORMAL',
        maxAggregateSize: 20,
        unitSystem: isMetric ? 'SI' : 'IMPERIAL'
      },
      stirrupBar: {
        size: selectedBarSize,
        diameter: isMetric ? barData.diameter_mm : barData.diameter_in,
        area: isMetric ? barData.area_mm2 : barData.area_in2,
        perimeter: barData.perimeter_mm,
        unitWeight: isMetric ? barData.weight_kg_m : barData.weight_lb_ft,
        grade: RebarGrade.GRADE_60,
        yieldStrength: fyt,
        ultimateStrength: fyt * 1.25,
        elasticModulus: 200000,
        coating: BarCoating.UNCOATED
      },
      designCode,
      memberType,
      seismicCategory,
      cover: clearCover
    };
    
    const calcResult = stirrupCalculator.design(input);
    setResult(calcResult);
  };
  
  // Bar size options
  const barSizeOptions = isMetric 
    ? Object.keys(METRIC_BAR_DATA).filter(k => ['D8', 'D10', 'D12', 'D16'].includes(k))
    : Object.keys(US_BAR_DATA).filter(k => ['#3', '#4', '#5', '#6'].includes(k));

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Stirrup Design Calculator
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Shear reinforcement design per ACI 318, EC2, IS 456
          </p>
        </div>
      </div>
      
      <Tabs.Root defaultValue="input" className="w-full">
        <Tabs.List className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          <Tabs.Trigger 
            value="input"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white border-b-2 border-transparent
                       data-[state=active]:text-blue-600 data-[state=active]:border-blue-600"
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Input
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="results"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white border-b-2 border-transparent
                       data-[state=active]:text-blue-600 data-[state=active]:border-blue-600"
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Results
          </Tabs.Trigger>
        </Tabs.List>
        
        {/* Input Tab */}
        <Tabs.Content value="input" className="space-y-6">
          {/* Design Code Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Design Code
              </Label.Root>
              <Select.Root value={designCode} onValueChange={(v) => setDesignCode(v as ConcreteDesignCode)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(ConcreteDesignCode).map((code) => (
                        <Select.Item key={code} value={code}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                     rounded text-slate-900 dark:text-white flex items-center gap-2">
                          <Select.ItemText>{code}</Select.ItemText>
                          <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Member Type
              </Label.Root>
              <Select.Root value={memberType} onValueChange={(v) => setMemberType(v as MemberType)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(MemberType).map((type) => (
                        <Select.Item key={type} value={type}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                     rounded text-slate-900 dark:text-white flex items-center gap-2">
                          <Select.ItemText>{type}</Select.ItemText>
                          <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Seismic Category
              </Label.Root>
              <Select.Root value={seismicCategory} onValueChange={(v) => setSeismicCategory(v as SeismicCategory)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(SeismicCategory).map((cat) => (
                        <Select.Item key={cat} value={cat}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                     rounded text-slate-900 dark:text-white flex items-center gap-2">
                          <Select.ItemText>{cat}</Select.ItemText>
                          <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Material Properties */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Material Properties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  f'c ({isMetric ? 'MPa' : 'psi'})
                </Label.Root>
                <input
                  type="number"
                  value={fc}
                  onChange={(e) => setFc(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  fy (Longitudinal) ({isMetric ? 'MPa' : 'psi'})
                </Label.Root>
                <input
                  type="number"
                  value={fy}
                  onChange={(e) => setFy(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  fyt (Stirrup) ({isMetric ? 'MPa' : 'psi'})
                </Label.Root>
                <input
                  type="number"
                  value={fyt}
                  onChange={(e) => setFyt(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Section Geometry */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Section Geometry
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Width ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total Depth ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Effective d ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  value={effectiveDepth}
                  onChange={(e) => setEffectiveDepth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cover ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  step="0.1"
                  value={clearCover}
                  onChange={(e) => setClearCover(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Applied Loads */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Applied Loads (Factored)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vu ({isMetric ? 'kN' : 'kips'})
                </Label.Root>
                <input
                  type="number"
                  value={Vu}
                  onChange={(e) => setVu(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mu ({isMetric ? 'kN-m' : 'kip-ft'})
                </Label.Root>
                <input
                  type="number"
                  value={Mu}
                  onChange={(e) => setMu(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nu ({isMetric ? 'kN' : 'kips'})
                </Label.Root>
                <input
                  type="number"
                  value={Nu}
                  onChange={(e) => setNu(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Stirrup Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Stirrup Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Stirrup Type
                </Label.Root>
                <Select.Root value={stirrupType} onValueChange={(v) => setStirrupType(v as StirrupType)}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                             border border-slate-300 dark:border-slate-600 rounded-lg
                                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    <Select.Value />
                    <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 
                                               dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {Object.values(StirrupType).map((type) => (
                          <Select.Item key={type} value={type}
                            className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                       rounded text-slate-900 dark:text-white flex items-center gap-2">
                            <Select.ItemText>{type}</Select.ItemText>
                            <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              
              <div>
                <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bar Size
                </Label.Root>
                <Select.Root value={selectedBarSize} onValueChange={setSelectedBarSize}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                             border border-slate-300 dark:border-slate-600 rounded-lg
                                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    <Select.Value />
                    <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 
                                               dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {barSizeOptions.map((size) => (
                          <Select.Item key={size} value={size}
                            className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                       rounded text-slate-900 dark:text-white flex items-center gap-2">
                            <Select.ItemText>{size}</Select.ItemText>
                            <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>
            
            {barData && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 inline mr-1" />
                  Selected: {selectedBarSize} - Diameter: {isMetric ? barData.diameter_mm : barData.diameter_in}{isMetric ? 'mm' : '"'}, 
                  Area per leg: {(isMetric ? barData.area_mm2 : barData.area_in2).toFixed(isMetric ? 1 : 3)}{isMetric ? 'mm²' : 'in²'},
                  Total Av: {stirrupArea.toFixed(isMetric ? 1 : 3)}{isMetric ? 'mm²' : 'in²'}
                </p>
              </div>
            )}
          </div>
          
          {/* Calculate Button */}
          <button type="button"
            onClick={handleCalculate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium 
                       rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate Stirrup Design
          </button>
        </Tabs.Content>
        
        {/* Results Tab */}
        <Tabs.Content value="results" className="space-y-6">
          {result ? (
            <>
              {/* Status Banner */}
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                result.isAdequate 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {result.isAdequate ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <h3 className={`font-semibold ${result.isAdequate ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {result.isAdequate ? 'Design is Adequate' : 'Design is NOT Adequate'}
                  </h3>
                  <p className={`text-sm ${result.isAdequate ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Utilization: {(result.utilization * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              
              {/* Capacity Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Shear Capacity</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Vc (Concrete)</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.concreteCapacity.toFixed(2)} {isMetric ? 'kN' : 'kips'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Vs (Steel)</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.requiredSteelCapacity.toFixed(2)} {isMetric ? 'kN' : 'kips'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">φVn (Design)</span>
                      <span className="font-mono text-slate-900 dark:text-white font-semibold">
                        {result.totalCapacity.toFixed(2)} {isMetric ? 'kN' : 'kips'}
                      </span>
                    </div>
                    <Separator.Root className="h-px bg-slate-300 dark:bg-slate-600 my-2" />
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Vu (Applied)</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {Vu.toFixed(2)} {isMetric ? 'kN' : 'kips'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Stirrup Design</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Bar Size</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.stirrupConfig.barSize}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Number of Legs</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.stirrupConfig.legs}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Av Provided</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.providedAvs.toFixed(isMetric ? 1 : 3)} {isMetric ? 'mm²' : 'in²'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Av Minimum</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {result.requiredAvs.toFixed(isMetric ? 1 : 3)} {isMetric ? 'mm²' : 'in²'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Spacing Results */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  Spacing Requirements
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Required</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {result.stirrupConfig.spacing.toFixed(0)}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{isMetric ? 'mm' : 'in'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Maximum</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {result.stirrupConfig.maxSpacing.toFixed(0)}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{isMetric ? 'mm' : 'in'}</p>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-800 rounded-lg p-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">Provided</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {result.stirrupConfig.spacing}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">{isMetric ? 'mm' : 'in'}</p>
                  </div>
                </div>
              </div>
              
              {/* Stirrup Regions */}
              {result.regions && result.regions.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Stirrup Regions
                  </h4>
                  <div className="space-y-2">
                    {result.regions.map((region, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white dark:bg-slate-700 rounded">
                        <span className="text-slate-600 dark:text-slate-400">
                          {region.type}: {region.startPosition.toFixed(0)} - {region.endPosition.toFixed(0)} {isMetric ? 'mm' : 'in'}
                        </span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {region.count} @ {region.spacing.toFixed(0)} {isMetric ? 'mm' : 'in'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Warnings
                  </h4>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Calculator className="w-16 h-16 mx-auto text-slate-500 dark:text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                Enter design parameters and click Calculate to see results
              </p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default StirrupDesignPanel;
