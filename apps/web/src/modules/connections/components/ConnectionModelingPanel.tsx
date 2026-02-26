/**
 * ============================================================================
 * CONNECTION MODELING PANEL
 * ============================================================================
 * 
 * Professional connection modeling interface using Radix/Tailwind UI
 * Uses ConnectionFormData for simplified form binding
 * 
 * @author BeamLab Engineering Team
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo, useEffect, ChangeEvent } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Grid3x3,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ConnectionFormData,
  BoltGrade,
  BoltHoleType,
  BoltBehavior,
  ConnectionType,
  LoadingType,
  DesignCode,
  DesignMethod,
  SteelGrade,
  BoltPosition,
} from '../types/BoltedConnectionTypes';

// ============================================================================
// INTERFACES
// ============================================================================

interface ConnectionModelingPanelProps {
  connection: ConnectionFormData;
  onChange: (updates: Partial<ConnectionFormData>) => void;
  onAnalyze?: () => void;
}

// ============================================================================
// BOLT PATTERN EDITOR
// ============================================================================

const BoltPatternEditor: React.FC<{
  positions: BoltPosition[];
  selectedBolt: string | null;
  onSelectBolt: (id: string | null) => void;
  width: number;
  height: number;
  boltDiameter: number;
}> = ({ positions, selectedBolt, onSelectBolt, width, height, boltDiameter }) => {
  const scale = Math.min(280 / Math.max(width, 100), 200 / Math.max(height, 100)) * 0.8;
  const offsetX = (300 - width * scale) / 2;
  const offsetY = (220 - height * scale) / 2;

  return (
    <svg
      width="100%"
      height="220"
      viewBox="0 0 300 220"
      className="bg-muted/30 rounded-lg border"
    >
      {/* Plate outline */}
      <rect
        x={offsetX}
        y={offsetY}
        width={width * scale}
        height={height * scale}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {/* Grid lines */}
      {positions.length > 0 && (
        <>
          {/* Vertical lines */}
          {Array.from(new Set(positions.map(p => p.x))).map((x, i) => (
            <line
              key={`v-${i}`}
              x1={offsetX + x * scale}
              y1={offsetY}
              x2={offsetX + x * scale}
              y2={offsetY + height * scale}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="4 4"
              className="text-muted-foreground/30"
            />
          ))}
          {/* Horizontal lines */}
          {Array.from(new Set(positions.map(p => p.y))).map((y, i) => (
            <line
              key={`h-${i}`}
              x1={offsetX}
              y1={offsetY + y * scale}
              x2={offsetX + width * scale}
              y2={offsetY + y * scale}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="4 4"
              className="text-muted-foreground/30"
            />
          ))}
        </>
      )}

      {/* Bolt holes */}
      {positions.map((pos) => (
        <g
          key={pos.id}
          onClick={() => onSelectBolt(selectedBolt === pos.id ? null : pos.id)}
          className="cursor-pointer"
        >
          <circle
            cx={offsetX + pos.x * scale}
            cy={offsetY + pos.y * scale}
            r={boltDiameter * scale / 2 + 2}
            fill={selectedBolt === pos.id ? '#3B82F6' : '#E5E7EB'}
            stroke={selectedBolt === pos.id ? '#1D4ED8' : '#9CA3AF'}
            strokeWidth="2"
          />
          <text
            x={offsetX + pos.x * scale}
            y={offsetY + pos.y * scale + 3}
            textAnchor="middle"
            fontSize="10"
            fill={selectedBolt === pos.id ? 'white' : '#374151'}
          >
            {pos.id.replace('B', '')}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConnectionModelingPanel: React.FC<ConnectionModelingPanelProps> = ({
  connection,
  onChange,
  onAnalyze,
}) => {
  const [selectedBolt, setSelectedBolt] = useState<string | null>(null);
  
  // Destructure geometry for easier access
  const { geometry, bolt, plate, loads } = connection;

  // Calculate bolt positions from geometry
  const boltPositions = useMemo((): BoltPosition[] => {
    const positions: BoltPosition[] = [];
    for (let row = 0; row < geometry.numRows; row++) {
      for (let col = 0; col < geometry.numColumns; col++) {
        const x = geometry.edgeDistanceLeft + col * geometry.pitchHorizontal;
        const y = geometry.edgeDistanceTop + row * geometry.pitchVertical;
        positions.push({
          id: `B${row * geometry.numColumns + col + 1}`,
          row: row + 1,
          column: col + 1,
          x,
          y,
          edgeDistanceHorizontal: Math.min(
            geometry.edgeDistanceLeft + col * geometry.pitchHorizontal,
            geometry.plateWidth - x
          ),
          edgeDistanceVertical: Math.min(
            geometry.edgeDistanceTop + row * geometry.pitchVertical,
            geometry.plateHeight - y
          ),
          isActive: true,
        });
      }
    }
    return positions;
  }, [geometry]);

  // Calculate plate dimensions from geometry
  const plateWidth = useMemo(() => 
    geometry.edgeDistanceLeft + 
    geometry.edgeDistanceRight + 
    (geometry.numColumns - 1) * geometry.pitchHorizontal,
    [geometry]
  );
  
  const plateHeight = useMemo(() => 
    geometry.edgeDistanceTop + 
    geometry.edgeDistanceBottom + 
    (geometry.numRows - 1) * geometry.pitchVertical,
    [geometry]
  );

  // Capacity estimate (simplified)
  const capacityEstimate = useMemo(() => {
    const totalBolts = geometry.numRows * geometry.numColumns;
    // Simplified capacity based on bolt diameter
    const boltCapacity = bolt.diameter <= 16 ? 50 : bolt.diameter <= 20 ? 75 : 100;
    return totalBolts * boltCapacity;
  }, [geometry.numRows, geometry.numColumns, bolt.diameter]);

  // Update plate dimensions when geometry changes
  useEffect(() => {
    if (geometry.plateWidth !== plateWidth || geometry.plateHeight !== plateHeight) {
      onChange({
        geometry: {
          ...geometry,
          plateWidth,
          plateHeight,
        },
      });
    }
  }, [plateWidth, plateHeight, geometry, onChange]);

  // Calculate utilization
  const totalShear = Math.sqrt(loads.shearX ** 2 + loads.shearY ** 2);
  const utilizationPercent = (totalShear / capacityEstimate) * 100;

  // Helper to update geometry
  const updateGeometry = useCallback((updates: Partial<typeof geometry>) => {
    onChange({
      geometry: { ...geometry, ...updates },
    });
  }, [geometry, onChange]);

  // Helper to update bolt
  const updateBolt = useCallback((updates: Partial<typeof bolt>) => {
    onChange({
      bolt: { ...bolt, ...updates },
    });
  }, [bolt, onChange]);

  // Helper to update plate
  const updatePlate = useCallback((updates: Partial<typeof plate>) => {
    onChange({
      plate: { ...plate, ...updates },
    });
  }, [plate, onChange]);

  // Helper to update loads
  const updateLoads = useCallback((updates: Partial<typeof loads>) => {
    onChange({
      loads: { ...loads, ...updates },
    });
  }, [loads, onChange]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Grid3x3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{connection.name || 'New Connection'}</h2>
            <p className="text-xs text-muted-foreground">
              {connection.connectionType.replace(/_/g, ' ')} Connection
            </p>
          </div>
        </div>
        <Badge 
          variant={utilizationPercent > 100 ? 'destructive' : utilizationPercent > 80 ? 'secondary' : 'default'}
        >
          {utilizationPercent.toFixed(0)}% Util
        </Badge>
      </div>

      {/* Pattern Preview */}
      <div className="p-4 border-b">
        <BoltPatternEditor
          positions={boltPositions}
          selectedBolt={selectedBolt}
          onSelectBolt={setSelectedBolt}
          width={plateWidth}
          height={plateHeight}
          boltDiameter={bolt.diameter}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Plate: {plateWidth.toFixed(0)} × {plateHeight.toFixed(0)} mm</span>
          <span>{geometry.numRows * geometry.numColumns} bolts</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geometry" className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-4 p-1">
          <TabsTrigger value="geometry" className="text-xs">Geometry</TabsTrigger>
          <TabsTrigger value="bolts" className="text-xs">Bolts</TabsTrigger>
          <TabsTrigger value="loads" className="text-xs">Loads</TabsTrigger>
          <TabsTrigger value="options" className="text-xs">Options</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          {/* Geometry Tab */}
          <TabsContent value="geometry" className="p-4 space-y-4 m-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={geometry.numRows}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ numRows: parseInt(e.target.value) || 1 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={geometry.numColumns}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ numColumns: parseInt(e.target.value) || 1 })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Row Spacing (mm)</Label>
                <Input
                  type="number"
                  min={50}
                  max={200}
                  value={geometry.pitchVertical}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ pitchVertical: parseInt(e.target.value) || 75 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Column Spacing (mm)</Label>
                <Input
                  type="number"
                  min={50}
                  max={200}
                  value={geometry.pitchHorizontal}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ pitchHorizontal: parseInt(e.target.value) || 75 })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Edge Distance Top (mm)</Label>
                <Input
                  type="number"
                  min={25}
                  max={100}
                  value={geometry.edgeDistanceTop}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ edgeDistanceTop: parseInt(e.target.value) || 35 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Edge Distance Bottom (mm)</Label>
                <Input
                  type="number"
                  min={25}
                  max={100}
                  value={geometry.edgeDistanceBottom}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ edgeDistanceBottom: parseInt(e.target.value) || 35 })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Edge Distance Left (mm)</Label>
                <Input
                  type="number"
                  min={25}
                  max={100}
                  value={geometry.edgeDistanceLeft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ edgeDistanceLeft: parseInt(e.target.value) || 35 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Edge Distance Right (mm)</Label>
                <Input
                  type="number"
                  min={25}
                  max={100}
                  value={geometry.edgeDistanceRight}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateGeometry({ edgeDistanceRight: parseInt(e.target.value) || 35 })
                  }
                  className="h-9"
                />
              </div>
            </div>
          </TabsContent>

          {/* Bolts Tab */}
          <TabsContent value="bolts" className="p-4 space-y-4 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Bolt Grade</Label>
              <Select
                value={bolt.grade}
                onValueChange={(value: BoltGrade) => updateBolt({ grade: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BoltGrade.ASTM_A307}>A307 (Low Strength)</SelectItem>
                  <SelectItem value={BoltGrade.ASTM_A325}>A325 (High Strength)</SelectItem>
                  <SelectItem value={BoltGrade.ASTM_A490}>A490 (High Strength)</SelectItem>
                  <SelectItem value={BoltGrade.ISO_8_8}>ISO 8.8</SelectItem>
                  <SelectItem value={BoltGrade.ISO_10_9}>ISO 10.9</SelectItem>
                  <SelectItem value={BoltGrade.IS_8_8}>IS 8.8</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Bolt Diameter</Label>
              <Select
                value={bolt.diameter.toString()}
                onValueChange={(value: string) => updateBolt({ diameter: parseInt(value) })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">M12 (12 mm)</SelectItem>
                  <SelectItem value="16">M16 (16 mm)</SelectItem>
                  <SelectItem value="20">M20 (20 mm)</SelectItem>
                  <SelectItem value="22">M22 (22 mm)</SelectItem>
                  <SelectItem value="24">M24 (24 mm)</SelectItem>
                  <SelectItem value="27">M27 (27 mm)</SelectItem>
                  <SelectItem value="30">M30 (30 mm)</SelectItem>
                  <SelectItem value="36">M36 (36 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Hole Type</Label>
              <Select
                value={bolt.holeType}
                onValueChange={(value: BoltHoleType) => updateBolt({ holeType: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BoltHoleType.STANDARD}>Standard (STD)</SelectItem>
                  <SelectItem value={BoltHoleType.OVERSIZED}>Oversized (OVS)</SelectItem>
                  <SelectItem value={BoltHoleType.SHORT_SLOTTED}>Short Slotted (SSL)</SelectItem>
                  <SelectItem value={BoltHoleType.LONG_SLOTTED}>Long Slotted (LSL)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Connection Behavior</Label>
              <Select
                value={bolt.behavior}
                onValueChange={(value: BoltBehavior) => updateBolt({ behavior: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BoltBehavior.BEARING_TYPE_N}>Bearing - Threads Included (N)</SelectItem>
                  <SelectItem value={BoltBehavior.BEARING_TYPE_X}>Bearing - Threads Excluded (X)</SelectItem>
                  <SelectItem value={BoltBehavior.SLIP_CRITICAL_A}>Slip-Critical Class A</SelectItem>
                  <SelectItem value={BoltBehavior.SLIP_CRITICAL_B}>Slip-Critical Class B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bolt Info Summary */}
            <div className="p-3 bg-muted/30 rounded-lg mt-4">
              <h4 className="text-xs font-medium mb-2">Bolt Properties</h4>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Nominal Area:</span>
                <span>{(Math.PI * (bolt.diameter / 2) ** 2).toFixed(1)} mm²</span>
                <span className="text-muted-foreground">Tensile Area:</span>
                <span>{(Math.PI * (bolt.diameter / 2) ** 2 * 0.75).toFixed(1)} mm²</span>
              </div>
            </div>
          </TabsContent>

          {/* Loads Tab */}
          <TabsContent value="loads" className="p-4 space-y-4 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Horizontal Shear Vx (kN)</Label>
              <Input
                type="number"
                step="0.1"
                value={loads.shearX}
                onChange={(e: ChangeEvent<HTMLInputElement>) => 
                  updateLoads({ shearX: parseFloat(e.target.value) || 0 })
                }
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Vertical Shear Vy (kN)</Label>
              <Input
                type="number"
                step="0.1"
                value={loads.shearY}
                onChange={(e: ChangeEvent<HTMLInputElement>) => 
                  updateLoads({ shearY: parseFloat(e.target.value) || 0 })
                }
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Axial Force P (kN)</Label>
              <Input
                type="number"
                step="0.1"
                value={loads.axial}
                onChange={(e: ChangeEvent<HTMLInputElement>) => 
                  updateLoads({ axial: parseFloat(e.target.value) || 0 })
                }
                className="h-9"
                placeholder="+ tension, - compression"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Moment Mx (kN·m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={loads.momentX}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateLoads({ momentX: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Moment My (kN·m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={loads.momentY}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => 
                    updateLoads({ momentY: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9"
                />
              </div>
            </div>

            {/* Capacity Check Summary */}
            <div className="p-3 bg-muted/30 rounded-lg mt-4">
              <div className="flex items-center gap-2 mb-2">
                {utilizationPercent <= 100 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs font-medium">Preliminary Capacity Check</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">Est. Shear Capacity:</span>
                <span className="font-medium">{capacityEstimate.toFixed(0)} kN</span>
                <span className="text-muted-foreground">Resultant Shear:</span>
                <span className="font-medium">{totalShear.toFixed(1)} kN</span>
                <span className="text-muted-foreground">Utilization:</span>
                <span className={`font-medium ${utilizationPercent > 100 ? 'text-red-500' : 'text-green-500'}`}>
                  {utilizationPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Options Tab */}
          <TabsContent value="options" className="p-4 space-y-4 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Connection Type</Label>
              <Select
                value={connection.connectionType}
                onValueChange={(value: ConnectionType) => onChange({ connectionType: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ConnectionType.SINGLE_PLATE_SHEAR}>Single Plate (Shear Tab)</SelectItem>
                  <SelectItem value={ConnectionType.DOUBLE_ANGLE_SHEAR}>Double Angle</SelectItem>
                  <SelectItem value={ConnectionType.END_PLATE_SHEAR}>End Plate</SelectItem>
                  <SelectItem value={ConnectionType.GUSSET_PLATE}>Gusset Plate</SelectItem>
                  <SelectItem value={ConnectionType.BEAM_SPLICE}>Beam Splice</SelectItem>
                  <SelectItem value={ConnectionType.COLUMN_SPLICE}>Column Splice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Design Code</Label>
              <Select
                value={connection.designCode}
                onValueChange={(value: DesignCode) => onChange({ designCode: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DesignCode.AISC_360_22}>AISC 360-22</SelectItem>
                  <SelectItem value={DesignCode.AISC_360_16}>AISC 360-16</SelectItem>
                  <SelectItem value={DesignCode.EUROCODE_3}>Eurocode 3 EN 1993-1-8</SelectItem>
                  <SelectItem value={DesignCode.IS_800_2007}>IS 800:2007</SelectItem>
                  <SelectItem value={DesignCode.AS_4100}>AS 4100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Design Method</Label>
              <Select
                value={connection.designMethod}
                onValueChange={(value: DesignMethod) => onChange({ designMethod: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LRFD">LRFD (Load & Resistance Factor)</SelectItem>
                  <SelectItem value="ASD">ASD (Allowable Stress Design)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Plate Steel Grade</Label>
              <Select
                value={plate.grade}
                onValueChange={(value: SteelGrade) => updatePlate({ grade: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SteelGrade.A36}>ASTM A36 (250 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.A572_50}>ASTM A572 Gr.50 (345 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.A992}>ASTM A992 (345 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.S235}>S235 (235 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.S275}>S275 (275 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.S355}>S355 (355 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.E250}>IS E250 (250 MPa)</SelectItem>
                  <SelectItem value={SteelGrade.E350}>IS E350 (350 MPa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Plate Thickness (mm)</Label>
              <Select
                value={plate.thickness.toString()}
                onValueChange={(value: string) => updatePlate({ thickness: parseInt(value) })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 mm</SelectItem>
                  <SelectItem value="8">8 mm</SelectItem>
                  <SelectItem value="10">10 mm</SelectItem>
                  <SelectItem value="12">12 mm</SelectItem>
                  <SelectItem value="14">14 mm</SelectItem>
                  <SelectItem value="16">16 mm</SelectItem>
                  <SelectItem value="18">18 mm</SelectItem>
                  <SelectItem value="20">20 mm</SelectItem>
                  <SelectItem value="22">22 mm</SelectItem>
                  <SelectItem value="25">25 mm</SelectItem>
                  <SelectItem value="30">30 mm</SelectItem>
                  <SelectItem value="40">40 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer */}
      {onAnalyze && (
        <div className="p-4 border-t">
          <Button onClick={onAnalyze} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Run Full Analysis
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConnectionModelingPanel;
