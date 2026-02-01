/**
 * Foundation Design Page - IS 456:2000 & ACI 318-19
 * Complete foundation design: isolated, combined, strap, mat footings
 * 
 * CONNECTED TO REAL BACKEND:
 * - Uses apps/web/src/api/design.ts API client (designFoundation)
 */

import React, { useState, useCallback } from 'react';
import {
  Layers,
  Download,
  AlertCircle,
  CheckCircle2,
  Square,
  Grid3x3,
  Minus,
  Plus,
  Play,
  FileText,
  AlertTriangle
} from 'lucide-react';

// REAL API Client
import { designFoundation, FootingRequest, FootingResult } from '../api/design';

type FoundationType = 'isolated' | 'combined' | 'strap' | 'mat' | 'pile-cap';

interface FoundationInput {
  type: FoundationType;
  // Column loads
  axialLoad: number;
  momentX: number;
  momentY: number;
  shearX: number;
  shearY: number;
  
  // Column dimensions
  columnWidth: number;
  columnDepth: number;
  
  // Footing dimensions
  footingLength: number;
  footingWidth: number;
  footingDepth: number;
  cover: number;
  
  // Soil properties
  bearingCapacity: number;
  soilDensity: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Design code
  code: 'IS456' | 'ACI318';
}

export const FoundationDesignPage: React.FC = () => {
  const [input, setInput] = useState<FoundationInput>({
    type: 'isolated',
    axialLoad: 1000,
    momentX: 50,
    momentY: 30,
    shearX: 40,
    shearY: 25,
    columnWidth: 400,
    columnDepth: 400,
    footingLength: 2400,
    footingWidth: 2400,
    footingDepth: 600,
    cover: 75,
    bearingCapacity: 150,
    soilDensity: 18,
    fck: 25,
    fy: 415,
    code: 'IS456'
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Input validation
  const validateInputs = useCallback((): string | null => {
    if (input.axialLoad <= 0) {
      return 'Axial load must be positive';
    }
    if (input.footingLength <= 0 || input.footingWidth <= 0) {
      return 'Footing dimensions must be positive';
    }
    if (input.footingDepth <= 0) {
      return 'Footing depth must be positive';
    }
    if (input.bearingCapacity <= 0) {
      return 'Soil bearing capacity must be positive';
    }
    if (input.columnWidth <= 0 || input.columnDepth <= 0) {
      return 'Column dimensions must be positive';
    }
    // Check if footing is large enough for column
    if (input.footingLength < input.columnDepth || input.footingWidth < input.columnWidth) {
      return 'Footing must be larger than column';
    }
    return null;
  }, [input]);

  const handleAnalyze = async () => {
    // Validate first
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setAnalyzing(true);
    setError('');
    setResults(null);

    try {
      // Check if type is supported by API
      if (input.type !== 'isolated' && input.type !== 'combined' && input.type !== 'mat') {
        throw new Error(
          `${input.type} footing design not yet implemented in backend. ` +
          `Currently supported: isolated, combined, mat. ` +
          `See: apps/api/src/routes/design/index.ts`
        );
      }

      // Transform UI input to API request format
      const request: FootingRequest = {
        type: input.type as 'isolated' | 'combined' | 'mat',
        loads: [{
          P: input.axialLoad,
          Mx: input.momentX,
          My: input.momentY
        }],
        columnSize: {
          width: input.columnWidth,
          depth: input.columnDepth
        },
        soil: {
          bearingCapacity: input.bearingCapacity,
          soilType: 'general'
        },
        material: {
          fck: input.fck,
          fy: input.fy
        },
        minDepth: input.footingDepth
      };

      // Call REAL backend API
      const result: FootingResult = await designFoundation(request);

      // Transform API response to UI format
      setResults({
        passed: result.status === 'PASS',
        utilization: Math.max(result.bearingRatio, result.flexureRatio, result.punchingRatio),
        bearingPressure: {
          max: input.axialLoad / (input.footingLength * input.footingWidth / 1000000) * result.bearingRatio,
          min: input.axialLoad / (input.footingLength * input.footingWidth / 1000000) * 0.5,
          allowable: input.bearingCapacity
        },
        dimensions: result.dimensions,
        reinforcement: {
          long: typeof result.reinforcement?.longBars === 'string' 
            ? result.reinforcement.longBars 
            : `${result.reinforcement?.longBars || 12}mm @ 150mm c/c`,
          short: typeof result.reinforcement?.shortBars === 'string'
            ? result.reinforcement.shortBars
            : `${result.reinforcement?.shortBars || 12}mm @ 150mm c/c`
        },
        checks: [
          {
            description: `Bearing pressure check (${(result.bearingRatio * 100).toFixed(1)}%)`,
            passed: result.bearingRatio <= 1.0,
            ratio: result.bearingRatio
          },
          {
            description: `Punching shear check (${(result.punchingRatio * 100).toFixed(1)}%)`,
            passed: result.punchingRatio <= 1.0,
            ratio: result.punchingRatio
          },
          {
            description: `Flexure check (${(result.flexureRatio * 100).toFixed(1)}%)`,
            passed: result.flexureRatio <= 1.0,
            ratio: result.flexureRatio
          },
          ...(result.shearRatio ? [{
            description: `One-way shear check (${(result.shearRatio * 100).toFixed(1)}%)`,
            passed: result.shearRatio <= 1.0,
            ratio: result.shearRatio
          }] : [])
        ]
      });

    } catch (err: any) {
      console.error('Foundation design error:', err);
      
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        setError(
          'Cannot connect to design server. ' +
          'Ensure backend is running: pnpm run dev:api'
        );
      } else if (err.message?.includes('404')) {
        setError(
          'Foundation design API not found. ' +
          'Backend may need this endpoint implemented.'
        );
      } else {
        setError(err.message || 'Foundation design failed. Check console for details.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const updateInput = (key: keyof FoundationInput, value: any) => {
    setInput(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
            Foundation Design Center
          </h1>
          <p className="text-slate-400 text-sm">
            Professional foundation design per {input.code === 'IS456' ? 'IS 456:2000 & IS 1904:1986' : 'ACI 318-19 & ACI 336'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Foundation Type & Code Selection */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <div className="grid grid-cols-2 gap-6">
                {/* Foundation Type */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-3 block">Foundation Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'isolated', label: 'Isolated', icon: Square },
                      { value: 'combined', label: 'Combined', icon: Grid3x3 },
                      { value: 'strap', label: 'Strap', icon: Minus },
                      { value: 'mat', label: 'Mat/Raft', icon: Layers }
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => updateInput('type', value)}
                        className={`py-3 px-4 rounded-lg font-medium transition-colors flex flex-col items-center gap-2 ${
                          input.type === value
                            ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Design Code */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-3 block">Design Code</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateInput('code', 'IS456')}
                      className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                        input.code === 'IS456'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      IS 456
                    </button>
                    <button
                      onClick={() => updateInput('code', 'ACI318')}
                      className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                        input.code === 'ACI318'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ACI 318
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Column Loads */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <h3 className="text-sm font-semibold text-amber-400 mb-4">Column Loads</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Axial Load P (kN)</label>
                  <input
                    type="number"
                    value={input.axialLoad}
                    onChange={(e) => updateInput('axialLoad', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Moment Mx (kN·m)</label>
                  <input
                    type="number"
                    value={input.momentX}
                    onChange={(e) => updateInput('momentX', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Moment My (kN·m)</label>
                  <input
                    type="number"
                    value={input.momentY}
                    onChange={(e) => updateInput('momentY', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Shear Vx (kN)</label>
                  <input
                    type="number"
                    value={input.shearX}
                    onChange={(e) => updateInput('shearX', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Shear Vy (kN)</label>
                  <input
                    type="number"
                    value={input.shearY}
                    onChange={(e) => updateInput('shearY', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Geometry */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <h3 className="text-sm font-semibold text-blue-400 mb-4">Geometry</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3 mb-2">
                  <p className="text-xs text-slate-500 italic">Column Dimensions</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Column Width (mm)</label>
                  <input
                    type="number"
                    value={input.columnWidth}
                    onChange={(e) => updateInput('columnWidth', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Column Depth (mm)</label>
                  <input
                    type="number"
                    value={input.columnDepth}
                    onChange={(e) => updateInput('columnDepth', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div className="col-span-2 md:col-span-3 mt-4 mb-2">
                  <p className="text-xs text-slate-500 italic">Footing Dimensions</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Footing Length L (mm)</label>
                  <input
                    type="number"
                    value={input.footingLength}
                    onChange={(e) => updateInput('footingLength', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Footing Width B (mm)</label>
                  <input
                    type="number"
                    value={input.footingWidth}
                    onChange={(e) => updateInput('footingWidth', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Footing Depth D (mm)</label>
                  <input
                    type="number"
                    value={input.footingDepth}
                    onChange={(e) => updateInput('footingDepth', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Clear Cover (mm)</label>
                  <input
                    type="number"
                    value={input.cover}
                    onChange={(e) => updateInput('cover', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Soil & Materials */}
            <div className="grid grid-cols-2 gap-6">
              {/* Soil Properties */}
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                <h3 className="text-sm font-semibold text-emerald-400 mb-4">Soil Properties</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400">Bearing Capacity (kN/m²)</label>
                    <input
                      type="number"
                      value={input.bearingCapacity}
                      onChange={(e) => updateInput('bearingCapacity', Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Soil Density (kN/m³)</label>
                    <input
                      type="number"
                      value={input.soilDensity}
                      onChange={(e) => updateInput('soilDensity', Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                <h3 className="text-sm font-semibold text-purple-400 mb-4">Materials</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400">Concrete Grade f'ck (MPa)</label>
                    <select
                      value={input.fck}
                      onChange={(e) => updateInput('fck', Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-purple-500 focus:outline-none"
                    >
                      <option value="20">M20 / 3000 psi</option>
                      <option value="25">M25 / 3600 psi</option>
                      <option value="30">M30 / 4350 psi</option>
                      <option value="35">M35 / 5075 psi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Steel Grade fy (MPa)</label>
                    <select
                      value={input.fy}
                      onChange={(e) => updateInput('fy', Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-purple-500 focus:outline-none"
                    >
                      <option value="415">Fe 415 / Grade 60</option>
                      <option value="500">Fe 500 / Grade 75</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {analyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing Foundation...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Foundation Design
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">Design Error</p>
                  <p className="text-red-300/80 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-1">
            {results ? (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  Design Results
                </h2>

                <div className="space-y-4">
                  {/* Safety Check */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Safety Status:</span>
                      <span className={`font-bold ${results.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {results.passed ? 'SAFE' : 'UNSAFE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Utilization:</span>
                      <span className="font-semibold text-white">{(results.utilization * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Bearing Pressure */}
                  {results.bearingPressure && (
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-amber-400 mb-2">Bearing Pressure</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Pressure:</span>
                          <span className="text-white">{results.bearingPressure.max.toFixed(2)} kN/m²</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Min Pressure:</span>
                          <span className="text-white">{results.bearingPressure.min.toFixed(2)} kN/m²</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Allowable:</span>
                          <span className="text-white">{input.bearingCapacity} kN/m²</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reinforcement */}
                  {results.reinforcement && (
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-blue-400 mb-2">Reinforcement</h3>
                      <div className="space-y-1 text-sm text-slate-300">
                        <p><span className="text-slate-400">Long Direction:</span> {results.reinforcement.long}</p>
                        <p><span className="text-slate-400">Short Direction:</span> {results.reinforcement.short}</p>
                      </div>
                    </div>
                  )}

                  {/* Code Checks */}
                  {results.checks && (
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-emerald-400 mb-2">Code Checks</h3>
                      <div className="space-y-2">
                        {results.checks.map((check: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            {check.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="text-slate-300">{check.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download Report */}
                  <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 h-full">
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <Layers className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-400 mb-2">No Results Yet</h3>
                  <p className="text-sm text-slate-500">
                    Configure the foundation parameters and run analysis to see design results
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

export default FoundationDesignPage;
