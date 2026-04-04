const prettifyToolId = (toolId: string): string =>
  toolId
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const COMMAND_KEYWORDS: Record<string, string[]> = {
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

export const prettifyWithFallback = (toolId: string): string[] => [
  toolId.toLowerCase(),
  ...prettifyToolId(toolId).toLowerCase().split(' '),
];
