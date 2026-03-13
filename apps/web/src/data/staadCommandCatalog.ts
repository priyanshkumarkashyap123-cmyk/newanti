import type { Category } from '../store/uiStore';
import { CATEGORY_TOOLS } from '../store/uiStore';

export type CommandStatus = 'ready' | 'partial' | 'coming-soon';

export interface StaadCommandEntry {
  key: string;
  toolId: string;
  label: string;
  category: Category;
  status: CommandStatus;
  description: string;
  keywords: string[];
  shortcut?: string;
  roadmapPhase?: 1 | 2 | 3;
}

export interface StaadCommandStats {
  total: number;
  ready: number;
  partial: number;
  comingSoon: number;
  readyPct: number;
}

// =====================================================================
// STATUS CLASSIFICATION
// =====================================================================

const READY_TOOLS = new Set<string>([
  'SELECT', 'SELECT_RANGE',
  'DRAW_NODE', 'DRAW_BEAM',
  'ARRAY_LINEAR', 'ARRAY_POLAR',
  'MIRROR', 'SPLIT_MEMBER', 'DIVIDE_MEMBER', 'MERGE_NODES',
  'ASSIGN_SECTION', 'ASSIGN_MATERIAL', 'ASSIGN_SUPPORT',
  'ASSIGN_RELEASE', 'ASSIGN_OFFSET',
  'ADD_POINT_LOAD', 'ADD_UDL', 'ADD_MOMENT', 'ADD_TRAPEZOID',
  'ADD_WIND', 'ADD_SEISMIC', 'LOAD_COMBINATIONS',
  'RUN_ANALYSIS', 'VIEW_DEFORMED', 'VIEW_REACTIONS', 'VIEW_SFD', 'VIEW_BMD', 'VIEW_DIAGRAMS',
  'MODAL_ANALYSIS', 'P_DELTA', 'BUCKLING_ANALYSIS',
  'STEEL_CHECK', 'CONCRETE_DESIGN', 'FOUNDATION_DESIGN', 'GENERATE_REPORT'
]);

const PARTIAL_TOOLS = new Set<string>([
  'DRAW_COLUMN', 'DRAW_PLATE', 'DRAW_CABLE', 'DRAW_ARCH', 'DRAW_RIGID_LINK',
  'COPY', 'MOVE', 'ROTATE', 'SCALE', 'OFFSET_MEMBER', 'EXTRUDE',
  'GRID_GENERATE', 'GRID_3D', 'CIRCULAR_GRID', 'TRUSS_GENERATOR', 'ARCH_GENERATOR',
  'FRAME_GENERATOR', 'CABLE_PATTERN', 'TOWER_GENERATOR', 'DECK_GENERATOR', 'STAIRCASE_GENERATOR',
  'ASSIGN_CABLE_PROPS', 'ASSIGN_SPRING', 'ASSIGN_MASS', 'MEMBER_ORIENTATION', 'ASSIGN_RIGID', 'ASSIGN_HINGE',
  'SECTION_BUILDER', 'IMPORT_SECTION',
  'ADD_SELF_WEIGHT', 'ADD_TEMPERATURE', 'ADD_MOVING_LOAD', 'ADD_HYDROSTATIC', 'ADD_PRETENSION', 'ADD_SETTLEMENT', 'ADD_PRESSURE', 'ADD_CENTRIFUGAL',
  'LOAD_PATTERN', 'ENVELOPE',
  'PUSHOVER', 'TIME_HISTORY', 'RESPONSE_SPECTRUM',
  'CONNECTION_DESIGN', 'TIMBER_DESIGN', 'COMPOSITE_DESIGN', 'SEISMIC_DETAIL', 'CROSS_SECTION_CHECK', 'DEFLECTION_CHECK',
  'GEOTECH_CALC', 'FOUNDATION_ANALYSIS', 'SLOPE_STABILITY', 'TRANS_GEOMETRIC', 'PAVEMENT_DESIGN', 'TRAFFIC_ANALYSIS',
  'HYDRAULICS_CHANNEL', 'HYDRAULICS_PIPE', 'CULVERT_DESIGN', 'ENV_WTP', 'ENV_STP', 'ENV_AQI', 'CONST_SCHEDULE', 'COST_ESTIMATE', 'SURVEY_TRAVERSE', 'SURVEY_VOLUME'
]);

