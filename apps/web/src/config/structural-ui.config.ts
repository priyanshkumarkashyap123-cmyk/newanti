/**
 * ============================================================================
 * STRUCTURAL ENGINEERING UI CONFIGURATION
 * ============================================================================
 * 
 * Central configuration for all structural engineering UI components,
 * design modules, and settings.
 * 
 * @version 1.0.0
 */

import {
  Box,
  Columns,
  Building2,
  Mountain,
  Cable,
  Activity,
  Layers,
  Grid3X3,
  Wind,
  Anchor,
  Calculator,
  Ruler,
  Shield,
} from 'lucide-react';

// =============================================================================
// DESIGN CODE CONFIGURATIONS
// =============================================================================

export const DESIGN_CODES = {
  // Concrete Design Codes
  concrete: {
    'IS456': { name: 'IS 456:2000', country: 'India', description: 'Plain and Reinforced Concrete' },
    'ACI318': { name: 'ACI 318-19', country: 'USA', description: 'Building Code Requirements' },
    'EN1992': { name: 'EN 1992-1-1', country: 'Europe', description: 'Eurocode 2' },
    'AS3600': { name: 'AS 3600:2018', country: 'Australia', description: 'Concrete Structures' },
    'BS8110': { name: 'BS 8110', country: 'UK', description: 'Structural Concrete (Legacy)' },
  },
  
  // Steel Design Codes
  steel: {
    'IS800': { name: 'IS 800:2007', country: 'India', description: 'Steel Construction' },
    'AISC360': { name: 'AISC 360-22', country: 'USA', description: 'Specification for Steel Buildings' },
    'EN1993': { name: 'EN 1993-1-1', country: 'Europe', description: 'Eurocode 3' },
    'AS4100': { name: 'AS 4100:2020', country: 'Australia', description: 'Steel Structures' },
  },
  
  // Loading Codes
  loading: {
    'IS875': { name: 'IS 875 (Part 1-5)', country: 'India', description: 'Design Loads' },
    'ASCE7': { name: 'ASCE 7-22', country: 'USA', description: 'Minimum Design Loads' },
    'EN1991': { name: 'EN 1991-1', country: 'Europe', description: 'Eurocode 1 - Actions' },
  },
  
  // Seismic Codes
  seismic: {
    'IS1893': { name: 'IS 1893:2016', country: 'India', description: 'Earthquake Resistant Design' },
    'ASCE7_SEISMIC': { name: 'ASCE 7-22 Ch.11-23', country: 'USA', description: 'Seismic Design' },
    'EN1998': { name: 'EN 1998-1', country: 'Europe', description: 'Eurocode 8' },
  },
  
  // Bridge Codes
  bridge: {
    'AASHTO': { name: 'AASHTO LRFD 9th Ed', country: 'USA', description: 'Bridge Design' },
    'IRC': { name: 'IRC Codes', country: 'India', description: 'Indian Roads Congress' },
    'EN1991_2': { name: 'EN 1991-2', country: 'Europe', description: 'Traffic Loads on Bridges' },
  },
  
  // Foundation Codes
  foundation: {
    'IS6403': { name: 'IS 6403:1981', country: 'India', description: 'Bearing Capacity' },
    'IS2911': { name: 'IS 2911', country: 'India', description: 'Pile Foundations' },
    'EN1997': { name: 'EN 1997-1', country: 'Europe', description: 'Eurocode 7 - Geotechnical' },
  },
} as const;

// =============================================================================
// MATERIAL GRADES
// =============================================================================

export const MATERIAL_GRADES = {
  concrete: {
    indian: ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60'],
    american: ['3000 psi', '4000 psi', '5000 psi', '6000 psi', '8000 psi', '10000 psi'],
    european: ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'],
  },
  
  steel: {
    indian: ['Fe250', 'Fe415', 'Fe500', 'Fe550', 'Fe600'],
    american: ['Grade 40', 'Grade 60', 'Grade 75', 'Grade 80'],
    european: ['B500A', 'B500B', 'B500C'],
  },
  
  structuralSteel: {
    indian: ['E250', 'E300', 'E350', 'E410', 'E450'],
    american: ['A36', 'A572 Gr.50', 'A992', 'A588'],
    european: ['S235', 'S275', 'S355', 'S460'],
  },
} as const;

// =============================================================================
// MODULE CONFIGURATIONS
// =============================================================================

