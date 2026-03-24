/**
 * ============================================================================
 * TORSION DESIGN PAGE - IS 456:2000 / ACI 318
 * ============================================================================
 * 
 * RC beam torsion design including:
 * - St. Venant torsion (uniform members)
 * - Warping torsion (non-uniform members)
 * - Combined flexure and torsion (P-M-T interaction)
 * - Stirrup and longitudinal bar design
 * - Skew-Bending check
 * 
 * CODES: IS 456 Cl. 40, ACI 318 Ch. 11
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  Calculator,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  Play,
  Loader2,
  RotateCw,
  Info,
  Settings,
  Zap,
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
import styles from '../styles/design-page.module.css';

interface TorsionInput {
  // Beam geometry
  width: number;
  depth: number;
  effectiveDepth: number;
  cover: number;
  length: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Design forces
  Tu: number;  // Ultimate torsional moment (kN·m)
  Mu: number;  // Ultimate flexural moment (kN·m)
  Vu: number;  // Ultimate shear force (kN)
  
  // Options
  code: 'IS456' | 'ACI318';
  memberType: 'solid' | 'hollow';
  hollowThickness?: number;
}

interface TorsionResult {
  status: 'success' | 'error';
  torsionCheck: {
    Tc: number;  // Torsional strength capacity
    Tu: number;  // Applied torsion
    utilization: number;
    passed: boolean;
  };
  reinforcement: {
    stirrupDia: number;
    stirrupSpacing: number;
    stirrupArea: number;
    longitudinalBarDia: number;
    numLongitudinalBars: number;
  };
  interaction: {
    pmt: number;  // P-M-T interaction ratio
    passed: boolean;
  };
  recommendations: string[];
  message: string;
}

export const TorsionDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TorsionResult | null>(null);

  const [input, setInput] = useState<TorsionInput>({
    width: 300,
    depth: 500,
    effectiveDepth: 450,
    cover: 40,
    length: 4000,
    fck: 30,
    fy: 500,
    Tu: 120,
    Mu: 250,
    Vu: 150,
    code: 'IS456',
    memberType: 'solid',
  });

  const handleDesign = async () => {
    setIsLoading(true);
    try {
      // Call backend API
      const response = await fetch('/api/design/torsion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      setResult(data);
      showToast('success', 'Torsion design completed');
    } catch (error) {
      showToast('error', getErrorMessage(error));
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
        className="sticky top-0 z-40 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200 px-6 py-4"
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
                <RotateCw className="w-6 h-6 text-orange-600" />
                Torsion Design
              </h1>
              <p className="text-sm text-gray-600">IS 456 Cl. 40 / ACI 318 Ch. 11</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl mx-auto p-6 space-y-6"
        >
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Geometry */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Beam Geometry</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Width (mm)" required />
                  <Input
                    type="number"
                    value={input.width}
                    onChange={(e) => setInput({ ...input, width: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel label="Depth (mm)" required />
                  <Input
                    type="number"
                    value={input.depth}
                    onChange={(e) => setInput({ ...input, depth: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel label="Effective Depth (mm)" required />
                  <Input
                    type="number"
                    value={input.effectiveDepth}
                    onChange={(e) => setInput({ ...input, effectiveDepth: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel label="Cover (mm)" required />
                  <Input
                    type="number"
                    value={input.cover}
                    onChange={(e) => setInput({ ...input, cover: parseFloat(e.target.value) })}
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
                  <FieldLabel label="Concrete Grade (fck, N/mm²)" required />
                  <Select
                    value={input.fck}
                    onChange={(e) => setInput({ ...input, fck: parseFloat(e.target.value) })}
                    className="mt-1"
                  >
                    {[20, 25, 30, 35, 40, 45, 50].map((grade) => (
                      <option key={grade} value={grade}>
                        M{grade}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel label="Steel Yield (fy, N/mm²)" required />
                  <Select
                    value={input.fy}
                    onChange={(e) => setInput({ ...input, fy: parseFloat(e.target.value) })}
                    className="mt-1"
                  >
                    {[250, 415, 500].map((fy) => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Design Forces */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Design Forces (Ultimate)</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FieldLabel label="Torsion Tu (kN·m)" required />
                  <Input
                    type="number"
                    value={input.Tu}
                    onChange={(e) => setInput({ ...input, Tu: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel label="Moment Mu (kN·m)" required />
                  <Input
                    type="number"
                    value={input.Mu}
                    onChange={(e) => setInput({ ...input, Mu: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <FieldLabel label="Shear Vu (kN)" required />
                  <Input
                    type="number"
                    value={input.Vu}
                    onChange={(e) => setInput({ ...input, Vu: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Code & Options */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Design Code" />
                  <Select
                    value={input.code}
                    onChange={(e) => setInput({ ...input, code: e.target.value as 'IS456' | 'ACI318' })}
                    className="mt-1"
                  >
                    <option value="IS456">IS 456:2000</option>
                    <option value="ACI318">ACI 318-19</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel label="Member Type" />
                  <Select
                    value={input.memberType}
                    onChange={(e) => setInput({ ...input, memberType: e.target.value as 'solid' | 'hollow' })}
                    className="mt-1"
                  >
                    <option value="solid">Solid Section</option>
                    <option value="hollow">Hollow Section</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleDesign}
                disabled={isLoading}
                className="gap-2 flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 py-3 font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Designing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Design
                  </>
                )}
              </Button>
              <Button variant="outline" className="gap-2">
                <Info className="w-4 h-4" />
                Help
              </Button>
            </div>

            <ClauseReference
              clauses={[
                { code: 'IS 456', clause: '40', title: 'Torsion' },
                { code: 'IS 456', clause: '40.4', title: 'Torsional reinforcement' },
                { code: 'ACI 318', clause: '11.6', title: 'Torsion' },
              ]}
            />
          </motion.div>

          {/* Results Section */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {result.status === 'success' ? (
                <>
                  <Alert
                    variant={result.torsionCheck.passed ? 'success' : 'destructive'}
                    icon={result.torsionCheck.passed ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  >
                    {result.message}
                  </Alert>

                  {/* Torsional Capacity */}
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-600" />
                      Torsional Capacity
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Torsion Capacity</p>
                        <p className="text-2xl font-bold text-gray-900">{result.torsionCheck.Tc.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">kN·m</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Applied Torsion</p>
                        <p className="text-2xl font-bold text-gray-900">{result.torsionCheck.Tu.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">kN·m</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Utilization</p>
                        <p className="text-2xl font-bold text-orange-600">{(result.torsionCheck.utilization * 100).toFixed(1)}%</p>
                        <p className="text-xs text-gray-500">of capacity</p>
                      </div>
                    </div>
                  </div>

                  {/* Reinforcement */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Reinforcement</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-3">Stirrups</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-700">Diameter</span>
                            <span className="font-mono font-semibold text-gray-900">
                              {result.reinforcement.stirrupDia}Φ
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-700">Spacing</span>
                            <span className="font-mono font-semibold text-gray-900">
                              {result.reinforcement.stirrupSpacing} mm
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-700">Area</span>
                            <span className="font-mono font-semibold text-gray-900">
                              {result.reinforcement.stirrupArea.toFixed(1)} mm²
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 mb-3">Longitudinal Bars</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-700">Diameter</span>
                            <span className="font-mono font-semibold text-gray-900">
                              {result.reinforcement.longitudinalBarDia}Φ
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-700">Number of bars</span>
                            <span className="font-mono font-semibold text-gray-900">
                              {result.reinforcement.numLongitudinalBars}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {result.recommendations.length > 0 && (
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-3">Recommendations</h3>
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
                </>
              ) : (
                <Alert variant="destructive" icon={<AlertCircle className="w-4 h-4" />}>
                  Design failed. Please check your inputs.
                </Alert>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default TorsionDesignPage;
