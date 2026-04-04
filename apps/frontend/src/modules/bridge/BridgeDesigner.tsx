/**
 * ============================================================================
 * COMPREHENSIVE BRIDGE DESIGNER UI COMPONENT
 * ============================================================================
 * 
 * Full-featured React component for bridge design covering:
 * - Superstructure design (deck, girders)
 * - Substructure design (piers, abutments)
 * - Foundation design (footings, piles)
 * - Bearing selection
 * - Loading analysis (vehicle loads, wind, seismic)
 * 
 * Features:
 * - Multi-code support (AASHTO, EN 1991-2, IRC)
 * - Step-by-step design workflow
 * - Interactive visualizations
 * - Comprehensive output reports
 * 
 * @version 1.0.0
 */


import React, { useState, useCallback } from 'react';
import {
  BridgeDeckDesignEngine,
  type BridgeType,
  type DeckSlabResult,
  type CompositeGirderResult,
} from './BridgeDeckDesignEngine';
import {
  BridgeSubstructureDesignEngine,
  designBridgePier,
  designBridgeAbutment,
  type PierDesignResult,
  type AbutmentDesignResult,
  type ElastomericBearingResult,
  type SpreadFootingResult,
  type SeismicZone,
  type SeismicDesignResult,
} from './BridgeSubstructureEngine';

// =============================================================================
// STYLING CONSTANTS
// =============================================================================

const CARD_CLASS = 'bg-[#131b2e] rounded-xl shadow-lg p-6 border border-[#1a2333]';
const INPUT_CLASS = 'w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
const SELECT_CLASS = 'w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer';
const BUTTON_PRIMARY = 'px-6 py-3 bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const BUTTON_SECONDARY = 'px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-[#dae2fd] font-medium tracking-wide rounded-lg transition-all';
const LABEL_CLASS = 'block text-sm font-medium tracking-wide text-[#adc6ff] mb-1';

// =============================================================================
// COMPONENT TYPES
// =============================================================================

type DesignPhase = 'geometry' | 'superstructure' | 'substructure' | 'foundation' | 'summary';

type LoadingCode = 'AASHTO' | 'EN1991' | 'IRC';

interface BridgeDesignState {
  // Bridge geometry
  bridgeType: BridgeType;
  numSpans: number;
  spanLengths: number[];         // m
  totalWidth: number;            // m
  numLanes: number;
  skewAngle: number;             // degrees

  // Materials
  concreteFck: number;           // MPa
  rebarFy: number;               // MPa
  steelFy: number;               // MPa

  // Deck
  deckThickness: number;         // mm
  haunchDepth: number;           // mm
  wearingSurfaceThickness: number; // mm

  // Girders
  girderType: 'I-girder' | 'box-girder' | 'plate-girder' | 'precast-concrete';
  numGirders: number;
  girderSpacing: number;         // m
  girderDepth: number;           // mm

  // Pier
  pierType: 'single-column' | 'multi-column' | 'wall-pier' | 'hammerhead';
  pierHeight: number;            // m
  numPierColumns: number;
  columnDiameter: number;        // m

  // Abutment
  abutmentType: 'cantilever' | 'gravity' | 'integral';
  abutmentHeight: number;        // m

  // Foundation
  foundationType: 'spread-footing' | 'pile-foundation';
  soilBearing: number;           // kPa
  soilFriction: number;          // degrees

  // Loading
  loadingCode: LoadingCode;
  designLife: number;            // years
  seismicZone: SeismicZone;
  windSpeed: number;             // m/s

  // Live load
  vehicleLoad: string;
  impactFactor: number;
}

interface DesignResults {
  deck?: DeckSlabResult;
  girders?: CompositeGirderResult;
  pier?: PierDesignResult;
  abutment?: AbutmentDesignResult;
  bearing?: ElastomericBearingResult;
  footing?: SpreadFootingResult;
  seismic?: SeismicDesignResult;
}

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

const InputField: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}> = ({ label, value, onChange, unit, min, max, step = 1, disabled }) => (
  <div>
    <label className={LABEL_CLASS}>
      {label} {unit && <span className="text-slate-500">({unit})</span>}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={`${INPUT_CLASS} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className={LABEL_CLASS}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const StatusBadge: React.FC<{ status: 'pass' | 'fail' | 'warning' }> = ({ status }) => {
  const colors = {
    pass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    fail: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium tracking-wide ${colors[status]}`}>
      {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✗ FAIL' : '⚠ WARNING'}
    </span>
  );
};

