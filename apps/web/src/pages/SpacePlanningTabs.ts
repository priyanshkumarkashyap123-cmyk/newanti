import {
  Building2,
  LayoutGrid,
  Compass,
  Zap,
  Droplets,
  Wind,
  Sun,
  Eye,
  PanelTopOpen,
  Palette,
  Table2,
  Settings2,
  Thermometer,
} from 'lucide-react';

export type PlanTab =
  | 'wizard'
  | 'floor_plan'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'vastu'
  | 'sunlight'
  | 'airflow'
  | 'elevations'
  | 'sections'
  | 'colors'
  | 'schedule';

export const PLAN_TABS: { key: PlanTab; label: string; icon: typeof Building2; group: string }[] = [
  { key: 'wizard', label: 'Configure', icon: Settings2, group: 'Setup' },
  { key: 'floor_plan', label: 'Floor Plan', icon: LayoutGrid, group: 'Architectural' },
  { key: 'structural', label: 'Structural', icon: Building2, group: 'Structural' },
  { key: 'electrical', label: 'Electrical', icon: Zap, group: 'MEP' },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets, group: 'MEP' },
  { key: 'hvac', label: 'HVAC', icon: Wind, group: 'MEP' },
  { key: 'vastu', label: 'Vastu', icon: Compass, group: 'Analysis' },
  { key: 'sunlight', label: 'Sunlight', icon: Sun, group: 'Analysis' },
  { key: 'airflow', label: 'Airflow', icon: Thermometer, group: 'Analysis' },
  { key: 'elevations', label: 'Elevations', icon: Eye, group: 'Drawings' },
  { key: 'sections', label: 'Sections', icon: PanelTopOpen, group: 'Drawings' },
  { key: 'colors', label: 'Colors', icon: Palette, group: 'Finishes' },
  { key: 'schedule', label: 'Schedule', icon: Table2, group: 'Documents' },
];
