/**
 * ============================================================================
 * STEEL MEMBER DESIGNER UI COMPONENT
 * ============================================================================
 * 
 * Comprehensive React component for structural steel member design:
 * - Tension member design
 * - Compression member (column) design
 * - Beam design (flexure, shear, LTB)
 * - Beam-column design (combined loading)
 * - Connection design (bolts, welds)
 * 
 * Features:
 * - Multi-code support (IS 800, AISC, EN 1993, AS 4100)
 * - Section database with search
 * - Interactive design calculations
 * - Detailed output with utilization ratios
 * - Visual section properties display
 * 
 * @version 1.0.0
 */


import React, { useState, useMemo, useCallback } from 'react';
import {
  STEEL_GRADES,
  getSections,
  findSection,
  type SteelSection,
  type SteelGrade,
  type SteelDesignCode,
  type SectionType,
  type SteelGradeType,
} from './SteelDesignConstants';
import {
  SteelMemberDesignEngine,
  designTensionMember,
  designColumn,
  designSteelBeam,
  designBeamColumn,
  designBoltedConnection,
  designFilletWeld,
  type TensionMemberResult,
  type CompressionMemberResult,
  type BeamDesignResult,
  type BeamColumnResult,
} from './SteelMemberDesignEngine';

// =============================================================================
// STYLING CONSTANTS
// =============================================================================

const CARD_CLASS = 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700';
const INPUT_CLASS = 'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
const SELECT_CLASS = 'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer';
const BUTTON_PRIMARY = 'px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const BUTTON_SECONDARY = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all';
const TAB_CLASS = 'px-4 py-2 font-medium rounded-t-lg transition-all';
const TAB_ACTIVE = 'bg-blue-600 text-white';
const TAB_INACTIVE = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// =============================================================================
// COMPONENT TYPES
// =============================================================================

type DesignMode = 'tension' | 'compression' | 'beam' | 'beam-column' | 'connection';

interface DesignState {
  mode: DesignMode;
  code: SteelDesignCode;
  gradeKey: SteelGradeType;
  sectionType: SectionType | '';
  sectionName: string;
  
  // Member parameters
  length: number;         // m
  effectiveLengthX: number;  // m
  effectiveLengthY: number;  // m
  unbracedLength: number; // m (for LTB)
  
  // Loading
  axialForce: number;     // kN
  majorMoment: number;    // kN-m
  minorMoment: number;    // kN-m
  shear: number;          // kN
  
  // Tension-specific
  numBoltHoles: number;
  boltHoleDiameter: number;  // mm
  connectionType: 'welded' | 'bolted';
  
  // Connection
  boltGrade: string;
  boltDiameter: number;
  numBolts: number;
  weldSize: number;
  weldLength: number;
}

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

