/**
 * ============================================================================
 * HYDRAULICS ENGINEERING UI COMPONENTS
 * ============================================================================
 * 
 * React components for hydraulic engineering calculations
 * Integrates with HydraulicsEngine
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// OPEN CHANNEL FLOW CALCULATOR
// =============================================================================

interface ChannelSection {
  type: 'rectangular' | 'trapezoidal' | 'triangular' | 'circular' | 'parabolic';
  bottomWidth?: number;
  sideSlope?: number;
  diameter?: number;
  topWidth?: number;
}

export function OpenChannelFlowCalculator() {
  const [channel, setChannel] = useState<ChannelSection>({
    type: 'trapezoidal',
    bottomWidth: 4,
    sideSlope: 1.5,
  });
  
  const [flowParams, setFlowParams] = useState({
    discharge: 15, // m³/s
    slope: 0.001, // m/m
    manningN: 0.025,
    depth: 2, // m (for analysis)
  });

  const [calcMode, setCalcMode] = useState<'normalDepth' | 'criticalDepth' | 'flowProfile'>('normalDepth');
  
  const [result, setResult] = useState<{
    normalDepth: number;
    criticalDepth: number;
    velocity: number;
    froudeNumber: number;
    flowRegime: 'subcritical' | 'critical' | 'supercritical';
    wettedPerimeter: number;
    hydraulicRadius: number;
    area: number;
    topWidth: number;
    specificEnergy: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const calculateArea = useCallback((y: number, section: ChannelSection): number => {
    switch (section.type) {
      case 'rectangular':
        return (section.bottomWidth || 0) * y;
      case 'trapezoidal':
        return (section.bottomWidth || 0) * y + (section.sideSlope || 0) * y * y;
      case 'triangular':
        return (section.sideSlope || 0) * y * y;
      case 'circular':
        const D = section.diameter || 0;
        const theta = 2 * Math.acos(1 - 2 * y / D);
        return (D * D / 8) * (theta - Math.sin(theta));
      case 'parabolic':
        return (2 / 3) * (section.topWidth || 0) * y;
      default:
        return 0;
    }
  }, []);

  const calculateWettedPerimeter = useCallback((y: number, section: ChannelSection): number => {
    switch (section.type) {
      case 'rectangular':
        return (section.bottomWidth || 0) + 2 * y;
      case 'trapezoidal':
        return (section.bottomWidth || 0) + 2 * y * Math.sqrt(1 + Math.pow(section.sideSlope || 0, 2));
      case 'triangular':
        return 2 * y * Math.sqrt(1 + Math.pow(section.sideSlope || 0, 2));
      case 'circular':
        const D = section.diameter || 0;
        return D * Math.acos(1 - 2 * y / D);
      case 'parabolic':
        // Approximate
        return (section.topWidth || 0) * (1 + 4 * y * y / Math.pow(section.topWidth || 1, 2));
      default:
        return 0;
    }
  }, []);

  const calculateTopWidth = useCallback((y: number, section: ChannelSection): number => {
    switch (section.type) {
      case 'rectangular':
        return section.bottomWidth || 0;
      case 'trapezoidal':
        return (section.bottomWidth || 0) + 2 * (section.sideSlope || 0) * y;
      case 'triangular':
        return 2 * (section.sideSlope || 0) * y;
      case 'circular':
        const D = section.diameter || 0;
        return Math.sqrt(y * (D - y)) * 2;
      case 'parabolic':
        return section.topWidth || 0;
      default:
        return 0;
    }
  }, []);

  const calculate = useCallback(() => {
    const { discharge: Q, slope: S, manningN: n } = flowParams;
    
    // Find normal depth using Newton-Raphson
    let yn = 1; // Initial guess
    for (let i = 0; i < 50; i++) {
      const A = calculateArea(yn, channel);
      const P = calculateWettedPerimeter(yn, channel);
      const R = A / P;
      const Qcalc = (1 / n) * A * Math.pow(R, 2/3) * Math.sqrt(S);
      
      // Derivative (numerical)
      const dy = 0.001;
      const A2 = calculateArea(yn + dy, channel);
      const P2 = calculateWettedPerimeter(yn + dy, channel);
      const R2 = A2 / P2;
      const Qcalc2 = (1 / n) * A2 * Math.pow(R2, 2/3) * Math.sqrt(S);
      const dQdy = (Qcalc2 - Qcalc) / dy;
      
      const error = Q - Qcalc;
      yn = yn + error / dQdy;
      
      if (Math.abs(error) < 0.0001) break;
    }

    // Find critical depth
    const g = 9.81;
    let yc = 1;
    for (let i = 0; i < 50; i++) {
      const A = calculateArea(yc, channel);
      const T = calculateTopWidth(yc, channel);
      const Acrit = Math.pow(Q * Q * T / g, 1/3);
      
      const error = A - Acrit;
      const dy = 0.001;
      const A2 = calculateArea(yc + dy, channel);
      const T2 = calculateTopWidth(yc + dy, channel);
      const Acrit2 = Math.pow(Q * Q * T2 / g, 1/3);
      const dAdy = (A2 - Acrit2) - (A - Acrit);
      
      yc = yc - error / (dAdy / dy + 1);
      
      if (Math.abs(error) < 0.0001) break;
    }

    // Calculate flow properties at normal depth
    const A = calculateArea(yn, channel);
    const P = calculateWettedPerimeter(yn, channel);
    const R = A / P;
    const T = calculateTopWidth(yn, channel);
    const V = Q / A;
    const Fr = V / Math.sqrt(g * A / T);
    const E = yn + V * V / (2 * g);

    setResult({
      normalDepth: yn,
      criticalDepth: yc,
      velocity: V,
      froudeNumber: Fr,
      flowRegime: Fr < 1 ? 'subcritical' : Fr > 1 ? 'supercritical' : 'critical',
      wettedPerimeter: P,
      hydraulicRadius: R,
      area: A,
      topWidth: T,
      specificEnergy: E,
    });
  }, [channel, flowParams, calculateArea, calculateWettedPerimeter, calculateTopWidth]);

  // Draw channel cross-section
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const scale = 30;
    const centerX = w / 2;
    const baseY = h * 0.75;

    // Draw channel section
    ctx.fillStyle = '#a3684a';
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;

    const b = channel.bottomWidth || 0;
    const z = channel.sideSlope || 0;
    const y = result?.normalDepth || flowParams.depth;
    const T = calculateTopWidth(y, channel);

    ctx.beginPath();
    if (channel.type === 'rectangular') {
      const halfB = b * scale / 2;
      ctx.moveTo(centerX - halfB - 20, baseY - y * scale - 20);
      ctx.lineTo(centerX - halfB, baseY - y * scale);
      ctx.lineTo(centerX - halfB, baseY);
      ctx.lineTo(centerX + halfB, baseY);
      ctx.lineTo(centerX + halfB, baseY - y * scale);
      ctx.lineTo(centerX + halfB + 20, baseY - y * scale - 20);
    } else if (channel.type === 'trapezoidal') {
      const halfB = b * scale / 2;
      const halfT = T * scale / 2;
      ctx.moveTo(centerX - halfT - 30, baseY - y * scale - 30);
      ctx.lineTo(centerX - halfT, baseY - y * scale);
      ctx.lineTo(centerX - halfB, baseY);
      ctx.lineTo(centerX + halfB, baseY);
      ctx.lineTo(centerX + halfT, baseY - y * scale);
      ctx.lineTo(centerX + halfT + 30, baseY - y * scale - 30);
    } else if (channel.type === 'triangular') {
      const halfT = T * scale / 2;
      ctx.moveTo(centerX - halfT - 30, baseY - y * scale - 30);
      ctx.lineTo(centerX - halfT, baseY - y * scale);
      ctx.lineTo(centerX, baseY);
      ctx.lineTo(centerX + halfT, baseY - y * scale);
      ctx.lineTo(centerX + halfT + 30, baseY - y * scale - 30);
    } else if (channel.type === 'circular') {
      const D = channel.diameter || 2;
      const R = D * scale / 2;
      ctx.arc(centerX, baseY - R, R, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Draw water surface
    if (result) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (channel.type === 'rectangular') {
        const halfB = b * scale / 2;
        ctx.moveTo(centerX - halfB, baseY);
        ctx.lineTo(centerX - halfB, baseY - y * scale);
        ctx.lineTo(centerX + halfB, baseY - y * scale);
        ctx.lineTo(centerX + halfB, baseY);
      } else if (channel.type === 'trapezoidal') {
        const halfB = b * scale / 2;
        const halfT = T * scale / 2;
        ctx.moveTo(centerX - halfB, baseY);
        ctx.lineTo(centerX - halfT, baseY - y * scale);
        ctx.lineTo(centerX + halfT, baseY - y * scale);
        ctx.lineTo(centerX + halfB, baseY);
      } else if (channel.type === 'triangular') {
        const halfT = T * scale / 2;
        ctx.moveTo(centerX, baseY);
        ctx.lineTo(centerX - halfT, baseY - y * scale);
        ctx.lineTo(centerX + halfT, baseY - y * scale);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Water surface pattern
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const waveY = baseY - y * scale + 2;
        ctx.moveTo(centerX - T * scale / 2 + 10, waveY + i * 5);
        for (let x = 0; x < T * scale - 20; x += 10) {
          ctx.quadraticCurveTo(
            centerX - T * scale / 2 + 10 + x + 5,
            waveY + i * 5 + (Math.random() - 0.5) * 3,
            centerX - T * scale / 2 + 10 + x + 10,
            waveY + i * 5
          );
        }
        ctx.stroke();
      }

      // Velocity arrow
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      const arrowY = baseY - y * scale / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, arrowY);
      ctx.lineTo(centerX + 30, arrowY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX + 40, arrowY);
      ctx.lineTo(centerX + 25, arrowY - 8);
      ctx.lineTo(centerX + 25, arrowY + 8);
      ctx.fill();
      ctx.font = '12px sans-serif';
      ctx.fillText(`V = ${result.velocity.toFixed(2)} m/s`, centerX + 45, arrowY + 4);
    }

    // Dimensions
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';

    // Bottom width
    if (b > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - b * scale / 2, baseY + 15);
      ctx.lineTo(centerX + b * scale / 2, baseY + 15);
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.textAlign = 'center';
      ctx.fillText(`b = ${b}m`, centerX, baseY + 30);
    }

    // Depth
    if (result) {
      ctx.strokeStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(centerX + T * scale / 2 + 25, baseY);
      ctx.lineTo(centerX + T * scale / 2 + 25, baseY - y * scale);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'left';
      ctx.fillText(`y = ${y.toFixed(3)}m`, centerX + T * scale / 2 + 30, baseY - y * scale / 2);
    }

    // Labels
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('Channel Cross-Section', centerX, 20);

  }, [channel, flowParams, result, calculateTopWidth]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Open Channel Flow Calculator</h2>
        <p className="text-cyan-100 text-sm">Manning's Equation & Critical Flow Analysis</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {/* Channel Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Channel Section</label>
              <div className="grid grid-cols-5 gap-2">
                {(['rectangular', 'trapezoidal', 'triangular', 'circular', 'parabolic'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setChannel({ ...channel, type })}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                      channel.type === type
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1).substring(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Geometry */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Channel Geometry</h3>
              <div className="grid grid-cols-2 gap-3">
                {(channel.type === 'rectangular' || channel.type === 'trapezoidal') && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bottom Width b (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={channel.bottomWidth}
                      onChange={(e) => setChannel({ ...channel, bottomWidth: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
                {(channel.type === 'trapezoidal' || channel.type === 'triangular') && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Side Slope z:1</label>
                    <input
                      type="number"
                      step="0.1"
                      value={channel.sideSlope}
                      onChange={(e) => setChannel({ ...channel, sideSlope: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
                {channel.type === 'circular' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Diameter D (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={channel.diameter}
                      onChange={(e) => setChannel({ ...channel, diameter: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Flow Parameters */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Flow Parameters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Discharge Q (m³/s)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={flowParams.discharge}
                    onChange={(e) => setFlowParams({ ...flowParams, discharge: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bed Slope S (m/m)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={flowParams.slope}
                    onChange={(e) => setFlowParams({ ...flowParams, slope: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Manning's n</label>
                  <input
                    type="number"
                    step="0.001"
                    value={flowParams.manningN}
                    onChange={(e) => setFlowParams({ ...flowParams, manningN: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={calculate}
              className="w-full py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700"
            >
              🔬 Calculate Flow Properties
            </button>
          </div>

          {/* Visualization & Results */}
          <div className="space-y-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={250}
              className="w-full border border-gray-200 rounded-lg bg-white"
            />

            {result && (
              <div className="space-y-4">
                {/* Flow Regime */}
                <div className={`rounded-lg p-4 text-center ${
                  result.flowRegime === 'subcritical' ? 'bg-blue-50' :
                  result.flowRegime === 'supercritical' ? 'bg-red-50' :
                  'bg-amber-50'
                }`}>
                  <div className="text-sm text-gray-600 mb-1">Flow Regime</div>
                  <div className={`text-2xl font-bold ${
                    result.flowRegime === 'subcritical' ? 'text-blue-600' :
                    result.flowRegime === 'supercritical' ? 'text-red-600' :
                    'text-amber-600'
                  }`}>
                    {result.flowRegime.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Fr = {result.froudeNumber.toFixed(3)}
                  </div>
                </div>

                {/* Key Results */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600">Normal Depth</div>
                    <div className="text-xl font-bold text-green-700">{result.normalDepth.toFixed(3)} m</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-amber-600">Critical Depth</div>
                    <div className="text-xl font-bold text-amber-700">{result.criticalDepth.toFixed(3)} m</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600">Velocity</div>
                    <div className="text-xl font-bold text-blue-700">{result.velocity.toFixed(2)} m/s</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-purple-600">Specific Energy</div>
                    <div className="text-xl font-bold text-purple-700">{result.specificEnergy.toFixed(3)} m</div>
                  </div>
                </div>

                {/* Additional Results */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Flow Area:</span>
                      <span className="font-mono">{result.area.toFixed(3)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Wetted Perimeter:</span>
                      <span className="font-mono">{result.wettedPerimeter.toFixed(3)} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hydraulic Radius:</span>
                      <span className="font-mono">{result.hydraulicRadius.toFixed(3)} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Top Width:</span>
                      <span className="font-mono">{result.topWidth.toFixed(3)} m</span>
                    </div>
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
// PIPE FLOW CALCULATOR
// =============================================================================

export function PipeFlowCalculator() {
  const [pipeParams, setPipeParams] = useState({
    diameter: 0.3, // m
    length: 100, // m
    roughness: 0.0001, // m (absolute roughness)
    kinematicViscosity: 1.004e-6, // m²/s (water at 20°C)
  });

  const [flowParams, setFlowParams] = useState({
    discharge: 0.05, // m³/s
    headAvailable: 5, // m
  });

  const [calcMode, setCalcMode] = useState<'headLoss' | 'discharge' | 'diameter'>('headLoss');
  
  const [method, setMethod] = useState<'darcy' | 'hazen' | 'manning'>('darcy');
  
  const [hazenC, setHazenC] = useState(130); // Hazen-Williams coefficient
  const [manningN, setManningN] = useState(0.012);

  const [result, setResult] = useState<{
    headLoss: number;
    velocity: number;
    reynoldsNumber: number;
    frictionFactor: number;
    flowRegime: 'laminar' | 'transitional' | 'turbulent';
    discharge: number;
    shearStress: number;
  } | null>(null);

  const calculate = useCallback(() => {
    const { diameter: D, length: L, roughness: e, kinematicViscosity: nu } = pipeParams;
    const { discharge: Q, headAvailable: H } = flowParams;
    
    const A = Math.PI * D * D / 4;
    const V = Q / A;
    const Re = V * D / nu;
    
    let f: number;
    let hf: number;
    const g = 9.81;

    // Determine flow regime
    let flowRegime: 'laminar' | 'transitional' | 'turbulent';
    if (Re < 2300) {
      flowRegime = 'laminar';
      f = 64 / Re;
    } else if (Re < 4000) {
      flowRegime = 'transitional';
      f = 0.03; // Approximate
    } else {
      flowRegime = 'turbulent';
      // Colebrook-White equation (iterative solution)
      f = 0.02; // Initial guess
      for (let i = 0; i < 20; i++) {
        const term1 = e / (3.7 * D);
        const term2 = 2.51 / (Re * Math.sqrt(f));
        f = 1 / Math.pow(-2 * Math.log10(term1 + term2), 2);
      }
    }

    if (method === 'darcy') {
      // Darcy-Weisbach
      hf = f * (L / D) * (V * V / (2 * g));
    } else if (method === 'hazen') {
      // Hazen-Williams
      const C = hazenC;
      hf = 10.67 * L * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
    } else {
      // Manning
      const R = D / 4; // Hydraulic radius for full pipe
      const S = Math.pow((Q * manningN) / (A * Math.pow(R, 2/3)), 2);
      hf = S * L;
    }

    // Wall shear stress
    const tau = (f / 4) * (0.5 * 1000 * V * V); // Using water density

    setResult({
      headLoss: hf,
      velocity: V,
      reynoldsNumber: Re,
      frictionFactor: f,
      flowRegime,
      discharge: Q,
      shearStress: tau,
    });
  }, [pipeParams, flowParams, method, hazenC, manningN]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Pipe Flow Calculator</h2>
        <p className="text-blue-100 text-sm">Darcy-Weisbach, Hazen-Williams & Manning's Methods</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {/* Method Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'darcy', name: 'Darcy-Weisbach' },
                  { id: 'hazen', name: 'Hazen-Williams' },
                  { id: 'manning', name: 'Manning' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id as typeof method)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      method === m.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipe Properties */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Pipe Properties</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Diameter (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pipeParams.diameter}
                    onChange={(e) => setPipeParams({ ...pipeParams, diameter: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Length (m)</label>
                  <input
                    type="number"
                    value={pipeParams.length}
                    onChange={(e) => setPipeParams({ ...pipeParams, length: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                {method === 'darcy' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Roughness ε (m)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={pipeParams.roughness}
                      onChange={(e) => setPipeParams({ ...pipeParams, roughness: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
                {method === 'hazen' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hazen-Williams C</label>
                    <input
                      type="number"
                      value={hazenC}
                      onChange={(e) => setHazenC(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
                {method === 'manning' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Manning's n</label>
                    <input
                      type="number"
                      step="0.001"
                      value={manningN}
                      onChange={(e) => setManningN(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Flow Parameters */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Flow Parameters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Discharge Q (m³/s)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={flowParams.discharge}
                    onChange={(e) => setFlowParams({ ...flowParams, discharge: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ν (m²/s)</label>
                  <input
                    type="number"
                    step="1e-7"
                    value={pipeParams.kinematicViscosity}
                    onChange={(e) => setPipeParams({ ...pipeParams, kinematicViscosity: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={calculate}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              🔬 Calculate Head Loss
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* Pipe Visualization */}
            <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center">
              <svg width="350" height="150" viewBox="0 0 350 150">
                {/* Pipe outline */}
                <rect x="20" y="40" width="300" height="60" rx="30" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
                <rect x="20" y="50" width="300" height="40" rx="20" fill="#0ea5e9" />
                
                {/* Flow arrows */}
                <g fill="#0284c7">
                  <polygon points="100,70 85,60 85,80" />
                  <polygon points="180,70 165,60 165,80" />
                  <polygon points="260,70 245,60 245,80" />
                </g>
                
                {/* Head loss indication */}
                {result && (
                  <g>
                    <line x1="30" y1="30" x2="30" y2="35" stroke="#dc2626" strokeWidth="2" />
                    <line x1="310" y1={30 + result.headLoss * 5} x2="310" y2={35 + result.headLoss * 5} stroke="#dc2626" strokeWidth="2" />
                    <line x1="30" y1="32" x2="310" y2={32 + result.headLoss * 5} stroke="#dc2626" strokeWidth="1" strokeDasharray="4 2" />
                    <text x="170" y={25 + result.headLoss * 2.5} textAnchor="middle" fontSize="10" fill="#dc2626">
                      hf = {result.headLoss.toFixed(3)} m
                    </text>
                  </g>
                )}
                
                {/* Labels */}
                <text x="20" y="130" fontSize="10" fill="#6b7280">D = {pipeParams.diameter} m</text>
                <text x="170" y="130" fontSize="10" fill="#6b7280" textAnchor="middle">L = {pipeParams.length} m</text>
              </svg>
            </div>

            {result && (
              <div className="space-y-3">
                {/* Flow Regime */}
                <div className={`rounded-lg p-3 text-center ${
                  result.flowRegime === 'laminar' ? 'bg-green-50' :
                  result.flowRegime === 'turbulent' ? 'bg-red-50' :
                  'bg-amber-50'
                }`}>
                  <span className="text-sm text-gray-600">Flow Regime: </span>
                  <span className={`font-bold ${
                    result.flowRegime === 'laminar' ? 'text-green-700' :
                    result.flowRegime === 'turbulent' ? 'text-red-700' :
                    'text-amber-700'
                  }`}>
                    {result.flowRegime.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">(Re = {result.reynoldsNumber.toFixed(0)})</span>
                </div>

                {/* Key Results */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-red-600">Head Loss</div>
                    <div className="text-xl font-bold text-red-700">{result.headLoss.toFixed(4)} m</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600">Velocity</div>
                    <div className="text-xl font-bold text-blue-700">{result.velocity.toFixed(3)} m/s</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-purple-600">Friction Factor f</div>
                    <div className="text-xl font-bold text-purple-700">{result.frictionFactor.toFixed(5)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-amber-600">Wall Shear Stress</div>
                    <div className="text-xl font-bold text-amber-700">{result.shearStress.toFixed(2)} Pa</div>
                  </div>
                </div>

                {/* Formula Used */}
                <div className="bg-gray-100 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Formula Used:</div>
                  {method === 'darcy' && (
                    <div className="font-mono text-sm">h<sub>f</sub> = f × (L/D) × (V²/2g)</div>
                  )}
                  {method === 'hazen' && (
                    <div className="font-mono text-sm">h<sub>f</sub> = 10.67 × L × Q<sup>1.852</sup> / (C<sup>1.852</sup> × D<sup>4.87</sup>)</div>
                  )}
                  {method === 'manning' && (
                    <div className="font-mono text-sm">V = (1/n) × R<sup>2/3</sup> × S<sup>1/2</sup></div>
                  )}
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
// HYDROLOGY CALCULATOR
// =============================================================================

export function HydrologyCalculator() {
  const [catchment, setCatchment] = useState({
    area: 5, // km²
    length: 3, // km (longest flow path)
    slope: 0.02, // average slope (m/m)
    imperviousPercent: 30,
    curveNumber: 75,
  });

  const [rainfall, setRainfall] = useState({
    intensity: 50, // mm/hr
    duration: 60, // minutes
    returnPeriod: 25, // years
    totalDepth: 100, // mm
  });

  const [method, setMethod] = useState<'rational' | 'scs' | 'both'>('both');

  const [result, setResult] = useState<{
    rational: {
      C: number;
      tc: number;
      Q: number;
    };
    scs: {
      S: number;
      Ia: number;
      Pe: number;
      Qp: number;
      tp: number;
    };
  } | null>(null);

  const calculate = useCallback(() => {
    const { area: A, length: L, slope: S, imperviousPercent, curveNumber: CN } = catchment;
    const { intensity: I, duration, totalDepth: P } = rainfall;

    // Rational Method
    const C = 0.3 + (imperviousPercent / 100) * 0.5; // Simplified runoff coefficient
    const tc = (0.87 * Math.pow(L * 1000, 3) / (S * 1000000)) ** 0.385 / 60; // Kirpich formula (hours)
    const Q_rational = (C * I * A) / 3.6; // m³/s

    // SCS Method
    const S_retention = (25400 / CN) - 254; // mm
    const Ia = 0.2 * S_retention; // Initial abstraction
    const Pe = P > Ia ? Math.pow(P - Ia, 2) / (P - Ia + S_retention) : 0; // Effective precipitation
    
    // Unit hydrograph peak
    const tp = 0.5 * (duration / 60) + 0.6 * tc; // Time to peak (hours)
    const Qp = (0.208 * A * Pe) / tp; // Peak discharge (m³/s)

    setResult({
      rational: {
        C,
        tc: tc * 60, // convert to minutes
        Q: Q_rational,
      },
      scs: {
        S: S_retention,
        Ia,
        Pe,
        Qp,
        tp: tp * 60, // convert to minutes
      },
    });
  }, [catchment, rainfall, method]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Hydrology Calculator</h2>
        <p className="text-sky-100 text-sm">Rational Method & SCS Curve Number</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {/* Catchment Properties */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Catchment Properties</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Area (km²)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={catchment.area}
                    onChange={(e) => setCatchment({ ...catchment, area: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Flow Length (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={catchment.length}
                    onChange={(e) => setCatchment({ ...catchment, length: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Average Slope (m/m)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={catchment.slope}
                    onChange={(e) => setCatchment({ ...catchment, slope: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Impervious (%)</label>
                  <input
                    type="number"
                    value={catchment.imperviousPercent}
                    onChange={(e) => setCatchment({ ...catchment, imperviousPercent: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">SCS Curve Number (CN)</label>
                  <input
                    type="range"
                    min="30"
                    max="98"
                    value={catchment.curveNumber}
                    onChange={(e) => setCatchment({ ...catchment, curveNumber: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>30 (Pervious)</span>
                    <span className="font-bold text-sky-600">{catchment.curveNumber}</span>
                    <span>98 (Impervious)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rainfall Data */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Rainfall Data</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Intensity (mm/hr)</label>
                  <input
                    type="number"
                    value={rainfall.intensity}
                    onChange={(e) => setRainfall({ ...rainfall, intensity: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={rainfall.duration}
                    onChange={(e) => setRainfall({ ...rainfall, duration: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Total Depth P (mm)</label>
                  <input
                    type="number"
                    value={rainfall.totalDepth}
                    onChange={(e) => setRainfall({ ...rainfall, totalDepth: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Return Period (yr)</label>
                  <input
                    type="number"
                    value={rainfall.returnPeriod}
                    onChange={(e) => setRainfall({ ...rainfall, returnPeriod: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={calculate}
              className="w-full py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700"
            >
              🔬 Calculate Runoff
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {result && (
              <>
                {/* Rational Method Results */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">Rational Method</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-blue-600">Runoff Coeff. C</div>
                      <div className="text-lg font-bold text-blue-800">{result.rational.C.toFixed(2)}</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-blue-600">Time of Conc. tc</div>
                      <div className="text-lg font-bold text-blue-800">{result.rational.tc.toFixed(1)} min</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-blue-600">Peak Discharge Q</div>
                      <div className="text-lg font-bold text-blue-800">{result.rational.Q.toFixed(2)} m³/s</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-center text-blue-600 font-mono">
                    Q = CiA/3.6 = ({result.rational.C.toFixed(2)} × {rainfall.intensity} × {catchment.area}) / 3.6
                  </div>
                </div>

                {/* SCS Method Results */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-3">SCS Curve Number Method</h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-green-600">Retention S</div>
                      <div className="text-lg font-bold text-green-800">{result.scs.S.toFixed(1)} mm</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-green-600">Initial Abstraction Ia</div>
                      <div className="text-lg font-bold text-green-800">{result.scs.Ia.toFixed(1)} mm</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-green-600">Effective Precip. Pe</div>
                      <div className="text-lg font-bold text-green-800">{result.scs.Pe.toFixed(1)} mm</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-xs text-green-600">Time to Peak tp</div>
                      <div className="text-lg font-bold text-green-800">{result.scs.tp.toFixed(1)} min</div>
                    </div>
                  </div>
                  <div className="mt-3 bg-white rounded p-3 text-center">
                    <div className="text-xs text-green-600">Peak Discharge</div>
                    <div className="text-2xl font-bold text-green-800">{result.scs.Qp.toFixed(2)} m³/s</div>
                  </div>
                </div>

                {/* Comparison */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Comparison</h4>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{result.rational.Q.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Rational (m³/s)</div>
                    </div>
                    <div className="text-gray-400">vs</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{result.scs.Qp.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">SCS (m³/s)</div>
                    </div>
                  </div>
                </div>
              </>
            )}
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
  OpenChannelFlowCalculator,
  PipeFlowCalculator,
  HydrologyCalculator,
};