// =====================================================================
// RICH METADATA PER COMMAND
// =====================================================================

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  // MODELING
  SELECT:          'Click or box-select individual nodes/members; clears previous selection',
  SELECT_RANGE:    'Drag a box to select all entities within the 2D screen rectangle',
  PAN:             'Click-and-drag the viewport to pan the model view',
  ZOOM_WINDOW:     'Draw a rectangle to zoom into a specific region of the model',
  DRAW_NODE:       'Click on the grid to place a new joint/node at that position',
  DRAW_BEAM:       'Click two nodes (or grid points) to create a new beam element',
  DRAW_COLUMN:     'Shortcut to draw vertical member; same topology as beam but flagged as column',
  DRAW_CABLE:      'Defines a catenary cable element with nonlinear tension-only behaviour',
  DRAW_ARCH:       'Parametric parabolic/circular arch insertion; sets member attributes automatically',
  DRAW_RIGID_LINK: 'Rigid link (master–slave DOF coupling) between two nodes; infinite stiffness',
  DRAW_PLATE:      'Draw a 4-node Kirchhoff or Mindlin shell/plate element',
  COPY:            'Duplicate selected entities at the same position; ready for move/offset',
  MIRROR:          'Reflect selection across XY, YZ, or XZ plane; preserves member properties',
  DELETE:          'Remove all currently selected nodes, members, and associated loads',
  DIVIDE_MEMBER:   'Split member into N equal or custom-position segments, creating intermediate nodes',
  MERGE_NODES:     'Collapse two coincident nodes (within tolerance) into one, merging connectivity',
  ALIGN_NODES:     'Align selected nodes to min, max, or average coordinate on chosen axis',
  SPLIT_MEMBER:    'Insert a new node at a specified ratio position along a selected member',
  ARRAY_LINEAR:    'Repeat selection N times along X, Y, or Z axis at equal spacing',
  ARRAY_POLAR:     'Rotate-copy selection N times around a user-defined axis and centre point',
  ARRAY_3D:        '3-axis array: repeats selection simultaneously in X, Y, and Z directions',
  MOVE:            'Translate selected nodes/members by Δx, Δy, Δz with copy option',
  ROTATE:          'Rotate selection by angle about a custom axis; creates rotated copies if needed',
  SCALE:           'Scale selected geometry by a factor about a base point',
  OFFSET_MEMBER:   'Create a parallel offset copy of selected members at a specified distance',
  EXTRUDE:         'Translational repeat — extrudesselection along a direction vector for N steps',
  GRID_GENERATE:   '2D uniform rectangular nodal grid with user-specified X/Z bay spacings',
  GRID_3D:         '3-dimensional ortho grid with bay spacings in all three axes',
  CIRCULAR_GRID:   'Polar nodal grid measured from a centre point at equal angular increments',
  TRUSS_GENERATOR: 'Parametric truss generator: Pratt, Howe, Warren, Fink, etc.',
  ARCH_GENERATOR:  'Parametric arch generator with rise, span, and articulation settings',
  PIER_GENERATOR:  'Multi-level pier/column structure generator for bridge substructure',
  TOWER_GENERATOR: 'Lattice/monopole tower generator with taper, leg, and bracing patterns',
  DECK_GENERATOR:  'Bridge deck panel generator with plate elements and edge beams',
  CABLE_PATTERN:   'Cable structure generator: suspension, stayed, net patterns',
  FRAME_GENERATOR: 'Portal and multi-bay frame generator with configurable bay/storey counts',
  STAIRCASE_GENERATOR: 'Staircase structural framing generator with landing and flight options',
  MEASURE_DISTANCE:'Report real-world 3D distance between any two selected nodes',
  MEASURE_ANGLE:   'Report interior angle at a node shared by two members',
  MEASURE_AREA:    'Report enclosed area of a polygonal loop defined by selected members',

  // PROPERTIES
  ASSIGN_SECTION:     'Select from section library or custom profile and assign to selected members',
  ASSIGN_MATERIAL:    'Set Young\'s modulus, density, Poisson ratio for selected elements',
  ASSIGN_RELEASE:     'Release one or more moment/force DOFs at member start or end nodes',
  ASSIGN_OFFSET:      'Assign an eccentricity offset to a member centroidal axis',
  ASSIGN_CABLE_PROPS: 'Set cable pretension, axial stiffness, and catenary parameters',
  ASSIGN_SPRING:      'Connect translational or rotational spring to a node along any axis',
  ASSIGN_MASS:        'Lumped mass assignment to nodes for dynamic/seismic analysis',
  MEMBER_ORIENTATION: 'Set the beta-angle (local-z direction) for non-symmetrical sections',
  ASSIGN_RIGID:       'Mark a member as analytically rigid (very high stiffness multiplier)',
  ASSIGN_HINGE:       'Insert explicit pin/hinge at both ends of selected members',
  ASSIGN_SUPPORT:     'Apply support conditions (fixed, pinned, roller) at selected nodes',
  SECTION_BUILDER:    'Custom section builder from prismatic shapes, with I/A/J computation',
  IMPORT_SECTION:     'Import section properties from CSV, AISC, IS 808, or EURO databases',

  // LOADING
  ADD_POINT_LOAD:   'Apply concentrated force or moment at selected nodes (Fx, Fy, Fz, Mx, My, Mz)',
  ADD_MOMENT:       'Apply concentrated moment load at node — direction and magnitude',
  ADD_UDL:          'Apply uniformly distributed load (kN/m) along beam members',
  ADD_TRAPEZOID:    'Apply linearly varying (trapezoidal) distributed load over member length',
  ADD_WIND:         'IS 875 / ASCE 7 wind pressure auto-generation per building geometry',
  ADD_SEISMIC:      'IS 1893 / ASCE 7 / EN 1998 equivalent static lateral force',
  LOAD_COMBINATIONS:'Define and manage ULS/SLS load combination factors (IS 875 / ACI / ASCE)',
  ADD_PRETENSION:   'Cable or tendon pretension load; coupler elongation or stress input',
  ADD_TEMPERATURE:  'Uniform or gradient temperature change along member length',
  ADD_MOVING_LOAD:  'IRC 6 / AASHTO truck/lane load analysis; influence line generation',
  ADD_HYDROSTATIC:  'Triangular hydrostatic pressure on plate/shell elements',
  ADD_SELF_WEIGHT:  'Auto-compute member self-weight from density and cross-section area',
  ADD_SETTLEMENT:   'Prescribed support settlement (mm) at selected nodes',
  ADD_PRESSURE:     'Uniform or projected surface pressure on faces of plate elements',
  ADD_CENTRIFUGAL:  'Radially-directed centrifugal body force on rotating structure',
  LOAD_PATTERN:     'Checkerboard / patterned live load arrangement for flat slabs',
  ENVELOPE:         'Auto-generate envelope load cases from all defined combinations',

  // ANALYSIS
  RUN_ANALYSIS:       'Execute linear static analysis using direct stiffness method',
  VIEW_DEFORMED:      'Render deformed shape with scale factor slider',
  VIEW_REACTIONS:     'Display support reaction forces and moments at constrained nodes',
  VIEW_SFD:           'Shear force diagram — colour-coded along all members',
  VIEW_BMD:           'Bending moment diagram — colour-coded along all members',
  VIEW_DIAGRAMS:      'Combined result view: SFD, BMD, axial, torsion on one screen',
  MODAL_ANALYSIS:     'Eigenvalue analysis for natural frequencies and mode shapes (Lanczos)',
  BUCKLING_ANALYSIS:  'Linear buckling (bifurcation) analysis; critical load factor output',
  P_DELTA:            'Geometric nonlinear P-Δ and P-δ analysis with load amplification',
  PUSHOVER:           'Nonlinear static pushover (capacity curve) analysis per IS 1893 / FEMA 356',
  TIME_HISTORY:       'Transient dynamic analysis under accelerogram or time–force input',
  RESPONSE_SPECTRUM:  'Modal superposition using IS 1893/ASCE 7 response spectra; CQC/SRSS',

  // DESIGN
  STEEL_CHECK:        'IS 800 / AISC 360 / EC3 member capacity checks: axial, bending, shear, utilization',
  CONCRETE_DESIGN:    'IS 456 / ACI 318 / EC2 RC beam/column/slab design; reinforcement output',
  CONNECTION_DESIGN:  'Bolted and welded connection design per IS 800 including gusseted joints',
  FOUNDATION_DESIGN:  'IS 456 isolated/combined footing design; Meyerhof bearing capacity check',
  GENERATE_REPORT:    'Automated PDF report: model summary, load cases, analysis results, design checks',
  TIMBER_DESIGN:      'NDS 2018 / IS 883 timber beam/column capacity check with wet service factors',
  COMPOSITE_DESIGN:   'AISC 360-I composite beam design with shear stud interaction ratio',
  SEISMIC_DETAIL:     'Seismic detailing checks: lap splice, stirrup spacing, joint shear (IS 13920)',
  CROSS_SECTION_CHECK:'Classify steel section (Compact/Non-compact/Slender) per IS 800 / AISC 360',
  DEFLECTION_CHECK:   'Span/deflection ratio check; long-term creep-modified deflection for RC',

  // CIVIL
  GEOTECH_CALC:       'Bearing capacity calculations: general shear, Terzaghi, Meyerhof, IS 6403',
  FOUNDATION_ANALYSIS:'Mat/raft foundation analysis on elastic Winkler spring foundation model',
  SLOPE_STABILITY:    'Bishop modified method and Fellenius method for slope stability (FS)',
  TRANS_GEOMETRIC:    'Road curve geometry: horizontal alignment, vertical curve, cross-section',
  PAVEMENT_DESIGN:    'IRC 37 flexible pavement design; AASHTO PMS thickness computation',
  TRAFFIC_ANALYSIS:   'IRC 6 peak-hour volume to capacity ratio and Level of Service determination',
  HYDRAULICS_CHANNEL: 'Open-channel flow: Manning\'s equation, normal depth, critical depth',
  HYDRAULICS_PIPE:    'Pressurised pipe flow: Hazen-Williams, Darcy-Weisbach friction loss',
  CULVERT_DESIGN:     'Inlet/outlet control culvert hydraulics; barrel size selection per IS 5551',
  ENV_WTP:            'Water treatment plant capacity sizing and sedimentation basin design',
  ENV_STP:            'Sewage treatment plant BOD loading, retention time, and aeration design',
  ENV_AQI:            'Air quality index from measured pollutant concentrations (CPCB norms)',
  CONST_SCHEDULE:     'CPM/PERT critical-path scheduling with resource levelling',
  COST_ESTIMATE:      'BOQ quantity takeoff and CSI MasterFormat cost estimate',
  SURVEY_TRAVERSE:    'Closed traverse adjustment by Bowditch (compass) rule; area calculation',
  SURVEY_VOLUME:      'Earthwork volume by prismoidal formula from cross-section data',
};

