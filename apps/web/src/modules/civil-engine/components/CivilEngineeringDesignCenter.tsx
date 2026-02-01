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

import React, { useState, useCallback, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface DesignModule {
  id: string;
  name: string;
  category: 'structural' | 'geotechnical' | 'hydraulics' | 'transportation' | 'surveying';
  icon: string;
  description: string;
  component: React.ComponentType<any>;
}

interface CalculationResult {
  id: string;
  moduleId: string;
  timestamp: Date;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
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
    id: 'frame-analysis',
    name: '2D Frame Analysis',
    category: 'structural',
    icon: '🏗️',
    description: 'Analyze 2D frames using direct stiffness method',
    component: FrameAnalysisPanel,
  },
  {
    id: 'truss-analysis',
    name: 'Truss Analysis',
    category: 'structural',
    icon: '📐',
    description: 'Analyze 2D trusses for member forces',
    component: TrussAnalysisPanel,
  },
  {
    id: 'beam-design',
    name: 'Beam Design',
    category: 'structural',
    icon: '━━━',
    description: 'Design RC and steel beams',
    component: BeamDesignPanel,
  },
  {
    id: 'column-design',
    name: 'Column Design',
    category: 'structural',
    icon: '▮',
    description: 'Design RC and steel columns',
    component: ColumnDesignPanel,
  },
  
  // Geotechnical
  {
    id: 'bearing-capacity',
    name: 'Bearing Capacity',
    category: 'geotechnical',
    icon: '🏔️',
    description: 'Calculate foundation bearing capacity',
    component: BearingCapacityPanel,
  },
  {
    id: 'settlement-analysis',
    name: 'Settlement Analysis',
    category: 'geotechnical',
    icon: '📉',
    description: 'Calculate foundation settlements',
    component: SettlementPanel,
  },
  {
    id: 'slope-stability',
    name: 'Slope Stability',
    category: 'geotechnical',
    icon: '⛰️',
    description: 'Analyze slope factor of safety',
    component: SlopeStabilityPanel,
  },
  {
    id: 'pile-design',
    name: 'Pile Foundation',
    category: 'geotechnical',
    icon: '⬇️',
    description: 'Design pile foundations',
    component: PileDesignPanel,
  },
  
  // Hydraulics
  {
    id: 'channel-flow',
    name: 'Open Channel Flow',
    category: 'hydraulics',
    icon: '🌊',
    description: 'Calculate channel hydraulics',
    component: ChannelFlowPanel,
  },
  {
    id: 'pipe-flow',
    name: 'Pipe Flow',
    category: 'hydraulics',
    icon: '🔵',
    description: 'Analyze pipe flow and head losses',
    component: PipeFlowPanel,
  },
  {
    id: 'hydrology',
    name: 'Hydrology',
    category: 'hydraulics',
    icon: '🌧️',
    description: 'Rainfall-runoff analysis',
    component: HydrologyPanel,
  },
  {
    id: 'hydraulic-structures',
    name: 'Hydraulic Structures',
    category: 'hydraulics',
    icon: '🌉',
    description: 'Design weirs, spillways, culverts',
    component: HydraulicStructuresPanel,
  },
  
  // Transportation
  {
    id: 'geometric-design',
    name: 'Geometric Design',
    category: 'transportation',
    icon: '🛣️',
    description: 'Highway geometric design',
    component: GeometricDesignPanel,
  },
  {
    id: 'pavement-design',
    name: 'Pavement Design',
    category: 'transportation',
    icon: '🚗',
    description: 'Flexible and rigid pavement design',
    component: PavementDesignPanel,
  },
  {
    id: 'traffic-analysis',
    name: 'Traffic Analysis',
    category: 'transportation',
    icon: '🚦',
    description: 'Traffic flow and signal design',
    component: TrafficAnalysisPanel,
  },
  
  // Surveying
  {
    id: 'traverse',
    name: 'Traverse Computation',
    category: 'surveying',
    icon: '📍',
    description: 'Traverse closure and adjustment',
    component: TraversePanel,
  },
  {
    id: 'leveling',
    name: 'Leveling',
    category: 'surveying',
    icon: '⚖️',
    description: 'Differential leveling calculations',
    component: LevelingPanel,
  },
  {
    id: 'curve-setting',
    name: 'Curve Setting Out',
    category: 'surveying',
    icon: '↪️',
    description: 'Horizontal and vertical curves',
    component: CurveSettingPanel,
  },
];

