/**
 * ============================================================================
 * STAIRCASE DESIGN PAGE - IS 456:2000
 * ============================================================================
 * 
 * Reinforced concrete staircase design including:
 * - Dog-legged stairs (L-shaped)
 * - Open-well stairs (multiple flights)
 * - Slab-type stairs (unified slab)
 * - Landing beam design
 * - Reinforcement planning
 * 
 * CODES: IS 456:2000 Clause 34
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Layers,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Info,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input, Select } from '../components/ui/FormInputs';
import { Alert } from '../components/ui/alert';
import { useToast } from '../components/ui/ToastSystem';
import { FieldLabel } from '../components/ui/FieldLabel';
import { ClauseReference } from '../components/ui/ClauseReference';
import { getErrorMessage } from '../lib/errorHandling';
import styles from '../styles/design-page.module.css';

interface StaircaseInput {
  // Geometry
  floorToFloorHeight: number;
  flightSpan: number;
  flightThickness: number;
  landingThickness: number;
  
  // Stairs geometry
  numSteps: number;
  tread: number;  // mm
  rise: number;   // mm
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  deadLoad: number;  // kN/m²
  liveLoad: number;  // kN/m² (includes self-weight if not specified)
  
  // Options
  staircaseType: 'dog-legged' | 'open-well' | 'slab-type';
  numFlights: number;
}

interface StaircaseResult {
  status: 'success' | 'error';
  geometry: {
    flightLength: number;
    flightEffectiveSpan: number;
    effectiveDepth: number;
    actualDepth: number;
  };
  loads: {
    deadLoad: number;
    liveLoad: number;
    factorDL: number;
    factorLL: number;
    udl: number;
  };
  design: {
    mainBar: {
      dia: number;
      spacing: number;
      area: number;
    };
    distribution: {
      dia: number;
      spacing: number;
    };
    landing: {
      mainBar: { dia: number; area: number };
      support: { dia: number; spacing: number };
    };
  };
  checks: {
    deflection: { actual: number; limit: number; passed: boolean };
    cracking: { wcalc: number; wlimit: number; passed: boolean };
    shear: { vu: number; vc: number; passed: boolean };
  };
  message: string;
}

export const StaircaseDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StaircaseResult | null>(null);

  const [input, setInput] = useState<StaircaseInput>({
    floorToFloorHeight: 3500,
    flightSpan: 3000,
    flightThickness: 150,
    landingThickness: 150,
    numSteps: 12,
    tread: 250,
    rise: 175,
    fck: 30,
    fy: 500,
    deadLoad: 5,
    liveLoad: 4,
    staircaseType: 'dog-legged',
    numFlights: 2,
  });

  const handleDesign = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/design/staircase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      setResult(data);
      toast.success('Staircase design completed');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles['design-page']}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 px-6 py-4"
      >
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
              <Layers className="w-6 h-6 text-purple-600" />
              Staircase Design
            </h1>
            <p className="text-sm text-gray-600">IS 456:2000 Clause 34 - Dog-legged & Open-well</p>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-5xl mx-auto p-6 space-y-6"
        >
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Staircase Type */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Staircase Type</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel field="staircaseType" label="Type" />
                  <Select
                    value={input.staircaseType}
                    options={[
                      { value: 'dog-legged', label: 'Dog-legged (L-shaped)' },
                      { value: 'open-well', label: 'Open-well (Multiple flights)' },
                      { value: 'slab-type', label: 'Slab-type (Unified)' },
                    ]}
                    onChange={(value) =>
                      setInput({
                        ...input,
                        staircaseType: value as 'dog-legged' | 'open-well' | 'slab-type',
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="numFlights" label="Number of Flights" />
                  <Input
                    type="number"
                    value={input.numFlights}
                    onChange={(e) => setInput({ ...input, numFlights: parseInt(e.target.value) || 1 })}
                    className="mt-1"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Geometry */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Staircase Geometry</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel field="floorToFloorHeight" label="Floor-to-Floor Height (mm)" />
                  <Input
                    type="number"
                    value={input.floorToFloorHeight}
                    onChange={(e) =>
                      setInput({ ...input, floorToFloorHeight: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="flightSpan" label="Flight Span (mm)" />
                  <Input
                    type="number"
                    value={input.flightSpan}
                    onChange={(e) =>
                      setInput({ ...input, flightSpan: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="flightThickness" label="Flight Thickness (mm)" />
                  <Input
                    type="number"
                    value={input.flightThickness}
                    onChange={(e) =>
                      setInput({ ...input, flightThickness: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="landingThickness" label="Landing Thickness (mm)" />
                  <Input
                    type="number"
                    value={input.landingThickness}
                    onChange={(e) =>
                      setInput({ ...input, landingThickness: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="numSteps" label="Number of Steps" />
                  <Input
                    type="number"
                    value={input.numSteps}
                    onChange={(e) => setInput({ ...input, numSteps: parseInt(e.target.value) || 1 })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Step Dimensions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Step Dimensions</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel field="tread" label="Tread (mm)" />
                  <Input
                    type="number"
                    value={input.tread}
                    onChange={(e) => setInput({ ...input, tread: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Typical: 250-300 mm</p>
                </div>
                <div>
                  <FieldLabel field="rise" label="Rise (mm)" />
                  <Input
                    type="number"
                    value={input.rise}
                    onChange={(e) => setInput({ ...input, rise: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Typical: 170-200 mm</p>
                </div>
              </div>
              <Alert variant="info" className="mt-4 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5" />
                <span>Verify: 2×Rise + Tread should be between 550-700 mm (ergonomic rule)</span>
              </Alert>
            </div>

            {/* Materials */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel field="fck" label="Concrete Grade (fck)" />
                  <Select
                    value={input.fck}
                    options={[20, 25, 30, 35].map((g) => ({ value: String(g), label: `M${g}` }))}
                    onChange={(value) => setInput({ ...input, fck: parseFloat(value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="fy" label="Steel Yield (fy)" />
                  <Select
                    value={input.fy}
                    options={[250, 415, 500].map((gradeFy) => ({ value: String(gradeFy), label: String(gradeFy) }))}
                    onChange={(value) => setInput({ ...input, fy: parseFloat(value) })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Loads */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Loads</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel field="deadLoad" label="Dead Load (kN/m²)" />
                  <Input
                    type="number"
                    value={input.deadLoad}
                    onChange={(e) => setInput({ ...input, deadLoad: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Finishes, flooring</p>
                </div>
                <div>
                  <FieldLabel field="liveLoad" label="Live Load (kN/m²)" />
                  <Input
                    type="number"
                    value={input.liveLoad}
                    onChange={(e) => setInput({ ...input, liveLoad: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">IS 875 Part 1: Typical 2-4 kN/m²</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleDesign}
                disabled={isLoading}
                className="gap-2 flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-3 font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Designing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Design Staircase
                  </>
                )}
              </Button>
              <Button variant="outline" className="gap-2">
                <Info className="w-4 h-4" />
                Help
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ClauseReference clauseKey="IS456_34.2" />
              <ClauseReference clauseKey="IS456_26.5.2.1" />
              <ClauseReference clauseKey="IS456_40.1" />
            </div>
          </motion.div>

          {/* Results Section */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Alert
                variant={result.status === 'success' ? 'success' : 'destructive'}
                className="flex items-start gap-2"
              >
                {result.status === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                <span>{result.message}</span>
              </Alert>

              {/* Design Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
                  <p className="text-sm text-blue-600 font-medium">Effective Depth Required</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{result.geometry.effectiveDepth.toFixed(0)}</p>
                  <p className="text-xs text-blue-600 mt-2">
                    Actual depth: {result.geometry.actualDepth.toFixed(0)} mm
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
                  <p className="text-sm text-green-600 font-medium">Design Load</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{result.loads.udl.toFixed(2)}</p>
                  <p className="text-xs text-green-600 mt-2">kN/m</p>
                </div>
              </div>

              {/* Reinforcement */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Required Reinforcement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Flight (Main)</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Diameter</span>
                        <span className="font-mono font-semibold">{result.design.mainBar.dia}Φ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Spacing</span>
                        <span className="font-mono font-semibold">{result.design.mainBar.spacing} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Area</span>
                        <span className="font-mono font-semibold">{result.design.mainBar.area.toFixed(0)} mm²</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Distribution</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Diameter</span>
                        <span className="font-mono font-semibold">{result.design.distribution.dia}Φ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Spacing</span>
                        <span className="font-mono font-semibold">{result.design.distribution.spacing} mm</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Landing Beam</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Main Bar</span>
                        <span className="font-mono font-semibold">{result.design.landing.mainBar.dia}Φ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Support</span>
                        <span className="font-mono font-semibold">{result.design.landing.support.dia}Φ @ {result.design.landing.support.spacing} mm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`rounded-lg border p-4 ${
                    result.checks.deflection.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 mb-2">Deflection</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Actual:</span>
                      <span className="font-mono">{result.checks.deflection.actual.toFixed(1)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limit:</span>
                      <span className="font-mono">{result.checks.deflection.limit.toFixed(1)} mm</span>
                    </div>
                    <p className={`mt-2 font-semibold ${result.checks.deflection.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {result.checks.deflection.passed ? 'PASS' : 'FAIL'}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-4 ${
                    result.checks.cracking.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 mb-2">Crack Width</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Calculated:</span>
                      <span className="font-mono">{result.checks.cracking.wcalc.toFixed(2)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limit:</span>
                      <span className="font-mono">{result.checks.cracking.wlimit.toFixed(2)} mm</span>
                    </div>
                    <p className={`mt-2 font-semibold ${result.checks.cracking.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {result.checks.cracking.passed ? 'PASS' : 'FAIL'}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-4 ${
                    result.checks.shear.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 mb-2">Shear Check</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Vu:</span>
                      <span className="font-mono">{result.checks.shear.vu.toFixed(2)} N/mm²</span>
                    </div>
                    <div className="flex justify-between">
                      <span>vc:</span>
                      <span className="font-mono">{result.checks.shear.vc.toFixed(2)} N/mm²</span>
                    </div>
                    <p className={`mt-2 font-semibold ${result.checks.shear.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {result.checks.shear.passed ? 'PASS' : 'FAIL'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default StaircaseDesignPage;