const COMMAND_KEYWORDS: Record<string, string[]> = {
  SELECT:          ['select', 'pick', 'cursor', 'click'],
  DRAW_NODE:       ['node', 'joint', 'point', 'vertex'],
  DRAW_BEAM:       ['beam', 'member', 'element', 'bar', 'frame'],
  DRAW_CABLE:      ['cable', 'catenary', 'tension', 'wire'],
  ARRAY_LINEAR:    ['array', 'linear', 'repeat', 'copy', 'pattern', 'extrude'],
  ARRAY_POLAR:     ['polar', 'circular', 'radial', 'rotate copy'],
  MIRROR:          ['mirror', 'reflect', 'flip', 'symmetry'],
  DIVIDE_MEMBER:   ['divide', 'segment', 'split', 'cut', 'intermediate'],
  SPLIT_MEMBER:    ['split', 'mid', 'insert node', 'cut'],
  MERGE_NODES:     ['merge', 'coincident', 'connect', 'weld'],
  ASSIGN_SECTION:  ['section', 'profile', 'isc', 'hea', 'ipe', 'ubc', 'assign'],
  ASSIGN_MATERIAL: ['material', 'steel', 'concrete', 'aluminium', 'modulus', 'e'],
  ASSIGN_SUPPORT:  ['support', 'fixed', 'pinned', 'roller', 'boundary'],
  ADD_POINT_LOAD:  ['point load', 'nodal', 'force', 'kn', 'concentrated'],
  ADD_UDL:         ['udl', 'distributed', 'w/m', 'uniform'],
  ADD_WIND:        ['wind', 'is875', 'asce7', 'pressure', 'bs6399'],
  ADD_SEISMIC:     ['seismic', 'earthquake', 'is1893', 'zone', 'lateral'],
  RUN_ANALYSIS:    ['run', 'analyse', 'solve', 'stiffness', 'fem', 'fea', 'dof'],
  VIEW_DEFORMED:   ['deformed', 'deflection', 'displacement', 'shape'],
  VIEW_SFD:        ['shear', 'sfd', 'shear force'],
  VIEW_BMD:        ['moment', 'bmd', 'bending'],
  MODAL_ANALYSIS:  ['modal', 'natural frequency', 'mode shape', 'eigenvalue', 'hz'],
  P_DELTA:         ['pdelta', 'p-delta', 'geometric nonlinear', 'second order'],
  STEEL_CHECK:     ['steel', 'is800', 'aisc', 'ec3', 'utilization', 'unity'],
  CONCRETE_DESIGN: ['concrete', 'rc', 'is456', 'aci318', 'ec2', 'rebar', 'reinforcement'],
  GENERATE_REPORT: ['report', 'pdf', 'export', 'output', 'print'],
  TRUSS_GENERATOR: ['truss', 'warren', 'pratt', 'fink', 'howe'],
  FRAME_GENERATOR: ['frame', 'portal', 'bay', 'storey', 'multi'],
  PUSHOVER:        ['pushover', 'capacity', 'nonlinear', 'fema', 'plastic hinge'],
  TIME_HISTORY:    ['time history', 'transient', 'dynamic', 'accelerogram'],
  RESPONSE_SPECTRUM: ['response spectrum', 'cqc', 'srss', 'spectral', 'dynamic'],
};

