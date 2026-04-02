/**
 * MEPDetailingPanels.tsx
 * Detailed technical panels for electrical, plumbing, and HVAC systems
 */

import type { HousePlanProject } from '../../services/space-planning/types';
import { InfoMini } from './PanelUtilityComponents';

export const ElectricalDetailingPanel: React.FC<{ electrical: HousePlanProject['electrical'] }> = ({
  electrical,
}) => {
  const fixtureByType = electrical.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});
  const fixtureWattById = new Map(electrical.fixtures.map((f) => [f.id, f.wattage]));

  return (
    <div className="bg-canvas rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-xs font-bold text-soft">Electrical Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-surface text-[11px] font-semibold">Circuit Schedule</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-surface">
                <th className="px-2 py-1 text-left">Circuit</th>
                <th className="px-2 py-1 text-center">MCB</th>
                <th className="px-2 py-1 text-center">Wire</th>
                <th className="px-2 py-1 text-center">Load</th>
                <th className="px-2 py-1 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {electrical.circuits.map((c) => {
                const circuitLoadKw =
                  c.fixtures.reduce((sum, fixtureId) => sum + (fixtureWattById.get(fixtureId) ?? 0), 0) /
                  1000;
                return (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 text-center">{c.mcbRating}A</td>
                    <td className="px-2 py-1 text-center">{c.wireSize}mm²</td>
                    <td className="px-2 py-1 text-center">{circuitLoadKw.toFixed(2)} kW</td>
                    <td className="px-2 py-1 text-center">{c.fixtures.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Fixture Mix & Safety</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Smoke Detectors" value={`${fixtureByType.smoke_detector || 0}`} />
            <InfoMini label="Emergency Lights" value={`${fixtureByType.emergency_light || 0}`} />
            <InfoMini label="CCTV Points" value={`${fixtureByType.cctv || 0}`} />
            <InfoMini label="EV Chargers" value={`${fixtureByType.ev_charging || 0}`} />
            <InfoMini label="Solar Ready" value={electrical.solarCapacity ? `${electrical.solarCapacity} kWp` : 'No'} />
            <InfoMini label="Backup" value={electrical.backupType || 'Not set'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const PlumbingDetailingPanel: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({
  plumbing,
}) => {
  const pipeTypeCount = plumbing.pipes.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});
  const fixtureTypeCount = plumbing.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-canvas rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-xs font-bold text-soft">Plumbing Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Pipe Network</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Water Supply" value={`${pipeTypeCount.water_supply || 0}`} />
            <InfoMini label="Drainage" value={`${pipeTypeCount.drainage || 0}`} />
            <InfoMini label="Vent" value={`${pipeTypeCount.vent || 0}`} />
            <InfoMini label="Hot Water" value={`${pipeTypeCount.hot_water || 0}`} />
            <InfoMini label="Rain Water" value={`${pipeTypeCount.rain_water || 0}`} />
            <InfoMini label="RWH" value={plumbing.rainwaterHarvesting ? 'Enabled' : 'Disabled'} />
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Fixtures & Systems</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="WC" value={`${fixtureTypeCount.wc || 0}`} />
            <InfoMini label="Basins" value={`${fixtureTypeCount.wash_basin || 0}`} />
            <InfoMini label="Showers" value={`${fixtureTypeCount.shower || 0}`} />
            <InfoMini label="Kitchen Sinks" value={`${fixtureTypeCount.kitchen_sink || 0}`} />
            <InfoMini label="Inspection Chambers" value={`${fixtureTypeCount.inspection_chamber || 0}`} />
            <InfoMini label="Pumps" value={`${fixtureTypeCount.pressure_pump || 0}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const HVACDetailingPanel: React.FC<{ hvac: HousePlanProject['hvac'] }> = ({ hvac }) => {
  const eqByType = hvac.equipment.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  const mechPaths = hvac.ventilationPaths.filter((p) => p.type === 'mechanical').length;
  const natPaths = hvac.ventilationPaths.filter((p) => p.type === 'natural').length;
  const mixedPaths = hvac.ventilationPaths.filter((p) => p.type === 'mixed').length;

  return (
    <div className="bg-canvas rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-xs font-bold text-soft">HVAC / Mechanical Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Equipment Schedule</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini
              label="AC Units"
              value={`${(eqByType.split_ac || 0) + (eqByType.vrf_unit || 0) + (eqByType.window_ac || 0)}`}
            />
            <InfoMini label="Fresh Air Units" value={`${eqByType.fresh_air_unit || 0}`} />
            <InfoMini label="Exhaust Fans" value={`${eqByType.exhaust_fan || 0}`} />
            <InfoMini label="Ventilators" value={`${eqByType.ventilator || 0}`} />
            <InfoMini label="Diffusers" value={`${eqByType.diffuser || 0}`} />
            <InfoMini label="Grilles" value={`${eqByType.grille || 0}`} />
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Air Movement Simulation</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="Natural Paths" value={`${natPaths}`} />
            <InfoMini label="Mechanical Paths" value={`${mechPaths}`} />
            <InfoMini label="Mixed Paths" value={`${mixedPaths}`} />
            <InfoMini label="Duct Routes" value={`${hvac.ductRoutes.length}`} />
            <InfoMini label="Ventilation Rate" value={`${hvac.ventilationRate} ACH`} />
            <InfoMini label="Fresh Air" value={`${hvac.freshAirPercentage}%`} />
          </div>
        </div>
      </div>
    </div>
  );
};
