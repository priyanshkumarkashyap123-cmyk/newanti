/**
 * ============================================================================
 * MOVING LOAD ANALYSIS PAGE - IRC 6:2017 / AASHTO / EUROCODE
 * ============================================================================
 * 
 * Bridge and long-span structure analysis using moving vehicle loads:
 * - Standard vehicle models (IRC Class A/AA, AASHTO HL-93, Eurocode LM1)
 * - Automatic envelope generation
 * - Critical position identification
 * - Multi-lane analysis
 * - Maximum force visualization
 * 
 * CONNECTED TO BACKEND:
 * - POST /load-generation/moving-loads (Python API)
 * - Returns load cases, envelopes, critical positions
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Calculator,
  Truck,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  Copy,
  Play,
  Loader2,
  ArrowLeft,
  Info,
  Settings,
  TrendingUp,
  Map,
  Zap,
  Home,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input, Select, Switch } from '../components/ui/FormInputs';
import { Alert } from '../components/ui/alert';
import { useToast } from '../components/ui/ToastSystem';
import { FieldLabel } from '../components/ui/FieldLabel';
import { ClauseReference } from '../components/ui/ClauseReference';
import { getErrorMessage } from '../lib/errorHandling';
import { MovingLoadEngine } from '../components/structural/MovingLoadEngine';
import styles from '../styles/design-page.module.css';

interface VehiclePreset {
  type: string;
  name: string;
  standard: string;
  totalLoad: number;
  totalLength: number;
}

interface LaneDefinition {
  id: string;
  name: string;
  startNode: string;
  endNode: string;
  length: number;
  width: number;
  laneSpacing: number;
  numLanes: number;
}

interface AnalysisInput {
  // Vehicle Selection
  vehicleType: 'IRC_CLASS_A' | 'IRC_CLASS_AA' | 'AASHTO_HL93' | 'EUROCODE_LM1' | 'custom';
  customVehicle?: {
    name: string;
    axles: Array<{ load: number; spacing: number; width: number }>;
  };
  impactFactor?: number;

  // Lane Definition
  laneMembers: string[];
  stepSize: number;
  numLanes: number;
  laneSpacing: number;
  
  // Structure
  spanLength: number;
  numSpans: number;
  
  // Analysis Options
  calculateEnvelope: boolean;
  includeMultipleLanes: boolean;
  includeImpact: boolean;
}

interface AnalysisResult {
  status: 'success' | 'error' | 'warning';
  vehicle: {
    name: string;
    standard: string;
    totalLoad: number;
    axleCount: number;
  };
  lane: {
    totalLength: number;
    numMembers: number;
  };
  envelope: {
    maxMoment: number;
    maxMomentPosition: number;
    maxShear: number;
    maxShearPosition: number;
    points: Array<{
      position: number;
      maxMoment: number;
      minMoment: number;
      maxShear: number;
      minShear: number;
    }>;
  };
  criticalPositions: Array<{
    position: number;
    effect: string;
    value: number;
    unit: string;
  }>;
  recommendations?: string[];
  timestamp: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MovingLoadPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'charts'>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [useCustomVehicle, setUseCustomVehicle] = useState(false);

  // ── Input States ──
  const [input, setInput] = useState<AnalysisInput>({
    vehicleType: 'IRC_CLASS_A',
    stepSize: 0.5,
    numLanes: 1,
    laneSpacing: 3.5,
    spanLength: 15,
    numSpans: 1,
    laneMembers: ['M1', 'M2', 'M3', 'M4'],
    calculateEnvelope: true,
    includeMultipleLanes: false,
    includeImpact: true,
  });

  const [customVehicle, setCustomVehicle] = useState({
    name: 'Custom Vehicle',
    axles: [
      { load: 50, spacing: 0, width: 2.5 },
      { load: 50, spacing: 1.5, width: 2.5 },
      { load: 100, spacing: 3.0, width: 2.5 },
    ],
  });

  // ── Results ──
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  // ── Handlers ──
  const handleAnalyze = useCallback(async () => {
    if (!input.laneMembers.length) {
      toast.error('Define lane members before analysis');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        vehicle_type: useCustomVehicle ? 'custom' : input.vehicleType,
        custom_vehicle: useCustomVehicle ? customVehicle : undefined,
        lane_members: input.laneMembers,
        step_size: input.stepSize,
        impact_factor: input.includeImpact ? undefined : 1.0,
        num_lanes: input.includeMultipleLanes ? input.numLanes : 1,
        lane_spacing: input.laneSpacing,
      };

      // Call backend API
      const response = await fetch('/api/load-generation/moving-loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      const newResult: AnalysisResult = {
        status: 'success',
        vehicle: data.vehicle,
        lane: data.lane,
        envelope: data.envelope,
        criticalPositions: data.criticalPositions,
        recommendations: data.recommendations,
        timestamp: new Date().toISOString(),
      };

      setResult(newResult);
      setHistory([newResult, ...history].slice(0, 5));
      setActiveTab('results');
      toast.success('Moving load analysis completed');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult({
        status: 'error',
        vehicle: { name: '', standard: '', totalLoad: 0, axleCount: 0 },
        lane: { totalLength: 0, numMembers: 0 },
        envelope: { maxMoment: 0, maxMomentPosition: 0, maxShear: 0, maxShearPosition: 0, points: [] },
        criticalPositions: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, useCustomVehicle, customVehicle, toast, history]);

  const handleAddAxle = () => {
    setCustomVehicle({
      ...customVehicle,
      axles: [...customVehicle.axles, { load: 50, spacing: 3.0, width: 2.5 }],
    });
  };

  const handleRemoveAxle = (index: number) => {
    setCustomVehicle({
      ...customVehicle,
      axles: customVehicle.axles.filter((_, i) => i !== index),
    });
  };

  const handleAddMember = () => {
    const nextId = `M${input.laneMembers.length + 1}`;
    setInput({ ...input, laneMembers: [...input.laneMembers, nextId] });
  };

  const handleRemoveMember = (index: number) => {
    setInput({
      ...input,
      laneMembers: input.laneMembers.filter((_, i) => i !== index),
    });
  };

  const handleExportResults = () => {
    if (!result) return;
    const csv = [
      ['Position (m)', 'Max Moment (kN·m)', 'Min Moment (kN·m)', 'Max Shear (kN)', 'Min Shear (kN)'],
      ...result.envelope.points.map((p) => [
        p.position.toFixed(2),
        p.maxMoment.toFixed(2),
        p.minMoment.toFixed(2),
        p.maxShear.toFixed(2),
        p.minShear.toFixed(2),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moving-load-envelope-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Envelope data exported to CSV');
  };

  // ── Vehicle Presets ──
  const VEHICLE_PRESETS: Record<string, VehiclePreset> = {
    IRC_CLASS_A: {
      type: 'IRC_CLASS_A',
      name: 'IRC Class A (Tracked)',
      standard: 'IRC 6:2017',
      totalLoad: 484,
      totalLength: 18.0,
    },
    IRC_CLASS_AA: {
      type: 'IRC_CLASS_AA',
      name: 'IRC Class AA (Wheeled Loader)',
      standard: 'IRC 6:2017',
      totalLoad: 700,
      totalLength: 3.6,
    },
    AASHTO_HL93: {
      type: 'AASHTO_HL93',
      name: 'AASHTO HL-93',
      standard: 'AASHTO LRFD',
      totalLoad: 356,
      totalLength: 14.63,
    },
    EUROCODE_LM1: {
      type: 'EUROCODE_LM1',
      name: 'Eurocode LM1',
      standard: 'EN 1991-2',
      totalLoad: 400,
      totalLength: 16.0,
    },
  };

  const selectedVehicle = useCustomVehicle
    ? { name: customVehicle.name, standard: 'Custom', totalLoad: 0, totalLength: 0 }
    : VEHICLE_PRESETS[input.vehicleType];

  return (
    <div className={styles['design-page']}>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200 px-6 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/design')}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-600" />
                Moving Load Analysis
              </h1>
              <p className="text-sm text-gray-600">
                Bridge design per IRC 6:2017, AASHTO, Eurocode
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('input')}>
              Input
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('results')}>
              Results
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-7xl mx-auto p-6 space-y-6"
        >
          {/* Tab: Input */}
          {activeTab === 'input' && (
            <div className="space-y-6">
              {/* Vehicle Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Vehicle Selection
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <FieldLabel field="vehicleType" label="Vehicle Type" />
                    <Select
                      value={useCustomVehicle ? 'custom' : input.vehicleType}
                      options={[
                        ...Object.entries(VEHICLE_PRESETS).map(([key, vehicle]) => ({ value: key, label: vehicle.name })),
                        { value: 'custom', label: 'Custom Vehicle' },
                      ]}
                      onChange={(value) => {
                        if (value === 'custom') {
                          setUseCustomVehicle(true);
                        } else {
                          setUseCustomVehicle(false);
                          setInput({
                            ...input,
                            vehicleType: value as AnalysisInput['vehicleType'],
                          });
                        }
                      }}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <FieldLabel field="totalLoad" label="Total Load (kN)" />
                    <Input
                      type="number"
                      value={selectedVehicle.totalLoad}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>

                  <div>
                    <FieldLabel field="standardCode" label="Standard / Code" />
                    <Input
                      type="text"
                      value={selectedVehicle.standard}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>

                  <div>
                    <FieldLabel field="vehicleLength" label="Vehicle Length (m)" />
                    <Input
                      type="number"
                      value={selectedVehicle.totalLength}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel field="includeImpact" label="Include Impact Factor" />
                      <Switch
                        checked={input.includeImpact}
                        onChange={(checked) =>
                          setInput({ ...input, includeImpact: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Vehicle Definition */}
                {useCustomVehicle && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">Axle Configuration</h3>
                      <Button size="sm" onClick={handleAddAxle} className="gap-1">
                        <Plus className="w-4 h-4" />
                        Add Axle
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {customVehicle.axles.map((axle, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label text={`Axle ${idx + 1} Load (kN)`} />
                            <Input
                              type="number"
                              value={axle.load}
                              onChange={(e) => {
                                const newAxles = [...customVehicle.axles];
                                newAxles[idx].load = parseFloat(e.target.value) || 0;
                                setCustomVehicle({ ...customVehicle, axles: newAxles });
                              }}
                              className="mt-1"
                            />
                          </div>
                          <div className="flex-1">
                            <Label text="Spacing (m)" />
                            <Input
                              type="number"
                              value={axle.spacing}
                              onChange={(e) => {
                                const newAxles = [...customVehicle.axles];
                                newAxles[idx].spacing = parseFloat(e.target.value) || 0;
                                setCustomVehicle({ ...customVehicle, axles: newAxles });
                              }}
                              className="mt-1"
                            />
                          </div>
                          <div className="flex-1">
                            <Label text="Width (m)" />
                            <Input
                              type="number"
                              value={axle.width}
                              onChange={(e) => {
                                const newAxles = [...customVehicle.axles];
                                newAxles[idx].width = parseFloat(e.target.value) || 0;
                                setCustomVehicle({ ...customVehicle, axles: newAxles });
                              }}
                              className="mt-1"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveAxle(idx)}
                            className="mb-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Lane Definition */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Map className="w-5 h-5 text-green-600" />
                  Lane Definition
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <FieldLabel field="spanLength" label="Span Length (m)" />
                    <Input
                      type="number"
                      value={input.spanLength}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          spanLength: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <FieldLabel field="numSpans" label="Number of Spans" />
                    <Input
                      type="number"
                      value={input.numSpans}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          numSpans: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1"
                      min="1"
                    />
                  </div>

                  <div>
                    <FieldLabel field="stepSize" label="Step Size (m)" />
                    <Input
                      type="number"
                      value={input.stepSize}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          stepSize: parseFloat(e.target.value) || 0.5,
                        })
                      }
                      className="mt-1"
                      min="0.1"
                      step="0.1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <FieldLabel field="includeMultipleLanes" label="Include Multiple Lanes" />
                      <Switch
                        checked={input.includeMultipleLanes}
                        onChange={(checked) =>
                          setInput({ ...input, includeMultipleLanes: checked })
                        }
                      />
                    </div>
                  </div>

                  {input.includeMultipleLanes && (
                    <>
                      <div>
                        <FieldLabel field="numLanes" label="Number of Lanes" />
                        <Input
                          type="number"
                          value={input.numLanes}
                          onChange={(e) =>
                            setInput({
                              ...input,
                              numLanes: parseInt(e.target.value) || 1,
                            })
                          }
                          className="mt-1"
                          min="1"
                        />
                      </div>

                      <div>
                        <FieldLabel field="laneSpacing" label="Lane Spacing (m)" />
                        <Input
                          type="number"
                          value={input.laneSpacing}
                          onChange={(e) =>
                            setInput({
                              ...input,
                              laneSpacing: parseFloat(e.target.value) || 3.5,
                            })
                          }
                          className="mt-1"
                          min="2.5"
                        />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>

              {/* Analysis Options */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Analysis Options
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FieldLabel field="calculateEnvelope" label="Calculate Load Envelope" />
                    <Switch
                      checked={input.calculateEnvelope}
                      onChange={(checked) =>
                        setInput({ ...input, calculateEnvelope: checked })
                      }
                    />
                  </div>

                  <Alert variant="info" className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5" />
                    <span>
                      Envelope calculation finds maximum and minimum values of moment and shear
                      across all vehicle positions.
                    </span>
                  </Alert>
                </div>
              </motion.div>

              {/* Action Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex gap-3"
              >
                <Button
                  onClick={handleAnalyze}
                  disabled={isLoading}
                  className="gap-2 flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Analysis
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => toast.info('Help coming soon')} className="gap-2">
                  <Info className="w-4 h-4" />
                  Help
                </Button>
              </motion.div>

              {/* Clause Reference */}
              <div className="flex flex-wrap items-center gap-3">
                <ClauseReference clauseKey="IS456_40.1" />
                <ClauseReference clauseKey="IS456_40.4" />
              </div>
            </div>
          )}

          {/* Tab: Results */}
          {activeTab === 'results' && result && (
            <div className="space-y-6">
              {result.status === 'success' ? (
                <>
                  <Alert variant="success" className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <span>Analysis completed successfully</span>
                  </Alert>

                  {/* Summary Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
                      <p className="text-sm text-blue-600 font-medium">Max Moment</p>
                      <p className="text-3xl font-bold text-blue-900 mt-1">
                        {result.envelope.maxMoment.toFixed(2)}
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        Position: {result.envelope.maxMomentPosition.toFixed(2)} m
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
                      <p className="text-sm text-green-600 font-medium">Max Shear</p>
                      <p className="text-3xl font-bold text-green-900 mt-1">
                        {result.envelope.maxShear.toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        Position: {result.envelope.maxShearPosition.toFixed(2)} m
                      </p>
                    </div>
                  </motion.div>

                  {/* Envelope Table */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      Load Envelope
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Position (m)</th>
                            <th className="px-4 py-2 text-right text-gray-700 font-medium">Max M (kN·m)</th>
                            <th className="px-4 py-2 text-right text-gray-700 font-medium">Min M (kN·m)</th>
                            <th className="px-4 py-2 text-right text-gray-700 font-medium">Max V (kN)</th>
                            <th className="px-4 py-2 text-right text-gray-700 font-medium">Min V (kN)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.envelope.points.map((point, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-900">{point.position.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-gray-900">
                                {point.maxMoment.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-900">
                                {point.minMoment.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-900">
                                {point.maxShear.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-900">
                                {point.minShear.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Critical Positions */}
                  {result.criticalPositions.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-600" />
                        Critical Positions
                      </h3>
                      <div className="space-y-3">
                        {result.criticalPositions.map((pos, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium text-gray-900">{pos.effect}</p>
                              <p className="text-sm text-gray-600">Position: {pos.position.toFixed(2)} m</p>
                            </div>
                            <p className="font-bold text-gray-900">
                              {pos.value.toFixed(2)} {pos.unit}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Recommendations
                      </h3>
                      <ul className="space-y-2">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex gap-2 text-sm text-blue-800">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Export Button */}
                  <Button
                    onClick={handleExportResults}
                    className="gap-2 w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3"
                  >
                    <Download className="w-4 h-4" />
                    Export Envelope Data to CSV
                  </Button>
                </>
              ) : (
                <Alert variant="destructive" className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>Analysis failed. Please check your inputs and try again.</span>
                </Alert>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Label: React.FC<{ text: string }> = ({ text }) => (
  <label className="block text-sm font-medium text-gray-700">{text}</label>
);

export default MovingLoadPage;
