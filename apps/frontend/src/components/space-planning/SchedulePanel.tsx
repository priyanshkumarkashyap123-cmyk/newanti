/**
 * SchedulePanel.tsx
 * Room and door/window schedule with bill of quantities
 *
 * TODO: Refactor this large component into smaller, focused modules
 * - ScheduleSection: Base component for schedule tables
 * - BOQCalculator: Logic for building cost estimates
 * - ExportServices: CSV/exports handling
 * - ScheduleTabs: Tab management for room/door/window/BOQ sections
 */

import { useState } from 'react';
import type { HousePlanProject } from '../../services/space-planning/types';

export const SchedulePanel: React.FC<{ project: HousePlanProject }> = ({ project }) => {
  const allRooms = project.floorPlans.flatMap((fp) => fp.rooms);
  const [activeTab, setActiveTab] = useState<'rooms' | 'mep' | 'simulation'>('rooms');

  const toCSV = (headers: string[], rows: Array<Array<string | number | boolean>>) => {
    const escape = (v: string | number | boolean) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  };

  const downloadCSV = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportRooms = () => {
    const csv = toCSV(
      ['Room ID', 'Room Name', 'Floor', 'Width (m)', 'Height (m)', 'Area (m²)', 'Ceiling Height (m)', 'Floor Finish', 'Wall Finish'],
      allRooms.map((r) => [
        r.id,
        r.spec.name,
        r.floor,
        r.width.toFixed(2),
        r.height.toFixed(2),
        (r.width * r.height).toFixed(2),
        r.ceilingHeight,
        r.finishFloor,
        r.finishWall,
      ]),
    );
    downloadCSV('room_schedule.csv', csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeTab === 'rooms' ? 'bg-blue-600 text-white' : 'bg-surface text-slate-600'}`}
        >
          Rooms
        </button>
        <button
          onClick={() => setActiveTab('mep')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeTab === 'mep' ? 'bg-blue-600 text-white' : 'bg-surface text-slate-600'}`}
        >
          MEP
        </button>
        <button
          onClick={() => setActiveTab('simulation')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeTab === 'simulation' ? 'bg-blue-600 text-white' : 'bg-surface text-slate-600'}`}
        >
          Simulation
        </button>
        <button
          onClick={handleExportRooms}
          className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
        >
          Export CSV
        </button>
      </div>

      {activeTab === 'rooms' && (
        <div className="bg-canvas rounded-xl border border-border p-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface">
                <th className="px-3 py-2 text-left font-semibold">Room</th>
                <th className="px-3 py-2 text-center">Width</th>
                <th className="px-3 py-2 text-center">Height</th>
                <th className="px-3 py-2 text-center">Area</th>
                <th className="px-3 py-2 text-center">Ceiling</th>
                <th className="px-3 py-2 text-left">Floor Finish</th>
              </tr>
            </thead>
            <tbody>
              {allRooms.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5 font-medium">{r.spec.name}</td>
                  <td className="px-3 py-1.5 text-center">{r.width.toFixed(2)}m</td>
                  <td className="px-3 py-1.5 text-center">{r.height.toFixed(2)}m</td>
                  <td className="px-3 py-1.5 text-center">{(r.width * r.height).toFixed(2)}m²</td>
                  <td className="px-3 py-1.5 text-center">{r.ceilingHeight}m</td>
                  <td className="px-3 py-1.5">{r.finishFloor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'mep' && (
        <div className="bg-canvas rounded-xl border border-border p-4">
          <div className="text-sm text-slate-500">MEP schedules exported via MEP detailing panels above</div>
        </div>
      )}

      {activeTab === 'simulation' && (
        <div className="bg-canvas rounded-xl border border-border p-4">
          <div className="text-sm text-slate-500">Simulation data available in Analysis panels</div>
        </div>
      )}
    </div>
  );
};