// =============================================================================
// CATEGORY STYLES
// =============================================================================

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  structural: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  geotechnical: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  hydraulics: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  transportation: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  surveying: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CivilEngineeringDesignCenter() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [calculationHistory, setCalculationHistory] = useState<CalculationResult[]>([]);
  const [showVisualization, setShowVisualization] = useState(true);

  const filteredModules = useMemo(() => {
    return DESIGN_MODULES.filter(module => {
      const matchesCategory = activeCategory === 'all' || module.category === activeCategory;
      const matchesSearch = module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          module.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const categories = useMemo(() => {
    return [
      { id: 'all', name: 'All Modules', count: DESIGN_MODULES.length },
      { id: 'structural', name: 'Structural', count: DESIGN_MODULES.filter(m => m.category === 'structural').length },
      { id: 'geotechnical', name: 'Geotechnical', count: DESIGN_MODULES.filter(m => m.category === 'geotechnical').length },
      { id: 'hydraulics', name: 'Hydraulics', count: DESIGN_MODULES.filter(m => m.category === 'hydraulics').length },
      { id: 'transportation', name: 'Transportation', count: DESIGN_MODULES.filter(m => m.category === 'transportation').length },
      { id: 'surveying', name: 'Surveying', count: DESIGN_MODULES.filter(m => m.category === 'surveying').length },
    ];
  }, []);

  const handleCalculationComplete = useCallback((result: Omit<CalculationResult, 'id' | 'timestamp'>) => {
    const newResult: CalculationResult = {
      ...result,
      id: `calc-${Date.now()}`,
      timestamp: new Date(),
    };
    setCalculationHistory(prev => [newResult, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const selectedModuleData = useMemo(() => {
    return DESIGN_MODULES.find(m => m.id === selectedModule);
  }, [selectedModule]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🏗️ Civil Engineering Design Center
              </h1>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
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
                  className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>
              
              {/* Visualization Toggle */}
              <button
                onClick={() => setShowVisualization(!showVisualization)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showVisualization 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                📊 {showVisualization ? 'Hide' : 'Show'} Visualization
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">Categories</h2>
              <div className="space-y-1">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeCategory === category.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      activeCategory === category.id
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}>
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Module List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">
                Modules ({filteredModules.length})
              </h2>
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {filteredModules.map(module => {
                  const styles = CATEGORY_STYLES[module.category];
                  return (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModule(module.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedModule === module.id
                          ? `${styles.bg} ${styles.border} ring-2 ring-offset-1 ring-blue-500`
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{module.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium truncate ${
                            selectedModule === module.id ? styles.text : 'text-gray-900'
                          }`}>
                            {module.name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
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
                <div className={`bg-white rounded-xl shadow-sm border p-6 ${
                  CATEGORY_STYLES[selectedModuleData.category].border
                }`}>
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl">{selectedModuleData.icon}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedModuleData.name}
                      </h2>
                      <p className="text-gray-600">{selectedModuleData.description}</p>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                        CATEGORY_STYLES[selectedModuleData.category].bg
                      } ${CATEGORY_STYLES[selectedModuleData.category].text}`}>
                        {selectedModuleData.category.charAt(0).toUpperCase() + selectedModuleData.category.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Module Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Panel */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">📝</span> Input Parameters
                    </h3>
                    <selectedModuleData.component
                      onCalculationComplete={handleCalculationComplete}
                    />
                  </div>

                  {/* Results & Visualization Panel */}
                  {showVisualization && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <span className="mr-2">📊</span> Results & Visualization
                      </h3>
                      <ResultsVisualizationPanel
                        moduleId={selectedModuleData.id}
                        latestResult={calculationHistory.find(c => c.moduleId === selectedModuleData.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Welcome Screen */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🏗️</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to Civil Engineering Design Center
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto mb-8">
                  A comprehensive platform for structural analysis, geotechnical engineering,
                  hydraulics, transportation engineering, and surveying calculations.
                  Select a module from the sidebar to get started.
                </p>
                
                {/* Quick Access Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
                  {Object.entries(CATEGORY_STYLES).map(([category, styles]) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${styles.bg} ${styles.border}`}
                    >
                      <div className="text-3xl mb-2">
                        {category === 'structural' && '🏗️'}
                        {category === 'geotechnical' && '🏔️'}
                        {category === 'hydraulics' && '🌊'}
                        {category === 'transportation' && '🛣️'}
                        {category === 'surveying' && '📍'}
                      </div>
                      <div className={`font-medium ${styles.text}`}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation History */}
            {calculationHistory.length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📜</span> Recent Calculations
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {calculationHistory.slice(0, 10).map(result => {
                    const module = DESIGN_MODULES.find(m => m.id === result.moduleId);
                    return (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <span>{module?.icon}</span>
                          <div>
                            <span className="font-medium text-gray-900">
                              {module?.name}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <button
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

function FrameAnalysisPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  const [nodes, setNodes] = useState<string>('');
  const [members, setMembers] = useState<string>('');
  const [loads, setLoads] = useState<string>('');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nodes (x, y coordinates)
        </label>
        <textarea
          value={nodes}
          onChange={(e) => setNodes(e.target.value)}
          placeholder="0, 0&#10;0, 3&#10;4, 3"
          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Members (start node, end node)
        </label>
        <textarea
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          placeholder="0, 1&#10;1, 2"
          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={() => onCalculationComplete({ moduleId: 'frame-analysis', inputs: { nodes, members, loads }, outputs: {} })}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
      >
        Analyze Frame
      </button>
    </div>
  );
}

function TrussAnalysisPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Truss Analysis Panel - Configure truss geometry and loads</div>;
}

function BeamDesignPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  const [span, setSpan] = useState(6);
  const [load, setLoad] = useState(20);
  const [concreteGrade, setConcreteGrade] = useState('M25');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Span (m)</label>
        <input
          type="number"
          value={span}
          onChange={(e) => setSpan(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Load (kN/m)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Concrete Grade</label>
        <select
          value={concreteGrade}
          onChange={(e) => setConcreteGrade(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option>M20</option>
          <option>M25</option>
          <option>M30</option>
          <option>M35</option>
          <option>M40</option>
        </select>
      </div>
      <button
        onClick={() => onCalculationComplete({ moduleId: 'beam-design', inputs: { span, load, concreteGrade }, outputs: {} })}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
      >
        Design Beam
      </button>
    </div>
  );
}

function ColumnDesignPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Column Design Panel - Configure column parameters</div>;
}

function BearingCapacityPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  const [foundationWidth, setFoundationWidth] = useState(2);
  const [foundationDepth, setFoundationDepth] = useState(1.5);
  const [cohesion, setCohesion] = useState(25);
  const [frictionAngle, setFrictionAngle] = useState(30);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Width B (m)</label>
          <input
            type="number"
            value={foundationWidth}
            onChange={(e) => setFoundationWidth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Depth Df (m)</label>
          <input
            type="number"
            value={foundationDepth}
            onChange={(e) => setFoundationDepth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cohesion c (kPa)</label>
          <input
            type="number"
            value={cohesion}
            onChange={(e) => setCohesion(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">φ (degrees)</label>
          <input
            type="number"
            value={frictionAngle}
            onChange={(e) => setFrictionAngle(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        onClick={() => onCalculationComplete({ moduleId: 'bearing-capacity', inputs: { foundationWidth, foundationDepth, cohesion, frictionAngle }, outputs: {} })}
        className="w-full py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
      >
        Calculate Bearing Capacity
      </button>
    </div>
  );
}

function SettlementPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Settlement Analysis Panel - Configure soil layers and loads</div>;
}

function SlopeStabilityPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Slope Stability Panel - Configure slope geometry</div>;
}

function PileDesignPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Pile Foundation Panel - Configure pile parameters</div>;
}

function ChannelFlowPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  const [channelType, setChannelType] = useState('rectangular');
  const [bottomWidth, setBottomWidth] = useState(4);
  const [slope, setSlope] = useState(0.001);
  const [manningN, setManningN] = useState(0.015);
  const [discharge, setDischarge] = useState(10);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type</label>
        <select
          value={channelType}
          onChange={(e) => setChannelType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="rectangular">Rectangular</option>
          <option value="trapezoidal">Trapezoidal</option>
          <option value="triangular">Triangular</option>
          <option value="circular">Circular</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bottom Width (m)</label>
          <input
            type="number"
            value={bottomWidth}
            onChange={(e) => setBottomWidth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slope (m/m)</label>
          <input
            type="number"
            step="0.0001"
            value={slope}
            onChange={(e) => setSlope(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        onClick={() => onCalculationComplete({ moduleId: 'channel-flow', inputs: { channelType, bottomWidth, slope, manningN, discharge }, outputs: {} })}
        className="w-full py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700"
      >
        Calculate Flow
      </button>
    </div>
  );
}

function PipeFlowPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Pipe Flow Panel - Configure pipe network</div>;
}

function HydrologyPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Hydrology Panel - Configure catchment parameters</div>;
}

function HydraulicStructuresPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Hydraulic Structures Panel - Design weirs, spillways</div>;
}

function GeometricDesignPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  const [designSpeed, setDesignSpeed] = useState(80);
  const [terrain, setTerrain] = useState('rolling');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Design Speed (km/h)</label>
        <input
          type="number"
          value={designSpeed}
          onChange={(e) => setDesignSpeed(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Terrain</label>
        <select
          value={terrain}
          onChange={(e) => setTerrain(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="level">Level</option>
          <option value="rolling">Rolling</option>
          <option value="mountainous">Mountainous</option>
        </select>
      </div>
      <button
        onClick={() => onCalculationComplete({ moduleId: 'geometric-design', inputs: { designSpeed, terrain }, outputs: {} })}
        className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
      >
        Calculate Parameters
      </button>
    </div>
  );
}

function PavementDesignPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Pavement Design Panel - Configure traffic and subgrade</div>;
}

function TrafficAnalysisPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Traffic Analysis Panel - Configure traffic parameters</div>;
}

function TraversePanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Traverse Panel - Enter traverse observations</div>;
}

function LevelingPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Leveling Panel - Enter staff readings</div>;
}

function CurveSettingPanel({ onCalculationComplete }: { onCalculationComplete: (result: any) => void }) {
  return <div className="text-gray-500">Curve Setting Panel - Configure curve parameters</div>;
}

// =============================================================================
// RESULTS & VISUALIZATION PANEL
// =============================================================================

function ResultsVisualizationPanel({ 
  moduleId, 
  latestResult 
}: { 
  moduleId: string; 
  latestResult?: CalculationResult 
}) {
  if (!latestResult) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>Run a calculation to see results and visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Results</h4>
        <pre className="text-sm text-gray-700 overflow-auto">
          {JSON.stringify(latestResult.outputs, null, 2) || 'Calculation complete'}
        </pre>
      </div>
      
      {/* Visualization Area */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[300px]">
        <h4 className="font-medium text-gray-900 mb-2">Visualization</h4>
        {latestResult.visualization ? (
          <div dangerouslySetInnerHTML={{ __html: latestResult.visualization }} />
        ) : (
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <span className="text-gray-400">Visualization will appear here</span>
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
