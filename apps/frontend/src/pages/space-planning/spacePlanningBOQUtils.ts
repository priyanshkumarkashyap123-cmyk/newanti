import { BOQ_RATE_PRESETS, type BoqPreset } from '../../components/space-planning/boqPresets';
import { buildMasterBoq, type MasterBoqTotals } from '../../components/space-planning/boq';

export type { BoqPreset, MasterBoqTotals };

export const getBoqPresetRates = (preset: BoqPreset): Readonly<Record<string, number>> => BOQ_RATE_PRESETS[preset];

export const buildMasterBoqTotals: typeof buildMasterBoq = buildMasterBoq;
