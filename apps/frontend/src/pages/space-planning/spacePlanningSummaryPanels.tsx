import {
  Building2,
  Compass,
  Droplets,
  Eye,
  LayoutGrid,
  Palette,
  PanelTopOpen,
  Sun,
  Table2,
  Thermometer,
  Wind,
  Zap,
} from 'lucide-react';
import type { ColorScheme, HousePlanProject } from '../../services/space-planning/types';
import type { OverlayMode } from '../../components/space-planning/FloorPlanRenderer';

const InfoMini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md bg-surface px-2 py-1.5 border border-border">
    <div className="text-[10px] text-dim">{label}</div>
    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</div>
  </div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  color: string;
}> = ({ label, value, detail, color }) => (
  <div className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg px-3 py-2.5 border border-${color}-200 dark:border-${color}-800/30`}>
    <div className={`text-[10px] text-${color}-600 dark:text-${color}-400`}>{label}</div>
    <div className={`text-sm font-bold text-${color}-800 dark:text-${color}-300`}>{value}</div>
    <div className={`text-[10px] text-${color}-500 dark:text-${color}-400/70 capitalize`}>{detail}</div>
  </div>
);

export const FloorSelector: React.FC<{
  floors: HousePlanProject['floorPlans'];
  selected: number;
  onChange: (floor: number) => void;
}> = ({ floors, selected, onChange }) => (
  <div className="flex gap-1">
    {floors.map((fp) => (
      <button
        key={fp.floor}
        onClick={() => onChange(fp.floor)}
        className={`px-3 py-1.5 text-xs font-medium tracking-wide rounded-lg ${
          selected === fp.floor
            ? 'bg-blue-600 text-white'
            : 'bg-surface text-slate-600 dark:text-slate-300 hover:bg-slate-200'
        }`}
      >
        {fp.label}
      </button>
    ))}
  </div>
);

export const OverlaySelector: React.FC<{
  current: OverlayMode;
  onChange: (mode: OverlayMode) => void;
}> = ({ current, onChange }) => (
  <div className="flex gap-1">
    {[
      { key: 'none' as const, label: 'Plan Only', icon: LayoutGrid },
      { key: 'structural' as const, label: 'Structural', icon: Building2 },
      { key: 'electrical' as const, label: 'Electrical', icon: Zap },
      { key: 'plumbing' as const, label: 'Plumbing', icon: Droplets },
      { key: 'hvac' as const, label: 'HVAC', icon: Wind },
    ].map((opt) => {
      const Icon = opt.icon;
      return (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          title={opt.label}
          className={`p-1.5 rounded ${current === opt.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      );
    })}
  </div>
);

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="text-xs font-medium tracking-wide text-soft">{value}</div>
  </div>
);

