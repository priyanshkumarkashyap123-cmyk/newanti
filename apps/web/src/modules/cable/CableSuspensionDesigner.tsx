/**
 * ============================================================================
 * CABLE & SUSPENSION STRUCTURE DESIGNER UI COMPONENT
 * ============================================================================
 * 
 * Comprehensive React component for cable and suspension structure design:
 * - Stay cable design and analysis
 * - Catenary and parabolic cable analysis
 * - Suspension bridge main cable design
 * - Hanger and tower design
 * - Aerodynamic stability analysis
 * 
 * Features:
 * - Interactive cable geometry visualization
 * - Cable material database
 * - Vibration analysis
 * - Multi-span cable systems
 * 
 * @version 1.0.0
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  CableDesignEngine,
  designStayCable,
  analyzeVibration,
  CABLE_MATERIALS,
  SPIRAL_STRAND_SIZES,
  LOCKED_COIL_SIZES,
  type CableMaterial,
  type CableGeometry,
  type StayCableResult,
  type CableVibrationAnalysis,
  type CatenaryCableResult,
} from '../cable/CableDesignEngine';
import {
  SuspensionBridgeDesignEngine,
  designSuspensionBridge,
  type SuspensionBridgeDesignResult,
  type TowerType,
} from '../suspension/SuspensionDesignEngine';

// Local type aliases for compatibility
type CableGeometryResult = CatenaryCableResult;
type VibrationResult = CableVibrationAnalysis;
type SuspensionBridgeResult = SuspensionBridgeDesignResult;
type AnchorageType = 'gravity' | 'tunnel' | 'rock';

// =============================================================================
// STYLING CONSTANTS
// =============================================================================

const CARD_CLASS = 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700';
const INPUT_CLASS = 'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
const SELECT_CLASS = 'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer';
const BUTTON_PRIMARY = 'px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const BUTTON_SECONDARY = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const TAB_CLASS = 'px-4 py-2 font-medium rounded-t-lg transition-all';
const TAB_ACTIVE = 'bg-indigo-600 text-white';
const TAB_INACTIVE = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';

// =============================================================================
// COMPONENT TYPES
// =============================================================================

type DesignMode = 'stay-cable' | 'catenary' | 'suspension-bridge';

interface CableDesignState {
  mode: DesignMode;
  
  // Stay cable parameters
  stayCableSpan: number;        // m
  stayCableAngle: number;       // degrees
  stayCableLoad: number;        // kN
  cableMaterialKey: string;
  strandDiameter: number;       // mm
  
  // Catenary cable parameters
  horizontalSpan: number;       // m
  verticalDrop: number;         // m
  cableWeight: number;          // kN/m
  additionalLoad: number;       // kN (point load at midspan)
  maxSag: number;               // m (for design)
  
  // Suspension bridge parameters
  mainSpan: number;             // m
  sideSpan: number;             // m
  sagRatio: number;             // f/L
  deckWidth: number;            // m
  deckWeight: number;           // kN/m (dead load)
  liveLoad: number;             // kN/m
  hangerSpacing: number;        // m
  towerType: TowerType;
  anchorageType: AnchorageType;
  towerHeight: number;          // m (above deck)
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
}> = ({ label, value, onChange, unit, min, max, step = 1 }) => (
  <div>
    <label className={LABEL_CLASS}>
      {label} {unit && <span className="text-gray-500">({unit})</span>}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      min={min}
      max={max}
      step={step}
      className={INPUT_CLASS}
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
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✗ FAIL' : '⚠ WARNING'}
    </span>
  );
};

const UtilizationBar: React.FC<{ ratio: number; label: string }> = ({ ratio, label }) => {
  const percentage = Math.min(ratio * 100, 100);
  const color = ratio <= 0.6 ? 'bg-green-500' : ratio <= 0.8 ? 'bg-yellow-500' : ratio <= 1.0 ? 'bg-orange-500' : 'bg-red-500';
  
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className={ratio > 1 ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-400'}>
          {(ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// =============================================================================
// CABLE VISUALIZATION COMPONENTS
// =============================================================================

const StayCableVisualization: React.FC<{ 
  span: number; 
  angle: number; 
  numStrands?: number;
}> = ({ span, angle, numStrands = 37 }) => {
  const angleRad = angle * Math.PI / 180;
  const verticalHeight = span * Math.sin(angleRad);
  const horizontalLength = span * Math.cos(angleRad);
  
  // Scale for SVG
  const scale = 250 / Math.max(horizontalLength, verticalHeight, 50);
  const x2 = 50 + horizontalLength * scale;
  const y2 = 250 - verticalHeight * scale;
  
  return (
    <div className={CARD_CLASS}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        Stay Cable Configuration
      </h3>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <svg width="100%" height="300" viewBox="0 0 400 300">
          {/* Tower (anchor point) */}
          <rect x="30" y="50" width="40" height="200" fill="#4B5563" stroke="#374151" strokeWidth="2" />
          
          {/* Deck */}
          <rect x="50" y="240" width="320" height="20" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />
          
          {/* Cable */}
          <line
            x1="50"
            y1={y2}
            x2={x2}
            y2="240"
            stroke="#EC4899"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Anchor points */}
          <circle cx="50" cy={y2} r="6" fill="#EC4899" />
          <circle cx={x2} cy="240" r="6" fill="#EC4899" />
          
          {/* Dimension labels */}
          <text x={(50 + x2) / 2} y="280" textAnchor="middle" fill="#374151" fontSize="12">
            Horiz: {horizontalLength.toFixed(1)}m
          </text>
          <text x="25" y={(y2 + 240) / 2} textAnchor="middle" fill="#374151" fontSize="12" transform={`rotate(-90 25 ${(y2 + 240) / 2})`}>
            Vert: {verticalHeight.toFixed(1)}m
          </text>
          
          {/* Angle indicator */}
          <path
            d={`M ${x2 - 30} 240 A 30 30 0 0 1 ${x2 - 30 * Math.cos(angleRad)} ${240 - 30 * Math.sin(angleRad)}`}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
          />
          <text x={x2 - 40} y="220" textAnchor="middle" fill="#10B981" fontSize="11" fontWeight="bold">
            {angle}°
          </text>
          
          {/* Cable info */}
          <text x="200" y="20" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="bold">
            STAY CABLE
          </text>
          <text x="200" y="40" textAnchor="middle" fill="#6B7280" fontSize="12">
            Length: {span.toFixed(1)}m | Strands: {numStrands}
          </text>
        </svg>
      </div>
    </div>
  );
};

