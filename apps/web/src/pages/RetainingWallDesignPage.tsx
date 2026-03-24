/**
 * ============================================================================
 * RETAINING WALL DESIGN PAGE - IS 456:2000 / IS 3370
 * ============================================================================
 * 
 * Cantilever and counterfort retaining wall design including:
 * - Earth pressure calculations (active, passive, at-rest)
 * - Stability checks (overturning, sliding, bearing)
 * - Base slab and stem reinforcement design
 * - Toe and heel design
 * - Shear and bending capacity verification
 * 
 * CODES: IS 456, IS 3370, IS 875 Part 5
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Mountain,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Info,
  TrendingDown,
  Shield,
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

interface RetainingWallInput {
  // Wall geometry
  wallHeight: number;
  stemThickness: number;
  baseSlab: {
    thickness: number;
    toeLength: number;
    heelLength: number;
  };
  
  // Soil properties
  gamma: number;  // Unit weight (kN/m³)
  phi: number;    // Friction angle (degrees)
  cohesion: number;  // kPa
  ka: number;     // Active earth pressure coefficient (auto-calculated if 0)
  kp: number;     // Passive earth pressure coefficient
  
  // Materials
  fck: number;
  fy: number;
  
  // Wall surcharge
  uniformSurcharge: number;  // kN/m²
  
  // Options
  wallType: 'cantilever' | 'counterfort';
  soilBearingCapacity: number;  // kPa
}

interface RetainingWallResult {
  status: 'success' | 'error';
  stability: {
    overturn: {
      mo: number;  // Overturning moment
      mr: number;  // Resisting moment
      fos: number;
      passed: boolean;
    };
    sliding: {
      force: number;
      resist: number;
      fos: number;
      passed: boolean;
    };
    bearing: {
      intensity: number;
      capacity: number;
      fos: number;
      passed: boolean;
    };
  };
  reinforcement: {
    stem: {
      mainBarDia: number;
      spacing: number;
      area: number;
    };
    baseTop: {
      mainBarDia: number;
      spacing: number;
      area: number;
    };
    baseBottom: {
      mainBarDia: number;
      spacing: number;
      area: number;
    };
  };
  overallStatus: 'safe' | 'unsafe' | 'warning';
  message: string;
}

export const RetainingWallDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RetainingWallResult | null>(null);

  const [input, setInput] = useState<RetainingWallInput>({
    wallHeight: 5000,
    stemThickness: 300,
    baseSlab: {
      thickness: 500,
      toeLength: 1000,
      heelLength: 2500,
    },
    gamma: 18,
    phi: 30,
    cohesion: 0,
    ka: 0,  // Will be auto-calculated
    kp: 0,
    fck: 30,
    fy: 500,
    uniformSurcharge: 10,
    wallType: 'cantilever',
    soilBearingCapacity: 200,
  });

  const handleDesign = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/design/retaining-wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      setResult(data);
      toast.success('Retaining wall design completed');
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
        className="sticky top-0 z-40 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-4"
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
              <Mountain className="w-6 h-6 text-amber-600" />
              Retaining Wall Design
            </h1>
            <p className="text-sm text-gray-600">IS 456 / IS 3370 / Cantilever & Counterfort</p>
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
            {/* Wall Geometry */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Wall Geometry</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel field="wallHeight" label="Wall Height (mm)" />
                  <Input
                    type="number"
                    value={input.wallHeight}
                    onChange={(e) => setInput({ ...input, wallHeight: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="stemThickness" label="Stem Thickness (mm)" />
                  <Input
                    type="number"
                    value={input.stemThickness}
                    onChange={(e) => setInput({ ...input, stemThickness: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="baseThickness" label="Base Slab Thickness (mm)" />
                  <Input
                    type="number"
                    value={input.baseSlab.thickness}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        baseSlab: { ...input.baseSlab, thickness: parseFloat(e.target.value) },
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="toeLength" label="Toe Length (mm)" />
                  <Input
                    type="number"
                    value={input.baseSlab.toeLength}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        baseSlab: { ...input.baseSlab, toeLength: parseFloat(e.target.value) },
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="heelLength" label="Heel Length (mm)" />
                  <Input
                    type="number"
                    value={input.baseSlab.heelLength}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        baseSlab: { ...input.baseSlab, heelLength: parseFloat(e.target.value) },
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Soil Properties */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Soil Properties</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel field="gamma" label="Unit Weight γ (kN/m³)" />
                  <Input
                    type="number"
                    value={input.gamma}
                    onChange={(e) => setInput({ ...input, gamma: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="phi" label="Friction Angle φ (°)" />
                  <Input
                    type="number"
                    value={input.phi}
                    onChange={(e) => setInput({ ...input, phi: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="cohesion" label="Cohesion (kPa)" />
                  <Input
                    type="number"
                    value={input.cohesion}
                    onChange={(e) => setInput({ ...input, cohesion: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="soilBearingCapacity" label="Bearing Capacity (kPa)" />
                  <Input
                    type="number"
                    value={input.soilBearingCapacity}
                    onChange={(e) =>
                      setInput({ ...input, soilBearingCapacity: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel field="uniformSurcharge" label="Uniform Surcharge (kN/m²)" />
                  <Input
                    type="number"
                    value={input.uniformSurcharge}
                    onChange={(e) =>
                      setInput({ ...input, uniformSurcharge: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Materials */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel field="fck" label="Concrete Grade (fck)" />
                  <Select
                    value={input.fck}
                    options={[20, 25, 30, 35, 40].map((grade) => ({ value: String(grade), label: `M${grade}` }))}
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleDesign}
                disabled={isLoading}
                className="gap-2 flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 py-3 font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Designing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Design Wall
                  </>
                )}
              </Button>
              <Button variant="outline" className="gap-2">
                <Info className="w-4 h-4" />
                Help
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ClauseReference clauseKey="IS456_40.1" />
              <ClauseReference clauseKey="IS456_40.4" />
              <ClauseReference clauseKey="IS456_26.5.2.1" />
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
                variant={result.overallStatus === 'safe' ? 'success' : 'destructive'}
                className="flex items-start gap-2"
              >
                {result.overallStatus === 'safe' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                <span>{result.message}</span>
              </Alert>

              {/* Stability Checks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`rounded-lg border p-6 ${
                    result.stability.overturn.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Overturning
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">FOS:</span>
                      <span className="font-bold text-gray-900">{result.stability.overturn.fos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={result.stability.overturn.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {result.stability.overturn.passed ? 'SAFE' : 'UNSAFE'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-6 ${
                    result.stability.sliding.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Sliding
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">FOS:</span>
                      <span className="font-bold text-gray-900">{result.stability.sliding.fos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={result.stability.sliding.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {result.stability.sliding.passed ? 'SAFE' : 'UNSAFE'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-6 ${
                    result.stability.bearing.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Mountain className="w-4 h-4" />
                    Bearing
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">FOS:</span>
                      <span className="font-bold text-gray-900">{result.stability.bearing.fos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={result.stability.bearing.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {result.stability.bearing.passed ? 'SAFE' : 'UNSAFE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reinforcement */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Reinforcement</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Stem Reinforcement</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Diameter:</span> <span className="font-mono">{result.reinforcement.stem.mainBarDia}Φ</span></div>
                      <div className="flex justify-between"><span>Spacing:</span> <span className="font-mono">{result.reinforcement.stem.spacing} mm</span></div>
                      <div className="flex justify-between"><span>Area:</span> <span className="font-mono">{result.reinforcement.stem.area.toFixed(0)} mm²</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Base Top (Heel)</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Diameter:</span> <span className="font-mono">{result.reinforcement.baseTop.mainBarDia}Φ</span></div>
                      <div className="flex justify-between"><span>Spacing:</span> <span className="font-mono">{result.reinforcement.baseTop.spacing} mm</span></div>
                      <div className="flex justify-between"><span>Area:</span> <span className="font-mono">{result.reinforcement.baseTop.area.toFixed(0)} mm²</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Base Bottom (Toe)</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Diameter:</span> <span className="font-mono">{result.reinforcement.baseBottom.mainBarDia}Φ</span></div>
                      <div className="flex justify-between"><span>Spacing:</span> <span className="font-mono">{result.reinforcement.baseBottom.spacing} mm</span></div>
                      <div className="flex justify-between"><span>Area:</span> <span className="font-mono">{result.reinforcement.baseBottom.area.toFixed(0)} mm²</span></div>
                    </div>
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

export default RetainingWallDesignPage;
