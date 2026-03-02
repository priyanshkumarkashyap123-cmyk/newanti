/**
 * Welded Connections Design Page
 * Professional weld design tools - Fillet, Groove, Weld Groups, Base Plates
 */


import React, { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import * as Separator from '@radix-ui/react-separator';
import * as Switch from '@radix-ui/react-switch';
import { 
  Flame, 
  Square, 
  Grid3X3, 
  Anchor,
  BookOpen,
  HelpCircle,
  ChevronDown,
  Calculator,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

import { 
  weldedConnectionCalculator 
} from './WeldedConnectionCalculator';
import {
  basePlateCalculator,
  BasePlateInput,
  BasePlateResult
} from './BasePlateCalculator';
import {
  WeldDesignCode,
  WeldType,
  WeldPosition,
  WeldProcess,
  ElectrodeClass,
  JointType,
  FilletWeldInput,
  FilletWeldResult,
  GrooveWeldInput,
  GrooveWeldResult,
  ELECTRODE_STRENGTH
} from './WeldedConnectionTypes';

// Extended types for UI (backwards compat with component props)
type ExtendedFilletWeldInput = Partial<FilletWeldInput> & {
  designCode: WeldDesignCode;
  weldSize: number;
  weldLength: number;
  loadAngle: number;
  electrode?: ElectrodeClass;
  position?: WeldPosition;
  baseMetal1Fy?: number;
  baseMetal1Thickness?: number;
  baseMetal2Fy?: number;
  baseMetal2Thickness?: number;
};

type ExtendedFilletWeldResult = FilletWeldResult & {
  nominalStrength?: number;
  directionalStrengthFactor?: number;
  minWeldSize?: number;
  maxWeldSize?: number;
};

type ExtendedGrooveWeldResult = GrooveWeldResult & {
  phiFactor?: number;
  governingLimitState?: string;
};

// Extended BasePlateResult for backwards compat
type ExtendedBasePlateResult = BasePlateResult & {
  plateUtilization?: number;
  anchorUtilization?: number;
  bearingCapacity?: number;
  requiredPlateThickness?: number;
};

// ============================================================================
// Main Page Component
// ============================================================================

export function WeldedConnectionsPage() {
  const [activeTab, setActiveTab] = useState('fillet');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Welded Connections
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AWS D1.1 • AISC 360 • Eurocode 3 • IS 800
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <BookOpen className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex gap-1 -mb-px">
              <Tabs.Trigger 
                value="fillet"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-slate-900 dark:text-white
                           data-[state=active]:text-red-600 data-[state=active]:border-red-600"
              >
                <Square className="w-4 h-4" />
                Fillet Welds
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="groove"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-slate-900 dark:text-white
                           data-[state=active]:text-red-600 data-[state=active]:border-red-600"
              >
                <Grid3X3 className="w-4 h-4" />
                Groove Welds
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="baseplate"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium 
                           text-slate-600 border-b-2 border-transparent
                           hover:text-slate-900 dark:hover:text-slate-900 dark:text-white
                           data-[state=active]:text-red-600 data-[state=active]:border-red-600"
              >
                <Anchor className="w-4 h-4" />
                Base Plates
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          {/* Fillet Weld Tab */}
          <Tabs.Content value="fillet" className="focus:outline-none">
            <FilletWeldPanel />
          </Tabs.Content>

          {/* Groove Weld Tab */}
          <Tabs.Content value="groove" className="focus:outline-none">
            <GrooveWeldPanel />
          </Tabs.Content>

          {/* Base Plate Tab */}
          <Tabs.Content value="baseplate" className="focus:outline-none">
            <BasePlatePanel />
          </Tabs.Content>
        </Tabs.Root>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Structural Engineering Suite. Professional use only.</p>
            <div className="flex items-center gap-4">
              <span>Design Codes: AWS D1.1-2020, AISC 360-22, EN 1993-1-8</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Fillet Weld Panel
// ============================================================================

function FilletWeldPanel() {
  const [designCode, setDesignCode] = useState<WeldDesignCode>(WeldDesignCode.AISC_360);
  const [weldPosition, setWeldPosition] = useState<WeldPosition>(WeldPosition.FLAT);
  const [electrodeClass, setElectrodeClass] = useState<ElectrodeClass>(ElectrodeClass.E70XX);
  
  const [weldSize, setWeldSize] = useState<number>(0.25);
  const [weldLength, setWeldLength] = useState<number>(6);
  const [loadAngle, setLoadAngle] = useState<number>(0);
  const [baseMetal1Fy, setBaseMetal1Fy] = useState<number>(50);
  const [baseMetal1Thickness, setBaseMetal1Thickness] = useState<number>(0.5);
  const [baseMetal2Fy, setBaseMetal2Fy] = useState<number>(50);
  const [baseMetal2Thickness, setBaseMetal2Thickness] = useState<number>(0.375);
  
  const [result, setResult] = useState<ExtendedFilletWeldResult | null>(null);

  const isMetric = designCode === WeldDesignCode.EUROCODE_3 || designCode === WeldDesignCode.IS_800;

  const handleCalculate = () => {
    const input = {
      designCode,
      weldSize,
      weldLength,
      loadAngle,
      electrode: electrodeClass,
      position: weldPosition,
      baseMetal1Fy,
      baseMetal1Thickness,
      baseMetal2Fy,
      baseMetal2Thickness
    } as unknown as FilletWeldInput;
    
    const calcResult = weldedConnectionCalculator.designFilletWeld(input);
    setResult(calcResult as ExtendedFilletWeldResult);
  };

  const utilizationColor = result 
    ? result.utilizationRatio < 0.7 ? 'text-green-600' 
      : result.utilizationRatio < 0.9 ? 'text-yellow-600' 
      : 'text-red-600'
    : '';

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Square className="w-8 h-8 text-red-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Fillet Weld Calculator
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AISC 360 / AWS D1.1 / Eurocode 3 compliant design
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Design Parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Design Code
              </Label.Root>
              <Select.Root value={designCode} onValueChange={(v) => setDesignCode(v as WeldDesignCode)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(WeldDesignCode).map((code) => (
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
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Electrode
              </Label.Root>
              <Select.Root value={electrodeClass} onValueChange={(v) => setElectrodeClass(v as ElectrodeClass)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(ElectrodeClass).map((el) => (
                        <Select.Item key={el} value={el}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                          <Select.ItemText>{el} ({ELECTRODE_STRENGTH[el]} ksi)</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>

          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* Weld Geometry */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weld Size ({isMetric ? 'mm' : 'in'})
              </Label.Root>
              <input
                type="number"
                step="0.0625"
                value={weldSize}
                onChange={(e) => setWeldSize(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weld Length ({isMetric ? 'mm' : 'in'})
              </Label.Root>
              <input
                type="number"
                step="0.5"
                value={weldLength}
                onChange={(e) => setWeldLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Load Angle (°)
              </Label.Root>
              <input
                type="number"
                min="0"
                max="90"
                value={loadAngle}
                onChange={(e) => setLoadAngle(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Base Metal */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-3">Base Metal Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Plate 1: Fy (ksi)
                </Label.Root>
                <input
                  type="number"
                  value={baseMetal1Fy}
                  onChange={(e) => setBaseMetal1Fy(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Thickness (in)
                </Label.Root>
                <input
                  type="number"
                  step="0.0625"
                  value={baseMetal1Thickness}
                  onChange={(e) => setBaseMetal1Thickness(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Plate 2: Fy (ksi)
                </Label.Root>
                <input
                  type="number"
                  value={baseMetal2Fy}
                  onChange={(e) => setBaseMetal2Fy(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Thickness (in)
                </Label.Root>
                <input
                  type="number"
                  step="0.0625"
                  value={baseMetal2Thickness}
                  onChange={(e) => setBaseMetal2Thickness(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium 
                       rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate Weld Strength
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-center mb-4">
                  <p className="text-sm text-red-600 dark:text-red-400">Design Strength (φRn)</p>
                  <p className="text-4xl font-bold text-red-900 dark:text-red-100">
                    {result.designStrength.toFixed(2)} kips
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Per {weldLength}" weld length
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Nominal Strength</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {(result.nominalStrength ?? 0).toFixed(2)} kips
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Throat Area</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {result.effectiveThroat.toFixed(3)} in²
                    </p>
                  </div>
                </div>
              </div>

              {result.directionalStrengthFactor && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 inline mr-1" />
                    Directional strength factor = {result.directionalStrengthFactor.toFixed(3)}
                    {loadAngle > 0 && ` (load at ${loadAngle}° increases capacity)`}
                  </p>
                </div>
              )}

              {result.minWeldSize && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Minimum Weld Size:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {result.minWeldSize}" (per Table J2.4)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-slate-600 dark:text-slate-400">Maximum Weld Size:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {result.maxWeldSize}"
                    </span>
                  </div>
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  {result.warnings.map((warn, idx) => (
                    <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      {warn}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed 
                            border-slate-300 dark:border-slate-600 rounded-lg p-12">
              <div className="text-center">
                <Square className="w-16 h-16 mx-auto text-slate-500 dark:text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter weld parameters and calculate
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Groove Weld Panel
// ============================================================================

function GrooveWeldPanel() {
  const [designCode, setDesignCode] = useState<WeldDesignCode>(WeldDesignCode.AISC_360);
  const [weldType, setWeldType] = useState<'CJP' | 'PJP'>('CJP');
  const [jointType, setJointType] = useState<JointType>(JointType.BUTT);
  const [electrodeClass, setElectrodeClass] = useState<ElectrodeClass>(ElectrodeClass.E70XX);
  
  const [plateThickness, setPlateThickness] = useState<number>(0.5);
  const [weldLength, setWeldLength] = useState<number>(12);
  const [grooveAngle, setGrooveAngle] = useState<number>(45);
  const [rootOpening, setRootOpening] = useState<number>(0.125);
  const [baseMetal1Fy, setBaseMetal1Fy] = useState<number>(50);
  const [baseMetal2Fy, setBaseMetal2Fy] = useState<number>(50);
  
  const [result, setResult] = useState<ExtendedGrooveWeldResult | null>(null);

  const handleCalculate = () => {
    const input = {
      designCode,
      weldType: weldType === 'CJP' ? WeldType.COMPLETE_JOINT_PENETRATION : WeldType.PARTIAL_JOINT_PENETRATION,
      jointType,
      plateThickness,
      weldLength,
      grooveAngle,
      rootOpening,
      electrodeClass,
      baseMetal1Fy,
      baseMetal2Fy
    } as unknown as GrooveWeldInput;
    
    const calcResult = weldedConnectionCalculator.designGrooveWeld(input);
    setResult(calcResult as ExtendedGrooveWeldResult);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Grid3X3 className="w-8 h-8 text-orange-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Groove Weld Calculator
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete Joint Penetration (CJP) and Partial Joint Penetration (PJP)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weld Type
              </Label.Root>
              <Select.Root value={weldType} onValueChange={(v) => setWeldType(v as 'CJP' | 'PJP')}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      <Select.Item value="CJP" className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>CJP - Complete Joint Penetration</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="PJP" className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <Select.ItemText>PJP - Partial Joint Penetration</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Joint Type
              </Label.Root>
              <Select.Root value={jointType} onValueChange={(v) => setJointType(v as JointType)}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 
                                           border border-slate-300 dark:border-slate-600 rounded-lg
                                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-white dark:bg-slate-800 border rounded-lg shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {Object.values(JointType).map((jt) => (
                        <Select.Item key={jt} value={jt}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                          <Select.ItemText>{jt}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>

          <Separator.Root className="h-px bg-slate-200 dark:bg-slate-700" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Plate Thickness (in)
              </Label.Root>
              <input
                type="number"
                step="0.0625"
                value={plateThickness}
                onChange={(e) => setPlateThickness(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weld Length (in)
              </Label.Root>
              <input
                type="number"
                step="0.5"
                value={weldLength}
                onChange={(e) => setWeldLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Groove Angle (°)
              </Label.Root>
              <input
                type="number"
                min="0"
                max="90"
                value={grooveAngle}
                onChange={(e) => setGrooveAngle(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <Label.Root className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Root Opening (in)
              </Label.Root>
              <input
                type="number"
                step="0.0625"
                value={rootOpening}
                onChange={(e) => setRootOpening(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium 
                       rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate Groove Weld
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="p-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="text-center mb-4">
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    {weldType} Design Strength
                  </p>
                  <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">
                    {result.designStrength.toFixed(2)} kips
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Effective Throat</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {result.effectiveThroat.toFixed(3)}"
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Nominal Strength</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {result.nominalStrength.toFixed(2)} kips
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">φ Factor:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{result.phiFactor}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Governing Limit State:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{result.governingLimitState}</span>
                </div>
              </div>

              {weldType === 'CJP' && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    CJP welds in tension/compression: strength = base metal strength
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed 
                            border-slate-300 dark:border-slate-600 rounded-lg p-12">
              <div className="text-center">
                <Grid3X3 className="w-16 h-16 mx-auto text-slate-500 dark:text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter groove weld parameters
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Base Plate Panel
// ============================================================================

function BasePlatePanel() {
  const [designCode, setDesignCode] = useState<WeldDesignCode>(WeldDesignCode.AISC_360);
  
  // Loads
  const [axialLoad, setAxialLoad] = useState<number>(500);
  const [moment, setMoment] = useState<number>(100);
  const [shearForce, setShearForce] = useState<number>(50);
  
  // Column
  const [columnDepth, setColumnDepth] = useState<number>(12);
  const [columnWidth, setColumnWidth] = useState<number>(12);
  const [columnFy, setColumnFy] = useState<number>(50);
  
  // Base Plate
  const [plateLength, setPlateLength] = useState<number>(18);
  const [plateWidth, setPlateWidth] = useState<number>(18);
  const [plateThickness, setPlateThickness] = useState<number>(1.5);
  const [plateFy, setPlateFy] = useState<number>(36);
  
  // Concrete
  const [pedestalLength, setPedestalLength] = useState<number>(24);
  const [pedestalWidth, setPedestalWidth] = useState<number>(24);
  const [concreteFc, setConcreteFc] = useState<number>(4);
  
  // Anchors
  const [anchorDiameter, setAnchorDiameter] = useState<number>(0.75);
  const [anchorFu, setAnchorFu] = useState<number>(125);
  const [numAnchors, setNumAnchors] = useState<number>(4);
  const [anchorEdgeDistance, setAnchorEdgeDistance] = useState<number>(3);
  
  const [result, setResult] = useState<ExtendedBasePlateResult | null>(null);

  const handleCalculate = () => {
    const input = {
      designCode,
      axialLoad,
      moment,
      shearForce,
      columnDepth,
      columnWidth,
      columnFy,
      plateLength,
      plateWidth,
      plateThickness,
      plateFy,
      pedestalLength,
      pedestalWidth,
      concreteFc,
      anchorDiameter,
      anchorFu,
      numAnchors,
      anchorEdgeDistance
    } as unknown as BasePlateInput;
    
    const calcResult = basePlateCalculator.design(input);
    setResult(calcResult as ExtendedBasePlateResult);
  };

  const getStatusColor = (ratio: number) => {
    if (ratio <= 0.7) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (ratio <= 1.0) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Anchor className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Base Plate Calculator
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Column base plate and anchor bolt design per AISC Design Guide 1
          </p>
        </div>
      </div>

      <Tabs.Root defaultValue="input">
        <Tabs.List className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          <Tabs.Trigger value="input" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white border-b-2 border-transparent
                     data-[state=active]:text-blue-600 data-[state=active]:border-blue-600">
            <Calculator className="w-4 h-4 inline mr-2" />
            Design Input
          </Tabs.Trigger>
          <Tabs.Trigger value="results" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white border-b-2 border-transparent
                     data-[state=active]:text-blue-600 data-[state=active]:border-blue-600">
            <FileText className="w-4 h-4 inline mr-2" />
            Results
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="input" className="space-y-6">
          {/* Applied Loads */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Applied Loads (Factored)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Axial Pu (kips)
                </Label.Root>
                <input
                  type="number"
                  value={axialLoad}
                  onChange={(e) => setAxialLoad(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Moment Mu (kip-ft)
                </Label.Root>
                <input
                  type="number"
                  value={moment}
                  onChange={(e) => setMoment(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Shear Vu (kips)
                </Label.Root>
                <input
                  type="number"
                  value={shearForce}
                  onChange={(e) => setShearForce(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Base Plate Geometry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Base Plate</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label.Root className="block text-sm text-blue-700 dark:text-blue-300 mb-1">N (in)</Label.Root>
                  <input type="number" step="0.5" value={plateLength} onChange={(e) => setPlateLength(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <Label.Root className="block text-sm text-blue-700 dark:text-blue-300 mb-1">B (in)</Label.Root>
                  <input type="number" step="0.5" value={plateWidth} onChange={(e) => setPlateWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <Label.Root className="block text-sm text-blue-700 dark:text-blue-300 mb-1">tp (in)</Label.Root>
                  <input type="number" step="0.125" value={plateThickness} onChange={(e) => setPlateThickness(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <Label.Root className="block text-sm text-blue-700 dark:text-blue-300 mb-1">Fyp (ksi)</Label.Root>
                  <input type="number" value={plateFy} onChange={(e) => setPlateFy(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Concrete Pedestal</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">A1 (in)</Label.Root>
                  <input type="number" step="0.5" value={pedestalLength} onChange={(e) => setPedestalLength(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">A2 (in)</Label.Root>
                  <input type="number" step="0.5" value={pedestalWidth} onChange={(e) => setPedestalWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <Label.Root className="block text-sm text-slate-600 dark:text-slate-400 mb-1">f'c (ksi)</Label.Root>
                  <input type="number" step="0.5" value={concreteFc} onChange={(e) => setConcreteFc(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Anchor Bolts */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Anchor Bolts</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label.Root className="block text-sm text-amber-700 dark:text-amber-300 mb-1">Diameter (in)</Label.Root>
                <input type="number" step="0.125" value={anchorDiameter} onChange={(e) => setAnchorDiameter(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              </div>
              <div>
                <Label.Root className="block text-sm text-amber-700 dark:text-amber-300 mb-1">Fu (ksi)</Label.Root>
                <input type="number" value={anchorFu} onChange={(e) => setAnchorFu(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              </div>
              <div>
                <Label.Root className="block text-sm text-amber-700 dark:text-amber-300 mb-1">Quantity</Label.Root>
                <input type="number" min="2" value={numAnchors} onChange={(e) => setNumAnchors(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              </div>
              <div>
                <Label.Root className="block text-sm text-amber-700 dark:text-amber-300 mb-1">Edge Dist (in)</Label.Root>
                <input type="number" step="0.5" value={anchorEdgeDistance} onChange={(e) => setAnchorEdgeDistance(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium 
                       rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Design Base Plate
          </button>
        </Tabs.Content>

        <Tabs.Content value="results" className="space-y-6">
          {result ? (
            <>
              {/* Status Overview */}
              <div className={`p-6 rounded-lg ${result.isAdequate 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center gap-3">
                  {result.isAdequate 
                    ? <CheckCircle className="w-8 h-8 text-green-600" />
                    : <AlertTriangle className="w-8 h-8 text-red-600" />}
                  <div>
                    <h3 className={`text-xl font-bold ${result.isAdequate ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                      {result.isAdequate ? 'Design Adequate' : 'Design Not Adequate'}
                    </h3>
                    <p className={`text-sm ${result.isAdequate ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      Max utilization: {(Math.max(result.bearingUtilization, result.plateUtilization ?? 0, result.anchorUtilization ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Utilization Ratios */}
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${getStatusColor(result.bearingUtilization)}`}>
                  <p className="text-sm font-medium mb-1">Concrete Bearing</p>
                  <p className="text-2xl font-bold">{(result.bearingUtilization * 100).toFixed(1)}%</p>
                </div>
                <div className={`p-4 rounded-lg ${getStatusColor(result.plateUtilization ?? 0)}`}>
                  <p className="text-sm font-medium mb-1">Plate Bending</p>
                  <p className="text-2xl font-bold">{((result.plateUtilization ?? 0) * 100).toFixed(1)}%</p>
                </div>
                <div className={`p-4 rounded-lg ${getStatusColor(result.anchorUtilization ?? 0)}`}>
                  <p className="text-sm font-medium mb-1">Anchor Bolts</p>
                  <p className="text-2xl font-bold">{((result.anchorUtilization ?? 0) * 100).toFixed(1)}%</p>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Bearing Capacity</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">φPp:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{(result.bearingCapacity ?? 0).toFixed(1)} kips</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Required tp:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{(result.requiredPlateThickness ?? 0).toFixed(3)}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Provided tp:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{plateThickness}"</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Anchor Design</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">φRn (tension):</span>
                      <span className="font-medium text-slate-900 dark:text-white">{result.anchorTensionCapacity.toFixed(1)} kips</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">φRn (shear):</span>
                      <span className="font-medium text-slate-900 dark:text-white">{result.anchorShearCapacity.toFixed(1)} kips</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Interaction:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{(result.anchorInteraction * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings</h4>
                  <ul className="space-y-1">
                    {result.warnings.map((warn: string, idx: number) => (
                      <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
              <Anchor className="w-16 h-16 mx-auto text-slate-500 dark:text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Enter design parameters and calculate</p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default WeldedConnectionsPage;
