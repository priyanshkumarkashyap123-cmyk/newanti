/**
 * RoomConfigWizard.tsx - Multi-step Room Configuration Wizard
 *
 * Step 1: Plot Details (dimensions, shape, unit)
 * Step 2: Orientation & Direction (compass, entry, road side)
 * Step 3: Room Program (select rooms, quantities, floors)
 * Step 4: Preferences (style, budget, climate, Vastu level)
 * Step 5: MEP Requirements (electrical, plumbing, HVAC choices)
 * Step 6: Location (latitude, longitude for sunlight)
 * Step 7: Review & Generate
 */

import { FC, useState, useCallback, useEffect } from 'react';
import {
  Home,
  Compass,
  LayoutGrid,
  Settings2,
  Zap,
  MapPin,
  CheckCircle2,
  Plus,
  Minus,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Building2,
} from 'lucide-react';
import type {
  PlotDimensions,
  SiteOrientation,
  SiteConstraints,
  RoomSpec,
  RoomType,
  UserPreferences,
  CardinalDirection,
  WizardStep,
} from '../../services/space-planning/types';
import { spacePlanningEngine } from '../../services/space-planning/SpacePlanningEngine';
import generateSmartDefaults, {
  type SmartDefaults,
  type SmartDefaultsInput,
} from '../../services/learning/smartDefaults';
import { getTemplateById } from '../../data/educationalTemplates';

// ============================================
// TYPES
// ============================================

interface RoomConfigWizardProps {
  onGenerate: (config: WizardConfig) => void;
  isGenerating?: boolean;
  className?: string;
  initialTemplateId?: string;
}

export interface WizardConfig {
  plot: PlotDimensions;
  orientation: SiteOrientation;
  constraints: SiteConstraints;
  roomSpecs: RoomSpec[];
  preferences: UserPreferences;
  location: { latitude: number; longitude: number; city: string; state: string; country: string };
}

const WIZARD_STEPS: { key: WizardStep; label: string; icon: FC<{ className?: string }> }[] = [
  { key: 'plot_details', label: 'Plot', icon: Home },
  { key: 'orientation', label: 'Direction', icon: Compass },
  { key: 'room_program', label: 'Rooms', icon: LayoutGrid },
  { key: 'preferences', label: 'Style', icon: Settings2 },
  { key: 'mep_requirements', label: 'MEP', icon: Zap },
  { key: 'review', label: 'Location', icon: MapPin },
  { key: 'generate', label: 'Generate', icon: Sparkles },
];

const ROOM_CATEGORIES: { label: string; types: RoomType[] }[] = [
  { label: 'Living Areas', types: ['living', 'dining', 'drawing_room', 'entrance_lobby', 'foyer'] },
  { label: 'Bedrooms', types: ['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'] },
  { label: 'Kitchen & Utility', types: ['kitchen', 'pantry', 'store', 'utility', 'laundry'] },
  { label: 'Bathrooms', types: ['bathroom', 'toilet'] },
  { label: 'Study & Work', types: ['study', 'home_office', 'library'] },
  { label: 'Worship & Special', types: ['pooja', 'home_theater', 'gym', 'workshop'] },
  { label: 'Outdoor & Access', types: ['balcony', 'terrace', 'verandah', 'sit_out', 'garden'] },
  { label: 'Circulation', types: ['corridor', 'staircase', 'lift'] },
  {
    label: 'Parking & Service',
    types: ['parking', 'garage', 'servants_quarter', 'walk_in_closet', 'dressing'],
  },
  {
    label: 'Technical',
    types: ['mechanical_room', 'electrical_panel', 'water_tank_room', 'basement'],
  },
];

const DIRECTIONS: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const ROOM_PRESETS: Record<
  'residential' | 'commercial' | 'industrial' | 'bridge' | 'tower',
  Array<[RoomType, { count: number; floor: number }]>
