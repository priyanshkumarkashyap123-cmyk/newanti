/**
 * StressVisualization.tsx - Advanced Stress Visualization Component
 * 
 * Displays stress contours on structural members with:
 * - Von Mises stress visualization
 * - Principal stress display
 * - Color-coded contours (blue to red)
 * - Interactive stress type selection
 * - Pass/fail status indicators
 * - Stress limit checking
 */

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Layers } from 'lucide-react';

interface StressPoint {
  x: number;
  y: number;
  z: number;
  sigma_x: number;
  sigma_y: number;
  sigma_z: number;
  tau_xy: number;
  tau_yz: number;
  tau_zx: number;
  von_mises: number;
  principal_1: number;
  principal_2: number;
  principal_3: number;
  max_shear: number;
}

interface ContourData {
  min: number;
  max: number;
  levels: number[];
  colors: string[];
  values: number[];
  points: Array<{
    x: number;
    y: number;
    z: number;
    value: number;
  }>;
}

interface StressCheck {
  passes: boolean;
  max_utilization: number;
  allowable_stress: number;
  critical_points: Array<{
    x: number;
    y: number;
    von_mises: number;
    utilization: number;
    status: string;
  }>;
  summary: string;
}

interface MemberStress {
  member_id: string;
  stress_points: StressPoint[];
  contours: ContourData;
  check: StressCheck;
}

interface StressVisualizationProps {
  results: MemberStress[];
  stressType: string;
  onClose?: () => void;
  onStressTypeChange?: (type: string) => void;
}