const UtilizationBar: React.FC<{ ratio: number; label: string }> = ({ ratio, label }) => {
  const percentage = Math.min(ratio * 100, 100);
  const color = ratio <= 0.7 ? 'bg-green-500' : ratio <= 0.9 ? 'bg-yellow-500' : ratio <= 1.0 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium tracking-wide text-[#adc6ff]">{label}</span>
        <span className={ratio > 1 ? 'text-red-600 font-bold' : 'text-[#869ab8]'}>
          {(ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const ProgressStep: React.FC<{
  number: number;
  title: string;
  active: boolean;
  completed: boolean;
  onClick: () => void;
}> = ({ number, title, active, completed, onClick }) => (
  <button type="button"
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${active
      ? 'bg-blue-600 text-white'
      : completed
        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
        : 'bg-slate-100 dark:bg-slate-700 text-[#869ab8]'
      }`}
  >
    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bg-white text-blue-600' : completed ? 'bg-green-500 text-white' : 'bg-slate-300 dark:bg-slate-600'
      }`}>
      {completed ? '✓' : number}
    </span>
    <span className="font-medium tracking-wide">{title}</span>
  </button>
);

// =============================================================================
// BRIDGE VISUALIZATION COMPONENT
// =============================================================================

const BridgeVisualization: React.FC<{ state: BridgeDesignState }> = ({ state }) => {
  const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-lg font-semibold text-[#dae2fd] mb-4">
        Bridge Elevation (Schematic)
      </h3>
      <div className="bg-[#0b1326] rounded-lg p-4 overflow-x-auto">
        <svg width="100%" height="200" viewBox="0 0 700 200">
          {/* Ground line */}
          <line x1="0" y1="180" x2="700" y2="180" stroke="#8B4513" strokeWidth="3" />
          <rect x="0" y="180" width="700" height="20" fill="#8B4513" opacity="0.3" />

          {/* Left abutment */}
          <rect x="20" y="80" width="30" height="100" fill="#6B7280" stroke="#374151" strokeWidth="2" />
          <text x="35" y="195" textAnchor="middle" fill="#374151" fontSize="10">Abut.</text>

          {/* Right abutment */}
          <rect x="650" y="80" width="30" height="100" fill="#6B7280" stroke="#374151" strokeWidth="2" />
          <text x="665" y="195" textAnchor="middle" fill="#374151" fontSize="10">Abut.</text>

          {/* Piers */}
          {state.numSpans > 1 && Array.from({ length: state.numSpans - 1 }).map((_, i) => {
            const x = 50 + (i + 1) * (600 / state.numSpans);
            return (
              <g key={i}>
                {state.pierType === 'single-column' || state.pierType === 'hammerhead' ? (
                  <>
                    <rect x={x - 15} y="100" width="30" height="80" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                    {state.pierType === 'hammerhead' && (
                      <rect x={x - 40} y="85" width="80" height="15" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                    )}
                  </>
                ) : state.pierType === 'multi-column' ? (
                  <>
                    <rect x={x - 25} y="100" width="15" height="80" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                    <rect x={x + 10} y="100" width="15" height="80" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                    <rect x={x - 35} y="85" width="70" height="15" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                  </>
                ) : (
                  <rect x={x - 20} y="100" width="40" height="80" fill="#4B5563" stroke="#374151" strokeWidth="2" />
                )}
                <text x={x} y="195" textAnchor="middle" fill="#374151" fontSize="10">P{i + 1}</text>
              </g>
            );
          })}

          {/* Deck/Girders */}
          <rect x="45" y="60" width="610" height="25" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" rx="2" />

          {/* Span labels */}
          {state.spanLengths.map((span, i) => {
            const startX = 50 + i * (600 / state.numSpans);
            const endX = startX + (600 / state.numSpans);
            const midX = (startX + endX) / 2;
            return (
              <text key={i} x={midX} y="50" textAnchor="middle" fill="#1D4ED8" fontSize="12" fontWeight="bold">
                Span {i + 1}: {span}m
              </text>
            );
          })}

          {/* Bridge type label */}
          <text x="350" y="20" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="bold">
            {state.bridgeType.replace('-', ' ').toUpperCase()} BRIDGE
          </text>
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
        <div>
          <span className="text-slate-500 block">Total Length</span>
          <span className="font-bold">{totalLength.toFixed(1)} m</span>
        </div>
        <div>
          <span className="text-slate-500 block">Width</span>
          <span className="font-bold">{state.totalWidth} m</span>
        </div>
        <div>
          <span className="text-slate-500 block">Spans</span>
          <span className="font-bold">{state.numSpans}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Lanes</span>
          <span className="font-bold">{state.numLanes}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Girder Type</span>
          <span className="font-bold">{state.girderType}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Pier Type</span>
          <span className="font-bold">{state.pierType}</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// GEOMETRY PHASE COMPONENT
// =============================================================================

const GeometryPhase: React.FC<{
  state: BridgeDesignState;
  updateState: (updates: Partial<BridgeDesignState>) => void;
}> = ({ state, updateState }) => {

  const handleNumSpansChange = (n: number) => {
    const spans = Array(n).fill(state.spanLengths[0] || 30);
    updateState({ numSpans: n, spanLengths: spans });
  };

  const handleSpanLengthChange = (index: number, value: number) => {
    const newSpans = [...state.spanLengths];
    newSpans[index] = value;
    updateState({ spanLengths: newSpans });
  };

  return (
    <div className="space-y-6">
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🌉 Bridge Geometry
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SelectField
            label="Bridge Type"
            value={state.bridgeType}
            onChange={(v) => updateState({ bridgeType: v as BridgeType })}
            options={[
              { value: 'slab', label: 'Solid Slab' },
              { value: 'T-beam', label: 'T-Beam / Girder-Slab' },
              { value: 'I-girder', label: 'I-Girder (Steel/Precast)' },
              { value: 'box-girder', label: 'Box Girder' },
              { value: 'steel-composite', label: 'Steel-Concrete Composite' },
              { value: 'plate-girder', label: 'Steel Plate Girder' },
            ]}
          />

          <InputField
            label="Number of Spans"
            value={state.numSpans}
            onChange={handleNumSpansChange}
            min={1}
            max={10}
            step={1}
          />

          <InputField
            label="Total Width"
            value={state.totalWidth}
            onChange={(v) => updateState({ totalWidth: v })}
            unit="m"
            min={5}
            max={50}
          />

          <InputField
            label="Number of Lanes"
            value={state.numLanes}
            onChange={(v) => updateState({ numLanes: v })}
            min={1}
            max={8}
            step={1}
          />

          <InputField
            label="Skew Angle"
            value={state.skewAngle}
            onChange={(v) => updateState({ skewAngle: v })}
            unit="°"
            min={0}
            max={60}
          />
        </div>

        {/* Span lengths */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-[#adc6ff] mb-3">
            Span Lengths
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {state.spanLengths.map((span, i) => (
              <InputField
                key={i}
                label={`Span ${i + 1}`}
                value={span}
                onChange={(v) => handleSpanLengthChange(i, v)}
                unit="m"
                min={5}
                max={200}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          📐 Material Properties
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField
            label="Concrete fck"
            value={state.concreteFck}
            onChange={(v) => updateState({ concreteFck: v })}
            unit="MPa"
            min={20}
            max={80}
          />
          <InputField
            label="Rebar fy"
            value={state.rebarFy}
            onChange={(v) => updateState({ rebarFy: v })}
            unit="MPa"
            min={400}
            max={600}
          />
          <InputField
            label="Steel fy"
            value={state.steelFy}
            onChange={(v) => updateState({ steelFy: v })}
            unit="MPa"
            min={250}
            max={500}
          />
        </div>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🚗 Loading Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SelectField
            label="Loading Code"
            value={state.loadingCode}
            onChange={(v) => updateState({ loadingCode: v as LoadingCode })}
            options={[
              { value: 'AASHTO', label: 'AASHTO LRFD (USA)' },
              { value: 'EN1991', label: 'EN 1991-2 (Eurocode)' },
              { value: 'IRC', label: 'IRC:6 (India)' },
            ]}
          />

          <SelectField
            label="Vehicle Load"
            value={state.vehicleLoad}
            onChange={(v) => updateState({ vehicleLoad: v })}
            options={
              state.loadingCode === 'AASHTO'
                ? [{ value: 'HL-93', label: 'HL-93 (Truck + Lane)' }]
                : state.loadingCode === 'EN1991'
                  ? [
                    { value: 'LM1-TS', label: 'LM1 Tandem System' },
                    { value: 'LM1-UDL', label: 'LM1 UDL' },
                  ]
                  : [
                    { value: 'IRC-70R', label: 'IRC 70R' },
                    { value: 'IRC-ClassA', label: 'IRC Class A' },
                  ]
            }
          />

          <SelectField
            label="Seismic Zone"
            value={state.seismicZone}
            onChange={(v) => updateState({ seismicZone: v as SeismicZone })}
            options={[
              { value: 'I', label: 'Zone I (Low)' },
              { value: 'II', label: 'Zone II' },
              { value: 'III', label: 'Zone III' },
              { value: 'IV', label: 'Zone IV' },
              { value: 'V', label: 'Zone V (High)' },
            ]}
          />

          <InputField
            label="Design Wind Speed"
            value={state.windSpeed}
            onChange={(v) => updateState({ windSpeed: v })}
            unit="m/s"
            min={20}
            max={80}
          />
        </div>
      </div>

      <BridgeVisualization state={state} />
    </div>
  );
};

// =============================================================================
// SUPERSTRUCTURE PHASE COMPONENT
// =============================================================================

const SuperstructurePhase: React.FC<{
  state: BridgeDesignState;
  updateState: (updates: Partial<BridgeDesignState>) => void;
  results: DesignResults;
  setResults: (r: DesignResults) => void;
}> = ({ state, updateState, results, setResults }) => {

  const runDeckDesign = () => {
    const geometry: import('./BridgeDeckDesignEngine').BridgeGeometry = {
      span: Math.max(...state.spanLengths),
      numSpans: state.numSpans,
      spanLengths: state.spanLengths,
      deckWidth: state.totalWidth,
      carriageWidth: state.totalWidth - 2,
      numLanes: state.numLanes,
      numGirders: state.numGirders,
      girderSpacing: state.girderSpacing,
      overhang: 1.0,
    };
    const materials: import('./BridgeDeckDesignEngine').BridgeMaterials = {
      fck: state.concreteFck,
      steelGrade: 'S355' as import('../steel/SteelDesignConstants').SteelGradeType,
      steelCode: 'EN1993' as import('../steel/SteelDesignConstants').SteelDesignCode,
      fsy: state.rebarFy,
    };
    const code = state.loadingCode === 'AASHTO' ? 'AASHTO' as const
      : state.loadingCode === 'EN1991' ? 'EN1991-2' as const : 'IRC' as const;
    const engine = new BridgeDeckDesignEngine(geometry, materials, code);

    const deckResult = engine.designDeckSlab({
      thickness: state.deckThickness,
      span: state.girderSpacing * 1000,
      overhang: 1000,
      fck: state.concreteFck,
      fsy: state.rebarFy,
      cover: 40,
      surfacing: state.wearingSurfaceThickness / 1000 * 23,
      barriers: 5,
    });

    setResults({ ...results, deck: deckResult });
  };

  const runGirderDesign = () => {
    const geometry: import('./BridgeDeckDesignEngine').BridgeGeometry = {
      span: Math.max(...state.spanLengths),
      numSpans: state.numSpans,
      spanLengths: state.spanLengths,
      deckWidth: state.totalWidth,
      carriageWidth: state.totalWidth - 2,
      numLanes: state.numLanes,
      numGirders: state.numGirders,
      girderSpacing: state.girderSpacing,
      overhang: 1.0,
    };
    const materials: import('./BridgeDeckDesignEngine').BridgeMaterials = {
      fck: state.concreteFck,
      steelGrade: 'S355' as import('../steel/SteelDesignConstants').SteelGradeType,
      steelCode: 'EN1993' as import('../steel/SteelDesignConstants').SteelDesignCode,
      fsy: state.rebarFy,
    };
    const code = state.loadingCode === 'AASHTO' ? 'AASHTO' as const
      : state.loadingCode === 'EN1991' ? 'EN1991-2' as const : 'IRC' as const;
    const engine = new BridgeDeckDesignEngine(geometry, materials, code);

    // Simple girder design based on span
    const maxSpan = Math.max(...state.spanLengths);

    const girderResult = engine.designCompositeGirder({
      steelSection: {
        designation: 'Custom',
        type: 'I-section' as const,
        name: 'Custom',
        h: state.girderDepth,
        b: 300,
        tw: 16,
        tf: 25,
        r: 0,
        A: state.girderDepth * 16 + 2 * 300 * 25,
        Ix: 1e9,
        Iy: 1e7,
        Zx: 1e6,
        Zy: 1e5,
        Zpx: 1.2e6,
        Zpy: 1.2e5,
        rx: 400,
        ry: 60,
        J: 5e5,
        Wx: 1e6,
        Wy: 1e5,
        mass: 200,
      } as import('../steel/SteelDesignConstants').SteelSection,
      steelGrade: 'S355' as import('../steel/SteelDesignConstants').SteelGradeType,
      slabWidth: state.girderSpacing * 1000,
      slabThickness: state.deckThickness,
      haunchHeight: state.haunchDepth,
      fck: state.concreteFck,
      span: maxSpan * 1000,
      deadLoadSteel: 2.0,
      deadLoadConcrete: state.deckThickness / 1000 * state.girderSpacing * 25,
      deadLoadSuperimposed: 3.0,
      liveLoad: 15.0,
      shored: false,
    });

    setResults({ ...results, girders: girderResult });
  };

  return (
    <div className="space-y-6">
      {/* Deck Slab Design */}
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🔲 Deck Slab Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <InputField
            label="Deck Thickness"
            value={state.deckThickness}
            onChange={(v) => updateState({ deckThickness: v })}
            unit="mm"
            min={150}
            max={400}
          />
          <InputField
            label="Girder Spacing"
            value={state.girderSpacing}
            onChange={(v) => updateState({ girderSpacing: v })}
            unit="m"
            min={1}
            max={5}
            step={0.1}
          />
          <InputField
            label="Haunch Depth"
            value={state.haunchDepth}
            onChange={(v) => updateState({ haunchDepth: v })}
            unit="mm"
            min={0}
            max={150}
          />
          <InputField
            label="Wearing Surface"
            value={state.wearingSurfaceThickness}
            onChange={(v) => updateState({ wearingSurfaceThickness: v })}
            unit="mm"
            min={50}
            max={150}
          />
        </div>

        <button type="button" onClick={runDeckDesign} className={BUTTON_PRIMARY}>
          Design Deck Slab
        </button>

        {results.deck && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Deck Slab Results</h3>
              <StatusBadge status={results.deck.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500 block">Effective Depth</span>
                <span className="font-bold">{results.deck.effectiveDepth} mm</span>
              </div>
              <div>
                <span className="text-slate-500 block">Positive Moment</span>
                <span className="font-bold">{results.deck.positiveTransverse.toFixed(1)} kN-m/m</span>
              </div>
              <div>
                <span className="text-slate-500 block">Negative Moment</span>
                <span className="font-bold">{results.deck.negativeTransverse.toFixed(1)} kN-m/m</span>
              </div>
              <div>
                <span className="text-slate-500 block">Longitudinal Moment</span>
                <span className="font-bold">{results.deck.longitudinalMoment.toFixed(1)} kN-m/m</span>
              </div>
            </div>

            <h4 className="font-medium tracking-wide mb-2">Reinforcement:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Top:</strong> Ø{results.deck.topTransverse.diameter}mm @ {results.deck.topTransverse.spacing}mm
              </div>
              <div>
                <strong>Bottom:</strong> Ø{results.deck.bottomTransverse.diameter}mm @ {results.deck.bottomTransverse.spacing}mm
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Girder Design */}
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          📏 Girder Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <SelectField
            label="Girder Type"
            value={state.girderType}
            onChange={(v) => updateState({ girderType: v as BridgeDesignState['girderType'] })}
            options={[
              { value: 'I-girder', label: 'I-Girder' },
              { value: 'box-girder', label: 'Box Girder' },
              { value: 'plate-girder', label: 'Plate Girder' },
              { value: 'precast-concrete', label: 'Precast Concrete' },
            ]}
          />
          <InputField
            label="Number of Girders"
            value={state.numGirders}
            onChange={(v) => updateState({ numGirders: v })}
            min={2}
            max={12}
            step={1}
          />
          <InputField
            label="Girder Depth"
            value={state.girderDepth}
            onChange={(v) => updateState({ girderDepth: v })}
            unit="mm"
            min={500}
            max={4000}
          />
        </div>

        <button type="button" onClick={runGirderDesign} className={BUTTON_PRIMARY}>
          Design Girders
        </button>

        {results.girders && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Composite Girder Results</h3>
              <StatusBadge status={results.girders.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500 block">Moment Demand</span>
                <span className="font-bold">{results.girders.M_total.toFixed(0)} kN-m</span>
              </div>
              <div>
                <span className="text-slate-500 block">Moment Capacity</span>
                <span className="font-bold">{results.girders.Mn_composite.toFixed(0)} kN-m</span>
              </div>
              <div>
                <span className="text-slate-500 block">Moment Utilization</span>
                <span className="font-bold">{(results.girders.momentUtilization * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-500 block">PNA Location</span>
                <span className="font-bold">{results.girders.pnaLocation}</span>
              </div>
            </div>

            <UtilizationBar
              ratio={results.girders.momentUtilization}
              label="Flexural Utilization"
            />

            {results.girders.ductile && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm">
                <strong>Ductility Check:</strong> Dp/Dt = {results.girders.ductilityRatio.toFixed(3)} — Section is ductile ✓
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// SUBSTRUCTURE PHASE COMPONENT
// =============================================================================

const SubstructurePhase: React.FC<{
  state: BridgeDesignState;
  updateState: (updates: Partial<BridgeDesignState>) => void;
  results: DesignResults;
  setResults: (r: DesignResults) => void;
}> = ({ state, updateState, results, setResults }) => {

  const runPierDesign = () => {
    const totalReaction = 3000;  // kN, simplified
    const braking = 150;         // kN

    const pierResult = designBridgePier(
      state.pierHeight,
      state.numPierColumns,
      state.columnDiameter,
      totalReaction,
      braking
    );

    setResults({ ...results, pier: pierResult });
  };

  const runAbutmentDesign = () => {
    const reaction = 2000;  // kN, simplified

    const abutmentResult = designBridgeAbutment(
      state.abutmentHeight,
      state.totalWidth,
      reaction,
      state.soilFriction
    );

    setResults({ ...results, abutment: abutmentResult });
  };

  const runBearingDesign = () => {
    const input = {
      deadLoad: 1500,
      liveLoad: 800,
      rotationDead: 0.005,
      rotationLive: 0.003,
      translationLong: 30,
      translationTrans: 5,
      horizontalLoad: 100,
      maxHeight: 150,
      maxPlanDimension: 600,
      temperatureRange: 60,
      designLife: 50,
    };

    const bearingResult = BridgeSubstructureDesignEngine.designElastomericBearing(input);
    setResults({ ...results, bearing: bearingResult });
  };

  return (
    <div className="space-y-6">
      {/* Pier Design */}
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🏛️ Pier Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <SelectField
            label="Pier Type"
            value={state.pierType}
            onChange={(v) => updateState({ pierType: v as BridgeDesignState['pierType'] })}
            options={[
              { value: 'single-column', label: 'Single Column' },
              { value: 'multi-column', label: 'Multi-Column Bent' },
              { value: 'wall-pier', label: 'Wall Pier' },
              { value: 'hammerhead', label: 'Hammerhead' },
            ]}
          />
          <InputField
            label="Pier Height"
            value={state.pierHeight}
            onChange={(v) => updateState({ pierHeight: v })}
            unit="m"
            min={3}
            max={50}
          />
          <InputField
            label="Number of Columns"
            value={state.numPierColumns}
            onChange={(v) => updateState({ numPierColumns: v })}
            min={1}
            max={6}
            step={1}
            disabled={state.pierType === 'single-column' || state.pierType === 'wall-pier'}
          />
          <InputField
            label="Column Diameter"
            value={state.columnDiameter}
            onChange={(v) => updateState({ columnDiameter: v })}
            unit="m"
            min={0.6}
            max={3}
            step={0.1}
          />
        </div>

        <button type="button" onClick={runPierDesign} className={BUTTON_PRIMARY}>
          Design Pier
        </button>

        {results.pier && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pier Design Results</h3>
              <StatusBadge status={results.pier.overallStatus} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500 block">Axial Load (Pu)</span>
                <span className="font-bold">{results.pier.column.Pu.toFixed(0)} kN</span>
              </div>
              <div>
                <span className="text-slate-500 block">Axial Capacity</span>
                <span className="font-bold">{results.pier.column.axialCapacity.toFixed(0)} kN</span>
              </div>
              <div>
                <span className="text-slate-500 block">Slenderness</span>
                <span className="font-bold">{results.pier.column.slenderness.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Interaction Ratio</span>
                <span className="font-bold">{results.pier.column.interactionRatio.toFixed(3)}</span>
              </div>
            </div>

            <UtilizationBar
              ratio={results.pier.column.interactionRatio}
              label="Column Interaction Ratio"
            />

            <div className="mt-4 p-3 bg-[#131b2e] rounded-lg text-sm">
              <strong>Reinforcement:</strong> {results.pier.column.longitudinalRebar.numBars} - Ø{results.pier.column.longitudinalRebar.diameter}mm
              ({(results.pier.column.longitudinalRebar.ratio * 100).toFixed(2)}%)
            </div>
          </div>
        )}
      </div>

      {/* Abutment Design */}
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🧱 Abutment Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <SelectField
            label="Abutment Type"
            value={state.abutmentType}
            onChange={(v) => updateState({ abutmentType: v as BridgeDesignState['abutmentType'] })}
            options={[
              { value: 'cantilever', label: 'Cantilever' },
              { value: 'gravity', label: 'Gravity' },
              { value: 'integral', label: 'Integral' },
            ]}
          />
          <InputField
            label="Abutment Height"
            value={state.abutmentHeight}
            onChange={(v) => updateState({ abutmentHeight: v })}
            unit="m"
            min={3}
            max={15}
          />
          <InputField
            label="Soil Friction Angle"
            value={state.soilFriction}
            onChange={(v) => updateState({ soilFriction: v })}
            unit="°"
            min={25}
            max={45}
          />
        </div>

        <button type="button" onClick={runAbutmentDesign} className={BUTTON_PRIMARY}>
          Design Abutment
        </button>

        {results.abutment && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Abutment Design Results</h3>
              <StatusBadge status={results.abutment.overallStatus} />
            </div>

            <h4 className="font-medium tracking-wide mb-2">Stability Checks:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div className={results.abutment.stability.slidingOk ? 'text-green-600' : 'text-red-600'}>
                <span className="block">Sliding FOS</span>
                <span className="font-bold">{results.abutment.stability.slidingFactor.toFixed(2)} ≥ 1.5</span>
              </div>
              <div className={results.abutment.stability.overturningOk ? 'text-green-600' : 'text-red-600'}>
                <span className="block">Overturning FOS</span>
                <span className="font-bold">{results.abutment.stability.overturningFactor.toFixed(2)} ≥ 2.0</span>
              </div>
              <div className={results.abutment.stability.bearingOk ? 'text-green-600' : 'text-red-600'}>
                <span className="block">Max Bearing</span>
                <span className="font-bold">{results.abutment.stability.maxBearingPressure.toFixed(0)} kPa</span>
              </div>
            </div>

            <h4 className="font-medium tracking-wide mb-2">Earth Pressure:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Ka = {results.abutment.earthPressure.activeCoefficient.toFixed(3)}</div>
              <div>Lateral Force = {results.abutment.earthPressure.lateralForce.toFixed(1)} kN/m</div>
            </div>
          </div>
        )}
      </div>

      {/* Bearing Design */}
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          ⚙️ Bearing Design
        </h2>

        <button type="button" onClick={runBearingDesign} className={BUTTON_PRIMARY}>
          Design Bearings
        </button>

        {results.bearing && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Elastomeric Bearing Results</h3>
              <StatusBadge status={results.bearing.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500 block">Size (L × W × H)</span>
                <span className="font-bold">{results.bearing.length}×{results.bearing.width}×{results.bearing.totalHeight} mm</span>
              </div>
              <div>
                <span className="text-slate-500 block">Layers</span>
                <span className="font-bold">{results.bearing.numLayers} × {results.bearing.layerThickness}mm</span>
              </div>
              <div>
                <span className="text-slate-500 block">Shape Factor</span>
                <span className="font-bold">{results.bearing.shapeFactor.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Shear Modulus</span>
                <span className="font-bold">{results.bearing.shearModulus} MPa</span>
              </div>
            </div>

            <UtilizationBar
              ratio={results.bearing.combinedStrain / results.bearing.allowableCombined}
              label="Combined Strain Ratio"
            />

            <div className="grid grid-cols-3 gap-2 text-sm mt-3">
              <div className={results.bearing.compressiveOk ? 'text-green-600' : 'text-red-600'}>
                ✓ Compression: {results.bearing.compressiveStress.toFixed(1)}/{results.bearing.allowableCompressive.toFixed(1)} MPa
              </div>
              <div className={results.bearing.shearOk ? 'text-green-600' : 'text-red-600'}>
                ✓ Shear: {(results.bearing.shearStrain * 100).toFixed(1)}%
              </div>
              <div className={results.bearing.rotationOk ? 'text-green-600' : 'text-red-600'}>
                ✓ Rotation: {(results.bearing.rotationDemand * 1000).toFixed(1)} mrad
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// FOUNDATION PHASE COMPONENT
// =============================================================================

const FoundationPhase: React.FC<{
  state: BridgeDesignState;
  updateState: (updates: Partial<BridgeDesignState>) => void;
  results: DesignResults;
  setResults: (r: DesignResults) => void;
}> = ({ state, updateState, results, setResults }) => {

  const runFootingDesign = () => {
    const result = BridgeSubstructureDesignEngine.designSpreadFooting({
      columnLoad: 3000,
      columnMomentX: 200,
      columnMomentY: 150,
      columnWidth: state.columnDiameter,
      columnDepth: state.columnDiameter,
      soilBearing: state.soilBearing,
      fck: state.concreteFck,
      fy: state.rebarFy,
    });

    setResults({ ...results, footing: result });
  };

  return (
    <div className="space-y-6">
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold text-[#dae2fd] mb-6">
          🏗️ Foundation Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <SelectField
            label="Foundation Type"
            value={state.foundationType}
            onChange={(v) => updateState({ foundationType: v as BridgeDesignState['foundationType'] })}
            options={[
              { value: 'spread-footing', label: 'Spread Footing' },
              { value: 'pile-foundation', label: 'Pile Foundation' },
            ]}
          />
          <InputField
            label="Allowable Bearing"
            value={state.soilBearing}
            onChange={(v) => updateState({ soilBearing: v })}
            unit="kPa"
            min={50}
            max={1000}
          />
          <InputField
            label="Soil Friction Angle"
            value={state.soilFriction}
            onChange={(v) => updateState({ soilFriction: v })}
            unit="°"
            min={20}
            max={45}
          />
        </div>

        <button type="button" onClick={runFootingDesign} className={BUTTON_PRIMARY}>
          Design Foundation
        </button>

        {results.footing && (
          <div className="mt-6 p-4 bg-[#0b1326] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Spread Footing Results</h3>
              <StatusBadge status={results.footing.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500 block">Size (L × B × D)</span>
                <span className="font-bold">{results.footing.length.toFixed(2)}×{results.footing.width.toFixed(2)}×{results.footing.depth.toFixed(2)} m</span>
              </div>
              <div>
                <span className="text-slate-500 block">Max Pressure</span>
                <span className="font-bold">{results.footing.maxPressure.toFixed(0)} kPa</span>
              </div>
              <div>
                <span className="text-slate-500 block">Min Pressure</span>
                <span className="font-bold">{results.footing.minPressure.toFixed(0)} kPa</span>
              </div>
              <div>
                <span className="text-slate-500 block">Settlement</span>
                <span className="font-bold">{results.footing.immediateSettlement.toFixed(1)} mm</span>
              </div>
            </div>

            <UtilizationBar ratio={results.footing.bearingUtilization} label="Bearing Utilization" />
            <UtilizationBar ratio={results.footing.punchingShearUtilization} label="Punching Shear" />

            <div className="mt-4 p-3 bg-[#131b2e] rounded-lg text-sm">
              <strong>Bottom Reinforcement:</strong><br />
              Long: Ø{results.footing.bottomRebarLong.diameter}mm @ {results.footing.bottomRebarLong.spacing}mm<br />
              Short: Ø{results.footing.bottomRebarShort.diameter}mm @ {results.footing.bottomRebarShort.spacing}mm
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// SUMMARY PHASE COMPONENT
// =============================================================================

const SummaryPhase: React.FC<{
  state: BridgeDesignState;
  results: DesignResults;
}> = ({ state, results }) => {
  const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);

  const allPass =
    (results.deck?.status === 'pass') &&
    (results.girders?.status === 'pass') &&
    (results.pier?.overallStatus === 'pass') &&
    (results.abutment?.overallStatus === 'pass') &&
    (results.bearing?.status === 'pass') &&
    (results.footing?.status === 'pass');

  return (
    <div className="space-y-6">
      <div className={CARD_CLASS}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#dae2fd]">
            📋 Design Summary
          </h2>
          <StatusBadge status={allPass ? 'pass' : 'fail'} />
        </div>

        {/* Bridge Overview */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="font-semibold mb-3">Bridge Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><strong>Type:</strong> {state.bridgeType}</div>
            <div><strong>Spans:</strong> {state.numSpans}</div>
            <div><strong>Total Length:</strong> {totalLength} m</div>
            <div><strong>Width:</strong> {state.totalWidth} m</div>
            <div><strong>Lanes:</strong> {state.numLanes}</div>
            <div><strong>Girder Type:</strong> {state.girderType}</div>
            <div><strong>Pier Type:</strong> {state.pierType}</div>
            <div><strong>Seismic Zone:</strong> {state.seismicZone}</div>
          </div>
        </div>

        {/* Component Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Deck */}
          <div className={`p-4 rounded-lg border ${results.deck ? (results.deck.status === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Deck Slab</span>
              {results.deck ? <StatusBadge status={results.deck.status} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.deck && (
              <div className="text-sm text-[#869ab8]">
                Eff. Depth: {results.deck.effectiveDepth}mm<br />
                Rebar: Ø{results.deck.bottomTransverse.diameter}@{results.deck.bottomTransverse.spacing}
              </div>
            )}
          </div>

          {/* Girders */}
          <div className={`p-4 rounded-lg border ${results.girders ? (results.girders.status === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Girders</span>
              {results.girders ? <StatusBadge status={results.girders.status} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.girders && (
              <div className="text-sm text-[#869ab8]">
                Depth: {state.girderDepth}mm<br />
                Capacity: {results.girders.Mn_composite.toFixed(0)} kN-m
              </div>
            )}
          </div>

          {/* Pier */}
          <div className={`p-4 rounded-lg border ${results.pier ? (results.pier.overallStatus === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Pier</span>
              {results.pier ? <StatusBadge status={results.pier.overallStatus} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.pier && (
              <div className="text-sm text-[#869ab8]">
                Type: {state.pierType}<br />
                Utilization: {(results.pier.column.interactionRatio * 100).toFixed(1)}%
              </div>
            )}
          </div>

          {/* Abutment */}
          <div className={`p-4 rounded-lg border ${results.abutment ? (results.abutment.overallStatus === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Abutments</span>
              {results.abutment ? <StatusBadge status={results.abutment.overallStatus} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.abutment && (
              <div className="text-sm text-[#869ab8]">
                Type: {state.abutmentType}<br />
                Sliding FOS: {results.abutment.stability.slidingFactor.toFixed(2)}
              </div>
            )}
          </div>

          {/* Bearings */}
          <div className={`p-4 rounded-lg border ${results.bearing ? (results.bearing.status === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Bearings</span>
              {results.bearing ? <StatusBadge status={results.bearing.status} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.bearing && (
              <div className="text-sm text-[#869ab8]">
                Size: {results.bearing.length}×{results.bearing.width}mm<br />
                Type: Elastomeric ({results.bearing.numLayers} layers)
              </div>
            )}
          </div>

          {/* Foundation */}
          <div className={`p-4 rounded-lg border ${results.footing ? (results.footing.status === 'pass' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20') : 'border-slate-300 bg-[#131b2e]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Foundation</span>
              {results.footing ? <StatusBadge status={results.footing.status} /> : <span className="text-slate-500 text-sm">Not Designed</span>}
            </div>
            {results.footing && (
              <div className="text-sm text-[#869ab8]">
                Size: {results.footing.length.toFixed(1)}×{results.footing.width.toFixed(1)}m<br />
                Bearing: {results.footing.maxPressure.toFixed(0)} kPa
              </div>
            )}
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-6 flex justify-end">
          <button type="button" className={BUTTON_SECONDARY + ' mr-3'}>
            📄 Export to PDF
          </button>
          <button type="button" className={BUTTON_PRIMARY}>
            💾 Save Design
          </button>
        </div>
      </div>

      <BridgeVisualization state={state} />
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const BridgeDesigner: React.FC = () => {
  const [phase, setPhase] = useState<DesignPhase>('geometry');
  const [state, setState] = useState<BridgeDesignState>({
    bridgeType: 'steel-composite',
    numSpans: 3,
    spanLengths: [30, 40, 30],
    totalWidth: 12,
    numLanes: 2,
    skewAngle: 0,
    concreteFck: 40,
    rebarFy: 500,
    steelFy: 345,
    deckThickness: 220,
    haunchDepth: 50,
    wearingSurfaceThickness: 75,
    girderType: 'I-girder',
    numGirders: 4,
    girderSpacing: 3.0,
    girderDepth: 1500,
    pierType: 'hammerhead',
    pierHeight: 8,
    numPierColumns: 1,
    columnDiameter: 1.5,
    abutmentType: 'cantilever',
    abutmentHeight: 6,
    foundationType: 'spread-footing',
    soilBearing: 200,
    soilFriction: 30,
    loadingCode: 'AASHTO',
    designLife: 75,
    seismicZone: 'III',
    windSpeed: 44,
    vehicleLoad: 'HL-93',
    impactFactor: 0.33,
  });

  const [results, setResults] = useState<DesignResults>({});

  const updateState = useCallback((updates: Partial<BridgeDesignState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const phases: { key: DesignPhase; title: string }[] = [
    { key: 'geometry', title: 'Geometry & Loading' },
    { key: 'superstructure', title: 'Superstructure' },
    { key: 'substructure', title: 'Substructure' },
    { key: 'foundation', title: 'Foundation' },
    { key: 'summary', title: 'Summary' },
  ];

  const phaseComplete = (p: DesignPhase): boolean => {
    switch (p) {
      case 'geometry': return true;  // Always complete
      case 'superstructure': return !!results.deck && !!results.girders;
      case 'substructure': return !!results.pier && !!results.abutment;
      case 'foundation': return !!results.footing;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#dae2fd] mb-2">
            🌉 Bridge Design Suite
          </h1>
          <p className="text-[#869ab8]">
            Comprehensive highway bridge design per AASHTO, EN 1991-2, or IRC codes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex flex-wrap gap-2 mb-8">
          {phases.map((p, i) => (
            <ProgressStep
              key={p.key}
              number={i + 1}
              title={p.title}
              active={phase === p.key}
              completed={phaseComplete(p.key) && phase !== p.key}
              onClick={() => setPhase(p.key)}
            />
          ))}
        </div>

        {/* Phase Content */}
        {phase === 'geometry' && (
          <GeometryPhase state={state} updateState={updateState} />
        )}
        {phase === 'superstructure' && (
          <SuperstructurePhase
            state={state}
            updateState={updateState}
            results={results}
            setResults={setResults}
          />
        )}
        {phase === 'substructure' && (
          <SubstructurePhase
            state={state}
            updateState={updateState}
            results={results}
            setResults={setResults}
          />
        )}
        {phase === 'foundation' && (
          <FoundationPhase
            state={state}
            updateState={updateState}
            results={results}
            setResults={setResults}
          />
        )}
        {phase === 'summary' && (
          <SummaryPhase state={state} results={results} />
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button type="button"
            onClick={() => {
              const idx = phases.findIndex((p) => p.key === phase);
              if (idx > 0) setPhase(phases[idx - 1].key);
            }}
            disabled={phase === 'geometry'}
            className={BUTTON_SECONDARY + ' disabled:opacity-50'}
          >
            ← Previous
          </button>
          <button type="button"
            onClick={() => {
              const idx = phases.findIndex((p) => p.key === phase);
              if (idx < phases.length - 1) setPhase(phases[idx + 1].key);
            }}
            disabled={phase === 'summary'}
            className={BUTTON_PRIMARY + ' disabled:opacity-50'}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default BridgeDesigner;