export const RoomDetailsPanel: React.FC<{
  room: import('../../services/space-planning/types').PlacedRoom;
  project: HousePlanProject;
}> = ({ room, project }) => {
  const colorScheme = project.colorSchemes.find((cs) => cs.roomType === room.spec.type);
  return (
    <div className="bg-canvas rounded-xl border border-border p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">{room.spec.name}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <InfoItem
          label="Dimensions"
          value={`${room.width.toFixed(1)}m × ${room.height.toFixed(1)}m`}
        />
        <InfoItem label="Area" value={`${(room.width * room.height).toFixed(1)} sq.m`} />
        <InfoItem label="Ceiling Height" value={`${room.ceilingHeight}m`} />
        <InfoItem label="Wall Thickness" value={`${room.wallThickness * 1000}mm`} />
        <InfoItem label="Floor Finish" value={room.finishFloor} />
        <InfoItem label="Wall Finish" value={room.finishWall} />
        <InfoItem label="Ceiling Finish" value={room.finishCeiling} />
        <InfoItem label="Vastu Direction" value={room.spec.vastuDirection || 'N/A'} />
        <InfoItem label="Doors" value={`${room.doors.length}`} />
        <InfoItem label="Windows" value={`${room.windows.length}`} />
        {colorScheme && (
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-slate-400">Colors:</span>
            {[colorScheme.wallColor, colorScheme.floorColor, colorScheme.accentColor].map((c, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded border border-slate-300"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <span className="text-[10px] text-slate-400">Mood: {colorScheme.mood}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const StructuralSummary: React.FC<{ structural: HousePlanProject['structural'] }> = ({
  structural,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Columns"
      value={`${structural.columns.length}`}
      detail={`${structural.columns[0]?.width * 1000}×${structural.columns[0]?.depth * 1000}mm`}
      color="blue"
    />
    <SummaryCard
      label="Beams"
      value={`${structural.beams.length}`}
      detail={`${structural.beams[0]?.width * 1000}×${structural.beams[0]?.depth * 1000}mm`}
      color="indigo"
    />
    <SummaryCard
      label="Foundations"
      value={`${structural.foundations.length}`}
      detail={structural.foundations[0]?.type}
      color="amber"
    />
    <SummaryCard
      label="Slab"
      value={structural.slabType.replace(/_/g, ' ')}
      detail={`${structural.slabThickness * 1000}mm thick`}
      color="green"
    />
  </div>
);

export const ElectricalSummary: React.FC<{ electrical: HousePlanProject['electrical'] }> = ({
  electrical,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Connected Load"
      value={`${electrical.connectedLoad.toFixed(1)} kW`}
      detail={`Demand: ${electrical.demandLoad.toFixed(1)} kW`}
      color="yellow"
    />
    <SummaryCard
      label="Fixtures"
      value={`${electrical.fixtures.length}`}
      detail={`${electrical.circuits.length} circuits`}
      color="amber"
    />
    <SummaryCard
      label="Supply"
      value={electrical.meterType.replace(/_/g, ' ')}
      detail={`${electrical.earthingType} earthing`}
      color="red"
    />
    <SummaryCard
      label="Panels"
      value={`${electrical.panels.length}`}
      detail={electrical.lightningProtection ? 'Lightning protected' : ''}
      color="orange"
    />
  </div>
);

export const PlumbingSummary: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({ plumbing }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Fixtures"
      value={`${plumbing.fixtures.length}`}
      detail={`${plumbing.pipes.length} pipe runs`}
      color="blue"
    />
    <SummaryCard
      label="Storage"
      value={`${plumbing.storageCapacity} L`}
      detail={`OHT: ${plumbing.overheadTankCapacity}L | Sump: ${plumbing.sumpCapacity}L`}
      color="cyan"
    />
    <SummaryCard
      label="Source"
      value={plumbing.waterSupplySource}
      detail={`Pump: ${plumbing.pumpHP} HP`}
      color="teal"
    />
    <SummaryCard
      label="Features"
      value={plumbing.rainwaterHarvesting ? 'RWH ✓' : 'No RWH'}
      detail={`Hot: ${plumbing.hotWaterSystem}`}
      color="green"
    />
  </div>
);

export const HVACSummary: React.FC<{ hvac: HousePlanProject['hvac'] }> = ({ hvac }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <SummaryCard
      label="Cooling Load"
      value={`${hvac.coolingLoad.toFixed(1)} TR`}
      detail={`${hvac.equipment.filter((e) => e.type === 'split_ac').length} AC units`}
      color="blue"
    />
    <SummaryCard
      label="Equipment"
      value={`${hvac.equipment.length}`}
      detail="Fans, AC, exhaust"
      color="indigo"
    />
    <SummaryCard
      label="Ventilation"
      value={`${hvac.ventilationRate} ACH`}
      detail={`${hvac.freshAirPercentage}% fresh air`}
      color="teal"
    />
    <SummaryCard
      label="Cross Vent"
      value={`${hvac.ventilationPaths.length} paths`}
      detail="Natural + mechanical"
      color="green"
    />
  </div>
);

export const ElectricalDetailingPanel: React.FC<{ electrical: HousePlanProject['electrical'] }> = ({
  electrical,
}) => {
  const fixtureByType = electrical.fixtures.reduce<Record<string, number>>((acc, fixture) => {
    acc[fixture.type] = (acc[fixture.type] || 0) + 1;
    return acc;
  }, {});
  const fixtureWattById = new Map(electrical.fixtures.map((fixture) => [fixture.id, fixture.wattage]));

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
              {electrical.circuits.map((circuit) => {
                const circuitLoadKw =
                  circuit.fixtures.reduce(
                    (sum, fixtureId) => sum + (fixtureWattById.get(fixtureId) ?? 0),
                    0,
                  ) / 1000;
                return (
                  <tr key={circuit.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1">{circuit.name}</td>
                    <td className="px-2 py-1 text-center">{circuit.mcbRating}A</td>
                    <td className="px-2 py-1 text-center">{circuit.wireSize}mm²</td>
                    <td className="px-2 py-1 text-center">{circuitLoadKw.toFixed(2)} kW</td>
                    <td className="px-2 py-1 text-center">{circuit.fixtures.length}</td>
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

export const PlumbingDetailingPanel: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({ plumbing }) => {
  const pipeTypeCount = plumbing.pipes.reduce<Record<string, number>>((acc, pipe) => {
    acc[pipe.type] = (acc[pipe.type] || 0) + 1;
    return acc;
  }, {});
  const fixtureTypeCount = plumbing.fixtures.reduce<Record<string, number>>((acc, fixture) => {
    acc[fixture.type] = (acc[fixture.type] || 0) + 1;
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
  const eqByType = hvac.equipment.reduce<Record<string, number>>((acc, equipment) => {
    acc[equipment.type] = (acc[equipment.type] || 0) + 1;
    return acc;
  }, {});
  const mechPaths = hvac.ventilationPaths.filter((path) => path.type === 'mechanical').length;
  const natPaths = hvac.ventilationPaths.filter((path) => path.type === 'natural').length;
  const mixedPaths = hvac.ventilationPaths.filter((path) => path.type === 'mixed').length;

  return (
    <div className="bg-canvas rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-xs font-bold text-soft">HVAC / Mechanical Detailing</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold mb-2">Equipment Schedule</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoMini label="AC Units" value={`${(eqByType.split_ac || 0) + (eqByType.vrf_unit || 0) + (eqByType.window_ac || 0)}`} />
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

export const SimulationCompliancePanel: React.FC<{
  sunlight: HousePlanProject['sunlight'];
  airflow: HousePlanProject['airflow'];
  rooms: import('../../services/space-planning/types').PlacedRoom[];
}> = ({ sunlight, airflow }) => {
  const daylightPass = sunlight.roomSunlight.filter((room) => room.naturalLightFactor >= 0.5).length;
  const ventilationPass = airflow.roomVentilation.filter((room) => room.airChangesPerHour >= 4).length;

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
  rooms: import('../../services/space-planning/types').PlacedRoom[];
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
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface">
            <th className="px-3 py-2 text-left font-semibold text-dim">Room</th>
            <th className="px-3 py-2 text-center font-semibold text-dim">Summer (hrs)</th>
            <th className="px-3 py-2 text-center font-semibold text-dim">Winter (hrs)</th>
            <th className="px-3 py-2 text-center font-semibold text-dim">Light Factor</th>
            <th className="px-3 py-2 text-center font-semibold text-dim">UV</th>
            <th className="px-3 py-2 text-center font-semibold text-dim">Glare</th>
          </tr>
        </thead>
        <tbody>
          {sunlight.roomSunlight.map((rs) => {
            const room = rooms.find((candidate) => candidate.id === rs.roomId);
            return (
              <tr key={rs.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-1.5 font-medium tracking-wide text-soft">{room?.spec.name || rs.roomId}</td>
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
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Recommendations</div>
      {sunlight.recommendations.map((recommendation, index) => (
        <div key={index} className="text-[10px] text-amber-600 dark:text-amber-400/80 flex gap-1 mb-0.5">
          <Sun className="w-3 h-3 flex-shrink-0 mt-0.5" /> {recommendation}
        </div>
      ))}
    </div>
  </div>
);

export const AirflowAnalysisPanel: React.FC<{
  airflow: HousePlanProject['airflow'];
  rooms: import('../../services/space-planning/types').PlacedRoom[];
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
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#131b2e]">
            <th className="px-3 py-2 text-left font-semibold text-[#869ab8]">Room</th>
            <th className="px-3 py-2 text-center font-semibold text-[#869ab8]">ACH</th>
            <th className="px-3 py-2 text-center font-semibold text-[#869ab8]">Adequacy</th>
            <th className="px-3 py-2 text-left font-semibold text-[#869ab8]">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {airflow.roomVentilation.map((rv) => {
            const room = rooms.find((candidate) => candidate.id === rv.roomId);
            const color =
              rv.adequacy === 'excellent' ? 'green' : rv.adequacy === 'good' ? 'blue' : rv.adequacy === 'fair' ? 'yellow' : 'red';
            return (
              <tr key={rv.roomId} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-1.5 font-medium tracking-wide text-[#adc6ff]">{room?.spec.name || rv.roomId}</td>
                <td className="px-3 py-1.5 text-center font-mono">{rv.airChangesPerHour}</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-400 capitalize`}
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

export const ColorSchemePanel: React.FC<{ schemes: ColorScheme[] }> = ({ schemes }) => {
  const uniqueSchemes = schemes.filter((scheme, index, arr) => arr.findIndex((candidate) => candidate.roomType === scheme.roomType) === index);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {uniqueSchemes.map((scheme) => (
        <div key={scheme.roomType} className="bg-[#0b1326] rounded-lg border border-[#1a2333] p-3">
          <div className="text-xs font-semibold text-[#adc6ff] mb-2 capitalize">
            {scheme.roomType.replace(/_/g, ' ')}
            {scheme.direction && <span className="text-[10px] text-slate-400 ml-1">({scheme.direction})</span>}
          </div>
          <div className="flex gap-1.5 mb-2">
            {[
              { color: scheme.wallColor, label: 'Wall' },
              { color: scheme.ceilingColor, label: 'Ceiling' },
              { color: scheme.floorColor, label: 'Floor' },
              { color: scheme.accentColor, label: 'Accent' },
            ].map(({ color, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className="w-8 h-8 rounded border border-slate-300 shadow-sm" style={{ backgroundColor: color }} title={color} />
                <span className="text-[8px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${scheme.vastuCompatible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {scheme.vastuCompatible ? 'Vastu ✓' : 'Non-vastu'}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">{scheme.mood}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export { SummaryCard, InfoMini };
