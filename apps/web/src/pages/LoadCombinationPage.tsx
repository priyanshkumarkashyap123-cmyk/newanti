/**
 * Load Combination Generator - IS 1893, ASCE 7, Eurocode
 * Auto-generate load combinations for seismic, wind, gravity loads
 */

import React, { useState, useEffect, memo } from 'react';
import { Input, Select } from '../components/ui/FormInputs';
import {
  Wind,
  Weight,
  Home,
  Zap,
  Plus,
  Trash2,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react';

type LoadType = 'dead' | 'live' | 'seismic' | 'wind' | 'snow' | 'temperature' | 'earth';
type DesignCode = 'IS1893' | 'ASCE7' | 'Eurocode' | 'IBC';

interface LoadCase {
  id: string;
  name: string;
  type: LoadType;
  factor: number;
}

interface Combination {
  id: string;
  name: string;
  cases: { caseId: string; factor: number }[];
  type: 'ULS' | 'SLS';
}

export const LoadCombinationPage: React.FC = () => {
  const [designCode, setDesignCode] = useState<DesignCode>('IS1893');
  const [loadCases, setLoadCases] = useState<LoadCase[]>([
    { id: '1', name: 'Dead Load (DL)', type: 'dead', factor: 1.5 },
    { id: '2', name: 'Live Load (LL)', type: 'live', factor: 1.5 },
    { id: '3', name: 'Seismic X (EQX)', type: 'seismic', factor: 1.5 },
    { id: '4', name: 'Wind X (WX)', type: 'wind', factor: 1.5 }
  ]);
  
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { document.title = 'Load Combinations | BeamLab'; }, []);

  const loadTypeIcons: Record<LoadType, any> = {
    dead: Weight,
    live: Home,
    seismic: Zap,
    wind: Wind,
    snow: Weight,
    temperature: AlertTriangle,
    earth: Weight
  };

  const addLoadCase = () => {
    const newCase: LoadCase = {
      id: Date.now().toString(),
      name: `Load Case ${loadCases.length + 1}`,
      type: 'dead',
      factor: 1.5
    };
    setLoadCases([...loadCases, newCase]);
  };

  const removeLoadCase = (id: string) => {
    setLoadCases(loadCases.filter(c => c.id !== id));
  };

  const updateLoadCase = (id: string, updates: Partial<LoadCase>) => {
    setLoadCases(loadCases.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const generateCombinations = () => {
    setGenerating(true);
    const newCombos = generateByCode(designCode, loadCases);
    setCombinations(newCombos);
    setGenerating(false);
  };

  const generateByCode = (code: DesignCode, cases: LoadCase[]): Combination[] => {
    const combos: Combination[] = [];
    
    const DL = cases.find(c => c.type === 'dead');
    const LL = cases.find(c => c.type === 'live');
    const EQ = cases.filter(c => c.type === 'seismic');
    const WL = cases.filter(c => c.type === 'wind');

    if (code === 'IS1893') {
      // IS 1893:2016 combinations
      if (DL && LL) {
        combos.push({
          id: '1',
          name: '1.5(DL+LL)',
          cases: [
            { caseId: DL.id, factor: 1.5 },
            { caseId: LL.id, factor: 1.5 }
          ],
          type: 'ULS'
        });
      }

      if (DL && LL && EQ.length > 0) {
        EQ.forEach((eq, idx) => {
          combos.push({
            id: `eq${idx + 2}`,
            name: `1.2(DL+LL±${eq.name})`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.2 },
              { caseId: eq.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
          combos.push({
            id: `eq${idx + 2}b`,
            name: `1.2(DL+LL-${eq.name})`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.2 },
              { caseId: eq.id, factor: -1.0 }
            ],
            type: 'ULS'
          });
        });
      }

      if (DL && LL && EQ.length > 0) {
        combos.push({
          id: 'eq_service',
          name: `1.0(DL+LL±${EQ[0].name})`,
          cases: [
            { caseId: DL.id, factor: 1.0 },
            { caseId: LL.id, factor: 1.0 },
            { caseId: EQ[0].id, factor: 1.0 }
          ],
          type: 'SLS'
        });
      }

    } else if (code === 'ASCE7') {
      // ASCE 7-22 combinations
      if (DL && LL) {
        combos.push(
          {
            id: '1',
            name: '1.4D',
            cases: [{ caseId: DL.id, factor: 1.4 }],
            type: 'ULS'
          },
          {
            id: '2',
            name: '1.2D + 1.6L',
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.6 }
            ],
            type: 'ULS'
          }
        );
      }

      if (DL && LL && EQ.length > 0) {
        EQ.forEach((eq, idx) => {
          combos.push({
            id: `asce_eq${idx}`,
            name: `1.2D + 1.0L ± 1.0${eq.name}`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.0 },
              { caseId: eq.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
        });
      }

      if (DL && LL && WL.length > 0) {
        WL.forEach((wl, idx) => {
          combos.push({
            id: `asce_wl${idx}`,
            name: `1.2D + 1.0L + 1.0${wl.name}`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.0 },
              { caseId: wl.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
        });
      }

    } else if (code === 'Eurocode') {
      // EN 1990 combinations
      if (DL && LL) {
        combos.push(
          {
            id: 'ec1',
            name: '1.35Gk + 1.5Qk',
            cases: [
              { caseId: DL.id, factor: 1.35 },
              { caseId: LL.id, factor: 1.5 }
            ],
            type: 'ULS'
          }
        );
      }

      if (DL && LL && EQ.length > 0) {
        EQ.forEach((eq, idx) => {
          combos.push({
            id: `ec_eq${idx}`,
            name: `Gk + 0.3Qk + ${eq.name}`,
            cases: [
              { caseId: DL.id, factor: 1.0 },
              { caseId: LL.id, factor: 0.3 },
              { caseId: eq.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
        });
      }
    } else if (code === 'IBC') {
      // IBC 2021 / ASCE 7-based combinations
      if (DL) {
        combos.push({
          id: 'ibc1',
          name: '1.4D',
          cases: [{ caseId: DL.id, factor: 1.4 }],
          type: 'ULS'
        });
      }
      if (DL && LL) {
        combos.push({
          id: 'ibc2',
          name: '1.2D + 1.6L',
          cases: [
            { caseId: DL.id, factor: 1.2 },
            { caseId: LL.id, factor: 1.6 }
          ],
          type: 'ULS'
        });
      }
      if (DL && LL && WL.length > 0) {
        WL.forEach((wl, idx) => {
          combos.push({
            id: `ibc_wl${idx}`,
            name: `1.2D + 1.0L + 1.0${wl.name}`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.0 },
              { caseId: wl.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
        });
      }
      if (DL && LL && EQ.length > 0) {
        EQ.forEach((eq, idx) => {
          combos.push({
            id: `ibc_eq${idx}`,
            name: `1.2D + 1.0L + 1.0${eq.name}`,
            cases: [
              { caseId: DL.id, factor: 1.2 },
              { caseId: LL.id, factor: 1.0 },
              { caseId: eq.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
          combos.push({
            id: `ibc_eq${idx}b`,
            name: `0.9D ± 1.0${eq.name}`,
            cases: [
              { caseId: DL.id, factor: 0.9 },
              { caseId: eq.id, factor: 1.0 }
            ],
            type: 'ULS'
          });
        });
      }
      // SLS
      if (DL && LL) {
        combos.push({
          id: 'ibc_sls',
          name: '1.0D + 1.0L',
          cases: [
            { caseId: DL.id, factor: 1.0 },
            { caseId: LL.id, factor: 1.0 }
          ],
          type: 'SLS'
        });
      }
    }

    return combos;
  };

  const downloadCombinations = () => {
    const data = combinations.map(c => ({
      name: c.name,
      type: c.type,
      expression: c.cases.map(cc => {
        const caseData = loadCases.find(lc => lc.id === cc.caseId);
        return `${cc.factor > 0 ? '+' : ''}${cc.factor}*${caseData?.name || 'Unknown'}`;
      }).join(' ')
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `load_combinations_${designCode}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Load Combination Generator
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Auto-generate code-compliant load combinations for {designCode}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Design Code Selection */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-blue-400 mb-4">Design Code</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { code: 'IS1893', label: 'IS 1893:2016' },
                  { code: 'ASCE7', label: 'ASCE 7-22' },
                  { code: 'Eurocode', label: 'EN 1990' },
                  { code: 'IBC', label: 'IBC 2021' }
                ].map(({ code, label }) => (
                  <button type="button"
                    key={code}
                    onClick={() => setDesignCode(code as DesignCode)}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                      designCode === code
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Load Cases */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-amber-400">Load Cases</h3>
                <button type="button"
                  onClick={addLoadCase}
                  className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Load Case
                </button>
              </div>

              <div className="space-y-3">
                {loadCases.map((loadCase) => {
                  const Icon = loadTypeIcons[loadCase.type];
                  return (
                    <div key={loadCase.id} className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex items-center gap-3">
                      <Icon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      
                      <div className="flex-1">
                        <Input
                          value={loadCase.name}
                          onChange={(e) => updateLoadCase(loadCase.id, { name: e.target.value })}
                          placeholder="Load case name"
                        />
                      </div>
                      
                      <Select
                        value={loadCase.type}
                        onChange={(v) => updateLoadCase(loadCase.id, { type: v as LoadType })}
                        options={[
                          { value: 'dead', label: 'Dead' },
                          { value: 'live', label: 'Live' },
                          { value: 'seismic', label: 'Seismic' },
                          { value: 'wind', label: 'Wind' },
                          { value: 'snow', label: 'Snow' },
                          { value: 'temperature', label: 'Temperature' },
                          { value: 'earth', label: 'Earth' },
                        ]}
                      />

                      <button type="button"
                        onClick={() => removeLoadCase(loadCase.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button type="button"
              onClick={generateCombinations}
              disabled={generating || loadCases.length === 0}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-200 dark:border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Generate Combinations
                </>
              )}
            </button>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-1">
            {combinations.length > 0 ? (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Combinations</h2>
                  <button type="button"
                    onClick={downloadCombinations}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-blue-300">
                      {combinations.length} combinations generated
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {combinations.map((combo) => (
                    <div key={combo.id} className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{combo.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${
                          combo.type === 'ULS' ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'
                        }`}>
                          {combo.type}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        {combo.cases.map((c, idx) => {
                          const caseData = loadCases.find(lc => lc.id === c.caseId);
                          return (
                            <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <span className="text-amber-400">{c.factor > 0 ? '+' : ''}{c.factor.toFixed(2)}</span>
                              <span>×</span>
                              <span>{caseData?.name || 'Unknown'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 h-full">
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <FileText className="w-16 h-16 text-slate-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Combinations Yet</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure load cases and click generate to create combinations
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LoadCombinationPage);