const COMMAND_ROADMAP_PHASE: Record<string, 1 | 2 | 3> = {
  // Coming-soon tools targeted for Phase 2 (near-term)
  PIER_GENERATOR: 2, DECK_GENERATOR: 2, STAIRCASE_GENERATOR: 2,
  CABLE_PATTERN: 2, TOWER_GENERATOR: 2,
  ADD_CENTRIFUGAL: 2, ADD_PRETENSION: 2, ADD_HYDROSTATIC: 2, ADD_SETTLEMENT: 2,
  PUSHOVER: 2, TIME_HISTORY: 2,
  TIMBER_DESIGN: 2, COMPOSITE_DESIGN: 2,
  GEOTECH_CALC: 2, FOUNDATION_ANALYSIS: 2, SLOPE_STABILITY: 2,
  // Phase 3 (longer-term roadmap)
  CIRCULAR_GRID: 3, ARRAY_3D: 3, MEASURE_AREA: 3,
  TRANS_GEOMETRIC: 3, PAVEMENT_DESIGN: 3, TRAFFIC_ANALYSIS: 3,
  HYDRAULICS_CHANNEL: 3, HYDRAULICS_PIPE: 3, CULVERT_DESIGN: 3,
  ENV_WTP: 3, ENV_STP: 3, ENV_AQI: 3,
  CONST_SCHEDULE: 3, COST_ESTIMATE: 3, SURVEY_TRAVERSE: 3, SURVEY_VOLUME: 3,
  SEISMIC_DETAIL: 3, CROSS_SECTION_CHECK: 3, DEFLECTION_CHECK: 3,
};

