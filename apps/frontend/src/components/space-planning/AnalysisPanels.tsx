/**
 * AnalysisPanels.tsx
 * Analysis panels for sunlight, airflow, and simulation compliance
 */

import { Sun } from 'lucide-react';
import type { HousePlanProject, PlacedRoom } from '../../services/space-planning/types';
import { InfoMini } from './PanelUtilityComponents';

export const SimulationCompliancePanel: React.FC<{
  sunlight: HousePlanProject['sunlight'];
  airflow: HousePlanProject['airflow'];
  rooms: PlacedRoom[];
}> = ({ sunlight, airflow, rooms }) => {
  const daylightPass = sunlight.roomSunlight.filter((r) => r.naturalLightFactor >= 0.5).length;
  const ventilationPass = airflow.roomVentilation.filter((r) => r.airChangesPerHour >= 4).length;

  return (
    <div className="bg-canvas rounded-xl border border-border p-4">
      <h3 className="text-xs font-bold text-soft mb-3">Simulation Compliance</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
        <InfoMini label="Rooms Daylight ≥ 50%" value={`${daylightPass}/${sunlight.roomSunlight.length}`} />
        <InfoMini label="Rooms ACH ≥ 4" value={`${ventilationPass}/${airflow.roomVentilation.length}`} />
        <InfoMini label="Cross Vent Paths" value={`${airflow.crossVentilationPaths.length}`} />
        <InfoMini label="Stack Potential" value={`${(airflow.stackVentilationPotential * 100).toFixed(0)}%`} />
      </div>
      <div className="mt-3 text-[10px] text-dim">
        Targets used: daylight factor ≥ 0.5 (good), ventilation ≥ 4 ACH (good), cross ventilation preferred for habitable rooms.
      </div>
    </div>
  );
};

export const SunlightAnalysisPanel: React.FC<{
  sunlight: HousePlanProject['sunlight'];
  rooms: PlacedRoom[];
}> = ({ sunlight, rooms }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-border/30">
        <div className="text-[10px] text-amber-600">Summer Solar Altitude</div>
        <div className="text-lg font-bold text-amber-800 dark:text-amber-300">
          {sunlight.solsticeAngles.summer.altitude.toFixed(1)}°
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-border/30">
        <div className="text-[10px] text-blue-600">Winter Solar Altitude</div>
        <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
          {sunlight.solsticeAngles.winter.altitude.toFixed(1)}°
        </div>
      </div>
      <div className="bg-surface rounded-lg p-3 border border-border">
        <div className="text-[10px] text-slate-500">Location</div>
        <div className="text-xs font-medium tracking-wide text-soft">
          {sunlight.latitude.toFixed(2)}°N, {sunlight.longitude.toFixed(2)}°E
        </div>
      </div>
    </div>
    {/* Room sunlight table */}
    <div className="overflow-x-auto">
      <table className="w-full text-xs" aria-label="Room sunlight analysis table">
        <caption className="sr-only">Sunlight duration, light factor, UV, and glare by room</caption>
        <thead>
          <tr className="bg-surface">
            <th scope="col" className="px-3 py-2 text-left font-semibold text-dim">Room</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-dim">Summer (hrs)</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-dim">Winter (hrs)</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-dim">Light Factor</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-dim">UV</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-dim">Glare</th>
          </tr>
        </thead>
        <tbody>
          {sunlight.roomSunlight.map((rs) => {
            const room = rooms.find((r) => r.id === rs.roomId);
            return (
              <tr key={rs.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <th scope="row" className="px-3 py-1.5 font-medium tracking-wide text-soft text-left">
                  {room?.spec.name || rs.roomId}
                </th>
                <td className="px-3 py-1.5 text-center">{rs.hoursOfDirectSun.summer}h</td>
                <td className="px-3 py-1.5 text-center">{rs.hoursOfDirectSun.winter}h</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      rs.naturalLightFactor >= 0.7
                        ? 'bg-green-100 text-green-700'
                        : rs.naturalLightFactor >= 0.4
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {(rs.naturalLightFactor * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center capitalize">{rs.uvExposure}</td>
                <td className="px-3 py-1.5 text-center">{rs.glareRisk ? '⚠️' : '✓'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {/* Recommendations */}
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
        Recommendations
      </div>
      {sunlight.recommendations.map((r, i) => (
        <div
          key={i}
          className="text-[10px] text-amber-600 dark:text-amber-400/80 flex gap-1 mb-0.5"
        >
          <Sun className="w-3 h-3 flex-shrink-0 mt-0.5" /> {r}
        </div>
      ))}
    </div>
  </div>
);

export const AirflowAnalysisPanel: React.FC<{
  airflow: HousePlanProject['airflow'];
  rooms: PlacedRoom[];
}> = ({ airflow, rooms }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-[#1a2333]/30">
        <div className="text-[10px] text-teal-600">Prevailing Wind</div>
        <div className="text-lg font-bold text-teal-800 dark:text-teal-300">
          {airflow.prevailingWindDirection}
        </div>
        <div className="text-[10px] text-teal-500">{airflow.windSpeed} m/s avg</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-[#1a2333]/30">
        <div className="text-[10px] text-green-600">Cross Ventilation</div>
        <div className="text-lg font-bold text-green-800 dark:text-green-300">
          {airflow.crossVentilationPaths.length} paths
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-[#1a2333]/30">
        <div className="text-[10px] text-blue-600">Stack Effect</div>
        <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
          {(airflow.stackVentilationPotential * 100).toFixed(0)}%
        </div>
      </div>
    </div>
    {/* Room ventilation table */}
    <div className="overflow-x-auto">
      <table className="w-full text-xs" aria-label="Room ventilation analysis table">
        <caption className="sr-only">Air changes per hour, adequacy, and recommendations by room</caption>
        <thead>
          <tr className="bg-[#131b2e]">
            <th scope="col" className="px-3 py-2 text-left font-semibold text-[#869ab8]">Room</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-[#869ab8]">ACH</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold text-[#869ab8]">Adequacy</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-[#869ab8]">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {airflow.roomVentilation.map((rv) => {
            const room = rooms.find((r) => r.id === rv.roomId);
            const adequacyBadge: Record<string, string> = {
              excellent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
              good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
              fair: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
              poor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
            };
            const badgeClass = adequacyBadge[rv.adequacy] ?? adequacyBadge.poor;
            return (
              <tr key={rv.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <th scope="row" className="px-3 py-1.5 font-medium tracking-wide text-[#adc6ff] text-left">
                  {room?.spec.name || rv.roomId}
                </th>
                <td className="px-3 py-1.5 text-center font-mono">{rv.airChangesPerHour}</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass} capitalize`}
                  >
                    {rv.adequacy}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-[#869ab8]">{rv.recommendation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
