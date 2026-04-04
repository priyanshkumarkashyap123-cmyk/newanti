/**
 * ============================================================================
 * CIVIL ENGINEERING DESIGN CENTER - UNIFIED UI COMPONENT
 * ============================================================================
 *
 * Main interface for all civil engineering calculations, design, and visualization
 * Integrates all modules into a cohesive user experience
 *
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo } from "react";
import { sanitizeHTML } from "../../../lib/sanitize";

// =============================================================================
// TYPES
// =============================================================================

interface DesignModule {
  id: string;
  name: string;
  category:
    | "structural"
    | "geotechnical"
    | "hydraulics"
    | "transportation"
    | "surveying";
  icon: string;
  description: string;
  component: React.ComponentType<{ onCalculationComplete: (result: Record<string, unknown>) => void }>;
}

interface CalculationResult {
  id: string;
  moduleId: string;
  timestamp: Date;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  visualization?: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  modifiedAt: Date;
  calculations: CalculationResult[];
}

// =============================================================================
// MODULE REGISTRY
// =============================================================================

const DESIGN_MODULES: DesignModule[] = [
  // Structural Analysis
  {
    id: "frame-analysis",
    name: "2D Frame Analysis",
    category: "structural",
    icon: "🏗️",
    description: "Analyze 2D frames using direct stiffness method",
    component: FrameAnalysisPanel,
  },
  {
    id: "truss-analysis",
    name: "Truss Analysis",
    category: "structural",
    icon: "📐",
    description: "Analyze 2D trusses for member forces",
    component: TrussAnalysisPanel,
  },
  {
    id: "beam-design",
    name: "Beam Design",
    category: "structural",
    icon: "━━━",
    description: "Design RC and steel beams",
    component: BeamDesignPanel,
  },
  {
    id: "column-design",
    name: "Column Design",
    category: "structural",
    icon: "▮",
    description: "Design RC and steel columns",
    component: ColumnDesignPanel,
  },

  // Geotechnical
  {
    id: "bearing-capacity",
    name: "Bearing Capacity",
    category: "geotechnical",
    icon: "🏔️",
    description: "Calculate foundation bearing capacity",
    component: BearingCapacityPanel,
  },
  {
    id: "settlement-analysis",
    name: "Settlement Analysis",
    category: "geotechnical",
    icon: "📉",
    description: "Calculate foundation settlements",
    component: SettlementPanel,
  },
  {
    id: "slope-stability",
    name: "Slope Stability",
    category: "geotechnical",
    icon: "⛰️",
    description: "Analyze slope factor of safety",
    component: SlopeStabilityPanel,
  },
  {
    id: "pile-design",
    name: "Pile Foundation",
    category: "geotechnical",
    icon: "⬇️",
    description: "Design pile foundations",
    component: PileDesignPanel,
  },

  // Hydraulics
  {
    id: "channel-flow",
    name: "Open Channel Flow",
    category: "hydraulics",
    icon: "🌊",
    description: "Calculate channel hydraulics",
    component: ChannelFlowPanel,
  },
  {
    id: "pipe-flow",
    name: "Pipe Flow",
    category: "hydraulics",
    icon: "🔵",
    description: "Analyze pipe flow and head losses",
    component: PipeFlowPanel,
  },
  {
    id: "hydrology",
    name: "Hydrology",
    category: "hydraulics",
    icon: "🌧️",
    description: "Rainfall-runoff analysis",
    component: HydrologyPanel,
  },
  {
    id: "hydraulic-structures",
    name: "Hydraulic Structures",
    category: "hydraulics",
    icon: "🌉",
    description: "Design weirs, spillways, culverts",
    component: HydraulicStructuresPanel,
  },

  // Transportation
  {
    id: "geometric-design",
    name: "Geometric Design",
    category: "transportation",
    icon: "🛣️",
    description: "Highway geometric design",
    component: GeometricDesignPanel,
  },
  {
    id: "pavement-design",
    name: "Pavement Design",
    category: "transportation",
    icon: "🚗",
    description: "Flexible and rigid pavement design",
    component: PavementDesignPanel,
  },
  {
    id: "traffic-analysis",
    name: "Traffic Analysis",
    category: "transportation",
    icon: "🚦",
    description: "Traffic flow and signal design",
    component: TrafficAnalysisPanel,
  },

  // Surveying
  {
    id: "traverse",
    name: "Traverse Computation",
    category: "surveying",
    icon: "📍",
    description: "Traverse closure and adjustment",
    component: TraversePanel,
  },
  {
    id: "leveling",
    name: "Leveling",
    category: "surveying",
    icon: "⚖️",
    description: "Differential leveling calculations",
    component: LevelingPanel,
  },
  {
    id: "curve-setting",
    name: "Curve Setting Out",
    category: "surveying",
    icon: "↪️",
    description: "Horizontal and vertical curves",
    component: CurveSettingPanel,
  },
];

// =============================================================================
// CATEGORY STYLES
// =============================================================================

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  structural: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  geotechnical: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  hydraulics: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  transportation: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  surveying: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CivilEngineeringDesignCenter() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [calculationHistory, setCalculationHistory] = useState<
    CalculationResult[]
  >([]);
  const [showVisualization, setShowVisualization] = useState(true);

  const filteredModules = useMemo(() => {
    return DESIGN_MODULES.filter((module) => {
      const matchesCategory =
        activeCategory === "all" || module.category === activeCategory;
      const matchesSearch =
        module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        module.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const categories = useMemo(() => {
    return [
      { id: "all", name: "All Modules", count: DESIGN_MODULES.length },
      {
        id: "structural",
        name: "Structural",
        count: DESIGN_MODULES.filter((m) => m.category === "structural").length,
      },
      {
        id: "geotechnical",
        name: "Geotechnical",
        count: DESIGN_MODULES.filter((m) => m.category === "geotechnical")
          .length,
      },
      {
        id: "hydraulics",
        name: "Hydraulics",
        count: DESIGN_MODULES.filter((m) => m.category === "hydraulics").length,
      },
      {
        id: "transportation",
        name: "Transportation",
        count: DESIGN_MODULES.filter((m) => m.category === "transportation")
          .length,
      },
      {
        id: "surveying",
        name: "Surveying",
        count: DESIGN_MODULES.filter((m) => m.category === "surveying").length,
      },
    ];
  }, []);

  const handleCalculationComplete = useCallback(
    (result: Record<string, unknown>) => {
      const newResult: CalculationResult = {
        ...(result as Omit<CalculationResult, "id" | "timestamp">),
        id: `calc-${Date.now()}`,
        timestamp: new Date(),
      };
      setCalculationHistory((prev) => [newResult, ...prev].slice(0, 50)); // Keep last 50
    },
    [],
  );

  const selectedModuleData = useMemo(() => {
    return DESIGN_MODULES.find((m) => m.id === selectedModule);
  }, [selectedModule]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-slate-900">
                🏗️ Civil Engineering Design Center
              </h1>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium tracking-wide rounded">
                v2.0
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute left-3 top-2.5 text-[#869ab8]">
                  🔍
                </span>
              </div>

              {/* Visualization Toggle */}
              <button type="button"
                onClick={() => setShowVisualization(!showVisualization)}
                className={`px-4 py-2 rounded-lg font-medium tracking-wide transition-colors ${
                  showVisualization
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                📊 {showVisualization ? "Hide" : "Show"} Visualization
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Categories & Module List */}
          <aside className="w-80 flex-shrink-0">
            {/* Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
              <h2 className="font-semibold text-slate-900 mb-3">Categories</h2>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button type="button"
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeCategory === category.id
                        ? "bg-blue-50 text-blue-700 font-medium tracking-wide"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{category.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        activeCategory === category.id
                          ? "bg-blue-100"
                          : "bg-slate-100"
                      }`}
                    >
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Module List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">
                Modules ({filteredModules.length})
              </h2>
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {filteredModules.map((module) => {
                  const styles = CATEGORY_STYLES[module.category];
                  return (
                    <button type="button"
                      key={module.id}
                      onClick={() => setSelectedModule(module.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedModule === module.id
                          ? `${styles.bg} ${styles.border} ring-2 ring-offset-1 ring-blue-500`
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{module.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-medium tracking-wide truncate ${
                              selectedModule === module.id
                                ? styles.text
                                : "text-slate-900"
                            }`}
                          >
                            {module.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate">
                            {module.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1">
            {selectedModuleData ? (
              <div className="space-y-6">
                {/* Module Header */}
                <div
                  className={`bg-white rounded-xl shadow-sm border p-6 ${
                    CATEGORY_STYLES[selectedModuleData.category].border
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl">{selectedModuleData.icon}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        {selectedModuleData.name}
                      </h2>
                      <p className="text-slate-600">
                        {selectedModuleData.description}
                      </p>
                      <span
                        className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium tracking-wide ${
                          CATEGORY_STYLES[selectedModuleData.category].bg
                        } ${CATEGORY_STYLES[selectedModuleData.category].text}`}
                      >
                        {selectedModuleData.category.charAt(0).toUpperCase() +
                          selectedModuleData.category.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Module Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Panel */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                      <span className="mr-2">📝</span> Input Parameters
                    </h3>
                    <selectedModuleData.component
                      onCalculationComplete={handleCalculationComplete}
                    />
                  </div>

                  {/* Results & Visualization Panel */}
                  {showVisualization && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                        <span className="mr-2">📊</span> Results & Visualization
                      </h3>
                      <ResultsVisualizationPanel
                        moduleId={selectedModuleData.id}
                        latestResult={calculationHistory.find(
                          (c) => c.moduleId === selectedModuleData.id,
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Welcome Screen */
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="text-6xl mb-4">🏗️</div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Welcome to Civil Engineering Design Center
                </h2>
                <p className="text-slate-600 max-w-2xl mx-auto mb-8">
                  A comprehensive platform for structural analysis, geotechnical
                  engineering, hydraulics, transportation engineering, and
                  surveying calculations. Select a module from the sidebar to
                  get started.
                </p>

                {/* Quick Access Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
                  {Object.entries(CATEGORY_STYLES).map(([category, styles]) => (
                    <button type="button"
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${styles.bg} ${styles.border}`}
                    >
                      <div className="text-3xl mb-2">
                        {category === "structural" && "🏗️"}
                        {category === "geotechnical" && "🏔️"}
                        {category === "hydraulics" && "🌊"}
                        {category === "transportation" && "🛣️"}
                        {category === "surveying" && "📍"}
                      </div>
                      <div className={`font-medium tracking-wide ${styles.text}`}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation History */}
            {calculationHistory.length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                  <span className="mr-2">📜</span> Recent Calculations
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {calculationHistory.slice(0, 10).map((result) => {
                    const module = DESIGN_MODULES.find(
                      (m) => m.id === result.moduleId,
                    );
                    return (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <span>{module?.icon}</span>
                          <div>
                            <span className="font-medium tracking-wide text-slate-900">
                              {module?.name}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <button type="button"
                          onClick={() => setSelectedModule(result.moduleId)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PANEL COMPONENTS (Placeholder implementations)
// =============================================================================

function FrameAnalysisPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [nodes, setNodes] = useState<string>("");
  const [members, setMembers] = useState<string>("");
  const [loads, setLoads] = useState<string>("");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Nodes (x, y coordinates)
        </label>
        <textarea
          value={nodes}
          onChange={(e) => setNodes(e.target.value)}
          placeholder="0, 0&#10;0, 3&#10;4, 3"
          className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Members (start node, end node)
        </label>
        <textarea
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          placeholder="0, 1&#10;1, 2"
          className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button type="button"
        onClick={() =>
          onCalculationComplete({
            moduleId: "frame-analysis",
            inputs: { nodes, members, loads },
            outputs: {},
          })
        }
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Analyze Frame
      </button>
    </div>
  );
}

function TrussAnalysisPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [numNodes, setNumNodes] = useState(4);
  const [span, setSpan] = useState(12);
  const [height, setHeight] = useState(3);
  const [load, setLoad] = useState(50);
  const [trussType, setTrussType] = useState("pratt");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Truss Type
        </label>
        <select
          value={trussType}
          onChange={(e) => setTrussType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="pratt">Pratt Truss</option>
          <option value="warren">Warren Truss</option>
          <option value="howe">Howe Truss</option>
          <option value="k-truss">K-Truss</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Span (m)
          </label>
          <input
            type="number"
            value={span}
            onChange={(e) => setSpan(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Height (m)
          </label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            No. of Panels
          </label>
          <input
            type="number"
            value={numNodes}
            onChange={(e) => setNumNodes(+e.target.value)}
            min={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Point Load (kN)
          </label>
          <input
            type="number"
            value={load}
            onChange={(e) => setLoad(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          const panelLength = span / numNodes;
          const diagonal = Math.sqrt(
            panelLength * panelLength + height * height,
          );
          const reaction = (load * numNodes) / 2;
          const maxChord = (reaction * span) / (4 * height);
          const maxDiag = reaction / Math.sin(Math.atan(height / panelLength));
          onCalculationComplete({
            moduleId: "truss-analysis",
            inputs: { trussType, span, height, numNodes, load },
            outputs: {
              reaction: reaction.toFixed(2),
              maxTopChord: (-maxChord).toFixed(2),
              maxBottomChord: maxChord.toFixed(2),
              maxDiagonal: maxDiag.toFixed(2),
              panelLength: panelLength.toFixed(2),
              diagonalLength: diagonal.toFixed(2),
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Analyze Truss
      </button>
    </div>
  );
}

function BeamDesignPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [span, setSpan] = useState(6);
  const [load, setLoad] = useState(20);
  const [concreteGrade, setConcreteGrade] = useState("M25");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Span (m)
        </label>
        <input
          type="number"
          value={span}
          onChange={(e) => setSpan(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Load (kN/m)
        </label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Concrete Grade
        </label>
        <select
          value={concreteGrade}
          onChange={(e) => setConcreteGrade(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option>M20</option>
          <option>M25</option>
          <option>M30</option>
          <option>M35</option>
          <option>M40</option>
        </select>
      </div>
      <button type="button"
        onClick={() =>
          onCalculationComplete({
            moduleId: "beam-design",
            inputs: { span, load, concreteGrade },
            outputs: {},
          })
        }
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Design Beam
      </button>
    </div>
  );
}

function ColumnDesignPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [axialLoad, setAxialLoad] = useState(1500);
  const [moment, setMoment] = useState(120);
  const [width, setWidth] = useState(400);
  const [depth, setDepth] = useState(400);
  const [length, setLength] = useState(3000);
  const [fck, setFck] = useState(25);
  const [fy, setFy] = useState(415);
  const [endCondition, setEndCondition] = useState("fixed-free");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Axial Load Pu (kN)
          </label>
          <input
            type="number"
            value={axialLoad}
            onChange={(e) => setAxialLoad(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Moment Mu (kN·m)
          </label>
          <input
            type="number"
            value={moment}
            onChange={(e) => setMoment(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Width b (mm)
          </label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Depth D (mm)
          </label>
          <input
            type="number"
            value={depth}
            onChange={(e) => setDepth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Eff. Length (mm)
          </label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            End Condition
          </label>
          <select
            value={endCondition}
            onChange={(e) => setEndCondition(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="fixed-free">Fixed-Free (k=2.0)</option>
            <option value="fixed-pinned">Fixed-Pinned (k=0.7)</option>
            <option value="fixed-fixed">Fixed-Fixed (k=0.65)</option>
            <option value="pinned-pinned">Pinned-Pinned (k=1.0)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            fck (MPa)
          </label>
          <input
            type="number"
            value={fck}
            onChange={(e) => setFck(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            fy (MPa)
          </label>
          <input
            type="number"
            value={fy}
            onChange={(e) => setFy(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          const kMap: Record<string, number> = {
            "fixed-free": 2.0,
            "fixed-pinned": 0.7,
            "fixed-fixed": 0.65,
            "pinned-pinned": 1.0,
          };
          const k = kMap[endCondition] || 1.0;
          const le = k * length;
          const iMin = Math.min(width, depth) / Math.sqrt(12);
          const slenderness = le / iMin;
          const isShort = slenderness < 12;
          const Ag = width * depth;
          const steelRatio = 0.02;
          const Asc = steelRatio * Ag;
          const puCapacity = 0.4 * fck * (Ag - Asc) + 0.67 * fy * Asc;
          const utilization = ((axialLoad * 1000) / puCapacity) * 100;
          onCalculationComplete({
            moduleId: "column-design",
            inputs: {
              axialLoad,
              moment,
              width,
              depth,
              length,
              fck,
              fy,
              endCondition,
            },
            outputs: {
              effectiveLength: le.toFixed(0),
              slendernessRatio: slenderness.toFixed(1),
              columnType: isShort ? "Short Column" : "Long (Slender) Column",
              axialCapacity: (puCapacity / 1000).toFixed(1),
              steelArea: Asc.toFixed(0),
              utilization: utilization.toFixed(1),
              status: utilization <= 100 ? "SAFE" : "REDESIGN NEEDED",
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Design Column
      </button>
    </div>
  );
}

function BearingCapacityPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [foundationWidth, setFoundationWidth] = useState(2);
  const [foundationDepth, setFoundationDepth] = useState(1.5);
  const [cohesion, setCohesion] = useState(25);
  const [frictionAngle, setFrictionAngle] = useState(30);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Width B (m)
          </label>
          <input
            type="number"
            value={foundationWidth}
            onChange={(e) => setFoundationWidth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Depth Df (m)
          </label>
          <input
            type="number"
            value={foundationDepth}
            onChange={(e) => setFoundationDepth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Cohesion c (kPa)
          </label>
          <input
            type="number"
            value={cohesion}
            onChange={(e) => setCohesion(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            φ (degrees)
          </label>
          <input
            type="number"
            value={frictionAngle}
            onChange={(e) => setFrictionAngle(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() =>
          onCalculationComplete({
            moduleId: "bearing-capacity",
            inputs: {
              foundationWidth,
              foundationDepth,
              cohesion,
              frictionAngle,
            },
            outputs: {},
          })
        }
        className="w-full py-2 bg-amber-600 text-white rounded-lg font-medium tracking-wide hover:bg-amber-700"
      >
        Calculate Bearing Capacity
      </button>
    </div>
  );
}

function SettlementPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [appliedPressure, setAppliedPressure] = useState(150);
  const [foundationWidth, setFoundationWidth] = useState(2);
  const [foundationLength, setFoundationLength] = useState(2);
  const [foundationDepth, setFoundationDepth] = useState(1.5);
  const [soilType, setSoilType] = useState("clay");
  const [compressionIndex, setCompressionIndex] = useState(0.3);
  const [voidRatio, setVoidRatio] = useState(0.85);
  const [layerThickness, setLayerThickness] = useState(4);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Soil Type
        </label>
        <select
          value={soilType}
          onChange={(e) => setSoilType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="clay">Clay (Consolidation)</option>
          <option value="sand">Sand (Elastic)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Applied Pressure (kPa)
          </label>
          <input
            type="number"
            value={appliedPressure}
            onChange={(e) => setAppliedPressure(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Foundation Width (m)
          </label>
          <input
            type="number"
            value={foundationWidth}
            onChange={(e) => setFoundationWidth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Foundation Length (m)
          </label>
          <input
            type="number"
            value={foundationLength}
            onChange={(e) => setFoundationLength(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Foundation Depth (m)
          </label>
          <input
            type="number"
            value={foundationDepth}
            onChange={(e) => setFoundationDepth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {soilType === "clay" && (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Compression Index Cc
              </label>
              <input
                type="number"
                step="0.01"
                value={compressionIndex}
                onChange={(e) => setCompressionIndex(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Initial Void Ratio e₀
              </label>
              <input
                type="number"
                step="0.01"
                value={voidRatio}
                onChange={(e) => setVoidRatio(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Layer Thickness (m)
          </label>
          <input
            type="number"
            value={layerThickness}
            onChange={(e) => setLayerThickness(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          const gamma = 18;
          const overburden = gamma * (foundationDepth + layerThickness / 2);
          let settlement: number;
          if (soilType === "clay") {
            settlement =
              ((compressionIndex * layerThickness * 1000) / (1 + voidRatio)) *
              Math.log10((overburden + appliedPressure) / overburden);
          } else {
            const Es = 25000;
            const mu = 0.3;
            const If = 1.0;
            settlement =
              (appliedPressure * foundationWidth * 1000 * (1 - mu * mu) * If) /
              Es;
          }
          const allowable = 25;
          onCalculationComplete({
            moduleId: "settlement",
            inputs: {
              appliedPressure,
              foundationWidth,
              foundationLength,
              foundationDepth,
              soilType,
              compressionIndex,
              voidRatio,
              layerThickness,
            },
            outputs: {
              totalSettlement: settlement.toFixed(2),
              allowableSettlement: allowable.toFixed(0),
              overburdenPressure: overburden.toFixed(1),
              status:
                settlement <= allowable ? "WITHIN LIMITS" : "EXCEEDS ALLOWABLE",
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Calculate Settlement
      </button>
    </div>
  );
}

function SlopeStabilityPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [slopeHeight, setSlopeHeight] = useState(10);
  const [slopeAngle, setSlopeAngle] = useState(45);
  const [cohesion, setCohesion] = useState(20);
  const [frictionAngle, setFrictionAngle] = useState(25);
  const [unitWeight, setUnitWeight] = useState(18);
  const [waterTable, setWaterTable] = useState(0);
  const [method, setMethod] = useState("culmann");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Analysis Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="culmann">Culmann&apos;s Method</option>
          <option value="taylor">Taylor&apos;s Stability Chart</option>
          <option value="infinite">Infinite Slope</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Slope Height (m)
          </label>
          <input
            type="number"
            value={slopeHeight}
            onChange={(e) => setSlopeHeight(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Slope Angle (°)
          </label>
          <input
            type="number"
            value={slopeAngle}
            onChange={(e) => setSlopeAngle(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Cohesion c (kPa)
          </label>
          <input
            type="number"
            value={cohesion}
            onChange={(e) => setCohesion(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Friction Angle φ (°)
          </label>
          <input
            type="number"
            value={frictionAngle}
            onChange={(e) => setFrictionAngle(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Unit Weight (kN/m³)
          </label>
          <input
            type="number"
            value={unitWeight}
            onChange={(e) => setUnitWeight(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Water Table Depth (m)
          </label>
          <input
            type="number"
            value={waterTable}
            onChange={(e) => setWaterTable(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          const beta = (slopeAngle * Math.PI) / 180;
          const phi = (frictionAngle * Math.PI) / 180;
          let fos: number;
          if (method === "infinite") {
            const ru =
              waterTable > 0 ? Math.min(waterTable / slopeHeight, 1) * 0.5 : 0;
            fos =
              cohesion /
                (unitWeight * slopeHeight * Math.cos(beta) * Math.sin(beta)) +
              (Math.tan(phi) * (1 - ru)) / Math.tan(beta);
          } else if (method === "culmann") {
            const critAngle = (slopeAngle + frictionAngle) / 2;
            const thetaC = (critAngle * Math.PI) / 180;
            const drivingForce =
              0.5 *
              unitWeight *
              slopeHeight *
              slopeHeight *
              (1 / Math.tan(thetaC) - 1 / Math.tan(beta));
            const resistingForce =
              cohesion * (slopeHeight / Math.sin(thetaC)) +
              drivingForce * Math.cos(thetaC - phi) * Math.tan(phi);
            fos =
              resistingForce /
              Math.max(drivingForce * Math.sin(thetaC - phi), 0.001);
          } else {
            const Ns = cohesion / (unitWeight * slopeHeight);
            fos =
              Ns > 0.18
                ? 3.0
                : (4 * cohesion) /
                  (unitWeight * slopeHeight * (1 - Math.cos(beta - phi)));
          }
          onCalculationComplete({
            moduleId: "slope-stability",
            inputs: {
              slopeHeight,
              slopeAngle,
              cohesion,
              frictionAngle,
              unitWeight,
              waterTable,
              method,
            },
            outputs: {
              factorOfSafety: fos.toFixed(3),
              stabilityNumber: (cohesion / (unitWeight * slopeHeight)).toFixed(
                4,
              ),
              criticalHeight: (
                (4 * cohesion * Math.sin(beta) * Math.cos(phi)) /
                (unitWeight * (1 - Math.cos(beta - phi)))
              ).toFixed(2),
              status:
                fos >= 1.5
                  ? "STABLE (FOS ≥ 1.5)"
                  : fos >= 1.0
                    ? "MARGINALLY STABLE"
                    : "UNSTABLE",
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Analyze Stability
      </button>
    </div>
  );
}

function PileDesignPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [pileDiameter, setPileDiameter] = useState(600);
  const [pileLength, setPileLength] = useState(15);
  const [pileType, setPileType] = useState("bored");
  const [soilType, setSoilType] = useState("clay");
  const [cu, setCu] = useState(60);
  const [phi, setPhi] = useState(30);
  const [appliedLoad, setAppliedLoad] = useState(800);
  const [Nc, setNc] = useState(9);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Pile Type
          </label>
          <select
            value={pileType}
            onChange={(e) => setPileType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="bored">Bored Cast-in-situ</option>
            <option value="driven">Driven Precast</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Soil at Tip
          </label>
          <select
            value={soilType}
            onChange={(e) => setSoilType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="clay">Cohesive (Clay)</option>
            <option value="sand">Granular (Sand)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Diameter (mm)
          </label>
          <input
            type="number"
            value={pileDiameter}
            onChange={(e) => setPileDiameter(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Length (m)
          </label>
          <input
            type="number"
            value={pileLength}
            onChange={(e) => setPileLength(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {soilType === "clay" ? (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Undrained Cohesion cu (kPa)
              </label>
              <input
                type="number"
                value={cu}
                onChange={(e) => setCu(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Bearing Capacity Factor Nc
              </label>
              <input
                type="number"
                value={Nc}
                onChange={(e) => setNc(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
              Friction Angle φ (°)
            </label>
            <input
              type="number"
              value={phi}
              onChange={(e) => setPhi(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Applied Load (kN)
          </label>
          <input
            type="number"
            value={appliedLoad}
            onChange={(e) => setAppliedLoad(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          const d = pileDiameter / 1000;
          const Ab = (Math.PI * d * d) / 4;
          const perim = Math.PI * d;
          const alpha = pileType === "bored" ? 0.45 : 0.6;
          let Qb: number, Qs: number;
          if (soilType === "clay") {
            Qb = Nc * cu * Ab;
            Qs = alpha * cu * perim * pileLength;
          } else {
            const phiRad = (phi * Math.PI) / 180;
            const Nq =
              Math.exp(Math.PI * Math.tan(phiRad)) *
              Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
            const gamma = 18;
            const sigmaTip = gamma * pileLength;
            Qb = Nq * sigmaTip * Ab;
            const K = pileType === "bored" ? 0.8 : 1.2;
            const delta = phi * 0.75;
            Qs =
              K *
              ((gamma * pileLength) / 2) *
              Math.tan((delta * Math.PI) / 180) *
              perim *
              pileLength;
          }
          const Qu = Qb + Qs;
          const FOS = 2.5;
          const Qa = Qu / FOS;
          onCalculationComplete({
            moduleId: "pile-design",
            inputs: {
              pileDiameter,
              pileLength,
              pileType,
              soilType,
              cu,
              phi,
              appliedLoad,
            },
            outputs: {
              endBearing: Qb.toFixed(1),
              skinFriction: Qs.toFixed(1),
              ultimateCapacity: Qu.toFixed(1),
              allowableCapacity: Qa.toFixed(1),
              factorOfSafety: FOS.toFixed(1),
              utilization: ((appliedLoad / Qa) * 100).toFixed(1),
              status: appliedLoad <= Qa ? "SAFE" : "OVERLOADED",
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Design Pile
      </button>
    </div>
  );
}

function ChannelFlowPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [channelType, setChannelType] = useState("rectangular");
  const [bottomWidth, setBottomWidth] = useState(4);
  const [slope, setSlope] = useState(0.001);
  const [manningN, setManningN] = useState(0.015);
  const [discharge, setDischarge] = useState(10);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Channel Type
        </label>
        <select
          value={channelType}
          onChange={(e) => setChannelType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="rectangular">Rectangular</option>
          <option value="trapezoidal">Trapezoidal</option>
          <option value="triangular">Triangular</option>
          <option value="circular">Circular</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Bottom Width (m)
          </label>
          <input
            type="number"
            value={bottomWidth}
            onChange={(e) => setBottomWidth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Slope (m/m)
          </label>
          <input
            type="number"
            step="0.0001"
            value={slope}
            onChange={(e) => setSlope(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() =>
          onCalculationComplete({
            moduleId: "channel-flow",
            inputs: { channelType, bottomWidth, slope, manningN, discharge },
            outputs: {},
          })
        }
        className="w-full py-2 bg-cyan-600 text-white rounded-lg font-medium tracking-wide hover:bg-cyan-700"
      >
        Calculate Flow
      </button>
    </div>
  );
}

function PipeFlowPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [diameter, setDiameter] = useState(300);
  const [length, setLength] = useState(500);
  const [slope, setSlope] = useState(0.002);
  const [roughness, setRoughness] = useState(0.013);
  const [flowType, setFlowType] = useState("gravity");
  const [pressure, setPressure] = useState(350);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Flow Type
        </label>
        <select
          value={flowType}
          onChange={(e) => setFlowType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="gravity">Gravity (Open/Part-Full)</option>
          <option value="pressure">Pressure (Full)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Diameter (mm)
          </label>
          <input
            type="number"
            value={diameter}
            onChange={(e) => setDiameter(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Length (m)
          </label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Manning's n
          </label>
          <input
            type="number"
            step="0.001"
            value={roughness}
            onChange={(e) => setRoughness(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {flowType === "gravity" ? (
          <div>
            <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
              Bed Slope
            </label>
            <input
              type="number"
              step="0.0001"
              value={slope}
              onChange={(e) => setSlope(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
              Pressure Head (kPa)
            </label>
            <input
              type="number"
              value={pressure}
              onChange={(e) => setPressure(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
      <button type="button"
        onClick={() => {
          const d = diameter / 1000;
          if (d <= 0) return; // Guard against zero diameter
          const A = (Math.PI * d * d) / 4;
          const P = Math.PI * d;
          const R = A / P;
          let velocity: number, flow: number;
          if (flowType === "gravity") {
            velocity =
              (1 / roughness) * Math.pow(R, 2 / 3) * Math.pow(slope, 0.5);
            flow = velocity * A;
          } else {
            const hf = (pressure * 1000) / 9810;
            const Sf = hf / length;
            velocity = (1 / roughness) * Math.pow(R, 2 / 3) * Math.pow(Sf, 0.5);
            flow = velocity * A;
          }
          const Re = (velocity * d) / 1.004e-6;
          onCalculationComplete({
            moduleId: "pipe-flow",
            inputs: { diameter, length, slope, roughness, flowType, pressure },
            outputs: {
              velocity: velocity.toFixed(3),
              flowRate: (flow * 1000).toFixed(2),
              reynoldsNumber: Re.toFixed(0),
              flowRegime:
                Re > 4000
                  ? "Turbulent"
                  : Re < 2000
                    ? "Laminar"
                    : "Transitional",
              pipeCapacity: (A * 1e6).toFixed(0),
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Calculate Pipe Flow
      </button>
    </div>
  );
}

function HydrologyPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [catchmentArea, setCatchmentArea] = useState(2.5);
  const [runoffCoeff, setRunoffCoeff] = useState(0.6);
  const [rainfall, setRainfall] = useState(80);
  const [timeOfConc, setTimeOfConc] = useState(30);
  const [method, setMethod] = useState("rational");
  const [curveNumber, setCurveNumber] = useState(75);
  const [stormDuration, setStormDuration] = useState(6);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="rational">Rational Method (Q = CiA)</option>
          <option value="scs">SCS Curve Number</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Catchment Area (km²)
          </label>
          <input
            type="number"
            step="0.1"
            value={catchmentArea}
            onChange={(e) => setCatchmentArea(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {method === "rational" ? (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Runoff Coeff. C
              </label>
              <input
                type="number"
                step="0.01"
                value={runoffCoeff}
                onChange={(e) => setRunoffCoeff(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Rainfall Intensity (mm/hr)
              </label>
              <input
                type="number"
                value={rainfall}
                onChange={(e) => setRainfall(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Time of Concentration (min)
              </label>
              <input
                type="number"
                value={timeOfConc}
                onChange={(e) => setTimeOfConc(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Curve Number (CN)
              </label>
              <input
                type="number"
                value={curveNumber}
                onChange={(e) => setCurveNumber(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Total Rainfall (mm)
              </label>
              <input
                type="number"
                value={rainfall}
                onChange={(e) => setRainfall(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Storm Duration (hr)
              </label>
              <input
                type="number"
                value={stormDuration}
                onChange={(e) => setStormDuration(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>
      <button type="button"
        onClick={() => {
          if (method === "rational") {
            const Q = (runoffCoeff * rainfall * catchmentArea) / 3.6;
            const volume = Q * timeOfConc * 60;
            onCalculationComplete({
              moduleId: "hydrology",
              inputs: {
                catchmentArea,
                runoffCoeff,
                rainfall,
                timeOfConc,
                method,
              },
              outputs: {
                peakDischarge: Q.toFixed(2),
                runoffVolume: volume.toFixed(0),
                timeOfConcentration: timeOfConc.toFixed(0),
                method: "Rational Method",
              },
            });
          } else {
            const S = 25400 / curveNumber - 254;
            const Ia = 0.2 * S;
            const P = rainfall;
            const Pe = P > Ia ? Math.pow(P - Ia, 2) / (P - Ia + S) : 0;
            const runoffVolume = Pe * catchmentArea * 1000;
            const Qp = (0.208 * runoffVolume) / (stormDuration * 3600);
            onCalculationComplete({
              moduleId: "hydrology",
              inputs: {
                catchmentArea,
                curveNumber,
                rainfall,
                stormDuration,
                method,
              },
              outputs: {
                potentialRetention: S.toFixed(1),
                initialAbstraction: Ia.toFixed(1),
                excessRainfall: Pe.toFixed(1),
                runoffVolume: runoffVolume.toFixed(0),
                peakDischarge: Qp.toFixed(2),
                method: "SCS CN Method",
              },
            });
          }
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Calculate Runoff
      </button>
    </div>
  );
}

function HydraulicStructuresPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [structureType, setStructureType] = useState("sharp-crested");
  const [crestLength, setCrestLength] = useState(10);
  const [headOverCrest, setHeadOverCrest] = useState(0.5);
  const [crestHeight, setCrestHeight] = useState(2);
  const [dischargeCoeff, setDischargeCoeff] = useState(1.84);
  const [channelWidth, setChannelWidth] = useState(12);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Structure Type
        </label>
        <select
          value={structureType}
          onChange={(e) => setStructureType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="sharp-crested">Sharp-Crested Weir</option>
          <option value="broad-crested">Broad-Crested Weir</option>
          <option value="ogee">Ogee Spillway</option>
          <option value="v-notch">V-Notch Weir (90°)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Crest Length (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={crestLength}
            onChange={(e) => setCrestLength(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Head over Crest H (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={headOverCrest}
            onChange={(e) => setHeadOverCrest(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Crest Height P (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={crestHeight}
            onChange={(e) => setCrestHeight(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Discharge Coeff. Cd
          </label>
          <input
            type="number"
            step="0.01"
            value={dischargeCoeff}
            onChange={(e) => setDischargeCoeff(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Channel Width (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={channelWidth}
            onChange={(e) => setChannelWidth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button type="button"
        onClick={() => {
          let Q: number;
          const H = headOverCrest;
          if (structureType === "v-notch") {
            Q =
              (8 / 15) *
              dischargeCoeff *
              Math.sqrt(2 * 9.81) *
              Math.pow(H, 2.5);
          } else if (structureType === "broad-crested") {
            Q = dischargeCoeff * crestLength * Math.pow(H, 1.5);
          } else {
            Q = dischargeCoeff * crestLength * Math.pow(H, 1.5);
          }
          const velocity = Q / (channelWidth * (crestHeight + H));
          const froudeUp = velocity / Math.sqrt(9.81 * (crestHeight + H));
          onCalculationComplete({
            moduleId: "hydraulic-structures",
            inputs: {
              structureType,
              crestLength,
              headOverCrest,
              crestHeight,
              dischargeCoeff,
              channelWidth,
            },
            outputs: {
              discharge: Q.toFixed(3),
              approachVelocity: velocity.toFixed(3),
              froudeNumber: froudeUp.toFixed(3),
              headToHeightRatio: (H / crestHeight).toFixed(3),
              specificEnergy: (H + (velocity * velocity) / (2 * 9.81)).toFixed(
                3,
              ),
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Calculate Discharge
      </button>
    </div>
  );
}

function GeometricDesignPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [designSpeed, setDesignSpeed] = useState(80);
  const [terrain, setTerrain] = useState("rolling");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Design Speed (km/h)
        </label>
        <input
          type="number"
          value={designSpeed}
          onChange={(e) => setDesignSpeed(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Terrain
        </label>
        <select
          value={terrain}
          onChange={(e) => setTerrain(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="level">Level</option>
          <option value="rolling">Rolling</option>
          <option value="mountainous">Mountainous</option>
        </select>
      </div>
      <button type="button"
        onClick={() =>
          onCalculationComplete({
            moduleId: "geometric-design",
            inputs: { designSpeed, terrain },
            outputs: {},
          })
        }
        className="w-full py-2 bg-green-600 text-white rounded-lg font-medium tracking-wide hover:bg-green-700"
      >
        Calculate Parameters
      </button>
    </div>
  );
}

function PavementDesignPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [pavementType, setPavementType] = useState("flexible");
  const [cbr, setCbr] = useState(5);
  const [trafficMSA, setTrafficMSA] = useState(30);
  const [laneWidth, setLaneWidth] = useState(3.5);
  const [designLife, setDesignLife] = useState(15);
  const [growthRate, setGrowthRate] = useState(7.5);
  const [modulus, setModulus] = useState(28000);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Pavement Type
        </label>
        <select
          value={pavementType}
          onChange={(e) => setPavementType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="flexible">Flexible (IRC:37)</option>
          <option value="rigid">Rigid / Concrete (IRC:58)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            CBR Value (%)
          </label>
          <input
            type="number"
            value={cbr}
            onChange={(e) => setCbr(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Design Traffic (MSA)
          </label>
          <input
            type="number"
            value={trafficMSA}
            onChange={(e) => setTrafficMSA(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Design Life (years)
          </label>
          <input
            type="number"
            value={designLife}
            onChange={(e) => setDesignLife(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Traffic Growth Rate (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={growthRate}
            onChange={(e) => setGrowthRate(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Lane Width (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={laneWidth}
            onChange={(e) => setLaneWidth(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {pavementType === "rigid" && (
          <div>
            <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
              Concrete Modulus (MPa)
            </label>
            <input
              type="number"
              value={modulus}
              onChange={(e) => setModulus(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
      <button type="button"
        onClick={() => {
          if (pavementType === "flexible") {
            const subgradeModulus = 10 * cbr;
            const granularBase = Math.max(150, 250 - cbr * 10);
            const bituminousLayer =
              trafficMSA > 20 ? 100 : trafficMSA > 5 ? 75 : 50;
            const wearingCourse = 40;
            const totalThickness =
              granularBase + bituminousLayer + wearingCourse;
            onCalculationComplete({
              moduleId: "pavement-design",
              inputs: {
                pavementType,
                cbr,
                trafficMSA,
                laneWidth,
                designLife,
                growthRate,
              },
              outputs: {
                subgradeModulus: subgradeModulus.toFixed(0),
                granularBaseThickness: granularBase.toFixed(0),
                bituminousLayerThickness: bituminousLayer.toFixed(0),
                wearingCourseThickness: wearingCourse.toFixed(0),
                totalThickness: totalThickness.toFixed(0),
                designMethod: "IRC:37-2018",
              },
            });
          } else {
            const k = 2.55 * Math.pow(cbr, 0.64) * 1000;
            const flexuralStrength = 0.7 * Math.sqrt(modulus * 0.15);
            const slabThickness = Math.max(
              150,
              Math.round(200 + trafficMSA * 1.5 - cbr * 3),
            );
            onCalculationComplete({
              moduleId: "pavement-design",
              inputs: { pavementType, cbr, trafficMSA, designLife, modulus },
              outputs: {
                modulusOfSubgradeReaction: (k / 1000).toFixed(1),
                flexuralStrength: flexuralStrength.toFixed(1),
                slabThickness: slabThickness.toFixed(0),
                jointSpacing: ((slabThickness * 24) / 1000).toFixed(1),
                designMethod: "IRC:58-2015",
              },
            });
          }
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Design Pavement
      </button>
    </div>
  );
}

function TrafficAnalysisPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [peakHourVolume, setPeakHourVolume] = useState(1800);
  const [numLanes, setNumLanes] = useState(2);
  const [greenTime, setGreenTime] = useState(60);
  const [cycleTime, setCycleTime] = useState(120);
  const [saturationFlow, setSaturationFlow] = useState(1800);
  const [analysisType, setAnalysisType] = useState("los");
  const [freeFlowSpeed, setFreeFlowSpeed] = useState(60);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Analysis Type
        </label>
        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="los">Level of Service (HCM)</option>
          <option value="signal">Signal Timing (Webster)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Peak Volume (veh/hr)
          </label>
          <input
            type="number"
            value={peakHourVolume}
            onChange={(e) => setPeakHourVolume(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Number of Lanes
          </label>
          <input
            type="number"
            value={numLanes}
            onChange={(e) => setNumLanes(+e.target.value)}
            min={1}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {analysisType === "signal" ? (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Green Time (s)
              </label>
              <input
                type="number"
                value={greenTime}
                onChange={(e) => setGreenTime(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Cycle Time (s)
              </label>
              <input
                type="number"
                value={cycleTime}
                onChange={(e) => setCycleTime(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Saturation Flow (veh/hr/lane)
              </label>
              <input
                type="number"
                value={saturationFlow}
                onChange={(e) => setSaturationFlow(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
              Free Flow Speed (km/hr)
            </label>
            <input
              type="number"
              value={freeFlowSpeed}
              onChange={(e) => setFreeFlowSpeed(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
      <button type="button"
        onClick={() => {
          if (analysisType === "los") {
            const capacity = numLanes * 1800;
            const vcRatio = peakHourVolume / capacity;
            const density = peakHourVolume / (freeFlowSpeed * numLanes);
            let los: string;
            if (vcRatio <= 0.35) los = "A";
            else if (vcRatio <= 0.54) los = "B";
            else if (vcRatio <= 0.71) los = "C";
            else if (vcRatio <= 0.87) los = "D";
            else if (vcRatio <= 1.0) los = "E";
            else los = "F";
            onCalculationComplete({
              moduleId: "traffic-analysis",
              inputs: { peakHourVolume, numLanes, freeFlowSpeed, analysisType },
              outputs: {
                capacity: capacity.toFixed(0),
                vcRatio: vcRatio.toFixed(3),
                density: density.toFixed(1),
                levelOfService: "LOS " + los,
                averageSpeed: (freeFlowSpeed * (1 - vcRatio * 0.5)).toFixed(1),
              },
            });
          } else {
            const gr = greenTime / cycleTime;
            const capacity = saturationFlow * numLanes * gr;
            const degSat = peakHourVolume / capacity;
            const d1 =
              (0.5 * cycleTime * Math.pow(1 - gr, 2)) /
              (1 - Math.min(gr * degSat, 0.99));
            const d2 =
              900 *
              (degSat -
                1 +
                Math.sqrt(
                  Math.pow(degSat - 1, 2) + (8 * 0.5 * degSat) / (capacity * 1),
                ));
            const avgDelay = d1 + Math.max(0, d2);
            onCalculationComplete({
              moduleId: "traffic-analysis",
              inputs: {
                peakHourVolume,
                numLanes,
                greenTime,
                cycleTime,
                saturationFlow,
                analysisType,
              },
              outputs: {
                capacity: capacity.toFixed(0),
                greenRatio: gr.toFixed(3),
                degreeOfSaturation: degSat.toFixed(3),
                averageDelay: avgDelay.toFixed(1),
                queueLength: ((peakHourVolume / 3600) * avgDelay).toFixed(0),
              },
            });
          }
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Analyze Traffic
      </button>
    </div>
  );
}

function TraversePanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [numLegs, setNumLegs] = useState(4);
  const [legs, setLegs] = useState([
    { bearing: 45, distance: 100 },
    { bearing: 135, distance: 80 },
    { bearing: 225, distance: 110 },
    { bearing: 315, distance: 90 },
  ]);

  const updateLeg = (i: number, field: "bearing" | "distance", val: number) => {
    const newLegs = [...legs];
    newLegs[i] = { ...newLegs[i], [field]: val };
    setLegs(newLegs);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Number of Traverse Legs
        </label>
        <input
          type="number"
          value={numLegs}
          min={3}
          max={10}
          onChange={(e) => {
            const n = Math.max(3, Math.min(10, +e.target.value));
            setNumLegs(n);
            setLegs((prev) => {
              const arr = [...prev];
              while (arr.length < n) arr.push({ bearing: 0, distance: 50 });
              return arr.slice(0, n);
            });
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {legs.slice(0, numLegs).map((leg, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-sm font-medium tracking-wide text-slate-600">
              Leg {i + 1}:
            </span>
            <input
              type="number"
              placeholder="Bearing (°)"
              value={leg.bearing}
              onChange={(e) => updateLeg(i, "bearing", +e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Distance (m)"
              value={leg.distance}
              onChange={(e) => updateLeg(i, "distance", +e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <button type="button"
        onClick={() => {
          let sumLat = 0,
            sumDep = 0,
            totalDist = 0;
          const computed = legs.slice(0, numLegs).map((leg) => {
            const rad = (leg.bearing * Math.PI) / 180;
            const lat = leg.distance * Math.cos(rad);
            const dep = leg.distance * Math.sin(rad);
            sumLat += lat;
            sumDep += dep;
            totalDist += leg.distance;
            return {
              bearing: leg.bearing,
              distance: leg.distance,
              latitude: lat,
              departure: dep,
            };
          });
          const closingError = Math.sqrt(sumLat * sumLat + sumDep * sumDep);
          const precision = totalDist / Math.max(closingError, 0.001);
          onCalculationComplete({
            moduleId: "traverse",
            inputs: { numLegs, legs: computed },
            outputs: {
              totalLatitude: sumLat.toFixed(4),
              totalDeparture: sumDep.toFixed(4),
              closingError: closingError.toFixed(4),
              precision: "1:" + Math.round(precision),
              totalDistance: totalDist.toFixed(2),
              status: precision >= 5000 ? "ACCEPTABLE" : "NEEDS ADJUSTMENT",
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Compute Traverse
      </button>
    </div>
  );
}

function LevelingPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [benchmarkRL, setBenchmarkRL] = useState(100.0);
  const [numStations, setNumStations] = useState(5);
  const [readings, setReadings] = useState([
    { bs: 1.435, is: 0, fs: 0 },
    { bs: 0, is: 1.82, fs: 0 },
    { bs: 0, is: 2.105, fs: 0 },
    { bs: 2.31, is: 0, fs: 1.645 },
    { bs: 0, is: 0, fs: 1.95 },
  ]);

  const updateReading = (i: number, field: "bs" | "is" | "fs", val: number) => {
    const newR = [...readings];
    newR[i] = { ...newR[i], [field]: val };
    setReadings(newR);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Benchmark RL (m)
          </label>
          <input
            type="number"
            step="0.001"
            value={benchmarkRL}
            onChange={(e) => setBenchmarkRL(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
            Stations
          </label>
          <input
            type="number"
            min={2}
            max={20}
            value={numStations}
            onChange={(e) => {
              const n = Math.max(2, Math.min(20, +e.target.value));
              setNumStations(n);
              setReadings((prev) => {
                const arr = [...prev];
                while (arr.length < n) arr.push({ bs: 0, is: 0, fs: 0 });
                return arr.slice(0, n);
              });
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="text-xs text-slate-500 font-medium tracking-wide">
        Enter BS, IS, FS for each station (0 = not applicable)
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {readings.slice(0, numStations).map((r, i) => (
          <div key={i} className="grid grid-cols-4 gap-1 items-center">
            <span className="text-sm text-slate-600">Stn {i + 1}</span>
            <input
              type="number"
              step="0.001"
              placeholder="BS"
              value={r.bs || ""}
              onChange={(e) => updateReading(i, "bs", +e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm"
            />
            <input
              type="number"
              step="0.001"
              placeholder="IS"
              value={r.is || ""}
              onChange={(e) => updateReading(i, "is", +e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm"
            />
            <input
              type="number"
              step="0.001"
              placeholder="FS"
              value={r.fs || ""}
              onChange={(e) => updateReading(i, "fs", +e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
        ))}
      </div>
      <button type="button"
        onClick={() => {
          const rls: number[] = [];
          let hi = benchmarkRL;
          let sumBS = 0,
            sumFS = 0;
          readings.slice(0, numStations).forEach((r, i) => {
            if (r.bs > 0) {
              hi = (i === 0 ? benchmarkRL : rls[rls.length - 1] || hi) + r.bs;
              sumBS += r.bs;
            }
            if (r.is > 0) rls.push(hi - r.is);
            else if (r.fs > 0) {
              rls.push(hi - r.fs);
              sumFS += r.fs;
            } else rls.push(hi);
          });
          const closingError =
            sumBS - sumFS - (rls[rls.length - 1] - benchmarkRL);
          onCalculationComplete({
            moduleId: "leveling",
            inputs: {
              benchmarkRL,
              numStations,
              readings: readings.slice(0, numStations),
            },
            outputs: {
              reducedLevels: rls.map((r) => r.toFixed(3)).join(", "),
              sumBS: sumBS.toFixed(3),
              sumFS: sumFS.toFixed(3),
              lastRL: rls[rls.length - 1]?.toFixed(3) || "N/A",
              arithmeticCheck: closingError.toFixed(4),
              rise: (rls[rls.length - 1] - benchmarkRL).toFixed(3),
            },
          });
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Compute Levels
      </button>
    </div>
  );
}

function CurveSettingPanel({
  onCalculationComplete,
}: {
  onCalculationComplete: (result: Record<string, unknown>) => void;
}) {
  const [curveType, setCurveType] = useState("simple");
  const [radius, setRadius] = useState(300);
  const [deflectionAngle, setDeflectionAngle] = useState(60);
  const [designSpeed, setDesignSpeed] = useState(80);
  const [chainagePI, setChainagePI] = useState(1500);
  const [verticalLength, setVerticalLength] = useState(200);
  const [grade1, setGrade1] = useState(3);
  const [grade2, setGrade2] = useState(-2);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
          Curve Type
        </label>
        <select
          value={curveType}
          onChange={(e) => setCurveType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="simple">Simple Circular Curve</option>
          <option value="compound">Compound Curve</option>
          <option value="vertical">Vertical (Summit/Valley)</option>
          <option value="transition">Transition / Spiral</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(curveType === "simple" ||
          curveType === "compound" ||
          curveType === "transition") && (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Radius (m)
              </label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Deflection Angle Δ (°)
              </label>
              <input
                type="number"
                value={deflectionAngle}
                onChange={(e) => setDeflectionAngle(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Design Speed (km/hr)
              </label>
              <input
                type="number"
                value={designSpeed}
                onChange={(e) => setDesignSpeed(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Chainage of PI (m)
              </label>
              <input
                type="number"
                value={chainagePI}
                onChange={(e) => setChainagePI(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        {curveType === "vertical" && (
          <>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Grade In g1 (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={grade1}
                onChange={(e) => setGrade1(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Grade Out g2 (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={grade2}
                onChange={(e) => setGrade2(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Curve Length L (m)
              </label>
              <input
                type="number"
                value={verticalLength}
                onChange={(e) => setVerticalLength(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">
                Design Speed (km/hr)
              </label>
              <input
                type="number"
                value={designSpeed}
                onChange={(e) => setDesignSpeed(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>
      <button type="button"
        onClick={() => {
          if (curveType === "vertical") {
            const A = Math.abs(grade1 - grade2);
            const K = verticalLength / A;
            const isSummit = grade1 > grade2;
            const SSD =
              0.278 * designSpeed * 2.5 +
              (designSpeed * designSpeed) / (254 * 0.35);
            const minL = isSummit
              ? (A * SSD * SSD) / 400
              : (A * SSD * SSD) / 120;
            onCalculationComplete({
              moduleId: "curve-setting",
              inputs: {
                curveType,
                grade1,
                grade2,
                verticalLength,
                designSpeed,
              },
              outputs: {
                algebraicDifference: A.toFixed(2),
                kValue: K.toFixed(2),
                curveTypeResult: isSummit ? "Summit Curve" : "Valley Curve",
                sightDistance: SSD.toFixed(1),
                minimumLength: minL.toFixed(1),
                status:
                  verticalLength >= minL ? "ADEQUATE" : "LENGTH INSUFFICIENT",
              },
            });
          } else {
            const deltaRad = (deflectionAngle * Math.PI) / 180;
            const T = radius * Math.tan(deltaRad / 2);
            const L = radius * deltaRad;
            const E = radius * (1 / Math.cos(deltaRad / 2) - 1);
            const M = radius * (1 - Math.cos(deltaRad / 2));
            const LC = 2 * radius * Math.sin(deltaRad / 2);
            const chainagePC = chainagePI - T;
            const chainagePT = chainagePC + L;
            let Ls = 0;
            if (curveType === "transition") {
              Ls =
                (designSpeed * designSpeed * designSpeed) /
                (46.7 * radius * 0.8);
            }
            onCalculationComplete({
              moduleId: "curve-setting",
              inputs: {
                curveType,
                radius,
                deflectionAngle,
                designSpeed,
                chainagePI,
              },
              outputs: {
                tangentLength: T.toFixed(3),
                curveLength: L.toFixed(3),
                externalDistance: E.toFixed(3),
                midOrdinate: M.toFixed(3),
                longChord: LC.toFixed(3),
                chainagePC: chainagePC.toFixed(3),
                chainagePT: chainagePT.toFixed(3),
                ...(curveType === "transition"
                  ? { transitionLength: Ls.toFixed(3) }
                  : {}),
              },
            });
          }
        }}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium tracking-wide hover:bg-blue-700"
      >
        Calculate Curve
      </button>
    </div>
  );
}

// =============================================================================
// RESULTS & VISUALIZATION PANEL
// =============================================================================

function ResultsVisualizationPanel({
  moduleId,
  latestResult,
}: {
  moduleId: string;
  latestResult?: CalculationResult;
}) {
  if (!latestResult) {
    return (
      <div className="h-96 flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">📊</div>
          <p>Run a calculation to see results and visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="font-medium tracking-wide text-slate-900 mb-2">Results</h4>
        <pre className="text-sm text-slate-700 overflow-auto">
          {JSON.stringify(latestResult.outputs, null, 2) ||
            "Calculation complete"}
        </pre>
      </div>

      {/* Visualization Area */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 min-h-[300px]">
        <h4 className="font-medium tracking-wide text-slate-900 mb-2">Visualization</h4>
        {latestResult.visualization ? (
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeHTML(latestResult.visualization),
            }}
          />
        ) : (
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded">
            <span className="text-[#869ab8]">
              Visualization will appear here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORT
// =============================================================================

export default CivilEngineeringDesignCenter;