export const MODULE_CONFIG = {
  // RC Beam Design
  'rc-beam': {
    id: 'rc-beam',
    name: 'RC Beam Design',
    description: 'Design reinforced concrete beams for flexure, shear, torsion, and serviceability',
    icon: Box,
    category: 'concrete',
    supportedCodes: ['IS456', 'ACI318', 'EN1992', 'AS3600'],
    defaultCode: 'IS456',
    features: [
      'Flexural design (singly/doubly reinforced)',
      'Shear design with stirrup spacing',
      'Torsion design (combined effects)',
      'Deflection and crack width checks',
      'Development length calculations',
      'Curtailment schedule',
    ],
    route: '/design/concrete',
  },
  
  // RC Column Design
  'rc-column': {
    id: 'rc-column',
    name: 'RC Column Design',
    description: 'Design reinforced concrete columns with P-M interaction and slenderness analysis',
    icon: Columns,
    category: 'concrete',
    supportedCodes: ['IS456', 'ACI318', 'EN1992', 'AS3600'],
    defaultCode: 'IS456',
    features: [
      'Short column design',
      'Slender column with moment magnification',
      'Uniaxial and biaxial bending',
      'P-M interaction diagrams',
      'Tie/spiral design',
    ],
    route: '/design/concrete',
  },
  
  // RC Slab Design
  'rc-slab': {
    id: 'rc-slab',
    name: 'RC Slab Design',
    description: 'Design one-way, two-way, and flat slabs with deflection checks',
    icon: Layers,
    category: 'concrete',
    supportedCodes: ['IS456', 'ACI318', 'EN1992'],
    defaultCode: 'IS456',
    features: [
      'One-way slab design',
      'Two-way slab (coefficient method)',
      'Flat slab (DDM & EFM)',
      'Punching shear design',
      'Deflection checks',
    ],
    route: '/design/concrete',
  },
  
  // Steel Member Design
  'steel-member': {
    id: 'steel-member',
    name: 'Steel Member Design',
    description: 'Design steel members for tension, compression, and bending',
    icon: Columns,
    category: 'steel',
    supportedCodes: ['IS800', 'AISC360', 'EN1993', 'AS4100'],
    defaultCode: 'IS800',
    features: [
      'Tension member design',
      'Compression member (column)',
      'Beam design (flexure, shear, LTB)',
      'Beam-column interaction',
      'Section classification',
    ],
    route: '/design/steel',
  },
  
  // Bridge Design
  'bridge-deck': {
    id: 'bridge-deck',
    name: 'Bridge Deck Design',
    description: 'Design bridge decks, girders, and superstructure elements',
    icon: Building2,
    category: 'bridge',
    supportedCodes: ['AASHTO', 'EN1991_2', 'IRC'],
    defaultCode: 'AASHTO',
    features: [
      'Deck slab design',
      'Composite girder design',
      'Box girder design',
      'Load distribution factors',
      'Vehicle load analysis',
    ],
    route: '/design-center?module=bridge-deck',
    premium: true,
  },
  
  // Foundation Design
  'foundation': {
    id: 'foundation',
    name: 'Foundation Design',
    description: 'Design shallow and deep foundations with settlement analysis',
    icon: Mountain,
    category: 'foundation',
    supportedCodes: ['IS6403', 'IS2911', 'EN1997'],
    defaultCode: 'IS6403',
    features: [
      'Bearing capacity analysis',
      'Settlement calculations',
      'Pile foundation design',
      'Raft foundation design',
    ],
    route: '/design/foundation',
  },
} as const;

// =============================================================================
// UI THEME CONFIGURATION
// =============================================================================

export const UI_THEME = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    
    // Category colors
    concrete: '#3b82f6',    // Blue
    steel: '#f97316',       // Orange
    bridge: '#8b5cf6',      // Purple
    foundation: '#10b981',  // Emerald
    cable: '#ec4899',       // Pink
    analysis: '#6366f1',    // Indigo
    
    // Status colors
    safe: '#10b981',
    warning: '#f59e0b',
    unsafe: '#ef4444',
    info: '#3b82f6',
  },
  
  gradients: {
    concrete: 'from-blue-500 to-cyan-500',
    steel: 'from-orange-500 to-amber-500',
    bridge: 'from-purple-500 to-violet-500',
    foundation: 'from-emerald-500 to-teal-500',
    cable: 'from-pink-500 to-rose-500',
    analysis: 'from-indigo-500 to-purple-500',
  },
  
  fonts: {
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'Fira Code', 'Consolas', monospace",
  },
  
  animation: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
} as const;