const CatenaryVisualization: React.FC<{
  span: number;
  sag: number;
  verticalDrop: number;
}> = ({ span, sag, verticalDrop }) => {
  const scale = 300 / span;
  const points: string[] = [];
  
  // Generate parabolic curve points
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * span;
    const normalizedX = (x - span / 2) / (span / 2);
    const y = sag * (1 - normalizedX * normalizedX) + verticalDrop * (x / span);
    
    const svgX = 50 + x * scale;
    const svgY = 80 + y * scale;
    points.push(`${svgX},${svgY}`);
  }
  
  return (
    <div className={CARD_CLASS}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        Cable Profile
      </h3>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <svg width="100%" height="200" viewBox="0 0 400 200">
          {/* Support points */}
          <rect x="40" y="70" width="20" height="60" fill="#4B5563" />
          <rect x="340" y={70 + verticalDrop * scale} width="20" height="60" fill="#4B5563" />
          
          {/* Cable curve */}
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Sag indicator */}
          <line
            x1="200"
            y1="80"
            x2="200"
            y2={80 + sag * scale}
            stroke="#EF4444"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          <text x="210" y={80 + sag * scale / 2} fill="#EF4444" fontSize="11">
            Sag: {sag.toFixed(2)}m
          </text>
          
          {/* Span */}
          <line x1="50" y1="170" x2="350" y2="170" stroke="#374151" strokeWidth="1" />
          <text x="200" y="185" textAnchor="middle" fill="#374151" fontSize="12">
            Span: {span}m
          </text>
          
          {/* Title */}
          <text x="200" y="30" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="bold">
            CATENARY / PARABOLIC CABLE
          </text>
        </svg>
      </div>
    </div>
  );
};

