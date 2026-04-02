/**
 * MEPSummaryComponents.tsx
 * Summary cards for structural, electrical, plumbing, and HVAC systems
 */

import type { HousePlanProject } from '../../services/space-planning/types';
import { SummaryCard } from './PanelUtilityComponents';

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

export const PlumbingSummary: React.FC<{ plumbing: HousePlanProject['plumbing'] }> = ({
  plumbing,
}) => (
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
      detail={`Fans, AC, exhaust`}
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
