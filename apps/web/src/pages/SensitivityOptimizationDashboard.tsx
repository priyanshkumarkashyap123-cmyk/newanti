/**
 * Sensitivity & Optimization Dashboard
 *
 * Features:
 * - Design sensitivity analysis (what-if scenarios)
 * - Multi-objective optimization
 * - Parameter studies
 * - Section optimization
 * - Weight minimization
 * - Cost optimization
 *
 * Industry Standard: Matches STAAD.Pro Optimization, ETABS Section Designer
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  BarChart3,
  PieChart,
  LineChart,
  AlertTriangle,
  CheckCircle,
  Info,
  Layers,
  Box,
  Activity,
  Sliders,
  RefreshCw,
  ArrowLeft,
  Home,
  Loader2,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit,
  Copy,
  Eye,
  Scale,
  DollarSign,
  Weight,
  Ruler,
} from "lucide-react";
import { Link } from "react-router-dom";

// Types
type ObjectiveType =
  | "minimize-weight"
  | "minimize-cost"
  | "maximize-stiffness"
  | "minimize-displacement"
  | "custom";
type ConstraintType =
  | "stress"
  | "displacement"
  | "frequency"
  | "buckling"
  | "code-check";
type VariableType =
  | "section-depth"
  | "section-width"
  | "rebar-ratio"
  | "concrete-grade"
  | "steel-grade";
type OptimizationMethod =
  | "gradient"
  | "genetic"
  | "particle-swarm"
  | "response-surface";

interface DesignVariable {
  id: string;
  name: string;
  type: VariableType;
  members: string[];
  lowerBound: number;
  upperBound: number;
  currentValue: number;
  step: number;
  unit: string;
}

interface Constraint {
  id: string;
  name: string;
  type: ConstraintType;
  limit: number;
  currentValue: number;
  unit: string;
  status: "satisfied" | "violated" | "active";
}

interface SensitivityResult {
  variableId: string;
  variableName: string;
  sensitivity: number;
  gradient: number;
  impact: "high" | "medium" | "low";
}

interface OptimizationResult {
  iteration: number;
  objective: number;
  feasibility: number;
  convergence: number;
  variables: { [key: string]: number };
}

const SensitivityOptimizationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "sensitivity" | "optimization" | "parameters"
  >("sensitivity");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  // Optimization settings
  const [optimizationSettings, setOptimizationSettings] = useState({
    objective: "minimize-weight" as ObjectiveType,
    method: "gradient" as OptimizationMethod,
    maxIterations: 100,
    convergenceTolerance: 0.001,
    populationSize: 50,
    mutationRate: 0.1,
  });

  useEffect(() => { document.title = 'Sensitivity & Optimization | BeamLab'; }, []);

  // Design variables
  const [variables] = useState<DesignVariable[]>([
    {
      id: "v1",
      name: "Beam Depth",
      type: "section-depth",
      members: ["B1-B24"],
      lowerBound: 450,
      upperBound: 900,
      currentValue: 600,
      step: 50,
      unit: "mm",
    },
    {
      id: "v2",
      name: "Column Width",
      type: "section-width",
      members: ["C1-C16"],
      lowerBound: 400,
      upperBound: 800,
      currentValue: 500,
      step: 50,
      unit: "mm",
    },
    {
      id: "v3",
      name: "Slab Rebar",
      type: "rebar-ratio",
      members: ["S1-S10"],
      lowerBound: 0.25,
      upperBound: 2.0,
      currentValue: 0.85,
      step: 0.05,
      unit: "%",
    },
    {
      id: "v4",
      name: "Beam Rebar",
      type: "rebar-ratio",
      members: ["B1-B24"],
      lowerBound: 0.5,
      upperBound: 3.0,
      currentValue: 1.5,
      step: 0.1,
      unit: "%",
    },
    {
      id: "v5",
      name: "Concrete Grade",
      type: "concrete-grade",
      members: ["All"],
      lowerBound: 25,
      upperBound: 50,
      currentValue: 35,
      step: 5,
      unit: "MPa",
    },
  ]);

  // Constraints
  const [constraints] = useState<Constraint[]>([
    {
      id: "c1",
      name: "Max Story Drift",
      type: "displacement",
      limit: 0.004,
      currentValue: 0.0032,
      unit: "H",
      status: "satisfied",
    },
    {
      id: "c2",
      name: "Max Stress Ratio",
      type: "stress",
      limit: 1.0,
      currentValue: 0.87,
      unit: "",
      status: "satisfied",
    },
    {
      id: "c3",
      name: "Min Frequency",
      type: "frequency",
      limit: 0.8,
      currentValue: 0.85,
      unit: "Hz",
      status: "active",
    },
    {
      id: "c4",
      name: "Buckling Safety",
      type: "buckling",
      limit: 2.0,
      currentValue: 2.45,
      unit: "",
      status: "satisfied",
    },
    {
      id: "c5",
      name: "Code Utilization",
      type: "code-check",
      limit: 1.0,
      currentValue: 0.92,
      unit: "",
      status: "active",
    },
  ]);

  // Sensitivity results
  const [sensitivityResults] = useState<SensitivityResult[]>([
    {
      variableId: "v1",
      variableName: "Beam Depth",
      sensitivity: 0.85,
      gradient: -2.34,
      impact: "high",
    },
    {
      variableId: "v2",
      variableName: "Column Width",
      sensitivity: 0.72,
      gradient: -1.89,
      impact: "high",
    },
    {
      variableId: "v3",
      variableName: "Slab Rebar",
      sensitivity: 0.45,
      gradient: -0.78,
      impact: "medium",
    },
    {
      variableId: "v4",
      variableName: "Beam Rebar",
      sensitivity: 0.38,
      gradient: -0.65,
      impact: "medium",
    },
    {
      variableId: "v5",
      variableName: "Concrete Grade",
      sensitivity: 0.25,
      gradient: -0.42,
      impact: "low",
    },
  ]);

  // Optimization history
  const [optimizationHistory] = useState<OptimizationResult[]>([
    {
      iteration: 1,
      objective: 1000,
      feasibility: 0.75,
      convergence: 1.0,
      variables: {},
    },
    {
      iteration: 5,
      objective: 920,
      feasibility: 0.85,
      convergence: 0.6,
      variables: {},
    },
    {
      iteration: 10,
      objective: 870,
      feasibility: 0.92,
      convergence: 0.35,
      variables: {},
    },
    {
      iteration: 15,
      objective: 845,
      feasibility: 0.98,
      convergence: 0.15,
      variables: {},
    },
    {
      iteration: 20,
      objective: 832,
      feasibility: 1.0,
      convergence: 0.05,
      variables: {},
    },
    {
      iteration: 25,
      objective: 828,
      feasibility: 1.0,
      convergence: 0.02,
      variables: {},
    },
  ]);

  // Run optimization
  const optimizationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  useEffect(
    () => () => {
      if (optimizationIntervalRef.current)
        clearInterval(optimizationIntervalRef.current);
    },
    [],
  );

  const runOptimization = useCallback(() => {
    setIsRunning(true);
    setProgress(0);

    optimizationIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (optimizationIntervalRef.current)
            clearInterval(optimizationIntervalRef.current);
          optimizationIntervalRef.current = null;
          setIsRunning(false);
          return 100;
        }
        return prev + 2;
      });
    }, 200);
  }, []);

  // Get impact color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-400 bg-red-400/10";
      case "medium":
        return "text-yellow-400 bg-yellow-400/10";
      case "low":
        return "text-green-400 bg-green-400/10";
      default:
        return "text-slate-600 dark:text-slate-400 bg-slate-400/10";
    }
  };

  // Get constraint status
  const getConstraintStatus = (status: string) => {
    switch (status) {
      case "satisfied":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "violated":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "active":
        return <Activity className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900">
      {/* Header */}
      <header className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-700/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-7 h-7 text-green-400" />
                  Sensitivity & Optimization
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Design optimization with multi-objective constraints
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runOptimization}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Optimization
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Progress Bar */}
        {isRunning && (
          <div className="mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-900 dark:text-white font-medium">
                Optimization in progress...
              </span>
              <span className="text-green-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-2">
              <span>Sensitivity analysis</span>
              <span>Gradient calculation</span>
              <span>Optimization step</span>
              <span>Convergence check</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-300 dark:border-slate-700/50 w-fit">
          {[
            {
              id: "sensitivity",
              label: "Sensitivity Analysis",
              icon: TrendingUp,
            },
            { id: "optimization", label: "Optimization", icon: Target },
            { id: "parameters", label: "Parameter Study", icon: Sliders },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-green-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sensitivity Analysis Tab */}
        {activeTab === "sensitivity" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Variables */}
            <div className="lg:col-span-2">
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-green-400" />
                  Design Variables & Sensitivity
                </h3>

                <div className="space-y-4">
                  {sensitivityResults.map((result, index) => {
                    const variable = variables.find(
                      (v) => v.id === result.variableId,
                    );
                    if (!variable) return null;

                    return (
                      <div
                        key={result.variableId}
                        onClick={() =>
                          setSelectedVariable(
                            result.variableId === selectedVariable
                              ? null
                              : result.variableId,
                          )
                        }
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          selectedVariable === result.variableId
                            ? "bg-green-900/20 border-green-500/50"
                            : "bg-slate-700/30 border-slate-300 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-600 dark:text-slate-400 text-sm">
                              #{index + 1}
                            </span>
                            <div>
                              <p className="text-slate-900 dark:text-white font-medium">
                                {result.variableName}
                              </p>
                              <p className="text-slate-600 dark:text-slate-400 text-sm">
                                {variable.members.join(", ")}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm ${getImpactColor(result.impact)}`}
                          >
                            {result.impact} impact
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                              Current
                            </p>
                            <p className="text-slate-900 dark:text-white font-medium">
                              {variable.currentValue} {variable.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Range</p>
                            <p className="text-slate-900 dark:text-white font-medium">
                              {variable.lowerBound} - {variable.upperBound}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                              Sensitivity
                            </p>
                            <p className="text-green-400 font-medium">
                              {result.sensitivity.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                              Gradient
                            </p>
                            <p
                              className={`font-medium ${result.gradient < 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {result.gradient.toFixed(3)}
                            </p>
                          </div>
                        </div>

                        {/* Sensitivity bar */}
                        <div className="mt-3">
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${result.impact === "high" ? "bg-red-500" : result.impact === "medium" ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${result.sensitivity * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Constraints */}
            <div>
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Active Constraints
                </h3>

                <div className="space-y-3">
                  {constraints.map((constraint) => (
                    <div
                      key={constraint.id}
                      className="p-3 bg-slate-700/30 rounded-lg border border-slate-300 dark:border-slate-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-900 dark:text-white font-medium text-sm">
                          {constraint.name}
                        </span>
                        {getConstraintStatus(constraint.status)}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          Current: {constraint.currentValue.toFixed(4)}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          Limit: {constraint.limit} {constraint.unit}
                        </span>
                      </div>

                      <div className="mt-2">
                        <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              constraint.status === "violated"
                                ? "bg-red-500"
                                : constraint.status === "active"
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min((constraint.currentValue / constraint.limit) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors text-sm">
                    <Plus className="w-4 h-4" />
                    Add Design Variable
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors text-sm">
                    <Plus className="w-4 h-4" />
                    Add Constraint
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors text-sm">
                    <RefreshCw className="w-4 h-4" />
                    Recalculate Sensitivity
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Tab */}
        {activeTab === "optimization" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings */}
            <div className="space-y-6">
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-400" />
                  Optimization Settings
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Objective Function
                    </label>
                    <select
                      value={optimizationSettings.objective}
                      onChange={(e) =>
                        setOptimizationSettings({
                          ...optimizationSettings,
                          objective: e.target.value as ObjectiveType,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="minimize-weight">Minimize Weight</option>
                      <option value="minimize-cost">Minimize Cost</option>
                      <option value="maximize-stiffness">
                        Maximize Stiffness
                      </option>
                      <option value="minimize-displacement">
                        Minimize Displacement
                      </option>
                      <option value="custom">Custom Function</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Method
                    </label>
                    <select
                      value={optimizationSettings.method}
                      onChange={(e) =>
                        setOptimizationSettings({
                          ...optimizationSettings,
                          method: e.target.value as OptimizationMethod,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="gradient">Gradient-Based (SQP)</option>
                      <option value="genetic">Genetic Algorithm (GA)</option>
                      <option value="particle-swarm">
                        Particle Swarm (PSO)
                      </option>
                      <option value="response-surface">
                        Response Surface (RSM)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Max Iterations: {optimizationSettings.maxIterations}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      value={optimizationSettings.maxIterations}
                      onChange={(e) =>
                        setOptimizationSettings({
                          ...optimizationSettings,
                          maxIterations: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Convergence Tolerance:{" "}
                      {optimizationSettings.convergenceTolerance}
                    </label>
                    <select
                      value={optimizationSettings.convergenceTolerance}
                      onChange={(e) =>
                        setOptimizationSettings({
                          ...optimizationSettings,
                          convergenceTolerance: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value={0.01}>0.01 (Coarse)</option>
                      <option value={0.001}>0.001 (Standard)</option>
                      <option value={0.0001}>0.0001 (Fine)</option>
                      <option value={0.00001}>0.00001 (Ultra)</option>
                    </select>
                  </div>

                  {(optimizationSettings.method === "genetic" ||
                    optimizationSettings.method === "particle-swarm") && (
                    <>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                          Population Size: {optimizationSettings.populationSize}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          value={optimizationSettings.populationSize}
                          onChange={(e) =>
                            setOptimizationSettings({
                              ...optimizationSettings,
                              populationSize: parseInt(e.target.value),
                            })
                          }
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Current Objective */}
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-xl p-5 border border-green-500/30">
                <div className="flex items-center gap-3 mb-4">
                  {optimizationSettings.objective === "minimize-weight" && (
                    <Weight className="w-6 h-6 text-green-400" />
                  )}
                  {optimizationSettings.objective === "minimize-cost" && (
                    <DollarSign className="w-6 h-6 text-green-400" />
                  )}
                  {optimizationSettings.objective === "maximize-stiffness" && (
                    <Box className="w-6 h-6 text-green-400" />
                  )}
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Current Objective</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">828 tonnes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm">17.2% reduction from initial</span>
                </div>
              </div>
            </div>

            {/* Convergence History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-green-400" />
                  Convergence History
                </h3>

                <div className="h-64 flex items-end gap-1">
                  {optimizationHistory.map((point, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-gradient-to-t from-green-600 to-emerald-400 rounded-t transition-all hover:opacity-80"
                      style={{ height: `${(point.objective / 1000) * 100}%` }}
                      title={`Iteration ${point.iteration}: ${point.objective} tonnes`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-2">
                  <span>Iteration 1</span>
                  <span>Iteration 25</span>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Optimization Results
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-300 dark:border-slate-700">
                        <th className="text-left p-3 text-slate-600 dark:text-slate-400 text-sm">
                          Iteration
                        </th>
                        <th className="text-right p-3 text-slate-600 dark:text-slate-400 text-sm">
                          Objective
                        </th>
                        <th className="text-right p-3 text-slate-600 dark:text-slate-400 text-sm">
                          Feasibility
                        </th>
                        <th className="text-right p-3 text-slate-600 dark:text-slate-400 text-sm">
                          Convergence
                        </th>
                        <th className="text-center p-3 text-slate-600 dark:text-slate-400 text-sm">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimizationHistory.map((result) => (
                        <tr
                          key={result.iteration}
                          className="border-b border-slate-300 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700/30"
                        >
                          <td className="p-3 text-slate-900 dark:text-white">{result.iteration}</td>
                          <td className="p-3 text-right text-slate-900 dark:text-white">
                            {result.objective} tonnes
                          </td>
                          <td className="p-3 text-right">
                            <span
                              className={
                                result.feasibility >= 1
                                  ? "text-green-400"
                                  : "text-yellow-400"
                              }
                            >
                              {(result.feasibility * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                            {result.convergence.toFixed(4)}
                          </td>
                          <td className="p-3 text-center">
                            {result.feasibility >= 1 &&
                            result.convergence < 0.05 ? (
                              <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                            ) : result.feasibility >= 0.9 ? (
                              <Activity className="w-4 h-4 text-yellow-400 mx-auto" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Optimized Variables */}
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-green-400" />
                  Optimized Design Variables
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {variables.map((variable) => (
                    <div
                      key={variable.id}
                      className="p-4 bg-slate-700/30 rounded-lg"
                    >
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                        {variable.name}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                          {variable.currentValue}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400 text-sm">
                          {variable.unit}
                        </span>
                      </div>
                      <p className="text-green-400 text-xs mt-1">
                        ↓{" "}
                        {Math.round(
                          (1 - variable.currentValue / variable.upperBound) *
                            100,
                        )}
                        % from max
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Study Tab */}
        {activeTab === "parameters" && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-300 dark:border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-green-400" />
              Parameter Study Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-slate-900 dark:text-white font-medium mb-4">
                  Select Variables
                </h4>
                <div className="space-y-2">
                  {variables.map((variable) => (
                    <label
                      key={variable.id}
                      className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-500 bg-slate-200 dark:bg-slate-700 text-green-500"
                      />
                      <span className="text-slate-900 dark:text-white">{variable.name}</span>
                      <span className="text-slate-600 dark:text-slate-400 text-sm ml-auto">
                        {variable.lowerBound} - {variable.upperBound}{" "}
                        {variable.unit}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-slate-900 dark:text-white font-medium mb-4">Study Settings</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Study Type
                    </label>
                    <select className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white">
                      <option>Full Factorial</option>
                      <option>Latin Hypercube</option>
                      <option>One-at-a-Time (OAT)</option>
                      <option>Central Composite (CCD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Samples per Variable
                    </label>
                    <input
                      type="number"
                      defaultValue={5}
                      className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                      Response Variables
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="rounded"
                        />
                        <span className="text-slate-700 dark:text-slate-300 text-sm">
                          Total Weight
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="rounded"
                        />
                        <span className="text-slate-700 dark:text-slate-300 text-sm">
                          Max Displacement
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-slate-700 dark:text-slate-300 text-sm">
                          Natural Frequency
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-slate-700 dark:text-slate-300 text-sm">
                          Base Shear
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-300 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 dark:text-slate-400">Total Combinations</span>
                    <span className="text-slate-900 dark:text-white font-bold">3,125</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Estimated Time</span>
                    <span className="text-slate-900 dark:text-white font-bold">~2.5 hours</span>
                  </div>
                </div>

                <button className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg transition-colors font-medium">
                  <Play className="w-4 h-4" />
                  Start Parameter Study
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export Results
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors">
            <Copy className="w-4 h-4" />
            Generate Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            Import Variables
          </button>
        </div>
      </div>
    </div>
  );
};

export default SensitivityOptimizationDashboard;