const SuspensionBridgeVisualization: React.FC<{
  mainSpan: number;
  sideSpan: number;
  sag: number;
  towerHeight: number;
}> = ({ mainSpan, sideSpan, sag, towerHeight }) => {
  const totalLength = sideSpan * 2 + mainSpan;
  const scale = 600 / totalLength;
  
  // Tower positions
  const tower1X = 50 + sideSpan * scale;
  const tower2X = 50 + (sideSpan + mainSpan) * scale;
  const deckY = 150;
  const towerTopY = deckY - towerHeight * scale;
  
  // Cable points
  const cablePoints: string[] = [];
  
  // Left anchorage to tower 1
  cablePoints.push(`50,${deckY - 20}`);
  cablePoints.push(`${tower1X},${towerTopY}`);
  
  // Main span parabola
  for (let i = 0; i <= 20; i++) {
    const progress = i / 20;
    const x = tower1X + progress * mainSpan * scale;
    const normalizedX = (progress - 0.5) * 2;
    const y = towerTopY + sag * scale * (1 - normalizedX * normalizedX) * -1 + sag * scale;
    cablePoints.push(`${x},${y}`);
  }
  
  // Tower 2 to right anchorage
  cablePoints.push(`${tower2X},${towerTopY}`);
  cablePoints.push(`${50 + totalLength * scale},${deckY - 20}`);
  
  return (
    <div className={CARD_CLASS}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        Suspension Bridge Configuration
      </h3>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <svg width="100%" height="220" viewBox="0 0 700 220">
          {/* Ground/Water */}
          <rect x="0" y="180" width="700" height="40" fill="#93C5FD" opacity="0.3" />
          
          {/* Anchorages */}
          <rect x="30" y="130" width="40" height="50" fill="#6B7280" stroke="#374151" strokeWidth="2" />
          <rect x={50 + totalLength * scale - 20} y="130" width="40" height="50" fill="#6B7280" stroke="#374151" strokeWidth="2" />
          
          {/* Towers */}
          <rect x={tower1X - 15} y={towerTopY} width="30" height={deckY - towerTopY} fill="#4B5563" stroke="#374151" strokeWidth="2" />
          <rect x={tower2X - 15} y={towerTopY} width="30" height={deckY - towerTopY} fill="#4B5563" stroke="#374151" strokeWidth="2" />
          
          {/* Main cable */}
          <polyline
            points={cablePoints.join(' ')}
            fill="none"
            stroke="#DC2626"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Deck */}
          <rect x="50" y={deckY} width={totalLength * scale} height="15" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />
          
          {/* Hangers (simplified) */}
          {Array.from({ length: Math.floor(mainSpan / 20) }).map((_, i) => {
            const progress = (i + 1) / (Math.floor(mainSpan / 20) + 1);
            const x = tower1X + progress * mainSpan * scale;
            const normalizedX = (progress - 0.5) * 2;
            const cableY = towerTopY + sag * scale * (1 - normalizedX * normalizedX) * -1 + sag * scale;
            return (
              <line
                key={i}
                x1={x}
                y1={cableY}
                x2={x}
                y2={deckY}
                stroke="#6B7280"
                strokeWidth="1"
              />
            );
          })}
          
          {/* Labels */}
          <text x={tower1X + mainSpan * scale / 2} y="30" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="bold">
            SUSPENSION BRIDGE
          </text>
          
          {/* Span dimensions */}
          <text x={(50 + tower1X) / 2} y="195" textAnchor="middle" fill="#6B7280" fontSize="10">
            Side: {sideSpan}m
          </text>
          <text x={tower1X + mainSpan * scale / 2} y="195" textAnchor="middle" fill="#1D4ED8" fontSize="11" fontWeight="bold">
            Main: {mainSpan}m
          </text>
          <text x={(tower2X + 50 + totalLength * scale) / 2} y="195" textAnchor="middle" fill="#6B7280" fontSize="10">
            Side: {sideSpan}m
          </text>
        </svg>
      </div>
    </div>
  );
};

// =============================================================================
// RESULT DISPLAY COMPONENTS
// =============================================================================

