/**
 * Development Length Panel
 * Interactive UI for bar development length calculations
 */


import React, { useState, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import * as Separator from '@radix-ui/react-separator';
import * as Switch from '@radix-ui/react-switch';
import { 
  ChevronDown, 
  Check, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Calculator,
  FileText,
  Table,
  Ruler
} from 'lucide-react';

import { 
  DevelopmentLengthCalculator,
  developmentLengthCalculator 
} from '../calculators/DevelopmentLengthCalculator';
import {
  ConcreteDesignCode,
  HookType,
  BarCoating,
  SeismicCategory,
  MemberType,
  DevelopmentLengthInput,
  DevelopmentLengthResult,
  createConcreteProperties,
  createRebarProperties,
  US_BAR_DATA,
  METRIC_BAR_DATA,
  BarDimensionTable,
  RebarGrade
} from '../types/ReinforcementTypes';

// Extended result type for UI display (backwards compat with component expectations)
type ExtendedDevelopmentLengthResult = DevelopmentLengthResult & {
  developmentType?: string;
  straightDevelopment?: number;
  hookDevelopment?: number;
  hookGeometry?: { bendRadius: number; extension: number };
  modificationFactors?: Record<string, number | string>;
  equation?: string;
  recommendations?: string[];
};

// ============================================================================
// Component
// ============================================================================

export function DevelopmentLengthPanel() {
  // Form state
  const [designCode, setDesignCode] = useState<ConcreteDesignCode>(ConcreteDesignCode.ACI_318_19);
  const [developmentType, setDevelopmentType] = useState<'tension' | 'compression'>('tension');
  const [hookType, setHookType] = useState<HookType | ''>('');
  const [coating, setCoating] = useState<BarCoating>(BarCoating.UNCOATED);
  const [isTopBar, setIsTopBar] = useState(false);
  
  // Material inputs
  const [fc, setFc] = useState<number>(4000);
  const [fy, setFy] = useState<number>(60000);
  
  // Geometry inputs
  const [selectedBarSize, setSelectedBarSize] = useState<string>('#6');
  const [clearCover, setClearCover] = useState<number>(1.5);
  const [barSpacing, setBarSpacing] = useState<number>(6);
  
  // Result
  const [result, setResult] = useState<ExtendedDevelopmentLengthResult | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [tableData, setTableData] = useState<Array<{
    barSize: string;
    diameter: number;
    tensionLd: number;
    compressionLd: number;
    hookLd: number;
  }> | null>(null);
  
  // Determine if using metric
  const isMetric = designCode === ConcreteDesignCode.EUROCODE_2 || 
                   designCode === ConcreteDesignCode.IS_456_2000;
  
  // Bar data
  const barData = useMemo((): BarDimensionTable | undefined => {
    const data = isMetric ? METRIC_BAR_DATA : US_BAR_DATA;
    return data.find(bar => bar.size === selectedBarSize);
  }, [selectedBarSize, isMetric]);
  
  // Bar size options
  const barSizeOptions = isMetric 
    ? METRIC_BAR_DATA.map(b => b.size)
    : US_BAR_DATA.map(b => b.size);

  // Handle calculation
  const handleCalculate = () => {
    if (!barData) return;
    
    const rebarProps = createRebarProperties(selectedBarSize, isMetric ? RebarGrade.FE_500 : RebarGrade.GRADE_60, coating);
    if (!rebarProps) return;
    
    const input: DevelopmentLengthInput = {
      designCode,
      bar: rebarProps,
      concrete: createConcreteProperties(fc, 'NORMAL'),
      barLocation: isTopBar ? 'TOP' : 'BOTTOM',
      coating,
      cover: clearCover,
      clearSpacing: barSpacing,
      stressType: developmentType === 'tension' ? 'TENSION' : 'COMPRESSION',
      hookType: hookType as HookType || undefined,
      memberType: MemberType.BEAM
    };
    
    const calcResult = developmentLengthCalculator.calculate(input);
    setResult(calcResult as ExtendedDevelopmentLengthResult);
  };
  
  // Generate full table
  const handleGenerateTable = () => {
    const data = developmentLengthCalculator.getBarSchedule(
      designCode,
      fc,
      fy,
      isMetric ? clearCover : clearCover
    );
    setTableData(data);
    setShowTable(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-[#0b1326] rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Ruler className="w-8 h-8 text-green-600" />
        <div>
          <h2 className="text-2xl font-bold text-[#dae2fd]">
            Development Length Calculator
          </h2>
          <p className="text-sm text-[#869ab8]">
            Bar anchorage and hook development per ACI 318, EC2, IS 456
          </p>
        </div>
      </div>
      
      <Tabs.Root defaultValue="input" className="w-full">
        <Tabs.List className="flex border-b border-[#1a2333] mb-6">
          <Tabs.Trigger 
            value="input"
            className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                       data-[state=active]:text-green-600 data-[state=active]:border-green-600"
          >
            <Calculator className="w-4 h-4 inline mr-2" />
            Input
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="results"
            className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                       data-[state=active]:text-green-600 data-[state=active]:border-green-600"
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Results
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="table"
            className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                       data-[state=active]:text-green-600 data-[state=active]:border-green-600"
          >
            <Table className="w-4 h-4 inline mr-2" />
            Quick Reference
          </Tabs.Trigger>
        </Tabs.List>
        
        {/* Input Tab */}
        <Tabs.Content value="input" className="space-y-6">
          {/* Design Code and Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Design Code
              </Label.Root>
              <Select.Root value={designCode} onValueChange={(v) => setDesignCode(v as ConcreteDesignCode)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-[#131b2e] text-[#dae2fd]">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-[#131b2e] border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(ConcreteDesignCode).map((code) => (
                        <Select.Item key={code} value={code}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                     rounded text-[#dae2fd] flex items-center gap-2">
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
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Development Type
              </Label.Root>
              <Select.Root value={developmentType} onValueChange={(v) => setDevelopmentType(v as 'tension' | 'compression')}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-[#131b2e] text-[#dae2fd]">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-[#131b2e] border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      <Select.Item value="tension" className="px-3 py-2 cursor-pointer hover:bg-slate-100 
                                   dark:hover:bg-slate-700 rounded text-[#dae2fd]">
                        <Select.ItemText>Tension</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="compression" className="px-3 py-2 cursor-pointer hover:bg-slate-100 
                                   dark:hover:bg-slate-700 rounded text-[#dae2fd]">
                        <Select.ItemText>Compression</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Hook Type (Optional)
              </Label.Root>
              <Select.Root value={hookType} onValueChange={(v) => setHookType(v as HookType | '')}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-[#131b2e] text-[#dae2fd]">
                  <Select.Value placeholder="None (Straight)" />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-[#131b2e] border border-slate-200 
                                             dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      <Select.Item value="" className="px-3 py-2 cursor-pointer hover:bg-slate-100 
                                   dark:hover:bg-slate-700 rounded text-[#dae2fd]">
                        <Select.ItemText>None (Straight)</Select.ItemText>
                      </Select.Item>
                      {Object.values(HookType).map((type) => (
                        <Select.Item key={type} value={type}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                     rounded text-[#dae2fd] flex items-center gap-2">
                          <Select.ItemText>{type}</Select.ItemText>
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
            <h3 className="text-lg font-semibold text-[#dae2fd] mb-3">
              Material Properties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  f'c ({isMetric ? 'MPa' : 'psi'})
                </Label.Root>
                <input
                  type="number"
                  value={fc}
                  onChange={(e) => setFc(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-[#131b2e] text-[#dae2fd]"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  fy ({isMetric ? 'MPa' : 'psi'})
                </Label.Root>
                <input
                  type="number"
                  value={fy}
                  onChange={(e) => setFy(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-[#131b2e] text-[#dae2fd]"
                />
              </div>
            </div>
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Bar Selection and Geometry */}
          <div>
            <h3 className="text-lg font-semibold text-[#dae2fd] mb-3">
              Bar Selection & Geometry
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  Bar Size
                </Label.Root>
                <Select.Root value={selectedBarSize} onValueChange={setSelectedBarSize}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                             border border-slate-300 dark:border-slate-600 rounded-lg
                                             bg-[#131b2e] text-[#dae2fd]">
                    <Select.Value />
                    <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-[#131b2e] border border-slate-200 
                                               dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      <Select.Viewport className="p-1">
                        {barSizeOptions.map((size) => (
                          <Select.Item key={size} value={size}
                            className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                       rounded text-[#dae2fd] flex items-center gap-2">
                            <Select.ItemText>{size}</Select.ItemText>
                            <Select.ItemIndicator><Check className="w-4 h-4" /></Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  Clear Cover ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  step="0.1"
                  value={clearCover}
                  onChange={(e) => setClearCover(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-[#131b2e] text-[#dae2fd]"
                />
              </div>
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  Bar Spacing ({isMetric ? 'mm' : 'in'})
                </Label.Root>
                <input
                  type="number"
                  step="0.5"
                  value={barSpacing}
                  onChange={(e) => setBarSpacing(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-[#131b2e] text-[#dae2fd]"
                />
              </div>
            </div>
            
            {barData && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <Info className="w-4 h-4 inline mr-1" />
                  {selectedBarSize}: Diameter = {isMetric ? barData.diameter_mm : barData.diameter_in}{isMetric ? 'mm' : '"'}, 
                  Area = {(isMetric ? barData.area_mm2 : barData.area_in2).toFixed(isMetric ? 1 : 3)}{isMetric ? 'mm²' : 'in²'}
                </p>
              </div>
            )}
          </div>
          
          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Modification Factors */}
          <div>
            <h3 className="text-lg font-semibold text-[#dae2fd] mb-3">
              Modification Factors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                  Bar Coating
                </Label.Root>
                <Select.Root value={coating} onValueChange={(v) => setCoating(v as BarCoating)}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                             border border-slate-300 dark:border-slate-600 rounded-lg
                                             bg-[#131b2e] text-[#dae2fd]">
                    <Select.Value />
                    <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-[#131b2e] border border-slate-200 
                                               dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {Object.values(BarCoating).map((type) => (
                          <Select.Item key={type} value={type}
                            className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700
                                       rounded text-[#dae2fd]">
                            <Select.ItemText>{type}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch.Root
                  checked={isTopBar}
                  onCheckedChange={setIsTopBar}
                  className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative
                             data-[state=checked]:bg-green-600 transition-colors"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow transition-transform
                                          translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
                <Label.Root className="text-sm text-[#adc6ff]">
                  Top Bar (More than 12" of concrete below)
                </Label.Root>
              </div>
            </div>
          </div>
          
          {/* Calculate Button */}
          <button type="button"
            onClick={handleCalculate}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium tracking-wide 
                       rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate Development Length
          </button>
        </Tabs.Content>
        
        {/* Results Tab */}
        <Tabs.Content value="results" className="space-y-6">
          {result ? (
            <>
              {/* Primary Result */}
              <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-[#1a2333] rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                    {result.developmentType === 'tension' ? 'Tension' : 'Compression'} Development Length
                  </p>
                  <p className="text-4xl font-bold text-green-900 dark:text-green-100">
                    {(result.straightDevelopment ?? result.requiredLength ?? 0).toFixed(isMetric ? 0 : 1)}
                  </p>
                  <p className="text-lg text-green-700 dark:text-green-300">
                    {isMetric ? 'mm' : 'inches'}
                  </p>
                </div>
              </div>
              
              {/* Hook Development (if applicable) */}
              {result.hookDevelopment && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                    Hook Development
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">ldh (Hook Development)</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {result.hookDevelopment.toFixed(isMetric ? 0 : 1)}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{isMetric ? 'mm' : 'in'}</p>
                    </div>
                    {result.hookGeometry && (
                      <>
                        <div>
                          <p className="text-sm text-blue-600 dark:text-blue-400">Bend Radius</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {result.hookGeometry.bendRadius.toFixed(isMetric ? 0 : 2)}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{isMetric ? 'mm' : 'in'}</p>
                        </div>
                      </>
                    )}
                  </div>
                  {result.hookGeometry && (
                    <p className="mt-3 text-sm text-blue-700 dark:text-blue-300">
                      Hook extension: {result.hookGeometry.extension.toFixed(isMetric ? 0 : 2)} {isMetric ? 'mm' : 'in'}
                    </p>
                  )}
                </div>
              )}
              
              {/* Modification Factors */}
              {result.modificationFactors && (
                <div className="p-4 bg-[#131b2e] rounded-lg">
                  <h4 className="font-semibold text-[#dae2fd] mb-3">
                    Modification Factors Applied
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(result.modificationFactors).map(([key, value]) => (
                      <div key={key} className="flex justify-between p-2 bg-white dark:bg-slate-700 rounded">
                        <span className="text-[#869ab8]">{key}</span>
                        <span className="font-mono text-[#dae2fd]">
                          {typeof value === 'number' ? value.toFixed(3) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Equation */}
              {result.equation && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Governing Equation
                  </h4>
                  <p className="text-sm font-mono text-yellow-700 dark:text-yellow-300">
                    {result.equation}
                  </p>
                </div>
              )}
              
              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Ruler className="w-16 h-16 mx-auto text-[#869ab8] mb-4" />
              <p className="text-[#869ab8]">
                Enter parameters and click Calculate to see development length
              </p>
            </div>
          )}
        </Tabs.Content>
        
        {/* Quick Reference Table Tab */}
        <Tabs.Content value="table" className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#869ab8]">
              Development lengths for all bar sizes (f'c = {fc} {isMetric ? 'MPa' : 'psi'}, fy = {fy} {isMetric ? 'MPa' : 'psi'})
            </p>
            <button type="button"
              onClick={handleGenerateTable}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium tracking-wide 
                         rounded-lg transition-colors flex items-center gap-2"
            >
              <Table className="w-4 h-4" />
              Generate Table
            </button>
          </div>
          
          {tableData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#131b2e]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[#dae2fd]">Bar Size</th>
                    <th className="px-4 py-3 text-left font-semibold text-[#dae2fd]">Diameter</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Tension ld</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Compression ldc</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Hook ldh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {tableData.map((row) => (
                    <tr key={row.barSize} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3 font-medium tracking-wide text-[#dae2fd]">{row.barSize}</td>
                      <td className="px-4 py-3 text-[#869ab8]">
                        {row.diameter.toFixed(isMetric ? 0 : 3)} {isMetric ? 'mm' : '"'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#dae2fd]">
                        {row.tensionLd} {isMetric ? 'mm' : '"'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#dae2fd]">
                        {row.compressionLd} {isMetric ? 'mm' : '"'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                        {row.hookLd} {isMetric ? 'mm' : '"'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
              <Table className="w-12 h-12 mx-auto text-[#869ab8] mb-3" />
              <p className="text-[#869ab8]">
                Click "Generate Table" to create a quick reference chart
              </p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default DevelopmentLengthPanel;