const COMMAND_SHORTCUTS: Record<string, string> = {
  SELECT: 'V',
  SELECT_RANGE: 'R',
  DRAW_NODE: 'N',
  DRAW_BEAM: 'B',
  DELETE: '⌫',
  RUN_ANALYSIS: '⌘⏎',
  GENERATE_REPORT: '⌘P',
  MIRROR: 'M',
};

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

const prettifyToolId = (toolId: string): string =>
  toolId
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getToolStatus = (toolId: string): CommandStatus => {
  if (READY_TOOLS.has(toolId)) return 'ready';
  if (PARTIAL_TOOLS.has(toolId)) return 'partial';
  return 'coming-soon';
};

export const getStaadCommandCatalog = (): StaadCommandEntry[] => {
  const entries: StaadCommandEntry[] = [];

  (Object.entries(CATEGORY_TOOLS) as [Category, string[]][]).forEach(([category, tools]) => {
    tools.forEach((toolId) => {
      const status = getToolStatus(toolId);
      entries.push({
        key: `${category}:${toolId}`,
        toolId,
        label: prettifyToolId(toolId),
        category,
        status,
        description: COMMAND_DESCRIPTIONS[toolId] ?? `${prettifyToolId(toolId)} — engineering tool`,
        keywords: COMMAND_KEYWORDS[toolId] ?? [toolId.toLowerCase(), ...prettifyToolId(toolId).toLowerCase().split(' ')],
        shortcut: COMMAND_SHORTCUTS[toolId],
        roadmapPhase: status !== 'ready' ? COMMAND_ROADMAP_PHASE[toolId] : undefined,
      });
    });
  });

  return entries;
};

