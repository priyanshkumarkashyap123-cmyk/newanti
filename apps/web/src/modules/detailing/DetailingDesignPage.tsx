/**
 * Detailing Design Page
 * Comprehensive RC member design and detailing
 * 
 * Features:
 * - Foundation design (isolated footings)
 * - Column design (RC columns)
 * - Beam design (flexure, shear, torsion)
 * - Slab design (one-way, two-way)
 * - Wall design (shear walls)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Module types
type DetailingModule = 'foundations' | 'columns' | 'beams' | 'slabs' | 'walls';

interface ModuleInfo {
  id: DetailingModule;
  name: string;
  description: string;
  icon: string;
  standards: string[];
  features: string[];
}

const MODULES: ModuleInfo[] = [
  {
    id: 'foundations',
    name: 'Foundation Design',
    description: 'Isolated footing design with soil pressure, shear, and flexure checks',
    icon: '🏗️',
    standards: ['ACI 318-19'],
    features: [
      'Soil bearing capacity check',
      'One-way shear design',
      'Two-way (punching) shear',
      'Flexural reinforcement',
      'Dowel design',
      'Quantity takeoff',
    ],
  },
  {
    id: 'columns',
    name: 'Column Design',
    description: 'RC column design with slenderness, P-M interaction, and confinement',
    icon: '🏛️',
    standards: ['ACI 318-19'],
    features: [
      'Slenderness check',
      'Moment magnification',
      'P-M interaction',
      'Seismic confinement (SMF/IMF/OMF)',
      'Shear design',
      'Lap splice requirements',
    ],
  },
  {
    id: 'beams',
    name: 'Beam Design',
    description: 'RC beam design for flexure, shear, torsion, and deflection',
    icon: '📐',
    standards: ['ACI 318-19'],
    features: [
      'Flexural design (rectangular/T-beam)',
      'Shear design with stirrup regions',
      'Torsion check',
      'Deflection verification',
      'Bar cutoff locations',
      'Seismic detailing',
    ],
  },
  {
    id: 'slabs',
    name: 'Slab Design',
    description: 'One-way and two-way slab design with DDM and punching shear',
    icon: '📋',
    standards: ['ACI 318-19'],
    features: [
      'One-way slab design',
      'Two-way DDM analysis',
      'Flat plate/flat slab',
      'Punching shear check',
      'Deflection control',
      'Temperature/shrinkage steel',
    ],
  },
  {
    id: 'walls',
    name: 'Shear Wall Design',
    description: 'Shear wall design with boundary elements and coupling beams',
    icon: '🧱',
    standards: ['ACI 318-19'],
    features: [
      'In-plane shear design',
      'Flexural design',
      'Boundary element check',
      'Out-of-plane loading',
      'Coupling beam design',
      'Seismic detailing (OSW/SSW)',
    ],
  },
];

export const DetailingDesignPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<DetailingModule>('foundations');
  const navigate = useNavigate();

  const selectedModule = MODULES.find(m => m.id === activeModule)!;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-zinc-900 dark:text-white">
      {/* Header */}
      <header className="bg-gray-100 dark:bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-500 hover:text-zinc-900 dark:text-white transition-colors"
            >
              ← Back
            </button>
            <div className="h-6 w-px bg-gray-600" />
            <h1 className="text-xl font-semibold">
              <span className="text-blue-400">RC Member</span> Design & Detailing
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">ACI 318-19 Compliant</span>
            <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
              Production Ready
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Module Selection */}
        <aside className="w-72 bg-gray-100 dark:bg-gray-800 border-r border-gray-700 min-h-[calc(100vh-64px)]">
          <nav className="p-4 space-y-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Design Modules
            </h2>
            {MODULES.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeModule === module.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <span className="text-2xl">{module.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{module.name}</div>
                  <div className="text-xs text-gray-500">
                    {module.standards.join(', ')}
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Quick Links */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Related Modules</h3>
            <div className="space-y-2 text-sm">
              <a
                href="/design/connections"
                className="block text-gray-500 dark:text-gray-400 hover:text-blue-400 transition-colors"
              >
                → Connection Design
              </a>
              <a
                href="/design/reinforcement"
                className="block text-gray-500 dark:text-gray-400 hover:text-blue-400 transition-colors"
              >
                → Reinforcement Details
              </a>
              <a
                href="/design/steel"
                className="block text-gray-500 dark:text-gray-400 hover:text-blue-400 transition-colors"
              >
                → Steel Design
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Module Header */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center text-3xl">
                  {selectedModule.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedModule.name}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">{selectedModule.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedModule.standards.map((std) => (
                  <span
                    key={std}
                    className="px-3 py-1 bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-full"
                  >
                    {std}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {selectedModule.features.map((feature, index) => (
              <div
                key={index}
                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Design Form Placeholder */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 bg-gray-750 border-b border-gray-700">
              <h3 className="font-semibold">Design Input</h3>
            </div>
            <div className="p-6">
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">{selectedModule.icon}</div>
                <p className="text-lg mb-2">
                  {selectedModule.name} Calculator
                </p>
                <p className="text-sm mb-6">
                  Import the calculator components to use this module
                </p>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-left font-mono text-sm max-w-lg mx-auto">
                  <code className="text-green-400">
                    {`import { ${getImportName(activeModule)} } from '@/modules/detailing/${activeModule}';`}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Code Reference */}
          <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="font-semibold mb-4">API Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Types Export</h4>
                <code className="text-blue-400 text-sm">
                  {`import { ${getTypesExport(activeModule)} } from './detailing/${activeModule}';`}
                </code>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Calculator Export</h4>
                <code className="text-green-400 text-sm">
                  {`import { ${getCalculatorExport(activeModule)} } from './detailing/${activeModule}';`}
                </code>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Helper functions
function getImportName(module: DetailingModule): string {
  const map: Record<DetailingModule, string> = {
    foundations: 'IsolatedFootingCalculator',
    columns: 'RCColumnCalculator',
    beams: 'RCBeamCalculator',
    slabs: 'RCSlabCalculator',
    walls: 'ShearWallCalculator',
  };
  return map[module];
}

function getTypesExport(module: DetailingModule): string {
  const map: Record<DetailingModule, string> = {
    foundations: 'FoundationType, IsolatedFootingInput',
    columns: 'ColumnType, RCColumnInput',
    beams: 'BeamType, RCBeamInput',
    slabs: 'SlabType, RCSlabInput',
    walls: 'WallType, ShearWallInput',
  };
  return map[module];
}

function getCalculatorExport(module: DetailingModule): string {
  const map: Record<DetailingModule, string> = {
    foundations: 'designIsolatedFooting',
    columns: 'designRCColumn',
    beams: 'designRCBeam',
    slabs: 'designRCSlab',
    walls: 'designShearWall',
  };
  return map[module];
}

export default DetailingDesignPage;