const InputField: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, onChange, unit, min, max, step = 0.1 }) => (
  <div>
    <label className={LABEL_CLASS}>
      {label} {unit && <span className="text-gray-500">({unit})</span>}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      min={min}
      max={max}
      step={step}
      className={INPUT_CLASS}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className={LABEL_CLASS}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const StatusBadge: React.FC<{ status: 'pass' | 'fail' | 'warning' }> = ({ status }) => {
  const colors = {
    pass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    fail: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✗ FAIL' : '⚠ WARNING'}
    </span>
  );
};

const UtilizationBar: React.FC<{ ratio: number; label: string }> = ({ ratio, label }) => {
  const percentage = Math.min(ratio * 100, 100);
  const color = ratio <= 0.7 ? 'bg-green-500' : ratio <= 0.9 ? 'bg-yellow-500' : ratio <= 1.0 ? 'bg-orange-500' : 'bg-red-500';
  
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className={ratio > 1 ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-400'}>
          {(ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// =============================================================================
// SECTION SELECTOR COMPONENT
// =============================================================================

const SectionSelector: React.FC<{
  code: SteelDesignCode;
  sectionType: SectionType | '';
  sectionName: string;
  onTypeChange: (type: SectionType | '') => void;
  onNameChange: (name: string) => void;
}> = ({ code, sectionType, sectionName, onTypeChange, onNameChange }) => {
  const sectionTypes = useMemo(() => {
    return (
      ['I-section', 'H-section', 'channel', 'angle', 'RHS', 'SHS', 'CHS', 'plate', 'built-up'] as SectionType[]
    ).map((value) => ({ value, label: value }));
  }, []);

  const sections = useMemo(() => {
    const standard = code === 'AISC360' ? 'AISC' : code === 'EN1993' ? 'EN' : 'IS';
    const available = getSections(standard as 'IS' | 'AISC' | 'EN');
    return available.map((s) => ({ value: s.designation, label: s.designation }));
  }, [code]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <SelectField
        label="Section Type"
        value={sectionType}
        onChange={(v) => onTypeChange(v as SectionType | '')}
        options={sectionTypes}
      />
      <SelectField
        label="Section"
        value={sectionName}
        onChange={onNameChange}
        options={sections}
      />
    </div>
  );
};

// =============================================================================
// SECTION PROPERTIES DISPLAY
// =============================================================================

const SectionPropertiesCard: React.FC<{ section: SteelSection | null | undefined }> = ({ section }) => {
  if (!section) {
    return (
      <div className={CARD_CLASS}>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Section Properties
        </h3>
        <p className="text-gray-500 italic">Select a section to view properties</p>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        {section.designation} Properties
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Depth</span>
          <span className="font-medium">{section.h} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Width</span>
          <span className="font-medium">{section.b} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Web Thickness</span>
          <span className="font-medium">{section.tw} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Flange Thickness</span>
          <span className="font-medium">{section.tf} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">Area</span>
          <span className="font-medium">{section.A.toFixed(0)} mm²</span>
        </div>
        <div>
          <span className="text-gray-500 block">Ix</span>
          <span className="font-medium">{(section.Ix / 1e4).toFixed(1)} ×10⁴ mm⁴</span>
        </div>
        <div>
          <span className="text-gray-500 block">Iy</span>
          <span className="font-medium">{(section.Iy / 1e4).toFixed(1)} ×10⁴ mm⁴</span>
        </div>
        <div>
          <span className="text-gray-500 block">Weight</span>
          <span className="font-medium">{section.mass} kg/m</span>
        </div>
        <div>
          <span className="text-gray-500 block">Zx</span>
          <span className="font-medium">{(section.Zx / 1e3).toFixed(1)} ×10³ mm³</span>
        </div>
        <div>
          <span className="text-gray-500 block">rx</span>
          <span className="font-medium">{section.rx.toFixed(1)} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">ry</span>
          <span className="font-medium">{section.ry.toFixed(1)} mm</span>
        </div>
        <div>
          <span className="text-gray-500 block">J (Torsion)</span>
          <span className="font-medium">{(section.J / 1e3).toFixed(1)} ×10³ mm⁴</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// RESULT DISPLAY COMPONENTS
// =============================================================================

const TensionResultCard: React.FC<{ result: TensionMemberResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Tension Member Design Results
      </h3>
      <StatusBadge status={result.status} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Section Areas</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Gross Area (Ag)</span>
            <span className="font-medium">{result.Ag.toFixed(0)} mm²</span>
          </div>
          <div className="flex justify-between">
            <span>Net Area (An)</span>
            <span className="font-medium">{result.An.toFixed(0)} mm²</span>
          </div>
          <div className="flex justify-between">
            <span>Effective Net Area (Ae)</span>
            <span className="font-medium">{result.Ae.toFixed(0)} mm²</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Capacities</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Yield Capacity (φPn_yield)</span>
            <span className="font-medium">{result.Tdg.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Rupture Capacity (φPn_rupture)</span>
            <span className="font-medium">{result.Tdn.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
            <span>Design Capacity (φPn)</span>
            <span>{result.Td.toFixed(1)} kN</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilization</h4>
      <UtilizationBar ratio={result.utilizationRatio} label="Demand/Capacity Ratio" />
    </div>

    {result.governingMode && (
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <span className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Governing Mode:</strong> {result.governingMode}
        </span>
      </div>
    )}
  </div>
);

const CompressionResultCard: React.FC<{ result: CompressionMemberResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Compression Member Design Results
      </h3>
      <StatusBadge status={result.status} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Slenderness</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>λx (Major Axis)</span>
            <span className="font-medium">{result.lambda_x.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>λy (Minor Axis)</span>
            <span className="font-medium">{result.lambda_y.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>Governing λ</span>
            <span className="font-medium text-blue-600">{result.lambda_max.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Critical Stresses</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Euler Stress (Fe)</span>
            <span className="font-medium">{result.Ncr.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Critical Stress (Fcr)</span>
            <span className="font-medium">{result.chi.toFixed(3)} (reduction)</span>
          </div>
          <div className="flex justify-between">
            <span>Buckling Curve</span>
            <span className="font-medium">{result.bucklingCurve || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Capacities</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Plastic (Npl)</span>
            <span className="font-medium">{result.Npl.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
            <span>Design (φPn)</span>
            <span>{result.Nd.toFixed(1)} kN</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilization</h4>
      <UtilizationBar ratio={result.utilizationRatio} label="Axial Load Ratio (Pu/φPn)" />
    </div>

  </div>
);

const BeamResultCard: React.FC<{ result: BeamDesignResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Beam Design Results
      </h3>
      <StatusBadge status={result.status} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Flexural Design</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Plastic Moment (Mp)</span>
            <span className="font-medium">{result.Mp.toFixed(1)} kN-m</span>
          </div>
          <div className="flex justify-between">
            <span>Nominal Moment (Mn)</span>
            <span className="font-medium">{result.Mn.toFixed(1)} kN-m</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
            <span>Design Moment (φMn)</span>
            <span>{result.Md.toFixed(1)} kN-m</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
          <div><strong>Mcr:</strong> {result.Mcr.toFixed(1)} kN-m</div>
          <div><strong>LTB Applicable:</strong> {result.ltbApplicable ? 'Yes' : 'No'} (ψ = {result.ltbReductionFactor.toFixed(2)})</div>
          {result.reducedMomentCapacity && (
            <div><strong>Reduced Mn (interaction):</strong> {result.reducedMomentCapacity.toFixed(1)} kN-m</div>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Shear Design</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Plastic Shear (Vp)</span>
            <span className="font-medium">{result.Vp.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Design Shear (Vd)</span>
            <span className="font-medium">{result.Vd.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
            <span>Applied Vu</span>
            <span>{result.Vu.toFixed(1)} kN</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilization Ratios</h4>
      <UtilizationBar ratio={result.momentUtilization} label="Flexural (Mu/φMn)" />
      <UtilizationBar ratio={result.shearUtilization} label="Shear (Vu/φVd)" />
    </div>
  </div>
);

const BeamColumnResultCard: React.FC<{ result: BeamColumnResult }> = ({ result }) => (
  <div className={CARD_CLASS}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        Beam-Column Design Results
      </h3>
      <StatusBadge status={result.status} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Axial</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Compression Nd</span>
            <span className="font-medium">{result.compressionCapacity.Nd.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between">
            <span>Axial Ratio</span>
            <span className="font-medium">{result.axialRatio.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Major Axis Moment</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Md (x)</span>
            <span className="font-medium">{result.bendingCapacity.Md.toFixed(1)} kN-m</span>
          </div>
          <div className="flex justify-between">
            <span>Major Axis Ratio</span>
            <span className="font-medium">{result.momentRatioX.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Minor Axis Moment</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Md (y)</span>
            <span className="font-medium">{result.bendingCapacity.Md.toFixed(1)} kN-m</span>
          </div>
          <div className="flex justify-between">
            <span>Minor Axis Ratio</span>
            <span className="font-medium">{result.momentRatioY.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Interaction Check</h4>
      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">Interaction Equation ({result.interactionFormula})</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {result.interactionRatio.toFixed(3)} ≤ 1.0
          </div>
        </div>
      </div>
      <UtilizationBar ratio={result.interactionRatio} label="Combined Interaction Ratio" />
    </div>

    {(result as any).amplification && (
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm">
        <strong>P-δ Amplification:</strong> B1x = {(result as any).amplification.B1x.toFixed(3)}, 
        B1y = {(result as any).amplification.B1y.toFixed(3)}
      </div>
    )}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const SteelMemberDesigner: React.FC = () => {
  // State
  const [state, setState] = useState<DesignState>({
    mode: 'tension',
    code: 'IS800',
    gradeKey: 'E250',
    sectionType: 'I-section',
    sectionName: 'ISMB 300',
    length: 6,
    effectiveLengthX: 6,
    effectiveLengthY: 6,
    unbracedLength: 3,
    axialForce: 500,
    majorMoment: 0,
    minorMoment: 0,
    shear: 0,
    numBoltHoles: 2,
    boltHoleDiameter: 24,
    connectionType: 'bolted',
    boltGrade: '8.8',
    boltDiameter: 20,
    numBolts: 4,
    weldSize: 6,
    weldLength: 200,
  });

  const [result, setResult] = useState<
    TensionMemberResult | CompressionMemberResult | BeamDesignResult | BeamColumnResult | null
  >(null);

  // Memoized values
  const selectedSection = useMemo(() => 
    findSection(state.sectionName),
    [state.sectionName]
  );

  const selectedGrade = useMemo(() => 
    STEEL_GRADES[state.gradeKey],
    [state.gradeKey]
  );

  const gradeOptions = useMemo(() => 
    Object.entries(STEEL_GRADES).map(([key, grade]) => ({
      value: key,
      label: `${key} (fy=${grade.fy} MPa)`,
    })),
    []
  );

  // Update state handler
  const updateState = useCallback((updates: Partial<DesignState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Design calculation
  const runDesign = useCallback(() => {
    if (!state.sectionName || !state.gradeKey) {
      alert('Please select a valid section and material grade');
      return;
    }

    let designResult: TensionMemberResult | CompressionMemberResult | BeamDesignResult | BeamColumnResult | null = null;

    switch (state.mode) {
      case 'tension':
        {
          const res = designTensionMember(
            state.sectionName,
            state.length,
            state.axialForce,
            state.gradeKey,
            state.code,
            state.numBoltHoles,
            state.boltHoleDiameter
          );
          designResult = res.tension || null;
        }
        break;

      case 'compression':
        {
          const res = designColumn(
            state.sectionName,
            state.length,
            state.axialForce,
            state.effectiveLengthX,
            state.effectiveLengthY,
            state.gradeKey,
            state.code
          );
          designResult = res.compression || null;
        }
        break;

      case 'beam':
        {
          const res = designSteelBeam(
            state.sectionName,
            state.length,
            state.majorMoment,
            state.shear,
            state.unbracedLength,
            state.gradeKey,
            state.code
          );
          designResult = res.beam || null;
        }
        break;

      case 'beam-column':
        {
          const res = designBeamColumn(
            state.sectionName,
            state.length,
            state.axialForce,
            state.majorMoment,
            state.minorMoment,
            state.effectiveLengthX,
            state.effectiveLengthY,
            state.gradeKey,
            state.code
          );
          designResult = res.beamColumn || null;
        }
        break;

      default:
        return;
    }

    setResult(designResult);
  }, [state]);

  // Handle code change - reset section type
  const handleCodeChange = useCallback((code: SteelDesignCode) => {
    const defaultType: SectionType = 'I-section';
    const defaultSection = code === 'AISC360' ? 'W14X90' : 'ISMB 300';
    updateState({ code, sectionType: defaultType, sectionName: defaultSection });
  }, [updateState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🏗️ Steel Member Design
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Design structural steel members per IS 800, AISC 360, EN 1993, or AS 4100
          </p>
        </div>

        {/* Design Mode Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['tension', 'compression', 'beam', 'beam-column'] as DesignMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => updateState({ mode })}
              className={`${TAB_CLASS} ${state.mode === mode ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              {mode === 'tension' && '↔️ Tension'}
              {mode === 'compression' && '↕️ Compression'}
              {mode === 'beam' && '📏 Beam'}
              {mode === 'beam-column' && '📊 Beam-Column'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Code and Material */}
            <div className={CARD_CLASS}>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Design Parameters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <SelectField
                  label="Design Code"
                  value={state.code}
                  onChange={(v) => handleCodeChange(v as SteelDesignCode)}
                  options={[
                    { value: 'IS800', label: 'IS 800:2007 (India)' },
                    { value: 'AISC360', label: 'AISC 360-22 (USA)' },
                    { value: 'EN1993', label: 'EN 1993-1-1 (Eurocode)' },
                    { value: 'AS4100', label: 'AS 4100:2020 (Australia)' },
                  ]}
                />
                <SelectField
                  label="Steel Grade"
                  value={state.gradeKey}
                  onChange={(v) => updateState({ gradeKey: v as SteelGradeType })}
                  options={gradeOptions}
                />
              </div>
              
              <SectionSelector
                code={state.code}
                sectionType={state.sectionType}
                sectionName={state.sectionName}
                onTypeChange={(v) => updateState({ sectionType: v })}
                onNameChange={(v) => updateState({ sectionName: v })}
              />
            </div>

            {/* Member Parameters */}
            <div className={CARD_CLASS}>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Member Geometry
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label="Member Length"
                  value={state.length}
                  onChange={(v) => updateState({ length: v })}
                  unit="m"
                  min={0.5}
                  max={50}
                />
                {(state.mode === 'compression' || state.mode === 'beam-column') && (
                  <>
                    <InputField
                      label="Effective Length X"
                      value={state.effectiveLengthX}
                      onChange={(v) => updateState({ effectiveLengthX: v })}
                      unit="m"
                      min={0.5}
                    />
                    <InputField
                      label="Effective Length Y"
                      value={state.effectiveLengthY}
                      onChange={(v) => updateState({ effectiveLengthY: v })}
                      unit="m"
                      min={0.5}
                    />
                  </>
                )}
                {(state.mode === 'beam' || state.mode === 'beam-column') && (
                  <InputField
                    label="Unbraced Length (LTB)"
                    value={state.unbracedLength}
                    onChange={(v) => updateState({ unbracedLength: v })}
                    unit="m"
                    min={0.1}
                  />
                )}
              </div>
            </div>

            {/* Loading */}
            <div className={CARD_CLASS}>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Applied Loads (Factored)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(state.mode === 'tension' || state.mode === 'compression' || state.mode === 'beam-column') && (
                  <InputField
                    label="Axial Force (Pu)"
                    value={state.axialForce}
                    onChange={(v) => updateState({ axialForce: v })}
                    unit="kN"
                  />
                )}
                {(state.mode === 'beam' || state.mode === 'beam-column') && (
                  <>
                    <InputField
                      label="Major Moment (Mux)"
                      value={state.majorMoment}
                      onChange={(v) => updateState({ majorMoment: v })}
                      unit="kN-m"
                    />
                    <InputField
                      label="Shear Force (Vu)"
                      value={state.shear}
                      onChange={(v) => updateState({ shear: v })}
                      unit="kN"
                    />
                  </>
                )}
                {state.mode === 'beam-column' && (
                  <InputField
                    label="Minor Moment (Muy)"
                    value={state.minorMoment}
                    onChange={(v) => updateState({ minorMoment: v })}
                    unit="kN-m"
                  />
                )}
              </div>

              {state.mode === 'tension' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Connection Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SelectField
                      label="Connection Type"
                      value={state.connectionType}
                      onChange={(v) => updateState({ connectionType: v as 'welded' | 'bolted' })}
                      options={[
                        { value: 'bolted', label: 'Bolted' },
                        { value: 'welded', label: 'Welded' },
                      ]}
                    />
                    {state.connectionType === 'bolted' && (
                      <>
                        <InputField
                          label="Number of Bolt Holes"
                          value={state.numBoltHoles}
                          onChange={(v) => updateState({ numBoltHoles: v })}
                          step={1}
                          min={1}
                        />
                        <InputField
                          label="Bolt Hole Diameter"
                          value={state.boltHoleDiameter}
                          onChange={(v) => updateState({ boltHoleDiameter: v })}
                          unit="mm"
                          min={12}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Design Button */}
            <button onClick={runDesign} className={BUTTON_PRIMARY + ' w-full'}>
              🔧 Run Design Analysis
            </button>

            {/* Results */}
            {result && (
              <>
                {state.mode === 'tension' && <TensionResultCard result={result as TensionMemberResult} />}
                {state.mode === 'compression' && <CompressionResultCard result={result as CompressionMemberResult} />}
                {state.mode === 'beam' && <BeamResultCard result={result as BeamDesignResult} />}
                {state.mode === 'beam-column' && <BeamColumnResultCard result={result as BeamColumnResult} />}
              </>
            )}
          </div>

          {/* Section Properties Sidebar */}
          <div className="lg:col-span-1">
            <SectionPropertiesCard section={selectedSection} />
            
            {/* Quick Reference */}
            <div className={`${CARD_CLASS} mt-6`}>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Quick Reference
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">Resistance Factors:</strong>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 ml-2">
                    <li>Tension yield: φ = 0.90</li>
                    <li>Tension rupture: φ = 0.75</li>
                    <li>Compression: φ = 0.90</li>
                    <li>Flexure: φ = 0.90</li>
                    <li>Shear: φ = 0.90</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">Slenderness Limits:</strong>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 ml-2">
                    <li>Columns: KL/r ≤ 200</li>
                    <li>Bracing: L/r ≤ 300</li>
                    <li>Tension: L/r ≤ 400</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SteelMemberDesigner;
