export type MemberType = 'beam' | 'column' | 'slab';

export interface DesignSchemaConfig {
  title: string;
  subtitle: string;
  pageTitle: string;
  dataSchema: Record<string, unknown>;
  columns: Array<{ key: string; label: string; type?: string }>;
  validate: (input: Record<string, unknown>) => string | null;
  initialData: Record<string, unknown>;
}

const requiredPositive = (value: unknown, label: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? null : `${label} must be greater than 0`;
};

export const beamSchema: DesignSchemaConfig = {
  title: 'RC Beam',
  subtitle: 'Flexure, shear, torsion, and section-wise checks',
  pageTitle: 'Concrete Beam Design | BeamLab',
  dataSchema: { memberType: 'beam' },
  columns: [
    { key: 'span', label: 'Span (mm)', type: 'number' },
    { key: 'width', label: 'Width b (mm)', type: 'number' },
    { key: 'depth', label: 'Depth D (mm)', type: 'number' },
    { key: 'effectiveDepth', label: 'Effective Depth d (mm)', type: 'number' },
    { key: 'fck', label: 'Concrete Grade fck (MPa)', type: 'number' },
    { key: 'fy', label: 'Steel Grade fy (MPa)', type: 'number' },
  ],
  initialData: {
    span: 6000,
    width: 300,
    depth: 500,
    effectiveDepth: 450,
    cover: 40,
    fck: 25,
    fy: 415,
    deadLoad: 25,
    liveLoad: 10,
    factorDL: 1.5,
    factorLL: 1.5,
    Mu: 150,
    Vu: 80,
    Tu: 0,
    stirrupDia: 8,
    mainBarDia: 16,
    enableSectionWise: false,
    supportCondition: 'simple',
    nSections: 11,
  },
  validate: (input) => {
    const span = requiredPositive(input.span, 'Beam span');
    if (span) return span;
    const width = requiredPositive(input.width, 'Beam width');
    if (width) return width;
    const depth = requiredPositive(input.depth, 'Beam depth');
    if (depth) return depth;
    const d = Number(input.effectiveDepth);
    if (!Number.isFinite(d) || d <= 0 || d >= Number(input.depth)) return 'Effective depth must be > 0 and < depth';
    return null;
  },
};

export const columnSchema: DesignSchemaConfig = {
  title: 'RC Column',
  subtitle: 'Axial load and biaxial interaction checks',
  pageTitle: 'Concrete Column Design | BeamLab',
  dataSchema: { memberType: 'column' },
  columns: [
    { key: 'width', label: 'Width (mm)', type: 'number' },
    { key: 'depth', label: 'Depth (mm)', type: 'number' },
    { key: 'height', label: 'Height (mm)', type: 'number' },
    { key: 'Pu', label: 'Axial Load Pu (kN)', type: 'number' },
  ],
  initialData: {
    width: 300,
    depth: 450,
    height: 3000,
    effectiveLength: 3000,
    cover: 40,
    fck: 25,
    fy: 415,
    Pu: 800,
    Mux: 100,
    Muy: 50,
    enableSectionWise: false,
    MuxTop: 100,
    MuxBottom: 60,
    MuyTop: 50,
    MuyBottom: 30,
  },
  validate: (input) => {
    const width = requiredPositive(input.width, 'Column width');
    if (width) return width;
    const depth = requiredPositive(input.depth, 'Column depth');
    if (depth) return depth;
    const height = requiredPositive(input.height, 'Column height');
    if (height) return height;
    return null;
  },
};

export const slabSchema: DesignSchemaConfig = {
  title: 'RC Slab',
  subtitle: 'One-way and two-way slab design checks',
  pageTitle: 'Concrete Slab Design | BeamLab',
  dataSchema: { memberType: 'slab' },
  columns: [
    { key: 'lx', label: 'Short Span lx (mm)', type: 'number' },
    { key: 'ly', label: 'Long Span ly (mm)', type: 'number' },
    { key: 'thickness', label: 'Thickness (mm)', type: 'number' },
    { key: 'fck', label: 'Concrete Grade fck (MPa)', type: 'number' },
  ],
  initialData: {
    lx: 4000,
    ly: 6000,
    thickness: 150,
    cover: 20,
    fck: 25,
    fy: 415,
    deadLoad: 3.75,
    liveLoad: 2.5,
    supportType: 'simply-supported',
  },
  validate: (input) => {
    const lx = requiredPositive(input.lx, 'Slab lx');
    if (lx) return lx;
    const ly = requiredPositive(input.ly, 'Slab ly');
    if (ly) return ly;
    const t = requiredPositive(input.thickness, 'Slab thickness');
    if (t) return t;
    return null;
  },
};