export const getStaadCommandStats = (catalog: StaadCommandEntry[]): StaadCommandStats => {
  const base = catalog.reduce<Omit<StaadCommandStats, 'readyPct'>>(
    (acc, command) => {
      acc.total += 1;
      if (command.status === 'ready') acc.ready += 1;
      if (command.status === 'partial') acc.partial += 1;
      if (command.status === 'coming-soon') acc.comingSoon += 1;
      return acc;
    },
    { total: 0, ready: 0, partial: 0, comingSoon: 0 }
  );
  return {
    ...base,
    readyPct: base.total > 0 ? Math.round((base.ready / base.total) * 100) : 0,
  };
};

/**
 * Export catalog to a CSV string suitable for download or audit reports.
 * Columns: Category, Tool ID, Label, Status, Execution Tier, Description
 */
export const getStaadCommandCatalogCsv = (catalog: StaadCommandEntry[]): string => {
  const header = 'Category,Tool ID,Label,Status,Execution Tier,Description';
  const rows = catalog.map((e) => {
    const tier = e.status === 'ready' ? 'Direct' : e.status === 'partial' ? 'Advanced' : 'Guided';
    const desc = e.description.replace(/,/g, ';').replace(/\n/g, ' ');
    return `${e.category},${e.toolId},"${e.label}",${e.status},"${tier}","${desc}"`;
  });
  return [header, ...rows].join('\n');
};
