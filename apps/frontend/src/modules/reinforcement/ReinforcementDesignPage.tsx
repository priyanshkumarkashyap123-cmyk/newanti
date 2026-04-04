/**
 * Reinforcement Design Page
 * Comprehensive RC detailing tools - Stirrups, Development Length, Lap Splices
 */


import React, { useState, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import * as Switch from '@radix-ui/react-switch';
import { 
  GitBranch, 
  Ruler, 
  Link2, 
  ArrowLeftRight,
  BookOpen,
  HelpCircle,
  ChevronDown,
  Info,
  Calculator,
  FileText,
  Table
} from 'lucide-react';

import { StirrupDesignPanel } from './components/StirrupDesignPanel';
import { DevelopmentLengthPanel } from './components/DevelopmentLengthPanel';
import { 
  lapSpliceCalculator 
} from './calculators/LapSpliceCalculator';
import {
  ConcreteDesignCode,
  BarCoating,
  LapSpliceClass,
  LapSpliceInput,
  LapSpliceResult,
  MemberType,
  US_BAR_DATA,
  METRIC_BAR_DATA
} from './types/ReinforcementTypes';

// ============================================================================
// Main Page Component
// ============================================================================

export function ReinforcementDesignPage() {
  const [activeTab, setActiveTab] = useState('stirrups');

  return (
    <div className="min-h-screen bg-[#0b1326]">
      {/* Header */}
      <header className="bg-[#0b1326] border-b border-[#1a2333]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                <GitBranch className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#dae2fd]">
                  Reinforcement Design
                </h1>
                <p className="text-sm text-[#869ab8]">
                  RC Detailing Tools • ACI 318 • Eurocode 2 • IS 456
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <BookOpen className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-[#0b1326] border-b border-[#1a2333]">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex gap-1 -mb-px">
              <Tabs.Trigger 
                value="stirrups"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-[#dae2fd]
                           data-[state=active]:text-orange-600 data-[state=active]:border-orange-600"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Stirrup Design
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="development"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-[#dae2fd]
                           data-[state=active]:text-orange-600 data-[state=active]:border-orange-600"
              >
                <Ruler className="w-4 h-4" />
                Development Length
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="lapsplice"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-[#dae2fd]
                           data-[state=active]:text-orange-600 data-[state=active]:border-orange-600"
              >
                <Link2 className="w-4 h-4" />
                Lap Splices
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          {/* Stirrup Design Tab */}
          <Tabs.Content value="stirrups" className="focus:outline-none">
            <StirrupDesignPanel />
          </Tabs.Content>

          {/* Development Length Tab */}
          <Tabs.Content value="development" className="focus:outline-none">
            <DevelopmentLengthPanel />
          </Tabs.Content>

          {/* Lap Splice Tab */}
          <Tabs.Content value="lapsplice" className="focus:outline-none">
            <LapSplicePanel />
          </Tabs.Content>
        </Tabs.Root>
      </main>

      {/* Footer */}
      <footer className="bg-[#0b1326] border-t border-[#1a2333] mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-[#869ab8]">
            <p>© {new Date().getFullYear()} Structural Engineering Suite. Professional use only.</p>
            <div className="flex items-center gap-4">
              <span>Design Codes: ACI 318-19, EN 1992-1-1, IS 456:2000</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Lap Splice Panel
// ============================================================================

function LapSplicePanel() {
  const [designCode, setDesignCode] = useState<ConcreteDesignCode>(ConcreteDesignCode.ACI_318_19);
  const [stressType, setStressType] = useState<'TENSION' | 'COMPRESSION'>('TENSION');
  const [spliceClass, setSpliceClass] = useState<LapSpliceClass>(LapSpliceClass.CLASS_B);
  const [coating, setCoating] = useState<BarCoating>(BarCoating.UNCOATED);
  const [barLocation, setBarLocation] = useState<'TOP' | 'BOTTOM' | 'OTHER'>('BOTTOM');
  
  const [fc, setFc] = useState<number>(4000);
  const [fy, setFy] = useState<number>(60000);
  const [selectedBarSize, setSelectedBarSize] = useState<string>('#6');
  const [clearCover, setClearCover] = useState<number>(1.5);
  const [clearSpacing, setClearSpacing] = useState<number>(2);
  const [percentSpliced, setPercentSpliced] = useState<number>(50);
  const [hasTransverseReinf, setHasTransverseReinf] = useState(false);
  
  const [result, setResult] = useState<LapSpliceResult | null>(null);
  const [tableData, setTableData] = useState<Array<{
    barSize: string;
    diameter: number;
    tensionClassA: number;
    tensionClassB: number;
    compression: number;
  }> | null>(null);
  
  const isMetric = designCode === ConcreteDesignCode.EUROCODE_2 || 
                   designCode === ConcreteDesignCode.IS_456_2000;
  
  const barData = useMemo(() => {
    const data = isMetric ? METRIC_BAR_DATA : US_BAR_DATA;
    return data.find(b => b.size === selectedBarSize) ?? null;
  }, [selectedBarSize, isMetric]);
  
  const barSizeOptions = isMetric 
    ? METRIC_BAR_DATA.map(b => b.size)
    : US_BAR_DATA.map(b => b.size);

  const handleCalculate = () => {
    if (!barData) return;
    
    const diameter = isMetric ? barData.diameter_mm : barData.diameter_in;
    const area = isMetric ? barData.area_mm2 : barData.area_in2;
    const weight = isMetric ? barData.weight_kg_m : barData.weight_lb_ft;
    const perimeter = barData.perimeter_mm;
    
    // Calculate approximate elastic modulus for steel
    const Es = isMetric ? 200000 : 29000; // MPa or ksi
    
    const input: LapSpliceInput = {
      designCode,
      stressType,
      spliceClass,
      percentSpliced,
      barLocation,
      coating,
      cover: clearCover,
      clearSpacing,
      hasTransverseReinf,
      memberType: MemberType.BEAM,
      bar: {
        size: selectedBarSize,
        diameter: diameter,
        area: area,
        perimeter: perimeter,
        unitWeight: weight,
        grade: 'GRADE_60' as any,
        yieldStrength: fy,
        ultimateStrength: fy * 1.5,
        elasticModulus: Es,
        coating: coating,
      },
      concrete: {
        compressiveStrength: fc,
        grade: isMetric ? `M${Math.round(fc)}` : `${Math.round(fc)} psi`,
        elasticModulus: isMetric ? 4700 * Math.sqrt(fc) : 57000 * Math.sqrt(fc),
        tensileStrength: isMetric ? 0.7 * Math.sqrt(fc) : 7.5 * Math.sqrt(fc),
        density: isMetric ? 2400 : 150,
        aggregateType: 'NORMAL',
        maxAggregateSize: isMetric ? 20 : 0.75,
        unitSystem: isMetric ? 'SI' : 'IMPERIAL',
      }
    };
    
    const calcResult = lapSpliceCalculator.calculate(input);
    setResult(calcResult);
  };
  
  const handleGenerateTable = () => {
    const data = lapSpliceCalculator.getLapSchedule(designCode, fc, fy, clearCover);
    setTableData(data);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-[#0b1326] rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-8 h-8 text-purple-600" />
        <div>
          <h2 className="text-2xl font-bold text-[#dae2fd]">
            Lap Splice Calculator
          </h2>
          <p className="text-sm text-[#869ab8]">
            Class A/B tension and compression lap splices
          </p>
        </div>
      </div>
      
      <Tabs.Root defaultValue="input" className="w-full">
        <Tabs.List className="flex border-b border-[#1a2333] mb-6">
          <Tabs.Trigger value="input" className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                     data-[state=active]:text-purple-600 data-[state=active]:border-purple-600">
            <Calculator className="w-4 h-4 inline mr-2" />
            Input
          </Tabs.Trigger>
          <Tabs.Trigger value="results" className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                     data-[state=active]:text-purple-600 data-[state=active]:border-purple-600">
            <FileText className="w-4 h-4 inline mr-2" />
            Results
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className="px-4 py-2 text-sm font-medium tracking-wide text-slate-600 hover:text-slate-900 dark:hover:text-[#dae2fd] border-b-2 border-transparent
                     data-[state=active]:text-purple-600 data-[state=active]:border-purple-600">
            <Table className="w-4 h-4 inline mr-2" />
            Quick Reference
          </Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="input" className="space-y-6">
          {/* Design Parameters */}
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
                  <Select.Content className="bg-[#131b2e] border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(ConcreteDesignCode).map((code) => (
                        <Select.Item key={code} value={code}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                          <Select.ItemText>{code}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Stress Type
              </Label.Root>
              <Select.Root value={stressType} onValueChange={(v) => setStressType(v as 'TENSION' | 'COMPRESSION')}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-[#131b2e] text-[#dae2fd]">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-[#131b2e] border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      <Select.Item value="TENSION" className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>Tension</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="COMPRESSION" className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>Compression</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Splice Class
              </Label.Root>
              <Select.Root value={spliceClass} onValueChange={(v) => setSpliceClass(v as LapSpliceClass)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-[#131b2e] text-[#dae2fd]">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-[#131b2e] border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      <Select.Item value={LapSpliceClass.CLASS_A} className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>Class A (1.0 × ld)</Select.ItemText>
                      </Select.Item>
                      <Select.Item value={LapSpliceClass.CLASS_B} className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>Class B (1.3 × ld)</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
          
          <div className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Materials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                f'c ({isMetric ? 'MPa' : 'psi'})
              </Label.Root>
              <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-[#131b2e] text-[#dae2fd]" />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                fy ({isMetric ? 'MPa' : 'psi'})
              </Label.Root>
              <input type="number" value={fy} onChange={(e) => setFy(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-[#131b2e] text-[#dae2fd]" />
            </div>
          </div>
          
          {/* Bar Selection */}
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
                  <Select.Content className="bg-[#131b2e] border rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                    <Select.Viewport className="p-1">
                      {barSizeOptions.map((size) => (
                        <Select.Item key={size} value={size}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                          <Select.ItemText>{size}</Select.ItemText>
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
              <input type="number" step="0.1" value={clearCover} onChange={(e) => setClearCover(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-[#131b2e] text-[#dae2fd]" />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                Clear Spacing ({isMetric ? 'mm' : 'in'})
              </Label.Root>
              <input type="number" step="0.5" value={clearSpacing} onChange={(e) => setClearSpacing(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-[#131b2e] text-[#dae2fd]" />
            </div>
          </div>
          
          {/* Switches */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Switch.Root checked={barLocation === 'TOP'} onCheckedChange={(checked) => setBarLocation(checked ? 'TOP' : 'BOTTOM')}
                className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative
                           data-[state=checked]:bg-purple-600 transition-colors">
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow transition-transform
                                        translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
              <Label.Root className="text-sm text-[#adc6ff]">Top Bar</Label.Root>
            </div>
            <div className="flex items-center gap-3">
              <Switch.Root checked={hasTransverseReinf} onCheckedChange={setHasTransverseReinf}
                className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative
                           data-[state=checked]:bg-purple-600 transition-colors">
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow transition-transform
                                        translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
              <Label.Root className="text-sm text-[#adc6ff]">Transverse Reinf.</Label.Root>
            </div>
          </div>
          
          <div>
            <Label.Root className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
              % Bars Spliced at Section
            </Label.Root>
            <input
              type="number"
              min="0"
              max="100"
              value={percentSpliced}
              onChange={(e) => setPercentSpliced(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-[#131b2e] text-[#dae2fd]"
            />
          </div>
          
          <button type="button" onClick={handleCalculate}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium tracking-wide 
                       rounded-lg transition-colors flex items-center justify-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculate Lap Splice
          </button>
        </Tabs.Content>
        
        <Tabs.Content value="results" className="space-y-6">
          {result ? (
            <>
              <div className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-[#1a2333] rounded-lg">
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">
                      {stressType === 'TENSION' ? 'Tension' : 'Compression'} Lap Splice
                    </p>
                    <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">
                      {result.requiredLength.toFixed(isMetric ? 0 : 1)}
                    </p>
                    <p className="text-lg text-purple-700 dark:text-purple-300">{isMetric ? 'mm' : 'inches'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">Splice Multiplier</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {result.spliceMultiplier.toFixed(2)}×
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Base ld: {result.developmentLength.toFixed(isMetric ? 0 : 1)} {isMetric ? 'mm' : 'in'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Factors Display */}
              {result.factors && result.factors.length > 0 && (
                <div className="p-4 bg-[#131b2e] rounded-lg">
                  <h4 className="font-semibold text-[#dae2fd] mb-3">Modification Factors</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {result.factors.map((factor, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-slate-700 rounded-lg">
                        <p className="text-xs text-[#869ab8]">{factor.name}</p>
                        <p className="text-lg font-semibold text-[#dae2fd]">{factor.value.toFixed(2)}</p>
                        <p className="text-xs text-[#869ab8]">{factor.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Stagger Requirements */}
              {result.staggerRequirements && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 inline mr-1" />
                    Stagger splices by min {result.staggerRequirements.minStagger.toFixed(isMetric ? 0 : 1)} {isMetric ? 'mm' : 'in'}. 
                    Max {result.staggerRequirements.maxPercentAtLocation}% of bars spliced at same location.
                  </p>
                </div>
              )}
              
              <div className="p-4 bg-[#131b2e] rounded-lg">
                <p className="text-sm text-[#869ab8]">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Code Reference: {result.codeReference}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Link2 className="w-16 h-16 mx-auto text-[#869ab8] mb-4" />
              <p className="text-[#869ab8]">Enter parameters and calculate</p>
            </div>
          )}
        </Tabs.Content>
        
        <Tabs.Content value="table" className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#869ab8]">
              Lap lengths for all bar sizes
            </p>
            <button type="button" onClick={handleGenerateTable}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium tracking-wide 
                         rounded-lg flex items-center gap-2">
              <Table className="w-4 h-4" />
              Generate Table
            </button>
          </div>
          
          {tableData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#131b2e]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[#dae2fd]">Bar</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Class A</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Class B</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#dae2fd]">Compression</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {tableData.map((row) => (
                    <tr key={row.barSize} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3 font-medium tracking-wide text-[#dae2fd]">{row.barSize}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#dae2fd]">
                        {row.tensionClassA}{isMetric ? 'mm' : '"'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">
                        {row.tensionClassB}{isMetric ? 'mm' : '"'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#dae2fd]">
                        {row.compression}{isMetric ? 'mm' : '"'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
              <Table className="w-12 h-12 mx-auto text-[#869ab8] mb-3" />
              <p className="text-[#869ab8]">Click "Generate Table" for quick reference</p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default ReinforcementDesignPage;