> = {
  residential: [
    ['living', { count: 1, floor: 0 }],
    ['dining', { count: 1, floor: 0 }],
    ['kitchen', { count: 1, floor: 0 }],
    ['master_bedroom', { count: 1, floor: 1 }],
    ['bedroom', { count: 2, floor: 1 }],
    ['bathroom', { count: 2, floor: 1 }],
    ['toilet', { count: 1, floor: 0 }],
    ['staircase', { count: 1, floor: 0 }],
    ['entrance_lobby', { count: 1, floor: 0 }],
    ['balcony', { count: 1, floor: 1 }],
    ['parking', { count: 1, floor: 0 }],
  ],
  commercial: [
    ['entrance_lobby', { count: 1, floor: 0 }],
    ['home_office', { count: 3, floor: 0 }],
    ['study', { count: 2, floor: 1 }],
    ['toilet', { count: 2, floor: 0 }],
    ['bathroom', { count: 2, floor: 1 }],
    ['staircase', { count: 1, floor: 0 }],
    ['lift', { count: 1, floor: 0 }],
    ['parking', { count: 1, floor: 0 }],
  ],
  industrial: [
    ['workshop', { count: 1, floor: 0 }],
    ['mechanical_room', { count: 1, floor: 0 }],
    ['electrical_panel', { count: 1, floor: 0 }],
    ['home_office', { count: 1, floor: 0 }],
    ['toilet', { count: 2, floor: 0 }],
    ['staircase', { count: 1, floor: 0 }],
    ['parking', { count: 1, floor: 0 }],
  ],
  bridge: [
    ['home_office', { count: 1, floor: 0 }],
    ['mechanical_room', { count: 1, floor: 0 }],
    ['electrical_panel', { count: 1, floor: 0 }],
    ['toilet', { count: 1, floor: 0 }],
  ],
  tower: [
    ['home_office', { count: 2, floor: 0 }],
    ['mechanical_room', { count: 1, floor: 0 }],
    ['electrical_panel', { count: 1, floor: 0 }],
    ['staircase', { count: 1, floor: 0 }],
    ['lift', { count: 1, floor: 0 }],
  ],
};

type QuickBuildingType = keyof typeof ROOM_PRESETS;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const inferProblemTypeFromTemplate = (templateId: string): SmartDefaultsInput['problemType'] => {
  if (templateId.includes('beam')) return 'beam';
  if (templateId.includes('truss')) return 'truss';
  if (templateId.includes('arch')) return 'arch';
  if (templateId.includes('frame') || templateId.includes('cable') || templateId.includes('space')) return 'frame';
  return 'other';
};

const inferBuildingTypeFromTemplate = (
  templateId: string,
): QuickBuildingType => {
  if (templateId.includes('cable') || templateId.includes('truss')) return 'bridge';
  if (templateId.includes('space')) return 'industrial';
  if (templateId.includes('frame')) return 'commercial';
  return 'residential';
};

// ============================================
// COMPONENT
// ============================================

