/**
 * ============================================================================
 * GEOTECHNICAL ENGINEERING UI COMPONENTS
 * ============================================================================
 * 
 * React components for geotechnical engineering calculations
 * Integrates with GeotechnicalEngine
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface SoilLayer {
  id: number;
  name: string;
  thickness: number;
  unitWeight: number;
  saturatedUnitWeight: number;
  cohesion: number;
  frictionAngle: number;
  E: number; // Young's modulus (kPa)
  mv: number; // Coefficient of volume compressibility (m²/kN)
  Cc: number; // Compression index
  e0: number; // Initial void ratio
  OCR: number; // Over-consolidation ratio
  permeability: number; // m/s
}

interface FoundationInput {
  type: 'strip' | 'square' | 'rectangular' | 'circular';
  width: number;
  length?: number;
  depth: number;
  load?: number;
}

// =============================================================================
// BEARING CAPACITY CALCULATOR
// =============================================================================

export function BearingCapacityCalculator() {
  const [method, setMethod] = useState<'terzaghi' | 'meyerhof' | 'hansen' | 'vesic'>('terzaghi');
  const [foundation, setFoundation] = useState<FoundationInput>({
    type: 'square',
    width: 2,
    length: 2,
    depth: 1.5,
  });
  const [soil, setSoil] = useState({
    cohesion: 25, // kPa
    frictionAngle: 30, // degrees
    unitWeight: 18, // kN/m³
    waterTableDepth: 10, // m from surface
  });
  const [result, setResult] = useState<{
    Nc: number;
    Nq: number;
    Ny: number;
    qu: number;
    qa: number;
    FOS: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const calculate = useCallback(() => {
    const { cohesion: c, frictionAngle: phi, unitWeight: gamma } = soil;
    const { width: B, depth: Df, type } = foundation;
    const phiRad = (phi * Math.PI) / 180;

    let Nc: number, Nq: number, Ny: number;
    let sc = 1, sq = 1, sy = 1; // Shape factors
    let dc = 1, dq = 1, dy = 1; // Depth factors

    // Bearing capacity factors
    if (method === 'terzaghi') {
      // Terzaghi's factors
      Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
      Nc = (Nq - 1) / Math.tan(phiRad);
      Ny = 2 * (Nq + 1) * Math.tan(phiRad);

      // Shape factors (Terzaghi)
      if (type === 'square') {
        sc = 1.3;
        sy = 0.8;
      } else if (type === 'circular') {
        sc = 1.3;
        sy = 0.6;
      }
    } else if (method === 'meyerhof') {
      // Meyerhof's factors
      Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
      Nc = (Nq - 1) / Math.tan(phiRad);
      Ny = (Nq - 1) * Math.tan(1.4 * phiRad);

      // Shape factors
      const L = foundation.length || B;
      sc = 1 + 0.2 * (B / L) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
      sq = 1 + 0.1 * (B / L) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
      sy = sq;

      // Depth factors
      dc = 1 + 0.2 * (Df / B) * Math.tan(Math.PI / 4 + phiRad / 2);
      dq = 1 + 0.1 * (Df / B) * Math.tan(Math.PI / 4 + phiRad / 2);
      dy = dq;
    } else {
      // Hansen's factors (also used for Vesic with slight modifications)
      Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
      Nc = (Nq - 1) / Math.tan(phiRad);
      Ny = method === 'vesic' 
        ? 2 * (Nq + 1) * Math.tan(phiRad)
        : 1.5 * (Nq - 1) * Math.tan(phiRad);

      // Shape factors (Hansen/Vesic)
      const L = foundation.length || B;
      sc = 1 + (B / L) * (Nq / Nc);
      sq = 1 + (B / L) * Math.tan(phiRad);
      sy = 1 - 0.4 * (B / L);

      // Depth factors
      const k = Df / B <= 1 ? Df / B : Math.atan(Df / B);
      dc = 1 + 0.4 * k;
      dq = 1 + 2 * Math.tan(phiRad) * Math.pow(1 - Math.sin(phiRad), 2) * k;
      dy = 1;
    }

    // Ultimate bearing capacity
    const qu = c * Nc * sc * dc + gamma * Df * Nq * sq * dq + 0.5 * gamma * B * Ny * sy * dy;
    
    // Allowable bearing capacity (FOS = 3)
    const FOS = 3;
    const qa = qu / FOS;

    setResult({ Nc, Nq, Ny, qu, qa, FOS });
  }, [method, foundation, soil]);

  // Draw foundation diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw ground
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, h * 0.4, w, h * 0.6);

    // Draw soil layers
    ctx.fillStyle = '#a3684a';
    ctx.fillRect(0, h * 0.4, w, h * 0.3);
    
    // Hatching for soil
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, h * 0.4);
      ctx.lineTo(i + 20, h);
      ctx.stroke();
    }

    // Draw excavation
    const excWidth = w * 0.4;
    const excDepth = h * 0.15;
    const excX = (w - excWidth) / 2;
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(excX, h * 0.4, excWidth, excDepth);

    // Draw foundation
    const foundWidth = w * 0.35;
    const foundDepth = h * 0.08;
    const foundX = (w - foundWidth) / 2;
    const foundY = h * 0.4 + excDepth - foundDepth;

    ctx.fillStyle = '#64748b';
    ctx.fillRect(foundX, foundY, foundWidth, foundDepth);

    // Foundation label
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`B = ${foundation.width}m`, w / 2, foundY + foundDepth / 2 + 4);

    // Draw column
    const colWidth = w * 0.08;
    ctx.fillStyle = '#475569';
    ctx.fillRect((w - colWidth) / 2, h * 0.1, colWidth, foundY - h * 0.1);

    // Draw load arrow
    ctx.strokeStyle = '#dc2626';
    ctx.fillStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.1);
    ctx.lineTo(w / 2 - 8, h * 0.04);
    ctx.lineTo(w / 2 + 8, h * 0.04);
    ctx.fill();
    ctx.font = '11px sans-serif';
    ctx.fillText('P', w / 2 + 15, h * 0.05);

    // Depth dimension
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(w * 0.85, h * 0.4);
    ctx.lineTo(w * 0.85, foundY + foundDepth);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#3b82f6';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Df = ${foundation.depth}m`, w * 0.87, (h * 0.4 + foundY + foundDepth) / 2);

    // Bearing capacity zone
    if (result) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      
      const zoneDepth = foundation.width * 1.5;
      const scale = excDepth / foundation.depth;
      
      ctx.beginPath();
      ctx.moveTo(foundX, foundY + foundDepth);
      ctx.lineTo(foundX - zoneDepth * scale * 0.5, foundY + foundDepth + zoneDepth * scale);
      ctx.lineTo(foundX + foundWidth + zoneDepth * scale * 0.5, foundY + foundDepth + zoneDepth * scale);
      ctx.lineTo(foundX + foundWidth, foundY + foundDepth);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Water table (if applicable)
    if (soil.waterTableDepth < foundation.depth + foundation.width * 2) {
      const wtY = h * 0.4 + (soil.waterTableDepth / (foundation.depth * 2)) * h * 0.4;
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(0, wtY);
      ctx.lineTo(w, wtY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#0ea5e9';
      ctx.font = '10px sans-serif';
      ctx.fillText('▼ GWT', 10, wtY - 5);
    }

  }, [foundation, soil, result]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Bearing Capacity Calculator</h2>
        <p className="text-amber-100 text-sm">Terzaghi, Meyerhof, Hansen & Vesic Methods</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-6">
            {/* Method Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Method</label>
              <div className="grid grid-cols-4 gap-2">
                {(['terzaghi', 'meyerhof', 'hansen', 'vesic'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      method === m
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Foundation Parameters */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-3">Foundation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select
                    value={foundation.type}
                    onChange={(e) => setFoundation({ ...foundation, type: e.target.value as FoundationInput['type'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="strip">Strip</option>
                    <option value="square">Square</option>
                    <option value="rectangular">Rectangular</option>
                    <option value="circular">Circular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Width B (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foundation.width}
                    onChange={(e) => setFoundation({ ...foundation, width: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                {foundation.type === 'rectangular' && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Length L (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={foundation.length}
                      onChange={(e) => setFoundation({ ...foundation, length: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Depth Df (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foundation.depth}
                    onChange={(e) => setFoundation({ ...foundation, depth: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Soil Parameters */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-3">Soil Properties</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cohesion c (kPa)</label>
                  <input
                    type="number"
                    value={soil.cohesion}
                    onChange={(e) => setSoil({ ...soil, cohesion: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Friction Angle φ (°)</label>
                  <input
                    type="number"
                    value={soil.frictionAngle}
                    onChange={(e) => setSoil({ ...soil, frictionAngle: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Unit Weight γ (kN/m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={soil.unitWeight}
                    onChange={(e) => setSoil({ ...soil, unitWeight: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Water Table Depth (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={soil.waterTableDepth}
                    onChange={(e) => setSoil({ ...soil, waterTableDepth: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={calculate}
              className="w-full py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              🔬 Calculate Bearing Capacity
            </button>
          </div>

          {/* Visualization & Results */}
          <div className="space-y-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="w-full border border-slate-200 rounded-lg bg-sky-50"
            />

            {result && (
              <div className="space-y-4">
                {/* Bearing Capacity Factors */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Bearing Capacity Factors</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{result.Nc.toFixed(2)}</div>
                      <div className="text-xs text-blue-500">Nc</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{result.Nq.toFixed(2)}</div>
                      <div className="text-xs text-blue-500">Nq</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{result.Ny.toFixed(2)}</div>
                      <div className="text-xs text-blue-500">Nγ</div>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{result.qu.toFixed(1)}</div>
                    <div className="text-sm text-red-500">Ultimate qu (kPa)</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{result.qa.toFixed(1)}</div>
                    <div className="text-sm text-green-500">Allowable qa (kPa)</div>
                    <div className="text-xs text-green-400">FOS = {result.FOS}</div>
                  </div>
                </div>

                {/* Formula */}
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="font-mono text-slate-700 text-center">
                    q<sub>u</sub> = cN<sub>c</sub>s<sub>c</sub>d<sub>c</sub> + γD<sub>f</sub>N<sub>q</sub>s<sub>q</sub>d<sub>q</sub> + 0.5γBN<sub>γ</sub>s<sub>γ</sub>d<sub>γ</sub>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SETTLEMENT CALCULATOR
// =============================================================================

export function SettlementCalculator() {
  const [foundation, setFoundation] = useState({
    width: 3,
    length: 3,
    depth: 1.5,
    appliedLoad: 500, // kN
  });

  const [soilLayers, setSoilLayers] = useState<SoilLayer[]>([
    {
      id: 1,
      name: 'Layer 1 - Sandy Clay',
      thickness: 3,
      unitWeight: 18,
      saturatedUnitWeight: 20,
      cohesion: 30,
      frictionAngle: 25,
      E: 15000,
      mv: 0.0002,
      Cc: 0.25,
      e0: 0.75,
      OCR: 1.5,
      permeability: 1e-8,
    },
    {
      id: 2,
      name: 'Layer 2 - Clay',
      thickness: 5,
      unitWeight: 17,
      saturatedUnitWeight: 19,
      cohesion: 40,
      frictionAngle: 20,
      E: 8000,
      mv: 0.0004,
      Cc: 0.35,
      e0: 0.85,
      OCR: 1.2,
      permeability: 1e-9,
    },
  ]);

  const [waterTableDepth, setWaterTableDepth] = useState(2);

  const [result, setResult] = useState<{
    immediate: number;
    consolidation: number;
    secondary: number;
    total: number;
    timeFor90: number; // days
  } | null>(null);

  const calculate = useCallback(() => {
    const B = foundation.width;
    const L = foundation.length;
    const Df = foundation.depth;
    const P = foundation.appliedLoad;
    const q = P / (B * L); // Applied pressure

    let immediate = 0;
    let consolidation = 0;
    let secondary = 0;

    // Simplified calculations
    soilLayers.forEach((layer, idx) => {
      const z = soilLayers.slice(0, idx).reduce((sum, l) => sum + l.thickness, 0) + layer.thickness / 2;
      const I = 1 / (1 + Math.pow(z / B, 2)); // Influence factor (Boussinesq)
      const deltaP = q * I; // Stress increase

      // Immediate settlement (elastic)
      immediate += (deltaP * layer.thickness) / layer.E;

      // Consolidation settlement
      const p0 = layer.unitWeight * (z - Df); // Initial effective stress
      const pf = p0 + deltaP; // Final effective stress
      consolidation += (layer.Cc * layer.thickness / (1 + layer.e0)) * Math.log10(pf / p0);

      // Secondary settlement (assume Cα/Cc = 0.04)
      secondary += 0.04 * consolidation * 0.1; // Simplified
    });

    // Time for 90% consolidation
    const H = soilLayers.reduce((sum, l) => sum + l.thickness, 0) / 2; // Drainage path
    const cv = 0.5e-7; // Assumed coefficient of consolidation (m²/s)
    const Tv90 = 0.848;
    const t90 = (Tv90 * H * H) / cv / (24 * 3600); // days

    setResult({
      immediate: immediate * 1000, // mm
      consolidation: consolidation * 1000, // mm
      secondary: secondary * 1000, // mm
      total: (immediate + consolidation + secondary) * 1000, // mm
      timeFor90: t90,
    });
  }, [foundation, soilLayers]);

  const addLayer = useCallback(() => {
    const maxId = Math.max(...soilLayers.map(l => l.id), 0);
    setSoilLayers([...soilLayers, {
      id: maxId + 1,
      name: `Layer ${maxId + 2}`,
      thickness: 3,
      unitWeight: 18,
      saturatedUnitWeight: 20,
      cohesion: 25,
      frictionAngle: 25,
      E: 10000,
      mv: 0.0003,
      Cc: 0.3,
      e0: 0.8,
      OCR: 1,
      permeability: 1e-8,
    }]);
  }, [soilLayers]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Settlement Analysis</h2>
        <p className="text-orange-100 text-sm">Immediate, Consolidation & Secondary Settlement</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Foundation Input */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Foundation</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Width B (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foundation.width}
                    onChange={(e) => setFoundation({ ...foundation, width: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Length L (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foundation.length}
                    onChange={(e) => setFoundation({ ...foundation, length: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Depth Df (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foundation.depth}
                    onChange={(e) => setFoundation({ ...foundation, depth: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Load P (kN)</label>
                  <input
                    type="number"
                    value={foundation.appliedLoad}
                    onChange={(e) => setFoundation({ ...foundation, appliedLoad: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Water Table Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterTableDepth}
                  onChange={(e) => setWaterTableDepth(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
            </div>

            <button
              onClick={calculate}
              className="w-full py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
            >
              🔬 Calculate Settlement
            </button>

            {/* Results */}
            {result && (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Immediate Settlement</span>
                    <span className="font-mono font-bold text-blue-800">{result.immediate.toFixed(2)} mm</span>
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700">Consolidation Settlement</span>
                    <span className="font-mono font-bold text-amber-800">{result.consolidation.toFixed(2)} mm</span>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Secondary Settlement</span>
                    <span className="font-mono font-bold text-purple-800">{result.secondary.toFixed(2)} mm</span>
                  </div>
                </div>
                <div className="bg-green-100 rounded-lg p-3 border-2 border-green-300">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-700">Total Settlement</span>
                    <span className="font-mono font-bold text-green-800 text-lg">{result.total.toFixed(2)} mm</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  Time for 90% consolidation: <span className="font-mono font-medium">{result.timeFor90.toFixed(0)} days</span>
                </div>
              </div>
            )}
          </div>

          {/* Soil Layers */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Soil Profile</h3>
              <button
                onClick={addLayer}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200"
              >
                + Add Layer
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {soilLayers.map((layer, idx) => (
                <div key={layer.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={layer.name}
                      onChange={(e) => {
                        const updated = [...soilLayers];
                        updated[idx].name = e.target.value;
                        setSoilLayers(updated);
                      }}
                      className="font-medium text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 outline-none"
                    />
                    {soilLayers.length > 1 && (
                      <button
                        onClick={() => setSoilLayers(soilLayers.filter(l => l.id !== layer.id))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Thickness (m)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={layer.thickness}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].thickness = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">γ (kN/m³)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={layer.unitWeight}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].unitWeight = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">E (kPa)</label>
                      <input
                        type="number"
                        value={layer.E}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].E = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Cc</label>
                      <input
                        type="number"
                        step="0.01"
                        value={layer.Cc}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].Cc = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">e₀</label>
                      <input
                        type="number"
                        step="0.01"
                        value={layer.e0}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].e0 = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">OCR</label>
                      <input
                        type="number"
                        step="0.1"
                        value={layer.OCR}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].OCR = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">c (kPa)</label>
                      <input
                        type="number"
                        value={layer.cohesion}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].cohesion = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">φ (°)</label>
                      <input
                        type="number"
                        value={layer.frictionAngle}
                        onChange={(e) => {
                          const updated = [...soilLayers];
                          updated[idx].frictionAngle = Number(e.target.value);
                          setSoilLayers(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Soil Profile Visualization */}
            <div className="mt-4 bg-gradient-to-b from-sky-100 to-amber-100 rounded-lg p-4 h-48">
              <SoilProfileVisualization
                layers={soilLayers}
                waterTableDepth={waterTableDepth}
                foundationDepth={foundation.depth}
                foundationWidth={foundation.width}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoilProfileVisualization({
  layers,
  waterTableDepth,
  foundationDepth,
  foundationWidth: _foundationWidth,
}: {
  layers: SoilLayer[];
  waterTableDepth: number;
  foundationDepth: number;
  foundationWidth: number;
}) {
  const totalDepth = layers.reduce((sum, l) => sum + l.thickness, 0);
  const scale = 150 / totalDepth;

  // Pre-calculate cumulative depths for each layer
  const layerPositions = layers.reduce<{ layer: SoilLayer; y: number; h: number }[]>((acc, layer, idx) => {
    const cumDepth = idx === 0 ? 0 : acc[idx - 1].y + acc[idx - 1].h;
    acc.push({ layer, y: cumDepth, h: layer.thickness * scale });
    return acc;
  }, []);
  const layerColors = ['#d4a574', '#b8956f', '#a3684a', '#8b5a3c', '#734d32'];

  return (
    <svg width="100%" viewBox="0 0 400 150" className="bg-transparent">
      {/* Layers */}
      {layerPositions.map(({ layer, y, h }, idx) => {
        return (
          <g key={layer.id}>
            <rect
              x={100}
              y={y}
              width={200}
              height={h}
              fill={layerColors[idx % layerColors.length]}
              stroke="#6b4423"
              strokeWidth="1"
            />
            <text x={310} y={y + h / 2 + 4} fontSize="10" fill="#6b4423">
              {layer.name}
            </text>
          </g>
        );
      })}

      {/* Foundation */}
      <rect
        x={150}
        y={foundationDepth * scale - 8}
        width={100}
        height={16}
        fill="#64748b"
        stroke="#1e293b"
        strokeWidth="2"
      />
      <text x={200} y={foundationDepth * scale + 3} textAnchor="middle" fontSize="9" fill="white">
        Foundation
      </text>

      {/* Water Table */}
      {waterTableDepth < totalDepth && (
        <g>
          <line
            x1={100}
            y1={waterTableDepth * scale}
            x2={300}
            y2={waterTableDepth * scale}
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
          <text x={95} y={waterTableDepth * scale + 4} textAnchor="end" fontSize="10" fill="#0ea5e9">
            GWT ▼
          </text>
        </g>
      )}

      {/* Scale */}
      <line x1={80} y1={0} x2={80} y2={totalDepth * scale} stroke="#6b7280" strokeWidth="1" />
      {layers.map((_, idx) => {
        const y = layers.slice(0, idx + 1).reduce((sum, l) => sum + l.thickness, 0) * scale;
        return (
          <g key={idx}>
            <line x1={75} y1={y} x2={85} y2={y} stroke="#6b7280" strokeWidth="1" />
            <text x={70} y={y + 3} textAnchor="end" fontSize="8" fill="#6b7280">
              {layers.slice(0, idx + 1).reduce((sum, l) => sum + l.thickness, 0)}m
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// =============================================================================
// SLOPE STABILITY ANALYZER
// =============================================================================

export function SlopeStabilityAnalyzer() {
  const [slopeGeometry, setSlopeGeometry] = useState({
    height: 10, // m
    angle: 30, // degrees
    topWidth: 20, // m
    bottomWidth: 30, // m
  });

  const [soilParams, setSoilParams] = useState({
    cohesion: 25, // kPa
    frictionAngle: 30, // degrees
    unitWeight: 18, // kN/m³
    saturatedUnitWeight: 20, // kN/m³
  });

  const [waterTable, setWaterTable] = useState({
    present: true,
    depthFromSurface: 5, // m
  });

  const [method, setMethod] = useState<'infinite' | 'culmann' | 'fellenius' | 'bishop'>('bishop');

  const [result, setResult] = useState<{
    FOS: number;
    criticalRadius?: number;
    criticalCenter?: { x: number; y: number };
    sliceForces?: { weight: number; normal: number; shear: number }[];
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const analyze = useCallback(() => {
    const { height: H, angle: beta } = slopeGeometry;
    const { cohesion: c, frictionAngle: phi, unitWeight: gamma } = soilParams;
    const betaRad = (beta * Math.PI) / 180;
    const phiRad = (phi * Math.PI) / 180;

    let FOS: number;

    if (method === 'infinite') {
      // Infinite slope analysis
      if (c === 0) {
        FOS = Math.tan(phiRad) / Math.tan(betaRad);
      } else {
        const z = H / 2; // Depth of failure plane
        FOS = (c / (gamma * z * Math.sin(betaRad) * Math.cos(betaRad))) +
              (Math.tan(phiRad) / Math.tan(betaRad));
      }
    } else if (method === 'culmann') {
      // Culmann's method (planar failure surface)
      const Hc = (4 * c * Math.sin(betaRad) * Math.cos(phiRad)) /
                 (gamma * (1 - Math.cos(betaRad - phiRad)));
      FOS = Hc / H;
    } else {
      // Fellenius or Bishop (simplified circular slip - using approximate method for demo)
      // Note: R, theta, W are calculated for reference but not used in this simplified demo
      const _R = H * 1.5; // Approximate slip circle radius
      const _theta = Math.PI / 4; // Arc angle
      const _W = 0.5 * gamma * H * H / Math.tan(betaRad); // Total weight (approximate)
      void _R; void _theta; void _W; // Suppress unused warnings
      
      if (method === 'fellenius') {
        // Ordinary Method of Slices
        const numSlices = 10;
        let sumResisting = 0;
        let sumDriving = 0;
        
        for (let i = 0; i < numSlices; i++) {
          const alpha = -30 + (i * 60 / numSlices); // degrees
          const alphaRad = (alpha * Math.PI) / 180;
          const b = H / numSlices;
          const h = H * (1 - i / numSlices) * 0.8; // Approximate slice height
          const Wi = gamma * b * h;
          
          sumDriving += Wi * Math.sin(alphaRad);
          sumResisting += c * b / Math.cos(alphaRad) + Wi * Math.cos(alphaRad) * Math.tan(phiRad);
        }
        
        FOS = sumResisting / sumDriving;
      } else {
        // Bishop's Simplified Method
        const numSlices = 10;
        let sumResisting = 0;
        let sumDriving = 0;
        
        for (let i = 0; i < numSlices; i++) {
          const alpha = -30 + (i * 60 / numSlices);
          const alphaRad = (alpha * Math.PI) / 180;
          const b = H / numSlices;
          const h = H * (1 - Math.abs(i - numSlices / 2) / (numSlices / 2)) * 0.8;
          const Wi = gamma * b * h;
          
          // Iterative calculation (simplified - assume initial FOS)
          const m = Math.cos(alphaRad) + Math.sin(alphaRad) * Math.tan(phiRad) / 1.5;
          
          sumDriving += Wi * Math.sin(alphaRad);
          sumResisting += (c * b + Wi * Math.tan(phiRad)) / m;
        }
        
        FOS = sumResisting / sumDriving;
      }
    }

    setResult({
      FOS: Math.max(0, FOS),
      criticalRadius: slopeGeometry.height * 1.5,
      criticalCenter: { x: slopeGeometry.height * 0.3, y: -slopeGeometry.height * 0.5 },
    });
  }, [slopeGeometry, soilParams, method]);

  // Draw slope diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Scale
    const scale = Math.min(w / 60, h / 30);
    const offsetX = 50;
    const offsetY = h - 30;

    // Draw coordinate system
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(w - 20, offsetY);
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX, 20);
    ctx.stroke();

    // Calculate slope points
    const H = slopeGeometry.height;
    const beta = (slopeGeometry.angle * Math.PI) / 180;
    const L = H / Math.tan(beta); // Horizontal projection

    const points = [
      { x: 0, y: 0 },
      { x: slopeGeometry.topWidth, y: 0 },
      { x: slopeGeometry.topWidth + L, y: -H },
      { x: slopeGeometry.topWidth + L + slopeGeometry.bottomWidth, y: -H },
    ];

    // Draw fill
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(offsetX + points[0].x * scale, offsetY + points[0].y * scale);
    points.forEach(p => {
      ctx.lineTo(offsetX + p.x * scale, offsetY + p.y * scale);
    });
    ctx.lineTo(offsetX + points[points.length - 1].x * scale, offsetY);
    ctx.closePath();
    ctx.fill();

    // Draw slope surface
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(offsetX + points[0].x * scale, offsetY + points[0].y * scale);
    points.forEach(p => {
      ctx.lineTo(offsetX + p.x * scale, offsetY + p.y * scale);
    });
    ctx.stroke();

    // Draw slip circle if result exists
    if (result && result.criticalRadius) {
      const R = result.criticalRadius;
      const cx = offsetX + (slopeGeometry.topWidth + L / 2) * scale;
      const cy = offsetY - H * scale - R * scale * 0.3;

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, R * scale * 0.8, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw center
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.fillText('O', cx + 8, cy - 5);

      // Draw radius
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * scale * 0.5, cy + R * scale * 0.4);
      ctx.stroke();
      ctx.fillText(`R = ${R.toFixed(1)}m`, cx + R * scale * 0.3, cy + R * scale * 0.2);
    }

    // Water table
    if (waterTable.present) {
      const wty = offsetY - waterTable.depthFromSurface * scale;
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(offsetX, wty);
      ctx.lineTo(w - 20, wty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#0ea5e9';
      ctx.font = '10px sans-serif';
      ctx.fillText('▼ GWT', w - 50, wty - 5);
    }

    // Dimensions
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';

    // Height dimension
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const dimX = offsetX + (slopeGeometry.topWidth + L) * scale + 20;
    ctx.moveTo(dimX, offsetY);
    ctx.lineTo(dimX, offsetY - H * scale);
    ctx.moveTo(dimX - 5, offsetY);
    ctx.lineTo(dimX + 5, offsetY);
    ctx.moveTo(dimX - 5, offsetY - H * scale);
    ctx.lineTo(dimX + 5, offsetY - H * scale);
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`H = ${H}m`, dimX + 8, offsetY - H * scale / 2);

    // Angle
    ctx.beginPath();
    const angleStartX = offsetX + slopeGeometry.topWidth * scale;
    const angleStartY = offsetY;
    ctx.arc(angleStartX, angleStartY, 30, -Math.PI, -Math.PI + beta, false);
    ctx.stroke();
    ctx.fillText(`β = ${slopeGeometry.angle}°`, angleStartX + 35, angleStartY - 10);

  }, [slopeGeometry, waterTable, result]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-stone-600 to-stone-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Slope Stability Analysis</h2>
        <p className="text-stone-100 text-sm">Infinite Slope, Culmann, Fellenius & Bishop Methods</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {/* Method Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Method</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'infinite', name: 'Infinite' },
                  { id: 'culmann', name: 'Culmann' },
                  { id: 'fellenius', name: 'Fellenius' },
                  { id: 'bishop', name: 'Bishop' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id as typeof method)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                      method === m.id
                        ? 'bg-stone-600 text-slate-900 dark:text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Slope Geometry */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-3">Slope Geometry</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Height H (m)</label>
                  <input
                    type="number"
                    value={slopeGeometry.height}
                    onChange={(e) => setSlopeGeometry({ ...slopeGeometry, height: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Angle β (°)</label>
                  <input
                    type="number"
                    value={slopeGeometry.angle}
                    onChange={(e) => setSlopeGeometry({ ...slopeGeometry, angle: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
              </div>
            </div>

            {/* Soil Properties */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-3">Soil Properties</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cohesion c (kPa)</label>
                  <input
                    type="number"
                    value={soilParams.cohesion}
                    onChange={(e) => setSoilParams({ ...soilParams, cohesion: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Friction φ (°)</label>
                  <input
                    type="number"
                    value={soilParams.frictionAngle}
                    onChange={(e) => setSoilParams({ ...soilParams, frictionAngle: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Unit Weight γ (kN/m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={soilParams.unitWeight}
                    onChange={(e) => setSoilParams({ ...soilParams, unitWeight: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">GWT Depth (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={waterTable.depthFromSurface}
                    onChange={(e) => setWaterTable({ ...waterTable, depthFromSurface: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={analyze}
              className="w-full py-3 bg-stone-600 text-slate-900 dark:text-white rounded-lg font-semibold hover:bg-stone-700"
            >
              🔬 Analyze Stability
            </button>

            {/* Result */}
            {result && (
              <div className={`rounded-lg p-4 text-center ${
                result.FOS >= 1.5 ? 'bg-green-50 border-2 border-green-300' :
                result.FOS >= 1.0 ? 'bg-amber-50 border-2 border-amber-300' :
                'bg-red-50 border-2 border-red-300'
              }`}>
                <div className="text-sm text-slate-600 mb-1">Factor of Safety</div>
                <div className={`text-4xl font-bold ${
                  result.FOS >= 1.5 ? 'text-green-600' :
                  result.FOS >= 1.0 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {result.FOS.toFixed(3)}
                </div>
                <div className={`text-sm mt-2 ${
                  result.FOS >= 1.5 ? 'text-green-700' :
                  result.FOS >= 1.0 ? 'text-amber-700' :
                  'text-red-700'
                }`}>
                  {result.FOS >= 1.5 ? '✓ STABLE (FOS ≥ 1.5)' :
                   result.FOS >= 1.0 ? '⚠ MARGINALLY STABLE' :
                   '✗ UNSTABLE (FOS < 1.0)'}
                </div>
              </div>
            )}
          </div>

          {/* Visualization */}
          <div>
            <canvas
              ref={canvasRef}
              width={450}
              height={350}
              className="w-full border border-slate-200 rounded-lg bg-sky-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  BearingCapacityCalculator,
  SettlementCalculator,
  SlopeStabilityAnalyzer,
};