const StressVisualization: React.FC<StressVisualizationProps> = ({
  results,
  stressType,
  onClose,
  onStressTypeChange
}) => {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    if (results.length > 0 && !selectedMember) {
      setSelectedMember(results[0].member_id);
    }
  }, [results, selectedMember]);

  const currentResult = results.find(r => r.member_id === selectedMember);

  const stressTypes = [
    { id: 'von_mises', label: 'Von Mises', icon: Activity },
    { id: 'principal_1', label: 'Max Principal (σ₁)', icon: TrendingUp },
    { id: 'principal_3', label: 'Min Principal (σ₃)', icon: TrendingUp },
    { id: 'sigma_x', label: 'Axial Stress (σₓ)', icon: Layers },
    { id: 'max_shear', label: 'Max Shear (τ_max)', icon: Layers }
  ];

  const getStressColor = (value: number, min: number, max: number): string => {
    if (max === min) return '#3b82f6'; // Blue if no variation
    
    const t = (value - min) / (max - min);
    
    // Blue (low) -> Cyan -> Green -> Yellow -> Red (high)
    let r: number, g: number, b: number;
    
    if (t < 0.25) {
      r = 0;
      g = Math.floor(255 * (t / 0.25));
      b = 255;
    } else if (t < 0.5) {
      r = 0;
      g = 255;
      b = Math.floor(255 * (1 - (t - 0.25) / 0.25));
    } else if (t < 0.75) {
      r = Math.floor(255 * ((t - 0.5) / 0.25));
      g = 255;
      b = 0;
    } else {
      r = 255;
      g = Math.floor(255 * (1 - (t - 0.75) / 0.25));
      b = 0;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  if (!currentResult) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-500">No stress data available</p>
      </div>
    );
  }

  const { contours, check } = currentResult;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[600px] overflow-y-auto z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Stress Visualization</h3>
              <p className="text-sm text-gray-600">
                Interactive stress analysis and contour display
              </p>
            </div>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Banner */}
        <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
          check.passes 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {check.passes ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span className="font-medium">{check.summary}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stress Type Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Select Stress Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stressTypes.map(type => {
              const Icon = type.icon;
              const isActive = stressType === type.id;
              
              return (
                <button
                  key={type.id}
                  onClick={() => onStressTypeChange?.(type.id)}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer hover:scale-105 ${
                    isActive
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 shadow-lg'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span className={`text-xs font-semibold text-center leading-tight ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                      {type.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Member Selector */}
        {results.length > 1 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Select Member
            </label>
            <select
              value={selectedMember || ''}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-200 font-medium cursor-pointer"
            >
              {results.map(result => (
                <option key={result.member_id} value={result.member_id}>
                  {result.member_id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Stress Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-medium">Min Stress</p>
            <p className="text-lg font-bold text-blue-900">{contours.min.toFixed(2)}</p>
            <p className="text-xs text-blue-600">MPa</p>
          </div>
          
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-600 font-medium">Max Stress</p>
            <p className="text-lg font-bold text-red-900">{contours.max.toFixed(2)}</p>
            <p className="text-xs text-red-600">MPa</p>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-600 font-medium">Allowable</p>
            <p className="text-lg font-bold text-purple-900">{check.allowable_stress.toFixed(2)}</p>
            <p className="text-xs text-purple-600">MPa</p>
          </div>
          
          <div className={`p-3 rounded-lg border ${
            check.max_utilization > 1.0
              ? 'bg-red-50 border-red-200'
              : check.max_utilization > 0.8
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <p className={`text-xs font-medium ${
              check.max_utilization > 1.0
                ? 'text-red-600'
                : check.max_utilization > 0.8
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              Utilization
            </p>
            <p className={`text-lg font-bold ${
              check.max_utilization > 1.0
                ? 'text-red-900'
                : check.max_utilization > 0.8
                ? 'text-yellow-900'
                : 'text-green-900'
            }`}>
              {(check.max_utilization * 100).toFixed(1)}%
            </p>
            <p className={`text-xs ${
              check.max_utilization > 1.0
                ? 'text-red-600'
                : check.max_utilization > 0.8
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {check.max_utilization > 1.0 ? 'OVERSTRESSED' : check.max_utilization > 0.8 ? 'WARNING' : 'SAFE'}
            </p>
          </div>
        </div>

        {/* Color Legend */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stress Legend
          </label>
          <div className="space-y-1">
            <div className="h-8 rounded-lg overflow-hidden flex">
              {contours.colors.map((color, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: color }}
                  className="flex-1"
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{contours.min.toFixed(1)} MPa</span>
              <span>{contours.max.toFixed(1)} MPa</span>
            </div>
          </div>
        </div>

        {/* Critical Points Warning */}
        {check.critical_points && check.critical_points.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 mb-2">
                  Critical Points Detected ({check.critical_points.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {check.critical_points.slice(0, 5).map((point, i) => (
                    <div key={i} className="text-sm text-red-800">
                      <span className="font-medium">Location x={point.x.toFixed(2)}m:</span>{' '}
                      σ_vm = {point.von_mises.toFixed(2)} MPa ({(point.utilization * 100).toFixed(1)}%)
                    </div>
                  ))}
                  {check.critical_points.length > 5 && (
                    <p className="text-sm text-red-600 italic">
                      + {check.critical_points.length - 5} more critical points
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stress Distribution Chart (Simplified) */}
        {showDetails && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Stress Distribution Along Member
              </label>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showDetails ? 'Hide Chart' : 'Show Chart'}
              </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="relative h-56">
                {/* SVG-based chart for better quality */}
                <svg width="100%" height="100%" viewBox="0 0 600 200" className="overflow-visible">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <line
                      key={`grid-h-${i}`}
                      x1="50"
                      y1={20 + i * 35}
                      x2="580"
                      y2={20 + i * 35}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.5"
                    />
                  ))}
                  
                  {/* Axes */}
                  <line x1="50" y1="195" x2="580" y2="195" stroke="#374151" strokeWidth="2" />
                  <line x1="50" y1="20" x2="50" y2="195" stroke="#374151" strokeWidth="2" />
                  
                  {/* Stress distribution curve */}
                  <path
                    d={(() => {
                      const values = contours.values.slice(0, 30);
                      const maxVal = Math.max(...values);
                      const minVal = Math.min(...values);
                      const range = maxVal - minVal || 1;
                      
                      return values.map((value, i) => {
                        const x = 50 + (i / (values.length - 1)) * 530;
                        const normalizedValue = (value - minVal) / range;
                        const y = 195 - (normalizedValue * 175);
                        return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                      }).join(' ');
                    })()}
                    fill="none"
                    stroke="url(#stressGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  
                  {/* Fill under curve with gradient */}
                  <path
                    d={(() => {
                      const values = contours.values.slice(0, 30);
                      const maxVal = Math.max(...values);
                      const minVal = Math.min(...values);
                      const range = maxVal - minVal || 1;
                      
                      const points = values.map((value, i) => {
                        const x = 50 + (i / (values.length - 1)) * 530;
                        const normalizedValue = (value - minVal) / range;
                        const y = 195 - (normalizedValue * 175);
                        return `${x},${y}`;
                      });
                      
                      return `M 50,195 L ${points.join(' L ')} L 580,195 Z`;
                    })()}
                    fill="url(#stressGradient)"
                    fillOpacity="0.15"
                  />
                  
                  {/* Data points */}
                  {contours.values.slice(0, 30).map((value, i) => {
                    const maxVal = Math.max(...contours.values.slice(0, 30));
                    const minVal = Math.min(...contours.values.slice(0, 30));
                    const range = maxVal - minVal || 1;
                    const normalizedValue = (value - minVal) / range;
                    const x = 50 + (i / 29) * 530;
                    const y = 195 - (normalizedValue * 175);
                    const color = getStressColor(value, contours.min, contours.max);
                    
                    return (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill={color}
                          stroke="white"
                          strokeWidth="1.5"
                          opacity="0.9"
                        />
                      </g>
                    );
                  })}
                  
                  {/* Y-axis labels */}
                  <text x="45" y="23" fontSize="11" textAnchor="end" fill="#6b7280" fontWeight="500">
                    {contours.max.toFixed(1)}
                  </text>
                  <text x="45" y="110" fontSize="11" textAnchor="end" fill="#6b7280" fontWeight="500">
                    {((contours.max + contours.min) / 2).toFixed(1)}
                  </text>
                  <text x="45" y="197" fontSize="11" textAnchor="end" fill="#6b7280" fontWeight="500">
                    {contours.min.toFixed(1)}
                  </text>
                  
                  {/* X-axis label */}
                  <text x="315" y="215" fontSize="12" textAnchor="middle" fill="#374151" fontWeight="600">
                    Position Along Member
                  </text>
                  
                  {/* Y-axis label */}
                  <text x="15" y="110" fontSize="12" textAnchor="middle" fill="#374151" fontWeight="600" transform="rotate(-90, 15, 110)">
                    Stress (MPa)
                  </text>
                  
                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="stressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="25%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="75%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              
              {/* Legend */}
              <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Low Stress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Elevated</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Critical</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              const dataStr = JSON.stringify(results, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `stress-analysis-${Date.now()}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg"
          >
            Export Data (JSON)
          </button>
          <button
            onClick={() => window.alert('Detailed PDF report feature coming soon!')}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 dark:from-gray-700 dark:to-gray-800 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 dark:hover:from-gray-600 dark:hover:to-gray-700 transition-all font-semibold shadow-lg"
          >
            PDF Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default StressVisualization;