export const RoomConfigWizard: FC<RoomConfigWizardProps> = ({
  onGenerate,
  isGenerating = false,
  className = '',
  initialTemplateId,
}) => {
  const [step, setStep] = useState(0);
  const [smartDefaults, setSmartDefaults] = useState<SmartDefaults | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  // Plot
  const [plot, setPlot] = useState<PlotDimensions>({
    width: 15,
    depth: 20,
    area: 300,
    shape: 'rectangular',
    unit: 'meters',
  });
  const [polygonVerticesText, setPolygonVerticesText] = useState('0,0\n15,0\n15,20\n0,20');
  const [polygonValidation, setPolygonValidation] = useState<{
    validVertices: number;
    invalidLines: number;
    hasEnoughVertices: boolean;
  }>({ validVertices: 4, invalidLines: 0, hasEnoughVertices: true });

  // Orientation
  const [orientation, setOrientation] = useState<SiteOrientation>({
    northDirection: 0,
    plotFacing: 'N',
    mainEntryDirection: 'N',
    roadSide: ['N'],
  });

  // Constraints
  const [constraints, setConstraints] = useState<SiteConstraints>({
    setbacks: { front: 3, rear: 2, left: 1.5, right: 1.5 },
    maxHeight: 15,
    maxFloors: 3,
    farAllowed: 2.5,
    groundCoverage: 60,
    parkingRequired: 1,
    buildingType: 'residential',
    zone: 'R1',
  });

  // Rooms
  const [selectedRooms, setSelectedRooms] = useState<
    Map<RoomType, { count: number; floor: number }>
  >(
    new Map([
      ['living', { count: 1, floor: 0 }],
      ['dining', { count: 1, floor: 0 }],
      ['kitchen', { count: 1, floor: 0 }],
      ['master_bedroom', { count: 1, floor: 1 }],
      ['bedroom', { count: 2, floor: 1 }],
      ['bathroom', { count: 2, floor: 1 }],
      ['toilet', { count: 1, floor: 0 }],
      ['staircase', { count: 1, floor: 0 }],
      ['entrance_lobby', { count: 1, floor: 0 }],
      ['balcony', { count: 1, floor: 1 }],
      ['parking', { count: 1, floor: 0 }],
    ]),
  );

  // Preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    style: 'contemporary',
    budget: 'standard',
    climate: 'hot_humid',
    orientation_priority: 'vastu',
    parking: 'covered',
    roofType: 'flat',
    naturalLighting: 'maximum',
    privacy: 'medium',
    greenFeatures: true,
    smartHome: false,
    accessibilityRequired: false,
    vastuCompliance: 'moderate',
  });

  // Location
  const [location, setLocation] = useState({
    latitude: 17.385,
    longitude: 78.4867,
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
  });

  const applySmartProfile = useCallback(
    (problemType: SmartDefaultsInput['problemType'], buildingType: QuickBuildingType) => {
      const span = clamp(plot.width, 8, 40);
      const defaults = generateSmartDefaults({
        problemType,
        span,
        height: constraints.maxHeight,
        buildingType,
        code: buildingType === 'residential' ? 'IS 456:2000' : 'Both',
        seismicZone: 'III',
        userLevel: 'beginner',
      });

      setSmartDefaults(defaults);

      const preset = ROOM_PRESETS[buildingType];
      setSelectedRooms(new Map(preset));

      const estimatedFloors = clamp(Math.round((constraints.maxHeight || 9) / 3.3), 1, 8);
      setConstraints((c) => ({
        ...c,
        maxFloors: estimatedFloors,
        buildingType: buildingType === 'residential' ? 'residential' : 'commercial',
      }));

      setPreferences((p) => ({
        ...p,
        budget: buildingType === 'residential' ? 'standard' : 'premium',
        style: buildingType === 'industrial' ? 'modern' : 'contemporary',
      }));
    },
    [constraints.maxHeight, plot.width],
  );

  useEffect(() => {
    if (!initialTemplateId || appliedTemplateId === initialTemplateId) return;

    const template = getTemplateById(initialTemplateId);
    if (!template) return;

    const inferredProblemType = inferProblemTypeFromTemplate(template.id);
    const inferredBuildingType = inferBuildingTypeFromTemplate(template.id);
    const defaults = generateSmartDefaults({
      problemType: inferredProblemType,
      span: template.plotDimensions.length,
      height: template.plotDimensions.height,
      buildingType: inferredBuildingType,
      code: inferredBuildingType === 'residential' ? 'IS 456:2000' : 'Both',
      seismicZone: 'III',
      userLevel: template.difficulty === 'BEGINNER' ? 'beginner' : 'intermediate',
    });

    setSmartDefaults(defaults);

    const suggestedWidth = clamp(Math.round((template.plotDimensions.length * 1.2) * 10) / 10, 12, 60);
    const suggestedDepth = clamp(Math.round((template.plotDimensions.length * 1.6) * 10) / 10, 14, 80);
    setPlot((p) => ({
      ...p,
      width: suggestedWidth,
      depth: suggestedDepth,
      area: suggestedWidth * suggestedDepth,
      shape: template.id.includes('arch') ? 'trapezoidal' : 'rectangular',
      unit: 'meters',
    }));

    setConstraints((c) => ({
      ...c,
      maxHeight: clamp(Math.max(template.plotDimensions.height * 2, 9), 9, 45),
      maxFloors: clamp(Math.max(Math.round(template.plotDimensions.height / 3), 2), 2, 12),
      buildingType: inferredBuildingType === 'residential' ? 'residential' : 'commercial',
    }));

    const preset = ROOM_PRESETS[inferredBuildingType];
    setSelectedRooms(new Map(preset));
    setPreferences((p) => ({
      ...p,
      style: inferredBuildingType === 'industrial' ? 'modern' : 'contemporary',
      budget: template.difficulty === 'ADVANCED' ? 'luxury' : 'premium',
      climate: 'composite',
      naturalLighting: 'balanced',
    }));

    setAppliedTemplateId(initialTemplateId);
    setStep(0);
  }, [appliedTemplateId, initialTemplateId]);

  // Helpers
  const updatePlot = useCallback((key: keyof PlotDimensions, value: unknown) => {
    setPlot((p) => {
      const updated = { ...p, [key]: value };
      if (key === 'width' || key === 'depth') {
        updated.area = (updated.width as number) * (updated.depth as number);
      }
      return updated;
    });
  }, []);

  const applyPolygonVertices = useCallback((rawText: string) => {
    const rows = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let invalidLines = 0;
    const vertices = rows
      .map((line) => {
        const [xRaw, yRaw] = line.split(',').map((v) => v.trim());
        const x = Number(xRaw);
        const y = Number(yRaw);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          invalidLines += 1;
          return null;
        }
        return { x, y };
      })
      .filter((v): v is { x: number; y: number } => !!v);

    setPolygonValidation({
      validVertices: vertices.length,
      invalidLines,
      hasEnoughVertices: vertices.length >= 3,
    });

    if (vertices.length < 3) {
      setPlot((p) => ({ ...p, irregularVertices: vertices }));
      return;
    }

    let twiceArea = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }
    const polygonArea = Math.abs(twiceArea) / 2;

    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);

    setPlot((p) => ({
      ...p,
      irregularVertices: vertices,
      width: Math.max(0.1, Math.round(width * 100) / 100),
      depth: Math.max(0.1, Math.round(depth * 100) / 100),
      area: Math.max(0.01, Math.round(polygonArea * 100) / 100),
    }));
  }, []);

  const updatePlotShape = useCallback(
    (shape: PlotDimensions['shape']) => {
      setPlot((p) => {
        if (shape === 'irregular' || shape === 'trapezoidal' || shape === 'L-shaped') {
          return p;
        }
        return { ...p, shape, irregularVertices: undefined };
      });

      if (shape === 'irregular' || shape === 'trapezoidal' || shape === 'L-shaped') {
        setPlot((p) => ({ ...p, shape }));
        applyPolygonVertices(polygonVerticesText);
      }
    },
    [applyPolygonVertices, polygonVerticesText],
  );

  const applyPolygonPreset = useCallback(
    (preset: 'rect' | 'lshape' | 'trapezoid') => {
      const textByPreset: Record<typeof preset, string> = {
        rect: '0,0\n15,0\n15,20\n0,20',
        lshape: '0,0\n14,0\n14,8\n8,8\n8,18\n0,18',
        trapezoid: '0,0\n16,0\n13,18\n3,18',
      };
      const text = textByPreset[preset];
      setPolygonVerticesText(text);
      applyPolygonVertices(text);
    },
    [applyPolygonVertices],
  );

  const toggleRoom = useCallback((type: RoomType) => {
    setSelectedRooms((prev) => {
      const next = new Map(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.set(type, { count: 1, floor: 0 });
      }
      return next;
    });
  }, []);

  const updateRoomCount = useCallback((type: RoomType, delta: number) => {
    setSelectedRooms((prev) => {
      const next = new Map(prev);
      const current = next.get(type);
      if (current) {
        const newCount = Math.max(0, current.count + delta);
        if (newCount === 0) {
          next.delete(type);
        } else {
          next.set(type, { ...current, count: newCount });
        }
      }
      return next;
    });
  }, []);

  const updateRoomFloor = useCallback((type: RoomType, floor: number) => {
    setSelectedRooms((prev) => {
      const next = new Map(prev);
      const current = next.get(type);
      if (current) next.set(type, { ...current, floor });
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const roomSpecs: RoomSpec[] = [];
    selectedRooms.forEach((config, type) => {
      for (let i = 0; i < config.count; i++) {
        roomSpecs.push(spacePlanningEngine.getDefaultRoomSpec(type, config.floor));
      }
    });

    onGenerate({
      plot,
      orientation,
      constraints,
      roomSpecs,
      preferences,
      location,
    });
  }, [plot, orientation, constraints, selectedRooms, preferences, location, onGenerate]);

  const buildableArea =
    (plot.width - constraints.setbacks.left - constraints.setbacks.right) *
    (plot.depth - constraints.setbacks.front - constraints.setbacks.rear);
  const totalRoomCount = Array.from(selectedRooms.values()).reduce((s, r) => s + r.count, 0);

  return (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {WIZARD_STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDone
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 p-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {/* Step 0: Plot Details */}
        {step === 0 && (
          <div className="space-y-4">
            {smartDefaults && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 p-3">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  Smart Defaults Applied
                </div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <div>Material: {smartDefaults.recommendedMaterial}</div>
                  <div>Deflection: {smartDefaults.deflectionLimit}</div>
                  <div>Code: {smartDefaults.primaryCode}</div>
                  <div>Template: {smartDefaults.recommendedTemplate}</div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Quick Start Profiles</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applySmartProfile('frame', 'residential')}
                  className="px-2.5 py-1 text-[10px] rounded bg-blue-600 text-white hover:bg-blue-500"
                >
                  Residential Villa
                </button>
                <button
                  type="button"
                  onClick={() => applySmartProfile('frame', 'commercial')}
                  className="px-2.5 py-1 text-[10px] rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Commercial Block
                </button>
                <button
                  type="button"
                  onClick={() => applySmartProfile('truss', 'industrial')}
                  className="px-2.5 py-1 text-[10px] rounded bg-amber-600 text-white hover:bg-amber-500"
                >
                  Industrial Shed
                </button>
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-500" /> Plot Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                label="Plot Width"
                value={plot.width}
                onChange={(v) => updatePlot('width', v)}
                suffix={plot.unit === 'meters' ? 'm' : 'ft'}
              />
              <FieldInput
                label="Plot Depth"
                value={plot.depth}
                onChange={(v) => updatePlot('depth', v)}
                suffix={plot.unit === 'meters' ? 'm' : 'ft'}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Unit:</span>
              {['meters', 'feet'].map((u) => (
                <button
                  key={u}
                  onClick={() => updatePlot('unit', u)}
                  className={`px-3 py-1 text-xs rounded ${plot.unit === u ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {u}
                </button>
              ))}
            </div>
            <FieldSelect
              label="Plot Shape"
              value={plot.shape}
              options={[
                { value: 'rectangular', label: 'Rectangular' },
                { value: 'L-shaped', label: 'L-Shaped' },
                { value: 'irregular', label: 'Irregular' },
                { value: 'trapezoidal', label: 'Trapezoidal' },
              ]}
              onChange={(v) => updatePlotShape(v as PlotDimensions['shape'])}
            />
            {(plot.shape === 'irregular' || plot.shape === 'L-shaped' || plot.shape === 'trapezoidal') && (
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 block">
                  Polygon Vertices (x,y per line; units in {plot.unit})
                </label>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => applyPolygonPreset('rect')}
                    className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Rectangle
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPolygonPreset('lshape')}
                    className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    L-Shape
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPolygonPreset('trapezoid')}
                    className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Trapezoid
                  </button>
                </div>
                <textarea
                  value={polygonVerticesText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setPolygonVerticesText(txt);
                    applyPolygonVertices(txt);
                  }}
                  className="w-full min-h-[110px] px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder={'0,0\n15,0\n15,20\n0,20'}
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Use clockwise or counter-clockwise order. Minimum 3 vertices required.
                </div>
                <div className="mt-1 text-[10px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    Parsed vertices: {polygonValidation.validVertices}
                  </span>
                  {polygonValidation.invalidLines > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      Invalid lines: {polygonValidation.invalidLines}
                    </span>
                  )}
                  {!polygonValidation.hasEnoughVertices && (
                    <span className="ml-2 text-red-600 dark:text-red-400">
                      Need at least 3 valid vertices
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                Plot Area: {plot.area.toFixed(0)} {plot.unit === 'meters' ? 'sq.m' : 'sq.ft'} (
                {(plot.area * (plot.unit === 'meters' ? 10.764 : 1)).toFixed(0)} sq.ft)
              </div>
            </div>
            {/* Setbacks */}
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-3">
              Setback Requirements
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                label="Front Setback"
                value={constraints.setbacks.front}
                onChange={(v) =>
                  setConstraints((c) => ({ ...c, setbacks: { ...c.setbacks, front: v } }))
                }
                suffix="m"
              />
              <FieldInput
                label="Rear Setback"
                value={constraints.setbacks.rear}
                onChange={(v) =>
                  setConstraints((c) => ({ ...c, setbacks: { ...c.setbacks, rear: v } }))
                }
                suffix="m"
              />
              <FieldInput
                label="Left Setback"
                value={constraints.setbacks.left}
                onChange={(v) =>
                  setConstraints((c) => ({ ...c, setbacks: { ...c.setbacks, left: v } }))
                }
                suffix="m"
              />
              <FieldInput
                label="Right Setback"
                value={constraints.setbacks.right}
                onChange={(v) =>
                  setConstraints((c) => ({ ...c, setbacks: { ...c.setbacks, right: v } }))
                }
                suffix="m"
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Buildable area: {buildableArea.toFixed(1)} sq.m
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <FieldInput
                label="Max Height"
                value={constraints.maxHeight}
                onChange={(v) => setConstraints((c) => ({ ...c, maxHeight: v }))}
                suffix="m"
              />
              <FieldInput
                label="Max Floors"
                value={constraints.maxFloors}
                onChange={(v) => setConstraints((c) => ({ ...c, maxFloors: v }))}
                suffix=""
              />
              <FieldInput
                label="FAR Allowed"
                value={constraints.farAllowed}
                onChange={(v) => setConstraints((c) => ({ ...c, farAllowed: v }))}
                suffix=""
              />
              <FieldInput
                label="Ground Coverage"
                value={constraints.groundCoverage}
                onChange={(v) => setConstraints((c) => ({ ...c, groundCoverage: v }))}
                suffix="%"
              />
            </div>
          </div>
        )}

        {/* Step 1: Orientation */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-500" /> Site Orientation & Direction
            </h3>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Plot Facing Direction</label>
              <div className="grid grid-cols-4 gap-1.5">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setOrientation((o) => ({ ...o, plotFacing: d }))}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      orientation.plotFacing === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Main Entry Direction</label>
              <div className="grid grid-cols-4 gap-1.5">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setOrientation((o) => ({ ...o, mainEntryDirection: d }))}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      orientation.mainEntryDirection === d
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {!['N', 'E', 'NE'].includes(orientation.mainEntryDirection) && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠ Vastu recommends N, E, or NE for main entrance
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Road Side(s)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setOrientation((o) => ({
                        ...o,
                        roadSide: o.roadSide.includes(d)
                          ? o.roadSide.filter((r) => r !== d)
                          : [...o.roadSide, d],
                      }));
                    }}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      orientation.roadSide.includes(d)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <FieldInput
              label="North Direction Angle"
              value={orientation.northDirection}
              onChange={(v) => setOrientation((o) => ({ ...o, northDirection: v }))}
              suffix="°"
            />
          </div>
        )}

        {/* Step 2: Room Program */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-500" /> Room Program
              </h3>
              <span className="text-xs text-slate-400">{totalRoomCount} rooms selected</span>
            </div>
            {ROOM_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {cat.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {cat.types.map((type) => {
                    const selected = selectedRooms.get(type);
                    const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                    return (
                      <div
                        key={type}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors ${
                          selected
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                        }`}
                      >
                        <button
                          onClick={() => toggleRoom(type)}
                          className="flex-1 text-left text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          {label}
                        </button>
                        {selected && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selected.floor}
                              onChange={(e) => updateRoomFloor(type, Number(e.target.value))}
                              className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5"
                              title="Floor"
                            >
                              <option value={-1}>Bsmt</option>
                              <option value={0}>GF</option>
                              <option value={1}>F1</option>
                              <option value={2}>F2</option>
                            </select>
                            <button
                              onClick={() => updateRoomCount(type, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 w-4 text-center">
                              {selected.count}
                            </span>
                            <button
                              onClick={() => updateRoomCount(type, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-500" /> Design Preferences
            </h3>
            <FieldSelect
              label="Architectural Style"
              value={preferences.style}
              options={[
                { value: 'modern', label: 'Modern' },
                { value: 'traditional', label: 'Traditional' },
                { value: 'contemporary', label: 'Contemporary' },
                { value: 'minimalist', label: 'Minimalist' },
                { value: 'classical', label: 'Classical' },
                { value: 'indo_western', label: 'Indo-Western' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({ ...p, style: v as UserPreferences['style'] }))
              }
            />
            <FieldSelect
              label="Budget Category"
              value={preferences.budget}
              options={[
                { value: 'economy', label: 'Economy' },
                { value: 'standard', label: 'Standard' },
                { value: 'premium', label: 'Premium' },
                { value: 'luxury', label: 'Luxury' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({ ...p, budget: v as UserPreferences['budget'] }))
              }
            />
            <FieldSelect
              label="Climate Zone"
              value={preferences.climate}
              options={[
                { value: 'hot_dry', label: 'Hot & Dry' },
                { value: 'hot_humid', label: 'Hot & Humid' },
                { value: 'composite', label: 'Composite' },
                { value: 'cold', label: 'Cold' },
                { value: 'temperate', label: 'Temperate' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({ ...p, climate: v as UserPreferences['climate'] }))
              }
            />
            <FieldSelect
              label="Vastu Compliance"
              value={preferences.vastuCompliance}
              options={[
                { value: 'strict', label: 'Strict — All rules enforced' },
                { value: 'moderate', label: 'Moderate — Major rules only' },
                { value: 'optional', label: 'Optional — Best effort' },
                { value: 'none', label: 'None — Ignore Vastu' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({
                  ...p,
                  vastuCompliance: v as UserPreferences['vastuCompliance'],
                }))
              }
            />
            <FieldSelect
              label="Roof Type"
              value={preferences.roofType}
              options={[
                { value: 'flat', label: 'Flat (RCC)' },
                { value: 'sloped', label: 'Sloped' },
                { value: 'hip', label: 'Hip Roof' },
                { value: 'gable', label: 'Gable Roof' },
                { value: 'butterfly', label: 'Butterfly' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({ ...p, roofType: v as UserPreferences['roofType'] }))
              }
            />
            <FieldSelect
              label="Parking Type"
              value={preferences.parking}
              options={[
                { value: 'covered', label: 'Covered Parking' },
                { value: 'open', label: 'Open Parking' },
                { value: 'basement', label: 'Basement Parking' },
                { value: 'stilt', label: 'Stilt Parking' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({ ...p, parking: v as UserPreferences['parking'] }))
              }
            />
            <FieldSelect
              label="Natural Lighting"
              value={preferences.naturalLighting}
              options={[
                { value: 'maximum', label: 'Maximum — Large windows' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'minimal', label: 'Minimal — Privacy priority' },
              ]}
              onChange={(v) =>
                setPreferences((p) => ({
                  ...p,
                  naturalLighting: v as UserPreferences['naturalLighting'],
                }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <ToggleField
                label="Green Features"
                checked={preferences.greenFeatures}
                onChange={(v) => setPreferences((p) => ({ ...p, greenFeatures: v }))}
              />
              <ToggleField
                label="Smart Home"
                checked={preferences.smartHome}
                onChange={(v) => setPreferences((p) => ({ ...p, smartHome: v }))}
              />
              <ToggleField
                label="Accessibility"
                checked={preferences.accessibilityRequired}
                onChange={(v) => setPreferences((p) => ({ ...p, accessibilityRequired: v }))}
              />
            </div>
          </div>
        )}

        {/* Step 4: MEP Requirements */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> MEP Requirements
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Electrical
              </div>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80">
                Electrical layout will be auto-generated based on room program: light points, fan
                points, power sockets, AC points, switch boards, distribution board, earthing, and
                circuit grouping per NBC norms.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-green-700 dark:text-green-400">
                Plumbing
              </div>
              <p className="text-[10px] text-green-600/80 dark:text-green-400/80">
                Water supply (cold + hot), drainage, vent pipes, rain water harvesting, overhead
                tank, sump, wash basins, WC, shower, kitchen sink — all auto-planned based on
                bathroom/kitchen layout.
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                HVAC / Ventilation
              </div>
              <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
                Split AC sizing per room, ceiling fans, exhaust fans for kitchen/bath, cross
                ventilation analysis, chimney for kitchen — calculated from room areas and climate
                zone.
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Fire Safety
              </div>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                Smoke detectors, fire extinguisher locations, emergency lighting, and escape route
                planning will be included if building exceeds 2 floors.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Location */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" /> Location (for Sunlight Analysis)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                label="Latitude"
                value={location.latitude}
                onChange={(v) => setLocation((l) => ({ ...l, latitude: v }))}
                suffix="°"
                step={0.01}
              />
              <FieldInput
                label="Longitude"
                value={location.longitude}
                onChange={(v) => setLocation((l) => ({ ...l, longitude: v }))}
                suffix="°"
                step={0.01}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldTextInput
                label="City"
                value={location.city}
                onChange={(v) => setLocation((l) => ({ ...l, city: v }))}
              />
              <FieldTextInput
                label="State"
                value={location.state}
                onChange={(v) => setLocation((l) => ({ ...l, state: v }))}
              />
            </div>
            <FieldTextInput
              label="Country"
              value={location.country}
              onChange={(v) => setLocation((l) => ({ ...l, country: v }))}
            />
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Pre-set Locations</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { city: 'Mumbai', lat: 19.076, lng: 72.8777, state: 'Maharashtra' },
                  { city: 'Delhi', lat: 28.6139, lng: 77.209, state: 'Delhi' },
                  { city: 'Bangalore', lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
                  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, state: 'Telangana' },
                  { city: 'Chennai', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
                  { city: 'Kolkata', lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
                ].map((loc) => (
                  <button
                    key={loc.city}
                    onClick={() =>
                      setLocation({
                        ...loc,
                        latitude: loc.lat,
                        longitude: loc.lng,
                        country: 'India',
                      })
                    }
                    className={`px-2 py-1 text-[10px] rounded ${location.city === loc.city ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {loc.city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Review & Generate */}
        {step === 6 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Review & Generate Plan
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <ReviewCard
                label="Plot"
                value={`${plot.width}m × ${plot.depth}m (${plot.area.toFixed(0)} sq.m)`}
              />
              <ReviewCard
                label="Facing"
                value={`${orientation.plotFacing} | Entry: ${orientation.mainEntryDirection}`}
              />
              <ReviewCard label="Buildable" value={`${buildableArea.toFixed(1)} sq.m`} />
              <ReviewCard label="Rooms" value={`${totalRoomCount} rooms`} />
              <ReviewCard label="Style" value={preferences.style.replace(/_/g, ' ')} />
              <ReviewCard label="Budget" value={preferences.budget} />
              <ReviewCard label="Vastu" value={preferences.vastuCompliance} />
              <ReviewCard label="Location" value={`${location.city}, ${location.state}`} />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Selected Rooms</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedRooms.entries()).map(([type, config]) => (
                  <span
                    key={type}
                    className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] rounded-full"
                  >
                    {type.replace(/_/g, ' ')} ×{config.count} (F{config.floor})
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
              <Building2 className="w-4 h-4 inline mr-1" />
              The engine will generate: Floor plans, Structural layout (columns, beams,
              foundations), Electrical plan, Plumbing plan, HVAC plan, Vastu analysis, Sunlight
              study, Airflow analysis, 4 Elevation views, 2 Cross-sections, Color schemes, and
              material recommendations.
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || totalRoomCount === 0}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Complete Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Complete House Plan
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <span className="text-[10px] text-slate-400">
          Step {step + 1} of {WIZARD_STEPS.length}
        </span>
        <button
          onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
          disabled={step >= WIZARD_STEPS.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-30"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

const FieldInput: FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
}> = ({ label, value, onChange, suffix, step = 0.5 }) => (
  <div>
    <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 block">{label}</label>
    <div className="flex items-center">
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      {suffix && <span className="ml-1.5 text-[10px] text-slate-400 min-w-[16px]">{suffix}</span>}
    </div>
  </div>
);

const FieldTextInput: FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 block">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const FieldSelect: FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 block">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const ToggleField: FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      checked
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
    }`}
  >
    <span
      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${checked ? 'border-green-500 bg-green-500' : 'border-slate-300'}`}
    >
      {checked && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
    </span>
    {label}
  </button>
);

const ReviewCard: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
      {value}
    </div>
  </div>
);

export default RoomConfigWizard;
