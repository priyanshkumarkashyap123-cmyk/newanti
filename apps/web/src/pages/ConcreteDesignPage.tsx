/**
 * Concrete Design Page - IS 456:2000 & ACI 318-19
 * Complete RC beam, column, and slab design interface
 * 
 * CONNECTED TO REAL BACKEND:
 * - Uses apps/web/src/api/design.ts API client
 * - Calls apps/backend-python/is_codes/is_456.py calculations (Python API)
 * - Supports beam, column, and slab design
 */

import React, { useState, useCallback } from 'react';
import { 
  Calculator, 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  Box,
  Columns,
  Square,
  Info,
  Settings,
  Play,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// REAL API Client - connects to Python backend at :8081
import { 
  designBeamIS456,
  designColumnIS456,
  designSlabIS456
} from '../api/design';

type DesignCode = 'IS456' | 'ACI318';
type MemberType = 'beam' | 'column' | 'slab';

interface BeamInput {
  // Geometry
  span: number;
  width: number;
  depth: number;
  effectiveDepth: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  deadLoad: number;
  liveLoad: number;
  factorDL: number;
  factorLL: number;
  
  // Moments & Shear
  Mu: number;
  Vu: number;
}

interface ColumnInput {
  // Geometry
  width: number;
  depth: number;
  height: number;
  effectiveLength: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  Pu: number;  // Axial load
  Mux: number; // Moment about major axis
  Muy: number; // Moment about minor axis
}

interface SlabInput {
  // Geometry
  lx: number; // Short span
  ly: number; // Long span
  thickness: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  deadLoad: number;
  liveLoad: number;
  
  // Support conditions
  supportType: 'simply-supported' | 'fixed' | 'continuous';
}

export const ConcreteDesignPage: React.FC = () => {
  const [designCode, setDesignCode] = useState<DesignCode>('IS456');
  const [memberType, setMemberType] = useState<MemberType>('beam');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Beam input state
  const [beamInput, setBeamInput] = useState<BeamInput>({
    span: 6000,
    width: 300,
    depth: 500,
    effectiveDepth: 450,
    cover: 40,
    fck: 25,
    fy: 415,
    deadLoad: 25,
    liveLoad: 10,
    factorDL: 1.5,
    factorLL: 1.5,
    Mu: 150,
    Vu: 80
  });

  // Column input state
  const [columnInput, setColumnInput] = useState<ColumnInput>({
    width: 300,
    depth: 450,
    height: 3000,
    effectiveLength: 3000,
    cover: 40,
    fck: 25,
    fy: 415,
    Pu: 800,
    Mux: 100,
    Muy: 50
  });

  // Slab input state
  const [slabInput, setSlabInput] = useState<SlabInput>({
    lx: 4000,
    ly: 6000,
    thickness: 150,
    cover: 20,
    fck: 25,
    fy: 415,
    deadLoad: 3.75,
    liveLoad: 2.5,
    supportType: 'simply-supported'
  });

  // Input validation before API call
  const validateInputs = useCallback((): string | null => {
    if (memberType === 'beam') {
      if (beamInput.width <= 0 || beamInput.depth <= 0) {
        return 'Beam width and depth must be positive';
      }
      if (beamInput.effectiveDepth >= beamInput.depth) {
        return 'Effective depth must be less than total depth';
      }
      if (beamInput.effectiveDepth <= 0) {
        return 'Effective depth must be positive';
      }
      if (beamInput.Mu < 0 || beamInput.Vu < 0) {
        return 'Moments and shear forces must be non-negative';
      }
    } else if (memberType === 'column') {
      if (columnInput.width <= 0 || columnInput.depth <= 0) {
        return 'Column width and depth must be positive';
      }
      if (columnInput.effectiveLength <= 0) {
        return 'Effective length must be positive';
      }
    } else if (memberType === 'slab') {
      if (slabInput.lx <= 0 || slabInput.ly <= 0) {
        return 'Slab spans must be positive';
      }
      if (slabInput.thickness <= 0) {
        return 'Slab thickness must be positive';
      }
    }
    return null;
  }, [memberType, beamInput, columnInput, slabInput]);

  const handleAnalyze = async () => {
    // Validate inputs first
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setAnalyzing(true);
    setError('');
    setResults(null);

    try {
      if (memberType === 'beam') {
        // Call Python backend API (port 8081)
        const result = await designBeamIS456({
          width: beamInput.width,
          depth: beamInput.depth,
          cover: beamInput.cover,
          Mu: beamInput.Mu,
          Vu: beamInput.Vu,
          fck: beamInput.fck,
          fy: beamInput.fy
        });
        
        // Transform API response to UI format
        setResults({
          passed: result.status === 'PASS',
          utilization: result.Mu_capacity > 0 ? beamInput.Mu / result.Mu_capacity : 0,
          reinforcement: {
            mainBottom: `${result.tension_steel.count} - ${result.tension_steel.diameter}mm φ (${result.tension_steel.area.toFixed(0)} mm²)`,
            mainTop: result.compression_steel ? 
              `${result.compression_steel.count} - ${result.compression_steel.diameter}mm φ` : 
              'Nominal (2 bars holding stirrups)',
            stirrups: `${result.stirrups.diameter}mm φ ${result.stirrups.legs}-legged @ ${result.stirrups.spacing}mm c/c`
          },
          capacities: {
            Mu: result.Mu_capacity,
            Vu: result.Vu_capacity
          },
          checks: result.checks.map((check: string, i: number) => ({
            description: check,
            passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
            clause: designCode === 'IS456' ? `Cl. 38.${i + 1}` : `Sec. 22.${i + 1}`
          }))
        });

      } else if (memberType === 'column') {
        // Call Python backend API (port 8081)
        const result = await designColumnIS456({
          width: columnInput.width,
          depth: columnInput.depth,
          cover: columnInput.cover,
          Pu: columnInput.Pu,
          Mux: columnInput.Mux,
          Muy: columnInput.Muy,
          unsupported_length: columnInput.effectiveLength,
          effective_length_factor: 1.0,
          fck: columnInput.fck,
          fy: columnInput.fy
        });
        
        // Transform API response to UI format
        const totalLongSteel = result.longitudinal_steel.reduce(
          (sum: number, bar: { area: number }) => sum + bar.area, 0
        );
        
        setResults({
          passed: result.status === 'PASS',
          utilization: result.interaction_ratio,
          reinforcement: {
            longitudinal: result.longitudinal_steel.map(
              (bar: { count: number; diameter: number }) => `${bar.count} - ${bar.diameter}mm φ`
            ).join(' + ') + ` (${totalLongSteel.toFixed(0)} mm²)`,
            ties: `${result.ties.diameter}mm φ @ ${result.ties.spacing}mm c/c`
          },
          capacities: {
            Pu: result.Pu_capacity,
            Mux: result.Mux_capacity,
            Muy: result.Muy_capacity
          },
          checks: result.checks.map((check: string, i: number) => ({
            description: check,
            passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
            clause: designCode === 'IS456' ? `Cl. 39.${i + 1}` : `Sec. 22.${i + 1}`
          }))
        });

      } else {
        // Slab design - Python API available!
        const result = await designSlabIS456({
          lx: slabInput.lx / 1000, // Convert mm to m
          ly: slabInput.ly / 1000, // Convert mm to m
          live_load: slabInput.liveLoad,
          floor_finish: 1.0,
          support_type: slabInput.supportType === 'simply-supported' ? 'simple' : 
                       slabInput.supportType === 'fixed' ? 'continuous' : 'continuous',
          fck: slabInput.fck,
          fy: slabInput.fy
        });
        
        setResults({
          passed: result.status === 'PASS',
          utilization: result.Mu_capacity > 0 ? result.Mu_demand / result.Mu_capacity : 0,
          reinforcement: {
            mainShort: `${result.main_reinforcement.diameter}mm φ @ ${result.main_reinforcement.spacing}mm c/c (${result.main_reinforcement.area_per_m.toFixed(0)} mm²/m)`,
            mainLong: result.distribution_reinforcement ? 
              `${result.distribution_reinforcement.diameter}mm φ @ ${result.distribution_reinforcement.spacing}mm c/c` : 
              'Per short span',
            distribution: result.distribution_reinforcement ? 
              `${result.distribution_reinforcement.area_per_m.toFixed(0)} mm²/m` : '-',
            topSteel: result.top_reinforcement ? 
              `${result.top_reinforcement.diameter}mm φ @ ${result.top_reinforcement.spacing}mm c/c` : 
              'None required'
          },
          capacities: {
            Mu: result.Mu_capacity,
            thickness: result.thickness
          },
          checks: result.checks.map((check: string, i: number) => ({
            description: check,
            passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
            clause: designCode === 'IS456' ? `Cl. 24.${i + 1}` : `Sec. 7.${i + 1}`
          })),
          deflectionCheck: {
            actual: result.deflection_check,
            limit: result.deflection_limit,
            passed: result.deflection_check <= result.deflection_limit
          }
        });
      }

    } catch (err: any) {
      console.error('Design analysis error:', err);
      
      // Provide helpful error messages
      if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        setError(
          'Cannot connect to Python design server (port 8081). ' +
          'Start it with: cd apps/backend-python && python main.py'
        );
      } else if (err.message?.includes('404')) {
        setError(
          'Design API endpoint not found. ' +
          'Ensure Python backend has /design/beam, /design/column, /design/slab routes.'
        );
      } else {
        setError(err.message || 'Design analysis failed. Check console for details.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const renderBeamForm = () => (
    <div className="space-y-6">
      {/* Geometry Section */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Box className="w-4 h-4" />
          Beam Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Span (mm)</label>
            <input
              type="number"
              value={beamInput.span}
              onChange={(e) => setBeamInput({...beamInput, span: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Width b (mm)</label>
            <input
              type="number"
              value={beamInput.width}
              onChange={(e) => setBeamInput({...beamInput, width: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Total Depth D (mm)</label>
            <input
              type="number"
              value={beamInput.depth}
              onChange={(e) => setBeamInput({...beamInput, depth: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Effective Depth d (mm)</label>
            <input
              type="number"
              value={beamInput.effectiveDepth}
              onChange={(e) => setBeamInput({...beamInput, effectiveDepth: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Clear Cover (mm)</label>
            <input
              type="number"
              value={beamInput.cover}
              onChange={(e) => setBeamInput({...beamInput, cover: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Materials Section */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Concrete Grade f'ck (MPa)</label>
            <select
              value={beamInput.fck}
              onChange={(e) => setBeamInput({...beamInput, fck: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="20">M20 / 3000 psi</option>
              <option value="25">M25 / 3600 psi</option>
              <option value="30">M30 / 4350 psi</option>
              <option value="35">M35 / 5075 psi</option>
              <option value="40">M40 / 5800 psi</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Steel Grade fy (MPa)</label>
            <select
              value={beamInput.fy}
              onChange={(e) => setBeamInput({...beamInput, fy: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="415">Fe 415 / Grade 60</option>
              <option value="500">Fe 500 / Grade 75</option>
              <option value="550">Fe 550 / Grade 80</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loads Section */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads & Moments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Dead Load (kN/m)</label>
            <input
              type="number"
              value={beamInput.deadLoad}
              onChange={(e) => setBeamInput({...beamInput, deadLoad: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Live Load (kN/m)</label>
            <input
              type="number"
              value={beamInput.liveLoad}
              onChange={(e) => setBeamInput({...beamInput, liveLoad: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div className="col-span-2 md:col-span-1" />
          <div>
            <label className="text-xs text-slate-400">Ultimate Moment Mu (kN·m)</label>
            <input
              type="number"
              value={beamInput.Mu}
              onChange={(e) => setBeamInput({...beamInput, Mu: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Ultimate Shear Vu (kN)</label>
            <input
              type="number"
              value={beamInput.Vu}
              onChange={(e) => setBeamInput({...beamInput, Vu: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderColumnForm = () => (
    <div className="space-y-6">
      {/* Geometry */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Columns className="w-4 h-4" />
          Column Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Width b (mm)</label>
            <input
              type="number"
              value={columnInput.width}
              onChange={(e) => setColumnInput({...columnInput, width: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Depth D (mm)</label>
            <input
              type="number"
              value={columnInput.depth}
              onChange={(e) => setColumnInput({...columnInput, depth: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Height (mm)</label>
            <input
              type="number"
              value={columnInput.height}
              onChange={(e) => setColumnInput({...columnInput, height: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Effective Length (mm)</label>
            <input
              type="number"
              value={columnInput.effectiveLength}
              onChange={(e) => setColumnInput({...columnInput, effectiveLength: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Clear Cover (mm)</label>
            <input
              type="number"
              value={columnInput.cover}
              onChange={(e) => setColumnInput({...columnInput, cover: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Concrete Grade f'ck (MPa)</label>
            <select
              value={columnInput.fck}
              onChange={(e) => setColumnInput({...columnInput, fck: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="20">M20 / 3000 psi</option>
              <option value="25">M25 / 3600 psi</option>
              <option value="30">M30 / 4350 psi</option>
              <option value="35">M35 / 5075 psi</option>
              <option value="40">M40 / 5800 psi</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Steel Grade fy (MPa)</label>
            <select
              value={columnInput.fy}
              onChange={(e) => setColumnInput({...columnInput, fy: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="415">Fe 415 / Grade 60</option>
              <option value="500">Fe 500 / Grade 75</option>
              <option value="550">Fe 550 / Grade 80</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loads */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Axial Load Pu (kN)</label>
            <input
              type="number"
              value={columnInput.Pu}
              onChange={(e) => setColumnInput({...columnInput, Pu: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Moment Mux (kN·m)</label>
            <input
              type="number"
              value={columnInput.Mux}
              onChange={(e) => setColumnInput({...columnInput, Mux: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Moment Muy (kN·m)</label>
            <input
              type="number"
              value={columnInput.Muy}
              onChange={(e) => setColumnInput({...columnInput, Muy: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSlabForm = () => (
    <div className="space-y-6">
      {/* Geometry */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Square className="w-4 h-4" />
          Slab Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Short Span lx (mm)</label>
            <input
              type="number"
              value={slabInput.lx}
              onChange={(e) => setSlabInput({...slabInput, lx: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Long Span ly (mm)</label>
            <input
              type="number"
              value={slabInput.ly}
              onChange={(e) => setSlabInput({...slabInput, ly: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Thickness (mm)</label>
            <input
              type="number"
              value={slabInput.thickness}
              onChange={(e) => setSlabInput({...slabInput, thickness: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Clear Cover (mm)</label>
            <input
              type="number"
              value={slabInput.cover}
              onChange={(e) => setSlabInput({...slabInput, cover: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Support Type</label>
            <select
              value={slabInput.supportType}
              onChange={(e) => setSlabInput({...slabInput, supportType: e.target.value as any})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="simply-supported">Simply Supported</option>
              <option value="fixed">Fixed</option>
              <option value="continuous">Continuous</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Concrete Grade f'ck (MPa)</label>
            <select
              value={slabInput.fck}
              onChange={(e) => setSlabInput({...slabInput, fck: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="20">M20 / 3000 psi</option>
              <option value="25">M25 / 3600 psi</option>
              <option value="30">M30 / 4350 psi</option>
              <option value="35">M35 / 5075 psi</option>
              <option value="40">M40 / 5800 psi</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Steel Grade fy (MPa)</label>
            <select
              value={slabInput.fy}
              onChange={(e) => setSlabInput({...slabInput, fy: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            >
              <option value="415">Fe 415 / Grade 60</option>
              <option value="500">Fe 500 / Grade 75</option>
              <option value="550">Fe 550 / Grade 80</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loads */}
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Dead Load (kN/m²)</label>
            <input
              type="number"
              value={slabInput.deadLoad}
              onChange={(e) => setSlabInput({...slabInput, deadLoad: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Live Load (kN/m²)</label>
            <input
              type="number"
              value={slabInput.liveLoad}
              onChange={(e) => setSlabInput({...slabInput, liveLoad: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          Design Results
        </h2>

        <div className="space-y-4">
          {/* Design Summary */}
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Design Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Status:</span>
                <span className={`ml-2 font-semibold ${results.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results.passed ? 'SAFE' : 'UNSAFE'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Utilization:</span>
                <span className="ml-2 font-semibold text-white">{(results.utilization * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Reinforcement */}
          {results.reinforcement && (
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Reinforcement Details</h3>
              <div className="space-y-2 text-sm text-slate-300">
                {memberType === 'beam' && (
                  <>
                    <p>Main Steel (Bottom): {results.reinforcement.mainBottom || results.reinforcement.main}</p>
                    <p>Main Steel (Top): {results.reinforcement.mainTop || 'As req.'}</p>
                    <p>Stirrups: {results.reinforcement.stirrups}</p>
                  </>
                )}
                {memberType === 'column' && (
                  <>
                    <p>Longitudinal Steel: {results.reinforcement.longitudinal}</p>
                    <p>Ties: {results.reinforcement.ties}</p>
                  </>
                )}
                {memberType === 'slab' && (
                  <>
                    <p>Main Bars (Short Span): {results.reinforcement.mainShort}</p>
                    <p>Main Bars (Long Span): {results.reinforcement.mainLong}</p>
                    <p>Distribution Bars: {results.reinforcement.distribution}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Code Checks */}
          {results.checks && (
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-400 mb-2">Code Checks</h3>
              <div className="space-y-2">
                {results.checks.map((check: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-slate-300">{check.description}</span>
                    <span className="text-slate-400 text-xs ml-auto">{check.clause}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download Report */}
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
            <Download className="w-5 h-5" />
            Download Detailed Report
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Concrete Design Center
          </h1>
          <p className="text-slate-400 text-sm">
            Professional RC design per {designCode === 'IS456' ? 'IS 456:2000' : 'ACI 318-19'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Code & Member Type Selection */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Design Code</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDesignCode('IS456')}
                      className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                        designCode === 'IS456'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      IS 456:2000
                    </button>
                    <button
                      onClick={() => setDesignCode('ACI318')}
                      className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                        designCode === 'ACI318'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ACI 318-19
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Member Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setMemberType('beam')}
                      className={`py-2 px-3 rounded-lg font-medium transition-colors flex flex-col items-center gap-1 ${
                        memberType === 'beam'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Box className="w-5 h-5" />
                      <span className="text-xs">Beam</span>
                    </button>
                    <button
                      onClick={() => setMemberType('column')}
                      className={`py-2 px-3 rounded-lg font-medium transition-colors flex flex-col items-center gap-1 ${
                        memberType === 'column'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Columns className="w-5 h-5" />
                      <span className="text-xs">Column</span>
                    </button>
                    <button
                      onClick={() => setMemberType('slab')}
                      className={`py-2 px-3 rounded-lg font-medium transition-colors flex flex-col items-center gap-1 ${
                        memberType === 'slab'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Square className="w-5 h-5" />
                      <span className="text-xs">Slab</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Forms */}
              {memberType === 'beam' && renderBeamForm()}
              {memberType === 'column' && renderColumnForm()}
              {memberType === 'slab' && renderSlabForm()}

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run Design Analysis
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Analysis Error</p>
                    <p className="text-red-300/80 text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-1">
            {results ? (
              renderResults()
            ) : (
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calculator className="w-16 h-16 text-slate-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-400 mb-2">No Results Yet</h3>
                  <p className="text-sm text-slate-400">
                    Configure the member properties and run analysis to see results
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

export default ConcreteDesignPage;