const StayCableResultCard: React.FC<{ result: StayCableResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Stay Cable Design Results
      </h3>
      <StatusBadge status={result.status} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Cable Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Cable Material</span>
            <span className="font-medium">{result.material?.name || 'Stay Cable'}</span>
          </div>
          <div className="flex justify-between">
            <span>Number of Strands</span>
            <span className="font-medium">{result.numStrands}</span>
          </div>
          <div className="flex justify-between">
            <span>Nominal Diameter</span>
            <span className="font-medium">{result.nominalDiameter} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Total Area</span>
            <span className="font-medium">{result.totalArea.toFixed(0)} mm²</span>
          </div>
          <div className="flex justify-between">
            <span>Cable Weight</span>
            <span className="font-medium">{result.cableWeight.toFixed(1)} kg</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Forces & Stresses</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Axial Force</span>
            <span className="font-medium">{result.axialForce.toFixed(0)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Service Capacity</span>
            <span className="font-medium">{result.serviceCapacity.toFixed(0)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Ultimate Capacity</span>
            <span className="font-medium">{result.ultimateCapacity.toFixed(0)} kN</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
            <span>Utilization Ratio</span>
            <span>{(result.utilizationRatio * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilization</h4>
      <UtilizationBar ratio={result.utilizationRatio} label="Stress Utilization" />
    </div>

    {result.elasticElongation && (
      <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
        <span className="text-sm text-purple-800 dark:text-purple-200">
          <strong>Elastic Elongation:</strong> {result.elasticElongation.toFixed(1)} mm 
        </span>
      </div>
    )}

    {result.totalElongation && (
      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <span className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Total Elongation:</strong> {result.totalElongation.toFixed(1)} mm
        </span>
      </div>
    )}
  </div>
);

const SuspensionResultCard: React.FC<{ result: SuspensionBridgeResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Suspension Bridge Design Results
      </h3>
      <StatusBadge status={result.overallStatus} />
    </div>

    {/* Main Cable */}
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Main Cable</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Main Span</span>
          <span className="font-bold">{result.mainCable.mainSpanLength} m</span>
        </div>
        <div>
          <span className="text-gray-500 block">Sag Ratio</span>
          <span className="font-bold">{(result.mainCable.sagRatio * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500 block">Selected Diameter</span>
          <span className="font-bold">{result.mainCable.selectedDiameter.toFixed(0)} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Required Area</span>
          <span className="font-bold">{(result.mainCable.requiredArea / 1000).toFixed(1)} ×10³ mm²</span>
        </div>
        <div>
          <span className="text-gray-500 block">H (Horizontal)</span>
          <span className="font-bold">{(result.mainCable.horizontalTension / 1000).toFixed(0)} MN</span>
        </div>
        <div>
          <span className="text-gray-500 block">Max Tension</span>
          <span className="font-bold">{(result.mainCable.absoluteMaxTension / 1000).toFixed(0)} MN</span>
        </div>
        <div>
          <span className="text-gray-500 block">Utilization</span>
          <span className="font-bold">{(result.mainCable.utilizationRatio * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500 block">Status</span>
          <span className={`font-bold ${result.mainCable.status === 'pass' ? 'text-green-600' : 'text-red-600'}`}>{result.mainCable.status.toUpperCase()}</span>
        </div>
      </div>
    </div>

    {/* Hangers */}
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Hangers</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Number</span>
          <span className="font-bold">{result.hangers.numHangers}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Spacing</span>
          <span className="font-bold">{result.hangers.spacing} m</span>
        </div>
        <div>
          <span className="text-gray-500 block">Hanger Diameter</span>
          <span className="font-bold">{result.hangers.hangerDiameter} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Max Force</span>
          <span className="font-bold">{result.hangers.maxForce.toFixed(0)} kN</span>
        </div>
      </div>
    </div>

    {/* Tower */}
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Towers</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Type</span>
          <span className="font-bold">{result.towers.left.towerType}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Height</span>
          <span className="font-bold">{result.towers.left.height.toFixed(0)} m</span>
        </div>
        <div>
          <span className="text-gray-500 block">Axial Force</span>
          <span className="font-bold">{(result.towers.left.axialForce / 1000).toFixed(1)} MN</span>
        </div>
        <div>
          <span className="text-gray-500 block">Status</span>
          <span className={`font-bold ${result.towers.left.status === 'pass' ? 'text-green-600' : 'text-red-600'}`}>{result.towers.left.status.toUpperCase()}</span>
        </div>
      </div>
    </div>

    {/* Aerodynamic Stability */}
    {result.aerodynamics && (
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
          🌬️ Aerodynamic Stability
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-yellow-700 dark:text-yellow-300 block">Flutter Speed</span>
            <span className="font-bold text-yellow-900 dark:text-yellow-100">
              {result.aerodynamics.flutterSpeed.toFixed(1)} m/s
            </span>
          </div>
          <div>
            <span className="text-yellow-700 dark:text-yellow-300 block">Vortex Frequency</span>
            <span className="font-bold text-yellow-900 dark:text-yellow-100">
              {result.aerodynamics.vortexSheddingFrequency.toFixed(3)} Hz
            </span>
          </div>
          <div>
            <span className="text-yellow-700 dark:text-yellow-300 block">Flutter Safe</span>
            <span className={`font-bold ${result.aerodynamics.flutterSafe ? 'text-green-600' : 'text-red-600'}`}>
              {result.aerodynamics.flutterSafe ? 'YES' : 'NO'}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <UtilizationBar 
            ratio={result.aerodynamics.designWindSpeed / result.aerodynamics.flutterSpeed} 
            label="Design Wind / Flutter Speed" 
          />
        </div>
      </div>
    )}

    {/* Warnings */}
    {result.warnings && result.warnings.length > 0 && (
      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
        <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Warnings</h4>
        <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-300">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CableSuspensionDesigner: React.FC = () => {
  const [state, setState] = useState<CableDesignState>({
    mode: 'stay-cable',
    stayCableSpan: 150,
    stayCableAngle: 30,
    stayCableLoad: 3000,
    cableMaterialKey: 'stay-cable-1860',
    strandDiameter: 15.7,
    horizontalSpan: 100,
    verticalDrop: 0,
    cableWeight: 0.5,
    additionalLoad: 50,
    maxSag: 5,
    mainSpan: 500,
    sideSpan: 200,
    sagRatio: 0.1,
    deckWidth: 25,
    deckWeight: 150,
    liveLoad: 20,
    hangerSpacing: 15,
    towerType: 'portal-frame',
    anchorageType: 'gravity',
    towerHeight: 100,
  });

  const [stayCableResult, setStayCableResult] = useState<StayCableResult | null>(null);
  const [catenaryResult, setCatenaryResult] = useState<CableGeometryResult | null>(null);
  const [suspensionResult, setSuspensionResult] = useState<SuspensionBridgeResult | null>(null);

  const updateState = useCallback((updates: Partial<CableDesignState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const materialOptions = useMemo(() => 
    Object.entries(CABLE_MATERIALS).map(([key, mat]) => ({
      value: key,
      label: `${mat.name} (fpu=${mat.fpu} MPa)`,
    })),
    []
  );

  const runStayCableDesign = () => {
    const material = CABLE_MATERIALS[state.cableMaterialKey];
    if (!material) return;

    // Convert UI state to StayCableInput format
    const angleRad = (state.stayCableAngle * Math.PI) / 180;
    const horizontalSpan = state.stayCableSpan * Math.cos(angleRad);
    const verticalRise = state.stayCableSpan * Math.sin(angleRad);
    
    const result = designStayCable({
      anchorPoint: { x: 0, y: 0 },
      deckPoint: { x: horizontalSpan, y: verticalRise },
      designForce: state.stayCableLoad,
      liveLoadRange: state.stayCableLoad * 0.3, // Assume 30% live load range
      temperature: 40, // Default temperature change
    }, state.cableMaterialKey);
    setStayCableResult(result);
  };

  const runCatenaryAnalysis = () => {
    // Create CableDesignEngine with proper constructor args
    const geometry: CableGeometry = {
      span: state.horizontalSpan,
      leftSupport: { x: 0, y: 0, type: 'pinned' as const },
      rightSupport: { x: state.horizontalSpan, y: -state.verticalDrop, type: 'pinned' as const },
      sag: state.maxSag,
    };
    const loading = {
      selfWeight: state.cableWeight,
      uniformLoad: state.additionalLoad / state.horizontalSpan, // Convert to distributed
      temperature: 0,
    };
    const engine = new CableDesignEngine(geometry, loading, state.cableMaterialKey, 1000);
    const result = engine.analyzeCatenary();
    setCatenaryResult(result);
  };

  const runSuspensionDesign = () => {
    // designSuspensionBridge(mainSpan, sideSpan, towerHeight, deckWidth, deckLoad, liveLoad)
    const towerHeight = state.mainSpan * state.sagRatio * 1.2; // Estimate tower height from sag
    const result = designSuspensionBridge(
      state.mainSpan,
      state.sideSpan,
      towerHeight,
      state.deckWidth,
      state.deckWeight,
      state.liveLoad
    );
    setSuspensionResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔗 Cable & Suspension Structure Design
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Design stay cables, catenary systems, and suspension bridges
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['stay-cable', 'catenary', 'suspension-bridge'] as DesignMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => updateState({ mode })}
              className={`${TAB_CLASS} ${state.mode === mode ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              {mode === 'stay-cable' && '📍 Stay Cable'}
              {mode === 'catenary' && '〰️ Catenary Cable'}
              {mode === 'suspension-bridge' && '🌉 Suspension Bridge'}
            </button>
          ))}
        </div>

        {/* STAY CABLE MODE */}
        {state.mode === 'stay-cable' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className={CARD_CLASS}>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Stay Cable Parameters
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Cable Length"
                    value={state.stayCableSpan}
                    onChange={(v) => updateState({ stayCableSpan: v })}
                    unit="m"
                    min={10}
                    max={500}
                  />
                  <InputField
                    label="Inclination Angle"
                    value={state.stayCableAngle}
                    onChange={(v) => updateState({ stayCableAngle: v })}
                    unit="°"
                    min={15}
                    max={75}
                  />
                  <InputField
                    label="Axial Load (Service)"
                    value={state.stayCableLoad}
                    onChange={(v) => updateState({ stayCableLoad: v })}
                    unit="kN"
                    min={100}
                  />
                  <InputField
                    label="Strand Diameter"
                    value={state.strandDiameter}
                    onChange={(v) => updateState({ strandDiameter: v })}
                    unit="mm"
                    min={12}
                    max={20}
                    step={0.1}
                  />
                </div>
                <div className="mt-4">
                  <SelectField
                    label="Cable Material"
                    value={state.cableMaterialKey}
                    onChange={(v) => updateState({ cableMaterialKey: v })}
                    options={materialOptions}
                  />
                </div>
                <button onClick={runStayCableDesign} className={`${BUTTON_PRIMARY} w-full mt-6`}>
                  Design Stay Cable
                </button>
              </div>

              {stayCableResult && <StayCableResultCard result={stayCableResult} />}
            </div>

            <div>
              <StayCableVisualization
                span={state.stayCableSpan}
                angle={state.stayCableAngle}
                numStrands={stayCableResult?.numStrands || 37}
              />
            </div>
          </div>
        )}

        {/* CATENARY MODE */}
        {state.mode === 'catenary' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className={CARD_CLASS}>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Catenary Cable Parameters
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Horizontal Span"
                    value={state.horizontalSpan}
                    onChange={(v) => updateState({ horizontalSpan: v })}
                    unit="m"
                    min={10}
                    max={500}
                  />
                  <InputField
                    label="Vertical Drop"
                    value={state.verticalDrop}
                    onChange={(v) => updateState({ verticalDrop: v })}
                    unit="m"
                    min={0}
                    max={50}
                  />
                  <InputField
                    label="Cable Self-Weight"
                    value={state.cableWeight}
                    onChange={(v) => updateState({ cableWeight: v })}
                    unit="kN/m"
                    min={0.1}
                    step={0.1}
                  />
                  <InputField
                    label="Point Load at Midspan"
                    value={state.additionalLoad}
                    onChange={(v) => updateState({ additionalLoad: v })}
                    unit="kN"
                    min={0}
                  />
                  <InputField
                    label="Target Sag"
                    value={state.maxSag}
                    onChange={(v) => updateState({ maxSag: v })}
                    unit="m"
                    min={0.5}
                    max={50}
                    step={0.5}
                  />
                </div>
                <button onClick={runCatenaryAnalysis} className={`${BUTTON_PRIMARY} w-full mt-6`}>
                  Analyze Cable
                </button>
              </div>

              {catenaryResult && (
                <div className={CARD_CLASS}>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Analysis Results
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block">Cable Length</span>
                      <span className="font-bold">{catenaryResult.cableLength?.toFixed(2) ?? 'N/A'} m</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Max Sag</span>
                      <span className="font-bold">{catenaryResult.sag?.toFixed(2) ?? 'N/A'} m</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">H (Horizontal)</span>
                      <span className="font-bold">{catenaryResult.horizontalTension?.toFixed(1) ?? 'N/A'} kN</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">T<sub>max</sub></span>
                      <span className="font-bold">{catenaryResult.maxTension?.toFixed(1) ?? 'N/A'} kN</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Left Reaction</span>
                      <span className="font-bold">{catenaryResult.leftReaction?.resultant?.toFixed(1) ?? 'N/A'} kN</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Right Reaction</span>
                      <span className="font-bold">{catenaryResult.rightReaction?.resultant?.toFixed(1) ?? 'N/A'} kN</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <CatenaryVisualization
                span={state.horizontalSpan}
                sag={catenaryResult?.sag || state.maxSag}
                verticalDrop={state.verticalDrop}
              />
            </div>
          </div>
        )}

        {/* SUSPENSION BRIDGE MODE */}
        {state.mode === 'suspension-bridge' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={CARD_CLASS}>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Bridge Geometry
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Main Span"
                    value={state.mainSpan}
                    onChange={(v) => updateState({ mainSpan: v })}
                    unit="m"
                    min={100}
                    max={3000}
                  />
                  <InputField
                    label="Side Span"
                    value={state.sideSpan}
                    onChange={(v) => updateState({ sideSpan: v })}
                    unit="m"
                    min={50}
                    max={500}
                  />
                  <InputField
                    label="Sag Ratio (f/L)"
                    value={state.sagRatio}
                    onChange={(v) => updateState({ sagRatio: v })}
                    min={0.08}
                    max={0.12}
                    step={0.01}
                  />
                  <InputField
                    label="Deck Width"
                    value={state.deckWidth}
                    onChange={(v) => updateState({ deckWidth: v })}
                    unit="m"
                    min={15}
                    max={50}
                  />
                  <InputField
                    label="Hanger Spacing"
                    value={state.hangerSpacing}
                    onChange={(v) => updateState({ hangerSpacing: v })}
                    unit="m"
                    min={5}
                    max={30}
                  />
                  <InputField
                    label="Tower Height (above deck)"
                    value={state.towerHeight}
                    onChange={(v) => updateState({ towerHeight: v })}
                    unit="m"
                    min={30}
                    max={300}
                  />
                </div>
              </div>

              <div className={CARD_CLASS}>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Loading & Configuration
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Dead Load"
                    value={state.deckWeight}
                    onChange={(v) => updateState({ deckWeight: v })}
                    unit="kN/m"
                    min={50}
                    max={500}
                  />
                  <InputField
                    label="Live Load"
                    value={state.liveLoad}
                    onChange={(v) => updateState({ liveLoad: v })}
                    unit="kN/m"
                    min={5}
                    max={50}
                  />
                  <SelectField
                    label="Tower Type"
                    value={state.towerType}
                    onChange={(v) => updateState({ towerType: v as TowerType })}
                    options={[
                      { value: 'portal-frame', label: 'Portal Frame' },
                      { value: 'A-frame', label: 'A-Frame' },
                      { value: 'H-frame', label: 'H-Frame' },
                      { value: 'diamond', label: 'Diamond' },
                      { value: 'inverted-Y', label: 'Inverted-Y' },
                      { value: 'single-pylon', label: 'Single Pylon' },
                    ]}
                  />
                  <SelectField
                    label="Anchorage Type"
                    value={state.anchorageType}
                    onChange={(v) => updateState({ anchorageType: v as AnchorageType })}
                    options={[
                      { value: 'gravity', label: 'Gravity Anchorage' },
                      { value: 'rock', label: 'Rock Anchorage' },
                      { value: 'tunnel', label: 'Tunnel Anchorage' },
                    ]}
                  />
                </div>
                <button onClick={runSuspensionDesign} className={`${BUTTON_PRIMARY} w-full mt-6`}>
                  Design Suspension Bridge
                </button>
              </div>
            </div>

            <SuspensionBridgeVisualization
              mainSpan={state.mainSpan}
              sideSpan={state.sideSpan}
              sag={state.mainSpan * state.sagRatio}
              towerHeight={state.towerHeight}
            />

            {suspensionResult && <SuspensionResultCard result={suspensionResult} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default CableSuspensionDesigner;