// =============================================================================
// DEFAULT SETTINGS
// =============================================================================

export const DEFAULT_SETTINGS = {
  // Unit System
  units: {
    system: 'SI' as const, // 'SI' | 'Imperial'
    length: 'mm',
    force: 'kN',
    moment: 'kN-m',
    stress: 'MPa',
    area: 'mm²',
  },
  
  // Design Preferences
  design: {
    defaultConcreteGrade: 'M30',
    defaultSteelGrade: 'Fe500',
    defaultCover: 40, // mm
    roundingPrecision: 2,
    showDetailedCalculations: true,
    autoSave: true,
    autoSaveInterval: 60000, // 1 minute
  },
  
  // Display
  display: {
    theme: 'dark' as const,
    compactMode: false,
    showTooltips: true,
    animationsEnabled: true,
    language: 'en',
  },
  
  // Export
  export: {
    defaultFormat: 'pdf' as const,
    includeCalculations: true,
    includeDrawings: true,
    companyName: '',
    engineerName: '',
    projectPrefix: 'PROJ',
  },
} as const;

// =============================================================================
// ROUTE CONFIGURATION
// =============================================================================

export const ROUTES = {
  // Main routes
  designCenter: '/design-center',
  dashboard: '/stream',
  workspace: '/app',
  
  // Design modules
  rcBeam: '/design/concrete',
  rcColumn: '/design/concrete',
  rcSlab: '/design/concrete',
  rcFooting: '/design/foundation',
  steelMember: '/design/steel',
  steelConnection: '/design/connections',
  bridgeDeck: '/design-center?module=bridge-deck',
  foundation: '/design/foundation',
  
  // Analysis
  modalAnalysis: '/analysis/modal',
  seismicAnalysis: '/analysis/seismic',
  bucklingAnalysis: '/analysis/buckling',
  
  // Legacy/Structural
  structural: '/structural',
  
  // Auth
  signIn: '/sign-in',
  signUp: '/sign-up',
  
  // Info
  help: '/help',
  docs: '/docs',
  pricing: '/pricing',
} as const;

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

export const KEYBOARD_SHORTCUTS = {
  // Global
  save: 'Ctrl+S',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  newProject: 'Ctrl+N',
  openProject: 'Ctrl+O',
  export: 'Ctrl+E',
  help: 'F1',
  
  // Navigation
  dashboard: 'Ctrl+D',
  workspace: 'Ctrl+W',
  designCenter: 'Ctrl+Shift+D',
  
  // Actions
  calculate: 'F5',
  clearResults: 'Escape',
  toggleSidebar: 'Ctrl+B',
  toggleFullscreen: 'F11',
  
  // Design specific
  addNode: 'N',
  addMember: 'M',
  addLoad: 'L',
  addSupport: 'S',
  deleteSelected: 'Delete',
  selectAll: 'Ctrl+A',
} as const;

// =============================================================================
// EXPORT CONFIGURATION
// =============================================================================

export const EXPORT_CONFIG = {
  formats: ['pdf', 'docx', 'xlsx', 'json', 'dxf'] as const,
  
  pdf: {
    pageSize: 'A4',
    orientation: 'portrait' as const,
    margins: { top: 20, right: 15, bottom: 20, left: 15 },
    fontSize: 10,
    headerHeight: 30,
    footerHeight: 20,
  },
  
  excel: {
    includeFormulas: true,
    includeCharts: false,
    sheetNames: ['Summary', 'Input', 'Results', 'Calculations'],
  },
  
  cad: {
    units: 'mm',
    layers: ['Geometry', 'Reinforcement', 'Dimensions', 'Text'],
    lineWeights: { thin: 0.25, medium: 0.5, thick: 1.0 },
  },
} as const;

// =============================================================================
// VERSION INFO
// =============================================================================

export const VERSION = {
  app: '4.0.0',
  api: '2.0.0',
  build: '2026.01.25',
  codename: 'Engineering Excellence',
  releaseDate: '2026-01-25',
} as const;

export default {
  DESIGN_CODES,
  MATERIAL_GRADES,
  MODULE_CONFIG,
  UI_THEME,
  DEFAULT_SETTINGS,
  ROUTES,
  KEYBOARD_SHORTCUTS,
  EXPORT_CONFIG,
  VERSION,
};
