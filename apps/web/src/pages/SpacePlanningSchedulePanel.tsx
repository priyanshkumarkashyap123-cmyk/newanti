import { useState } from 'react';
import { FileDown } from 'lucide-react';
import type { HousePlanProject } from '../services/space-planning/types';
import { BOQ_RATE_PRESETS, BoqPreset } from '../components/space-planning/boqPresets';
import { buildMasterBoq } from '../components/space-planning/boq';
import { downloadCSV, toCSV } from '../components/space-planning/csvExport';

export function SpacePlanningSchedulePanel({ project }: { project: HousePlanProject }) {
  const [boqPreset, setBoqPreset] = useState<BoqPreset>('standard');

  const allRooms = project.floorPlans.flatMap((fp) => fp.rooms);
  const allDoors = allRooms.flatMap((r) => r.doors.map((d) => ({ ...d, roomName: r.spec.name })));
  const allWindows = allRooms.flatMap((r) =>
    r.windows.map((w) => ({ ...w, roomName: r.spec.name })),
  );

  const handleExportRooms = () => {
    const csv = toCSV(
      ['Room ID', 'Room Name', 'Floor', 'Width (m)', 'Height (m)', 'Area (m²)', 'Ceiling Height (m)', 'Floor Finish', 'Wall Finish'],
      allRooms.map((r) => [r.id, r.spec.name, r.floor, r.width.toFixed(2), r.height.toFixed(2), (r.width * r.height).toFixed(2), r.ceilingHeight, r.finishFloor, r.finishWall]),
    );
    downloadCSV('room_schedule.csv', csv);
  };

  const handleExportMEP = () => {
    const electricalRows = project.electrical.fixtures.map((f) => ['Electrical Fixture', f.id, f.type, f.roomId, f.circuit, f.wattage, f.height, f.x.toFixed(2), f.y.toFixed(2)]);
    const circuitRows = project.electrical.circuits.map((c) => ['Electrical Circuit', c.id, c.name, c.type, c.mcbRating, c.wireSize, c.phase, c.fixtures.length, '']);
    const plumbingFixtureRows = project.plumbing.fixtures.map((f) => ['Plumbing Fixture', f.id, f.type, f.roomId, f.pipeSize, f.waterSupply, f.drainage, f.x.toFixed(2), f.y.toFixed(2)]);
    const pipeRows = project.plumbing.pipes.map((p) => ['Plumbing Pipe', p.id, p.type, p.material, p.diameter, p.floor, p.startX.toFixed(2), p.startY.toFixed(2), `${p.endX.toFixed(2)},${p.endY.toFixed(2)}`]);
    const hvacRows = project.hvac.equipment.map((e) => ['HVAC Equipment', e.id, e.type, e.roomId, typeof e.capacity === 'number' ? e.capacity : '', e.powerConsumption, '', e.x.toFixed(2), e.y.toFixed(2)]);
    const ventilationRows = project.hvac.ventilationPaths.map((v) => ['Ventilation Path', v.id, v.type, v.startRoomId, v.endRoomId || 'OUTSIDE', v.airflow, v.direction, '', '']);

    const csv = toCSV(['Category', 'ID', 'Type/Name', 'Room/From', 'Circuit/To', 'Load/Size', 'Meta 1', 'X/StartX', 'Y/EndXY'], [...electricalRows, ...circuitRows, ...plumbingFixtureRows, ...pipeRows, ...hvacRows, ...ventilationRows]);
    downloadCSV('mep_schedule.csv', csv);
  };

  const handleExportSimulation = () => {
    const sunlightRows = project.sunlight.roomSunlight.map((s) => ['Sunlight', s.roomId, s.hoursOfDirectSun.summer, s.hoursOfDirectSun.winter, (s.naturalLightFactor * 100).toFixed(1), s.glareRisk, s.uvExposure, '', '']);
    const airflowRows = project.airflow.roomVentilation.map((a) => ['Airflow', a.roomId, a.airChangesPerHour, a.adequacy, a.recommendation, '', '', '', '']);
    const csv = toCSV(['Category', 'Room ID', 'Metric 1', 'Metric 2', 'Metric 3', 'Metric 4', 'Metric 5', 'Metric 6', 'Metric 7'], [...sunlightRows, ...airflowRows]);
    downloadCSV('simulation_schedule.csv', csv);
  };

  const handleExportMasterBOQ = () => {
    const { rows, subtotal, contingency, gst, total } = buildMasterBoq(project, boqPreset);
    const boqRows = rows.map((r) => [r.section, r.code, r.desc, r.unit, r.qty.toFixed(2), r.rate.toFixed(2), r.amount.toFixed(2), r.remarks]);
    boqRows.push(['', '', 'SUBTOTAL', '', '', '', subtotal.toFixed(2), `Preset: ${boqPreset}`], ['', '', 'CONTINGENCY (5%)', '', '', '', contingency.toFixed(2), 'Project risk allowance'], ['', '', 'GST (18%)', '', '', '', gst.toFixed(2), 'Tax'], ['', '', 'GRAND TOTAL', '', '', '', total.toFixed(2), 'Estimated project amount']);
    const csv = toCSV(['Section', 'Item Code', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount', 'Remarks'], boqRows);
    downloadCSV(`master_boq_${boqPreset}.csv`, csv);
  };

  const masterBoqTotals = buildMasterBoq(project, boqPreset);

  const actions: Array<{
    key: string;
    label: string;
    onClick: () => void;
    tone: 'slate' | 'blue' | 'emerald' | 'violet';
  }> = [
    { key: 'rooms', label: 'Export Room CSV', onClick: handleExportRooms, tone: 'slate' },
    { key: 'mep', label: 'Export MEP CSV', onClick: handleExportMEP, tone: 'blue' },
    { key: 'simulation', label: 'Export Simulation CSV', onClick: handleExportSimulation, tone: 'emerald' },
    { key: 'boq', label: 'Export Master BOQ CSV', onClick: handleExportMasterBOQ, tone: 'violet' },
  ];

  const actionButtonClass =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium tracking-wide border border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

  return (
    <div className="space-y-4 bg-[#0b1326]/50 border border-[#1a2333] rounded-xl p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#adc6ff]">Schedules & Exports</div>
          <div className="text-[11px] text-slate-400">Download room, MEP, simulation, and BOQ CSVs.</div>
        </div>
        <div className="inline-flex items-center gap-2 text-xs">
          <label htmlFor="boqPreset" className="text-slate-400">BOQ preset</label>
          <select
            id="boqPreset"
            value={boqPreset}
            onChange={(e) => setBoqPreset(e.target.value as BoqPreset)}
            className="bg-[#0b1326] border border-[#1a2333] rounded-md px-2 py-1 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label="BOQ preset"
          >
            <option value="economy">Economy</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/40 text-amber-800 dark:text-amber-200">
            Est. Total ₹{masterBoqTotals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {actions.map(({ key, label, onClick, tone }) => {
          const toneClasses: Record<typeof tone, string> = {
            slate: 'bg-[#131b2e] text-slate-100 hover:bg-slate-800',
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50',
            emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900/50',
            violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-200 hover:bg-violet-200 dark:hover:bg-violet-900/50',
          } as const;
          return (
            <button key={key} onClick={onClick} className={`${actionButtonClass} ${toneClasses[tone]}`} aria-label={label}>
              <FileDown className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-500">
        Preset rates: economy → baseline materials, standard → mid-grade finishes, premium → high-spec fixtures.
      </div>
    </div>
  );
}