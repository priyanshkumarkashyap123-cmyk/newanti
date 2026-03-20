/**
 * Bar Bending Schedule (BBS) Page
 * 
 * Full UI for generating IS 2502-compliant bar bending schedules.
 * Supports beam, column, and slab RC member BBS generation,
 * with live preview, summary statistics, and CSV export.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Select } from '../components/ui/FormInputs';
import {
  Ruler,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  Building2,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Info,
  Columns3,
  BarChart3,
  ArrowLeft,
  Calculator,
  Weight,
  ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  type BarGrade,
  type MemberType,
  type BBSEntry,
  type BBSSchedule,
  STANDARD_BARS,
  generateBeamBBS,
  generateColumnBBS,
  generateSlabBBS,
  compileBBS,
  bbsToCSV,
  getDevelopmentLength,
} from '../engines/BarBendingScheduleEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types for form state
// ─────────────────────────────────────────────────────────────────────────────

interface BeamInput {
  memberRef: string;
  span: number;
  width: number;
  depth: number;
  cover: number;
  noOfMembers: number;
  bottomBarDia: number;
  bottomBarCount: number;
  topBarDia: number;
  topBarCount: number;
  crankBarDia: number;
  crankBarCount: number;
  stirrupDia: number;
  stirrupSpacing: number;
  stirrupSpacingEnd: number;
}

interface ColumnInput {
  memberRef: string;
  height: number;
  width: number;
  depth: number;
  cover: number;
  noOfMembers: number;
  mainBarDia: number;
  mainBarCount: number;
  tieDia: number;
  tieSpacing: number;
}

interface SlabInput {
  memberRef: string;
  spanX: number;
  spanY: number;
  thickness: number;
  cover: number;
  noOfMembers: number;
  mainBarDia: number;
  mainBarSpacing: number;
  distBarDia: number;
  distBarSpacing: number;
  extraTopDia: number;
  extraTopSpacing: number;
}

type MemberInput = 
  | { type: 'beam'; data: BeamInput }
  | { type: 'column'; data: ColumnInput }
  | { type: 'slab'; data: SlabInput };

const DEFAULT_BEAM: BeamInput = {
  memberRef: 'B1',
  span: 5000,
  width: 300,
  depth: 500,
  cover: 40,
  noOfMembers: 1,
  bottomBarDia: 20,
  bottomBarCount: 3,
  topBarDia: 16,
  topBarCount: 2,
  crankBarDia: 16,
  crankBarCount: 2,
  stirrupDia: 8,
  stirrupSpacing: 200,
  stirrupSpacingEnd: 100,
};

const DEFAULT_COLUMN: ColumnInput = {
  memberRef: 'C1',
  height: 3000,
  width: 300,
  depth: 450,
  cover: 40,
  noOfMembers: 1,
  mainBarDia: 20,
  mainBarCount: 6,
  tieDia: 8,
  tieSpacing: 200,
};

const DEFAULT_SLAB: SlabInput = {
  memberRef: 'S1',
  spanX: 4000,
  spanY: 5000,
  thickness: 150,
  cover: 25,
  noOfMembers: 1,
  mainBarDia: 12,
  mainBarSpacing: 150,
  distBarDia: 10,
  distBarSpacing: 200,
  extraTopDia: 10,
  extraTopSpacing: 200,
};

const BAR_DIAMETERS = STANDARD_BARS.map(b => b.dia);

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

const FormField: React.FC<{
  label: string;
  unit?: string;
  value: number | string;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  min?: number;
  step?: number;
}> = ({ label, unit, value, onChange, type = 'number', min = 0, step = 1 }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-[#869ab8] font-medium tracking-wide tracking-wide">
      {label} {unit && <span className="text-slate-500">({unit})</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      step={step}
      className="w-full bg-[#131b2e] border border-slate-600 rounded-lg px-3 py-2 text-sm text-[#dae2fd]
                 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
    />
  </div>
);

const DiameterSelect: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-[#869ab8] font-medium tracking-wide tracking-wide">{label}</label>
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-[#131b2e] border border-slate-600 rounded-lg px-3 py-2 text-sm text-[#dae2fd]
                 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
    >
      {BAR_DIAMETERS.map(d => (
        <option key={d} value={d}>{d} mm</option>
      ))}
    </select>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Member Form Components
// ─────────────────────────────────────────────────────────────────────────────

const BeamForm: React.FC<{
  data: BeamInput;
  onChange: (d: BeamInput) => void;
}> = ({ data, onChange }) => {
  const set = (key: keyof BeamInput, v: string | number) =>
    onChange({ ...data, [key]: typeof v === 'string' && key !== 'memberRef' ? Number(v) : v });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <FormField label="Member Ref" value={data.memberRef} onChange={v => set('memberRef', v)} type="text" />
      <FormField label="Span" unit="mm" value={data.span} onChange={v => set('span', v)} />
      <FormField label="Width" unit="mm" value={data.width} onChange={v => set('width', v)} />
      <FormField label="Depth" unit="mm" value={data.depth} onChange={v => set('depth', v)} />
      <FormField label="Cover" unit="mm" value={data.cover} onChange={v => set('cover', v)} />
      <FormField label="No. of Members" value={data.noOfMembers} onChange={v => set('noOfMembers', v)} min={1} />
      
      <div className="col-span-full mt-2">
        <h4 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3">Reinforcement</h4>
      </div>
      
      <DiameterSelect label="Bottom Bar Dia" value={data.bottomBarDia} onChange={v => set('bottomBarDia', v)} />
      <FormField label="Bottom Bar Count" value={data.bottomBarCount} onChange={v => set('bottomBarCount', v)} min={1} />
      <DiameterSelect label="Top Bar Dia" value={data.topBarDia} onChange={v => set('topBarDia', v)} />
      <FormField label="Top Bar Count" value={data.topBarCount} onChange={v => set('topBarCount', v)} min={1} />
      <DiameterSelect label="Crank Bar Dia" value={data.crankBarDia} onChange={v => set('crankBarDia', v)} />
      <FormField label="Crank Bar Count" value={data.crankBarCount} onChange={v => set('crankBarCount', v)} />
      <DiameterSelect label="Stirrup Dia" value={data.stirrupDia} onChange={v => set('stirrupDia', v)} />
      <FormField label="Stirrup Spacing (mid)" unit="mm" value={data.stirrupSpacing} onChange={v => set('stirrupSpacing', v)} />
      <FormField label="Stirrup Spacing (end)" unit="mm" value={data.stirrupSpacingEnd} onChange={v => set('stirrupSpacingEnd', v)} />
    </div>
  );
};

const ColumnForm: React.FC<{
  data: ColumnInput;
  onChange: (d: ColumnInput) => void;
}> = ({ data, onChange }) => {
  const set = (key: keyof ColumnInput, v: string | number) =>
    onChange({ ...data, [key]: typeof v === 'string' && key !== 'memberRef' ? Number(v) : v });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <FormField label="Member Ref" value={data.memberRef} onChange={v => set('memberRef', v)} type="text" />
      <FormField label="Height" unit="mm" value={data.height} onChange={v => set('height', v)} />
      <FormField label="Width" unit="mm" value={data.width} onChange={v => set('width', v)} />
      <FormField label="Depth" unit="mm" value={data.depth} onChange={v => set('depth', v)} />
      <FormField label="Cover" unit="mm" value={data.cover} onChange={v => set('cover', v)} />
      <FormField label="No. of Members" value={data.noOfMembers} onChange={v => set('noOfMembers', v)} min={1} />
      
      <div className="col-span-full mt-2">
        <h4 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3">Reinforcement</h4>
      </div>
      
      <DiameterSelect label="Main Bar Dia" value={data.mainBarDia} onChange={v => set('mainBarDia', v)} />
      <FormField label="Main Bar Count" value={data.mainBarCount} onChange={v => set('mainBarCount', v)} min={1} />
      <DiameterSelect label="Tie Dia" value={data.tieDia} onChange={v => set('tieDia', v)} />
      <FormField label="Tie Spacing" unit="mm" value={data.tieSpacing} onChange={v => set('tieSpacing', v)} />
    </div>
  );
};

const SlabForm: React.FC<{
  data: SlabInput;
  onChange: (d: SlabInput) => void;
}> = ({ data, onChange }) => {
  const set = (key: keyof SlabInput, v: string | number) =>
    onChange({ ...data, [key]: typeof v === 'string' && key !== 'memberRef' ? Number(v) : v });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <FormField label="Member Ref" value={data.memberRef} onChange={v => set('memberRef', v)} type="text" />
      <FormField label="Span X" unit="mm" value={data.spanX} onChange={v => set('spanX', v)} />
      <FormField label="Span Y" unit="mm" value={data.spanY} onChange={v => set('spanY', v)} />
      <FormField label="Thickness" unit="mm" value={data.thickness} onChange={v => set('thickness', v)} />
      <FormField label="Cover" unit="mm" value={data.cover} onChange={v => set('cover', v)} />
      <FormField label="No. of Members" value={data.noOfMembers} onChange={v => set('noOfMembers', v)} min={1} />
      
      <div className="col-span-full mt-2">
        <h4 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3">Reinforcement</h4>
      </div>
      
      <DiameterSelect label="Main Bar Dia" value={data.mainBarDia} onChange={v => set('mainBarDia', v)} />
      <FormField label="Main Bar Spacing" unit="mm" value={data.mainBarSpacing} onChange={v => set('mainBarSpacing', v)} />
      <DiameterSelect label="Distribution Bar Dia" value={data.distBarDia} onChange={v => set('distBarDia', v)} />
      <FormField label="Dist. Bar Spacing" unit="mm" value={data.distBarSpacing} onChange={v => set('distBarSpacing', v)} />
      <DiameterSelect label="Extra Top Dia" value={data.extraTopDia} onChange={v => set('extraTopDia', v)} />
      <FormField label="Extra Top Spacing" unit="mm" value={data.extraTopSpacing} onChange={v => set('extraTopSpacing', v)} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export const BarBendingSchedulePage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Bar Bending Schedule | BeamLab'; }, []);

  // Project meta
  const [projectName, setProjectName] = useState('Untitled Project');
  const [drawingRef, setDrawingRef] = useState('DRG-001');
  const [preparedBy, setPreparedBy] = useState('');
  const [barGrade, setBarGrade] = useState<BarGrade>('Fe500');
  const [wastageFactor, setWastageFactor] = useState(3);
  const [cover, setCover] = useState(40);

  // Members
  const [members, setMembers] = useState<MemberInput[]>([
    { type: 'beam', data: { ...DEFAULT_BEAM } },
  ]);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);

  // Generated schedule
  const [schedule, setSchedule] = useState<BBSSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'schedule' | 'summary'>('input');

  // Add member
  const addMember = (type: MemberType) => {
    const count = members.filter(m => m.type === type).length + 1;
    const prefix = type === 'beam' ? 'B' : type === 'column' ? 'C' : 'S';
    if (type === 'beam') {
      setMembers([...members, { type: 'beam', data: { ...DEFAULT_BEAM, memberRef: `${prefix}${count}` } }]);
    } else if (type === 'column') {
      setMembers([...members, { type: 'column', data: { ...DEFAULT_COLUMN, memberRef: `${prefix}${count}` } }]);
    } else {
      setMembers([...members, { type: 'slab', data: { ...DEFAULT_SLAB, memberRef: `${prefix}${count}` } }]);
    }
    setExpandedIdx(members.length);
  };

  const removeMember = (idx: number) => {
    setMembers(members.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(-1);
    else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const updateMember = (idx: number, data: any) => {
    const updated = [...members];
    updated[idx] = { ...updated[idx], data };
    setMembers(updated);
  };

  // Generate BBS
  const generateSchedule = useCallback(() => {
    const allEntries: BBSEntry[] = [];

    for (const member of members) {
      if (member.type === 'beam') {
        const d = member.data;
        allEntries.push(...generateBeamBBS({
          ...d,
          grade: barGrade,
        }));
      } else if (member.type === 'column') {
        const d = member.data;
        allEntries.push(...generateColumnBBS({
          ...d,
          grade: barGrade,
        }));
      } else {
        const d = member.data;
        allEntries.push(...generateSlabBBS({
          ...d,
          grade: barGrade,
        }));
      }
    }

    const compiled = compileBBS(allEntries, {
      projectName,
      drawingRef,
      preparedBy,
      barGrade,
      cover,
      wastageFactor,
      code: 'IS 456',
    });

    setSchedule(compiled);
    setActiveTab('schedule');
  }, [members, projectName, drawingRef, preparedBy, barGrade, cover, wastageFactor]);

  // Export CSV
  const exportCSV = useCallback(() => {
    if (!schedule) return;
    const csv = bbsToCSV(schedule);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BBS_${schedule.projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schedule]);

  // Dev length quick calc
  const devLength = useMemo(() => {
    return getDevelopmentLength(20, barGrade, 25);
  }, [barGrade]);

  const memberTypeConfig: Record<string, { icon: typeof Building2; label: string; color: string }> = {
    beam: { icon: Ruler, label: 'Beam', color: 'blue' },
    column: { icon: Building2, label: 'Column', color: 'emerald' },
    slab: { icon: LayoutGrid, label: 'Slab', color: 'amber' },
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header */}
      <div className="border-b border-[#1a2333] bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-4 mb-4">
            <button type="button"
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/app'); }}
              className="p-2 rounded-lg bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  Bar Bending Schedule
                </h1>
                <p className="text-sm text-[#869ab8]">
                  IS 2502 compliant BBS generator &bull; {members.length} member{members.length !== 1 ? 's' : ''} defined
                </p>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-2 mt-4">
            {(['input', 'schedule', 'summary'] as const).map(tab => (
              <button type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium tracking-wide tracking-wide transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#131b2e] text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab === 'input' ? 'Member Input' : tab === 'schedule' ? 'BBS Table' : 'Summary'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ═══════════ INPUT TAB ═══════════ */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-[#0b1326] rounded-xl p-6 border border-[#1a2333]">
              <h3 className="text-lg font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                Project Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Project Name" value={projectName} onChange={setProjectName} type="text" />
                <FormField label="Drawing Ref" value={drawingRef} onChange={setDrawingRef} type="text" />
                <FormField label="Prepared By" value={preparedBy} onChange={setPreparedBy} type="text" />
                <Select
                  label="Bar Grade"
                  value={barGrade}
                  onChange={(v) => setBarGrade(v as BarGrade)}
                  options={[
                    { value: 'Fe250', label: 'Fe 250 (Mild Steel)' },
                    { value: 'Fe415', label: 'Fe 415' },
                    { value: 'Fe500', label: 'Fe 500' },
                    { value: 'Fe550', label: 'Fe 550' },
                  ]}
                />
                <FormField label="Clear Cover" unit="mm" value={cover} onChange={v => setCover(Number(v))} />
                <FormField label="Wastage Factor" unit="%" value={wastageFactor} onChange={v => setWastageFactor(Number(v))} step={0.5} />
              </div>

              {/* Quick stats */}
              <div className="mt-4 pt-4 border-t border-[#1a2333] flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5" />
                  <span>Dev. length (20mm bar, M25): <strong className="text-[#adc6ff]">{devLength} mm</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Code: <strong className="text-[#adc6ff]">IS 456:2000 + IS 2502</strong></span>
                </div>
              </div>
            </div>

            {/* Add Member Buttons */}
            <div className="flex flex-wrap gap-3">
              <button type="button"
                onClick={() => addMember('beam')}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-600/30 transition-colors text-sm font-medium tracking-wide tracking-wide"
              >
                <Plus className="w-4 h-4" />
                <Ruler className="w-4 h-4" />
                Add Beam
              </button>
              <button type="button"
                onClick={() => addMember('column')}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30 transition-colors text-sm font-medium tracking-wide tracking-wide"
              >
                <Plus className="w-4 h-4" />
                <Building2 className="w-4 h-4" />
                Add Column
              </button>
              <button type="button"
                onClick={() => addMember('slab')}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/20 border border-amber-500/30 rounded-lg text-amber-400 hover:bg-amber-600/30 transition-colors text-sm font-medium tracking-wide tracking-wide"
              >
                <Plus className="w-4 h-4" />
                <LayoutGrid className="w-4 h-4" />
                Add Slab
              </button>
            </div>

            {/* Member Cards */}
            <div className="space-y-4">
              {members.map((member, idx) => {
                const cfg = memberTypeConfig[member.type];
                const Icon = cfg.icon;
                const isExpanded = expandedIdx === idx;

                return (
                  <div
                    key={idx}
                    className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden"
                  >
                    {/* Member header */}
                    <button type="button"
                      onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#131b2e] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                          ${member.type === 'beam' ? 'bg-blue-600/20 text-blue-400' :
                            member.type === 'column' ? 'bg-emerald-600/20 text-emerald-400' :
                            'bg-amber-600/20 text-amber-400'}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">
                            {member.data.memberRef}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            {cfg.label}
                            {' · '}
                            {member.type === 'beam' && `${(member.data as BeamInput).span}mm span`}
                            {member.type === 'column' && `${(member.data as ColumnInput).height}mm height`}
                            {member.type === 'slab' && `${(member.data as SlabInput).spanX}×${(member.data as SlabInput).spanY}mm`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={e => { e.stopPropagation(); removeMember(idx); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>

                    {/* Member form */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-[#1a2333]/50 pt-4">
                        {member.type === 'beam' && (
                          <BeamForm data={member.data as BeamInput} onChange={d => updateMember(idx, d)} />
                        )}
                        {member.type === 'column' && (
                          <ColumnForm data={member.data as ColumnInput} onChange={d => updateMember(idx, d)} />
                        )}
                        {member.type === 'slab' && (
                          <SlabForm data={member.data as SlabInput} onChange={d => updateMember(idx, d)} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] p-12 text-center">
                  <Layers className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                  <p className="text-[#869ab8] mb-2">No members defined</p>
                  <p className="text-xs text-slate-500">Add beams, columns, or slabs using the buttons above</p>
                </div>
              )}
            </div>

            {/* Generate Button */}
            {members.length > 0 && (
              <div className="flex justify-end">
                <button type="button"
                  onClick={generateSchedule}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-white font-semibold
                             hover:from-orange-600 hover:to-red-700 transition-all shadow-lg shadow-orange-500/20"
                >
                  <Calculator className="w-5 h-5" />
                  Generate BBS
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ SCHEDULE TAB ═══════════ */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {!schedule ? (
              <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] p-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-[#869ab8]">No schedule generated yet</p>
                <p className="text-xs text-slate-500 mt-1">Go to Member Input tab and click "Generate BBS"</p>
              </div>
            ) : (
              <>
                {/* Header bar */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#dae2fd]">{schedule.projectName}</h3>
                    <p className="text-xs text-slate-500">
                      {schedule.drawingRef} &bull; {schedule.date} &bull; {schedule.code} &bull; {schedule.barGrade}
                    </p>
                  </div>
                  <button type="button"
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg text-white text-sm font-medium tracking-wide tracking-wide hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                {/* BBS Table */}
                <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#131b2e] border-b border-[#1a2333]">
                          <th className="text-left px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Bar Mark</th>
                          <th className="text-left px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Member</th>
                          <th className="text-left px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Type</th>
                          <th className="text-left px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Shape</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Dia (mm)</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">No./Mem</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Members</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Total</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Cut Len (mm)</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Total Len (m)</th>
                          <th className="text-right px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Wt (kg)</th>
                          <th className="text-left px-4 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.entries.map((entry, idx) => (
                          <tr key={idx} className="border-b border-[#1a2333] hover:bg-[#131b2e] transition-colors">
                            <td className="px-4 py-3 text-orange-400 font-mono font-medium tracking-wide tracking-wide">{entry.barMark}</td>
                            <td className="px-4 py-3 text-[#dae2fd]">{entry.memberRef}</td>
                            <td className="px-4 py-3 text-[#869ab8] capitalize">{entry.memberType}</td>
                            <td className="px-4 py-3 text-[#869ab8]">{entry.shape.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 text-right text-cyan-400 font-mono">{entry.dia}</td>
                            <td className="px-4 py-3 text-right text-[#dae2fd]">{entry.noPerMember}</td>
                            <td className="px-4 py-3 text-right text-[#dae2fd]">{entry.noOfMembers}</td>
                            <td className="px-4 py-3 text-right text-[#dae2fd] font-medium tracking-wide tracking-wide">{entry.totalBars}</td>
                            <td className="px-4 py-3 text-right text-[#dae2fd] font-mono">{entry.cuttingLength}</td>
                            <td className="px-4 py-3 text-right text-[#dae2fd]">{entry.totalLength.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-medium tracking-wide tracking-wide">{entry.totalWeight.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{entry.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#131b2e] border-t border-slate-600">
                          <td colSpan={10} className="px-4 py-3 text-right text-[#adc6ff] font-semibold">
                            Total Steel Weight:
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-bold text-base">
                            {schedule.totalWeight.toFixed(2)} kg
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════ SUMMARY TAB ═══════════ */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {!schedule ? (
              <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] p-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-[#869ab8]">Generate a schedule first to see the summary</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0b1326] rounded-xl p-5 border border-[#1a2333]">
                    <p className="text-xs text-slate-500 mb-1">Total Entries</p>
                    <p className="text-2xl font-bold text-[#dae2fd]">{schedule.entries.length}</p>
                  </div>
                  <div className="bg-[#0b1326] rounded-xl p-5 border border-[#1a2333]">
                    <p className="text-xs text-slate-500 mb-1">Steel Weight</p>
                    <p className="text-2xl font-bold text-emerald-400">{schedule.totalWeight.toFixed(1)} kg</p>
                  </div>
                  <div className="bg-[#0b1326] rounded-xl p-5 border border-[#1a2333]">
                    <p className="text-xs text-slate-500 mb-1">Wastage ({schedule.wastageFactor}%)</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {(schedule.totalWeightWithWastage - schedule.totalWeight).toFixed(1)} kg
                    </p>
                  </div>
                  <div className="bg-[#0b1326] rounded-xl p-5 border border-[#1a2333]">
                    <p className="text-xs text-slate-500 mb-1">Total with Wastage</p>
                    <p className="text-2xl font-bold text-orange-400">{schedule.totalWeightWithWastage.toFixed(1)} kg</p>
                  </div>
                </div>

                {/* Summary by Diameter */}
                <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1a2333]">
                    <h3 className="text-base font-semibold text-[#dae2fd] flex items-center gap-2">
                      <Columns3 className="w-4 h-4 text-blue-400" />
                      Summary by Diameter
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#131b2e]">
                          <th className="text-left px-5 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Diameter (mm)</th>
                          <th className="text-right px-5 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Total Length (m)</th>
                          <th className="text-right px-5 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Unit Weight (kg/m)</th>
                          <th className="text-right px-5 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Total Weight (kg)</th>
                          <th className="px-5 py-3 text-[#869ab8] font-medium tracking-wide tracking-wide">Proportion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.summary.map((row, idx) => {
                          const pct = schedule.totalWeight > 0
                            ? (row.totalWeight / schedule.totalWeight * 100)
                            : 0;
                          return (
                            <tr key={idx} className="border-b border-[#1a2333] hover:bg-[#131b2e]">
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-cyan-500" />
                                  <span className="text-white font-medium tracking-wide tracking-wide">{row.dia} mm</span>
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right text-[#dae2fd]">{row.totalLength.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right text-[#869ab8]">{row.unitWeight.toFixed(3)}</td>
                              <td className="px-5 py-3 text-right text-emerald-400 font-medium tracking-wide tracking-wide">{row.totalWeight.toFixed(2)}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-[#131b2e] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[#869ab8] w-12 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* IS Code Reference */}
                <div className="bg-[#0b1326] rounded-xl p-5 border border-[#1a2333]">
                  <h3 className="text-sm font-semibold text-[#dae2fd] mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    Design Code References
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#869ab8]">
                    <div className="flex justify-between border-b border-[#1a2333] pb-2">
                      <span>Development Length (IS 456 Cl. 26.2.1)</span>
                      <span className="text-[#adc6ff] font-mono">L_d = ϕσ_s / 4τ_bd</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2333] pb-2">
                      <span>Bend Deductions (IS 2502:1963)</span>
                      <span className="text-[#adc6ff] font-mono">45°→1d, 90°→2d, 135°→3d</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2333] pb-2">
                      <span>Hook Allowance (HYSD bars)</span>
                      <span className="text-[#adc6ff] font-mono">4d + 75mm</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2333] pb-2">
                      <span>Standard Bar Sizes (IS 1786)</span>
                      <span className="text-[#adc6ff] font-mono">6,8,10,12,16,20,25,28,32,36,40</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarBendingSchedulePage;
