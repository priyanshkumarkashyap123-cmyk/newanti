/**
 * ============================================================================
 * CONNECTION DESIGN WIZARD (RADIX/TAILWIND VERSION)
 * ============================================================================
 * 
 * Step-by-step guided interface for designing common bolted connections
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.1
 */

import React, { useState, useCallback, useMemo, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Grid3x3,
  Package,
  Zap,
  Ruler,
  FileCheck,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';
import {
  BoltGrade,
  BoltHoleType,
  BoltBehavior,
  ConnectionType,
  LoadingType,
  DesignCode,
  DesignMethod,
  SteelGrade,
  ConnectionFormData,
} from '../types/BoltedConnectionTypes';

// ============================================================================
// INTERFACES
// ============================================================================

interface WizardStep {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface ConnectionTemplate {
  id: string;
  name: string;
  description: string;
  type: 'SHEAR' | 'MOMENT';
  complexity: 'Simple' | 'Standard' | 'Complex';
  boltRows: number;
  boltColumns: number;
}

interface WizardState {
  template: ConnectionTemplate | null;
  designCode: DesignCode;
  designMethod: DesignMethod;
  shearVertical: number;
  axial: number;
  moment: number;
  boltGrade: BoltGrade;
  boltDiameter: number;
  holeType: BoltHoleType;
  plateThickness: number;
  steelGrade: SteelGrade;
  boltRows: number;
  boltColumns: number;
  rowSpacing: number;
  colSpacing: number;
}

interface ConnectionDesignWizardProps {
  onComplete: (connection: ConnectionFormData) => void;
  onCancel: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WIZARD_STEPS: WizardStep[] = [
  { id: 'template', title: 'Connection Type', icon: <Grid3x3 className="w-4 h-4" /> },
  { id: 'loads', title: 'Design Loads', icon: <Zap className="w-4 h-4" /> },
  { id: 'materials', title: 'Materials', icon: <Package className="w-4 h-4" /> },
  { id: 'geometry', title: 'Geometry', icon: <Ruler className="w-4 h-4" /> },
  { id: 'review', title: 'Review', icon: <FileCheck className="w-4 h-4" /> },
];

const CONNECTION_TEMPLATES: ConnectionTemplate[] = [
  {
    id: 'simple-shear',
    name: 'Simple Shear Tab',
    description: 'Single plate connection for beam-to-column',
    type: 'SHEAR',
    complexity: 'Simple',
    boltRows: 3,
    boltColumns: 1,
  },
  {
    id: 'double-angle',
    name: 'Double Angle',
    description: 'Two angles connecting beam web to column',
    type: 'SHEAR',
    complexity: 'Simple',
    boltRows: 3,
    boltColumns: 2,
  },
  {
    id: 'end-plate',
    name: 'End Plate Moment',
    description: 'Welded end plate bolted to column',
    type: 'MOMENT',
    complexity: 'Standard',
    boltRows: 4,
    boltColumns: 2,
  },
  {
    id: 'extended-end-plate',
    name: 'Extended End Plate',
    description: 'End plate extending beyond flanges',
    type: 'MOMENT',
    complexity: 'Complex',
    boltRows: 6,
    boltColumns: 2,
  },
];

const INITIAL_STATE: WizardState = {
  template: null,
  designCode: DesignCode.AISC_360_22,
  designMethod: 'LRFD',
  shearVertical: 100,
  axial: 0,
  moment: 0,
  boltGrade: BoltGrade.ASTM_A325,
  boltDiameter: 20,
  holeType: BoltHoleType.STANDARD,
  plateThickness: 12,
  steelGrade: SteelGrade.A36,
  boltRows: 3,
  boltColumns: 2,
  rowSpacing: 75,
  colSpacing: 75,
};

// ============================================================================
// STEP COMPONENTS
// ============================================================================

const StepTemplate: React.FC<{
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}> = ({ state, onChange }) => {
  const complexityColors = {
    Simple: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    Standard: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    Complex: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Select Connection Type</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template that matches your requirements
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {CONNECTION_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all ${
              state.template?.id === template.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'hover:border-primary/50'
            }`}
            onClick={() => onChange({
              template,
              boltRows: template.boltRows,
              boltColumns: template.boltColumns,
            })}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                </div>
                {state.template?.id === template.id && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-zinc-900 dark:text-white" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">{template.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${complexityColors[template.complexity]}`}>
                  {template.complexity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{template.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Default: {template.boltRows}×{template.boltColumns} bolts
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="w-48">
          <Label className="text-xs">Design Code</Label>
          <Select
            value={state.designCode}
            onValueChange={(value: string) => onChange({ designCode: value as DesignCode })}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DesignCode.AISC_360_22}>AISC 360-22</SelectItem>
              <SelectItem value={DesignCode.EUROCODE_3}>Eurocode 3</SelectItem>
              <SelectItem value={DesignCode.IS_800_2007}>IS 800:2007</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label className="text-xs">Method</Label>
          <Select
            value={state.designMethod}
            onValueChange={(value: string) => onChange({ designMethod: value as DesignMethod })}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LRFD">LRFD</SelectItem>
              <SelectItem value="ASD">ASD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

const StepLoads: React.FC<{
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}> = ({ state, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Enter Design Loads</h3>
        <p className="text-sm text-muted-foreground">
          {state.designMethod === 'LRFD'
            ? 'Enter factored loads (LRFD combinations)'
            : 'Enter service loads (ASD combinations)'}
        </p>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Sign convention: Positive axial = tension, Positive shear = downward
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Vertical Shear (kN)</Label>
            <Input
              type="number"
              value={state.shearVertical}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                onChange({ shearVertical: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Axial Force (kN)</Label>
            <Input
              type="number"
              value={state.axial}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                onChange({ axial: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">+ = tension, - = compression</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">In-Plane Moment (kN·m)</Label>
            <Input
              type="number"
              value={state.moment}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                onChange({ moment: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Load Summary</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-muted-foreground">Resultant Shear:</span>
              <span className="font-medium">{state.shearVertical.toFixed(1)} kN</span>
              <span className="text-muted-foreground">Has Moment:</span>
              <span className="font-medium">{state.moment !== 0 ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepMaterials: React.FC<{
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}> = ({ state, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Material Properties</h3>
        <p className="text-sm text-muted-foreground">
          Select bolt grade and plate material
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <h4 className="font-semibold text-sm">Bolt Properties</h4>
          
          <div className="space-y-2">
            <Label className="text-xs">Bolt Grade</Label>
            <Select
              value={state.boltGrade}
              onValueChange={(value: string) => onChange({ boltGrade: value as BoltGrade })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BoltGrade.ASTM_A307}>A307 (Fu=414 MPa)</SelectItem>
                <SelectItem value={BoltGrade.ASTM_A325}>A325 (Fu=830 MPa)</SelectItem>
                <SelectItem value={BoltGrade.ASTM_A490}>A490 (Fu=1040 MPa)</SelectItem>
                <SelectItem value={BoltGrade.ISO_8_8}>ISO 8.8 (Fu=800 MPa)</SelectItem>
                <SelectItem value={BoltGrade.ISO_10_9}>ISO 10.9 (Fu=1000 MPa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Bolt Diameter</Label>
            <Select
              value={state.boltDiameter.toString()}
              onValueChange={(value: string) => onChange({ boltDiameter: parseInt(value) })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">M12</SelectItem>
                <SelectItem value="16">M16</SelectItem>
                <SelectItem value="20">M20</SelectItem>
                <SelectItem value="24">M24</SelectItem>
                <SelectItem value="27">M27</SelectItem>
                <SelectItem value="30">M30</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Hole Type</Label>
            <Select
              value={state.holeType}
              onValueChange={(value: string) => onChange({ holeType: value as BoltHoleType })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BoltHoleType.STANDARD}>Standard</SelectItem>
                <SelectItem value={BoltHoleType.OVERSIZED}>Oversize</SelectItem>
                <SelectItem value={BoltHoleType.SHORT_SLOTTED}>Short Slotted</SelectItem>
                <SelectItem value={BoltHoleType.LONG_SLOTTED}>Long Slotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <h4 className="font-semibold text-sm">Plate Properties</h4>
          
          <div className="space-y-2">
            <Label className="text-xs">Steel Grade</Label>
            <Select
              value={state.steelGrade}
              onValueChange={(value: string) => onChange({ steelGrade: value as SteelGrade })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SteelGrade.A36}>A36 (Fy=250 MPa)</SelectItem>
                <SelectItem value={SteelGrade.A572_50}>A572 Gr.50 (Fy=345 MPa)</SelectItem>
                <SelectItem value={SteelGrade.A992}>A992 (Fy=345 MPa)</SelectItem>
                <SelectItem value={SteelGrade.S235}>S235 (Fy=235 MPa)</SelectItem>
                <SelectItem value={SteelGrade.S355}>S355 (Fy=355 MPa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Plate Thickness (mm)</Label>
            <Input
              type="number"
              min={6}
              max={100}
              value={state.plateThickness}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                onChange({ plateThickness: parseInt(e.target.value) || 12 })}
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StepGeometry: React.FC<{
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}> = ({ state, onChange }) => {
  const edgeDistance = 35;
  const plateWidth = edgeDistance * 2 + (state.boltColumns - 1) * state.colSpacing;
  const plateHeight = edgeDistance * 2 + (state.boltRows - 1) * state.rowSpacing;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Connection Geometry</h3>
        <p className="text-sm text-muted-foreground">
          Define bolt pattern and spacing
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <h4 className="font-semibold text-sm">Bolt Pattern</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={state.boltRows}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    onChange({ boltRows: parseInt(e.target.value) || 1 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={state.boltColumns}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    onChange({ boltColumns: parseInt(e.target.value) || 1 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Row Spacing (mm)</Label>
                <Input
                  type="number"
                  min={50}
                  max={200}
                  value={state.rowSpacing}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    onChange({ rowSpacing: parseInt(e.target.value) || 75 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Col Spacing (mm)</Label>
                <Input
                  type="number"
                  min={50}
                  max={200}
                  value={state.colSpacing}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    onChange({ colSpacing: parseInt(e.target.value) || 75 })}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-xs">
            <p className="font-medium mb-2">Calculated Plate Size</p>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Width:</span>
              <span className="font-medium">{plateWidth} mm</span>
              <span className="text-muted-foreground">Height:</span>
              <span className="font-medium">{plateHeight} mm</span>
              <span className="text-muted-foreground">Total Bolts:</span>
              <span className="font-medium">{state.boltRows * state.boltColumns}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-sm mb-3">Pattern Preview</h4>
          <svg
            viewBox={`0 0 ${plateWidth + 20} ${plateHeight + 20}`}
            className="w-full h-48 bg-background rounded border"
          >
            <rect
              x={10}
              y={10}
              width={plateWidth}
              height={plateHeight}
              fill="#E5E7EB"
              stroke="#6B7280"
              strokeWidth="2"
            />
            {Array.from({ length: state.boltRows }).map((_, row) =>
              Array.from({ length: state.boltColumns }).map((_, col) => (
                <circle
                  key={`${row}-${col}`}
                  cx={10 + edgeDistance + col * state.colSpacing}
                  cy={10 + edgeDistance + row * state.rowSpacing}
                  r={state.boltDiameter / 2}
                  fill="white"
                  stroke="#3B82F6"
                  strokeWidth="2"
                />
              ))
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

const StepReview: React.FC<{
  state: WizardState;
}> = ({ state }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Review Connection</h3>
        <p className="text-sm text-muted-foreground">
          Verify all parameters before creating
        </p>
      </div>

      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          Ready to create connection
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Grid3x3 className="w-4 h-4" />
            <h4 className="font-semibold text-sm">Connection</h4>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Template:</span>
              <span className="font-medium">{state.template?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code:</span>
              <span className="font-medium">{state.designCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method:</span>
              <span className="font-medium">{state.designMethod}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" />
            <h4 className="font-semibold text-sm">Loads</h4>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shear:</span>
              <span className="font-medium">{state.shearVertical} kN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Axial:</span>
              <span className="font-medium">{state.axial} kN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moment:</span>
              <span className="font-medium">{state.moment} kN·m</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" />
            <h4 className="font-semibold text-sm">Materials</h4>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bolt:</span>
              <span className="font-medium">{state.boltGrade} M{state.boltDiameter}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Steel:</span>
              <span className="font-medium">{state.steelGrade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pattern:</span>
              <span className="font-medium">{state.boltRows}×{state.boltColumns}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConnectionDesignWizard: React.FC<ConnectionDesignWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return state.template !== null;
      case 1: return state.shearVertical !== 0 || state.axial !== 0;
      case 2: return state.boltDiameter > 0;
      case 3: return state.boltRows > 0 && state.boltColumns > 0;
      case 4: return true;
      default: return false;
    }
  }, [currentStep, state]);

  const handleComplete = () => {
    const edgeDistance = 35;
    const plateWidth = edgeDistance * 2 + (state.boltColumns - 1) * state.colSpacing;
    const plateHeight = edgeDistance * 2 + (state.boltRows - 1) * state.rowSpacing;

    // Map template type to proper ConnectionType
    const connectionType = state.template?.type === 'SHEAR' 
      ? ConnectionType.SINGLE_PLATE_SHEAR 
      : state.template?.type === 'MOMENT'
      ? ConnectionType.EXTENDED_END_PLATE
      : ConnectionType.SINGLE_PLATE_SHEAR;

    const connection: ConnectionFormData = {
      name: `${state.template?.name || 'Custom'} Connection`,
      description: state.template?.description || '',
      connectionType,
      loadingType: state.moment > 0 ? LoadingType.MOMENT_AND_SHEAR : LoadingType.SHEAR_ONLY,
      designCode: state.designCode,
      designMethod: state.designMethod,
      geometry: {
        plateWidth,
        plateHeight,
        plateThickness: state.plateThickness,
        numRows: state.boltRows,
        numColumns: state.boltColumns,
        pitchVertical: state.rowSpacing,
        pitchHorizontal: state.colSpacing,
        edgeDistanceTop: edgeDistance,
        edgeDistanceBottom: edgeDistance,
        edgeDistanceLeft: edgeDistance,
        edgeDistanceRight: edgeDistance,
      },
      bolt: {
        diameter: state.boltDiameter,
        grade: state.boltGrade,
        holeType: state.holeType,
        behavior: BoltBehavior.BEARING_TYPE_N,
      },
      plate: {
        grade: state.steelGrade,
        thickness: state.plateThickness,
      },
      loads: {
        shearX: 0,
        shearY: state.shearVertical,
        axial: state.axial,
        momentX: 0,
        momentY: state.moment,
      },
    };

    onComplete(connection);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepTemplate state={state} onChange={updateState} />;
      case 1: return <StepLoads state={state} onChange={updateState} />;
      case 2: return <StepMaterials state={state} onChange={updateState} />;
      case 3: return <StepGeometry state={state} onChange={updateState} />;
      case 4: return <StepReview state={state} />;
      default: return null;
    }
  };

  return (
    <Card className="min-h-[600px] flex flex-col">
      {/* Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Connection Design Wizard</CardTitle>
              <CardDescription>Step-by-step guided design</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {WIZARD_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  index === currentStep
                    ? 'bg-primary text-zinc-900 dark:text-white'
                    : index < currentStep
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-muted text-muted-foreground'
                } ${index <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                {index < currentStep ? <Check className="w-3 h-3" /> : step.icon}
                {step.title}
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${index < currentStep ? 'bg-green-500' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 p-6 overflow-auto">
        {renderStep()}
      </CardContent>

      {/* Footer */}
      <div className="border-t p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep((prev) => prev - 1)}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Step {currentStep + 1} of {WIZARD_STEPS.length}
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button onClick={() => setCurrentStep((prev) => prev + 1)} disabled={!canProceed}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
            <Check className="w-4 h-4 mr-2" />
            Create Connection
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ConnectionDesignWizard;
