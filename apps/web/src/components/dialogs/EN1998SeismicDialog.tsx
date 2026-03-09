/**
 * EN1998SeismicDialog.tsx — Eurocode 8 Seismic Load Generator
 * EN 1998-1:2004 Lateral Force Method of Analysis (Cl. 4.3.3.2)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Activity, MapPin, Building2, Calculator, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';

// ===== EN 1998 CONSTANTS =====

/** Ground types per EN 1998-1 Table 3.1 */
const GROUND_TYPES = [
  { value: 'A', label: 'A — Rock (vs > 800 m/s)', S: 1.0, TB: 0.15, TC: 0.4, TD: 2.0 },
  { value: 'B', label: 'B — Dense sand/gravel (vs 360–800)', S: 1.2, TB: 0.15, TC: 0.5, TD: 2.0 },
  { value: 'C', label: 'C — Dense/medium sand (vs 180–360)', S: 1.15, TB: 0.20, TC: 0.6, TD: 2.0 },
  { value: 'D', label: 'D — Loose-to-medium sand (vs < 180)', S: 1.35, TB: 0.20, TC: 0.8, TD: 2.0 },
  { value: 'E', label: 'E — Surface alluvium over rock', S: 1.4, TB: 0.15, TC: 0.5, TD: 2.0 },
];

/** Importance classes per EN 1998-1 Table 4.3 (recommended γI) */
const IMPORTANCE_CLASSES = [
  { value: 'I',   label: 'Class I — Minor (γI = 0.8)',   gamma: 0.8 },
  { value: 'II',  label: 'Class II — Ordinary (γI = 1.0)', gamma: 1.0 },
  { value: 'III', label: 'Class III — Important (γI = 1.2)', gamma: 1.2 },
  { value: 'IV',  label: 'Class IV — Critical (γI = 1.4)',  gamma: 1.4 },
];

/** Ductility classes & behaviour factor q (Table 5.1 simplified) */
const DUCTILITY_CLASSES = [
  { value: 'DCL', label: 'DCL — Low Ductility (q = 1.5)', q: 1.5 },
  { value: 'DCM_MRF', label: 'DCM — Moment Frame (q = 3.9)', q: 3.9 },
  { value: 'DCM_BF', label: 'DCM — Braced Frame (q = 2.0)', q: 2.0 },
  { value: 'DCM_SW', label: 'DCM — Shear Wall (q = 3.0)', q: 3.0 },
  { value: 'DCH_MRF', label: 'DCH — Moment Frame (q = 5.85)', q: 5.85 },
  { value: 'DCH_BF', label: 'DCH — Braced Frame (q = 2.5)', q: 2.5 },
  { value: 'DCH_SW', label: 'DCH — Shear Wall (q = 4.4)', q: 4.4 },
];

interface FloorData {
  level: number;
  height: number;   // m from base
  weight: number;    // kN
}

interface EN1998Params {
  agR: number;         // reference peak ground acceleration (m/s²) on Type A
  groundType: string;
  importance: string;
  gammaI: number;
  ductility: string;
  q: number;
  height: number;      // total building height (m)
  numStoreys: number;
  floors: FloorData[];
  direction: string;   // 'X' | 'Z'
}

interface EN1998Results {
  ag: number;         // design ground acceleration = agR × γI
  S: number;
  T1: number;         // fundamental period
  Sd_T1: number;      // design spectrum ordinate at T1
  lambda: number;     // correction factor (Cl. 4.3.3.2.2)
  Fb: number;         // base shear
  W: number;          // total weight
  Qi: { level: number; height: number; weight: number; force: number; shear: number }[];
}

const EN1998SeismicDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.en1998SeismicDialog || false;
  const [activeTab, setActiveTab] = useState('site');

  const [params, setParams] = useState<EN1998Params>({
    agR: 0.25,
    groundType: 'B',
    importance: 'II',
    gammaI: 1.0,
    ductility: 'DCM_MRF',
    q: 3.9,
    height: 30,
    numStoreys: 10,
    floors: [],
    direction: 'X',
  });

  // Auto-generate floor data when storeys/height change
  const prevConfig = React.useRef('');
  React.useEffect(() => {
    const config = `${params.numStoreys}-${params.height}`;
    if (config === prevConfig.current) return;
    prevConfig.current = config;

    const storyH = params.height / params.numStoreys;
    const floors: FloorData[] = [];
    for (let i = 1; i <= params.numStoreys; i++) {
      floors.push({
        level: i,
        height: i * storyH,
        weight: i === params.numStoreys ? 800 : 1000,
      });
    }
    setParams(prev => ({ ...prev, floors }));
  }, [params.numStoreys, params.height]);

  // ===== Design Spectrum Sd(T) per EN 1998-1 Cl. 3.2.2.5 =====
  const getDesignSpectrum = (T: number, ag: number, S: number, q: number, TB: number, TC: number, TD: number): number => {
    const beta = 0.2; // lower bound factor (Cl. 3.2.2.5(4)P)
    if (T <= 0) return ag * S * (2 / 3);
    if (T < TB) return ag * S * ((2 / 3) + (T / TB) * (2.5 / q - 2 / 3));
    if (T <= TC) return ag * S * (2.5 / q);
    if (T <= TD) return Math.max(ag * S * (2.5 / q) * (TC / T), beta * ag);
    return Math.max(ag * S * (2.5 / q) * (TC * TD) / (T * T), beta * ag);
  };

  // ===== Calculate results =====
  const results = useMemo((): EN1998Results | null => {
    if (!params.height || params.floors.length === 0) return null;
    const W = params.floors.reduce((sum, f) => sum + f.weight, 0);
    if (W === 0) return null;

    const ground = GROUND_TYPES.find(g => g.value === params.groundType)!;
    const ag = params.agR * params.gammaI;  // design ground accel (g)
    const S = ground.S;

    // Approximate fundamental period — EN 1998-1 Cl. 4.3.3.2.2 Eq. (4.6)
    // T1 = Ct × H^(3/4)
    const isMRF = params.ductility.includes('MRF');
    const Ct = isMRF ? 0.075 : 0.05;
    const T1 = Ct * Math.pow(params.height, 0.75);

    // Design spectrum ordinate
    const Sd_T1 = getDesignSpectrum(T1, ag * 9.81, S, params.q, ground.TB, ground.TC, ground.TD);

    // λ correction: 0.85 if T1 ≤ 2TC and building > 2 storeys, else 1.0 (Cl. 4.3.3.2.2(1)P)
    const lambda = (T1 <= 2 * ground.TC && params.numStoreys > 2) ? 0.85 : 1.0;

    // Base shear Fb = Sd(T1) × m × λ   where m = W/g  →  Fb = Sd(T1)/g × W × λ
    const Fb = (Sd_T1 / 9.81) * W * lambda;

    // Vertical distribution Cl. 4.3.3.2.3 Eq. (4.11):  Fi = Fb × (zi × mi) / Σ(zj × mj)
    const denom = params.floors.reduce((sum, f) => sum + f.height * f.weight, 0);
    let cumShear = 0;
    const Qi = params.floors.slice().reverse().map(floor => {
      const Fi = denom > 0 ? Fb * (floor.height * floor.weight) / denom : 0;
      cumShear += Fi;
      return { ...floor, force: Fi, shear: cumShear };
    }).reverse();

    return { ag, S, T1, Sd_T1, lambda, Fb, W, Qi };
  }, [params]);

  const handleGroundChange = (value: string) => {
    const gnd = GROUND_TYPES.find(g => g.value === value);
    if (gnd) setParams(prev => ({ ...prev, groundType: gnd.value }));
  };

  const handleImportanceChange = (value: string) => {
    const imp = IMPORTANCE_CLASSES.find(i => i.value === value);
    if (imp) setParams(prev => ({ ...prev, importance: imp.value, gammaI: imp.gamma }));
  };

  const handleDuctilityChange = (value: string) => {
    const dc = DUCTILITY_CLASSES.find(d => d.value === value);
    if (dc) setParams(prev => ({ ...prev, ductility: dc.value, q: dc.q }));
  };

  const handleApply = useCallback(() => {
    if (!results) return;
    const { nodes, addLoadCase } = useModelStore.getState();
    const direction = params.direction || 'X';

    // Group nodes by Y-level
    const levelMap = new Map<number, string[]>();
    nodes.forEach((node, id) => {
      const roundedY = Math.round(node.y * 10) / 10;
      if (!levelMap.has(roundedY)) levelMap.set(roundedY, []);
      levelMap.get(roundedY)!.push(id);
    });

    const nodalLoads: { id: string; nodeId: string; fx?: number; fy?: number; fz?: number }[] = [];
    let loadIdx = 0;

    results.Qi.forEach(story => {
      let bestY = -1;
      let bestDist = Infinity;
      levelMap.forEach((_, y) => {
        const dist = Math.abs(y - story.height);
        if (dist < bestDist) { bestDist = dist; bestY = y; }
      });

      if (bestY >= 0 && bestDist < 1.0) {
        const nodeIds = levelMap.get(bestY) || [];
        if (nodeIds.length > 0) {
          const forcePerNode = story.force / nodeIds.length;
          nodeIds.forEach(nodeId => {
            loadIdx++;
            const load: { id: string; nodeId: string; fx?: number; fz?: number } = {
              id: `EQ_EN_${loadIdx}`,
              nodeId,
            };
            if (direction === 'X') load.fx = forcePerNode;
            else load.fz = forcePerNode;
            nodalLoads.push(load);
          });
        }
      }
    });

    addLoadCase({
      id: `LC_EQ_EN1998_${direction}`,
      name: `Seismic EN 1998 (${direction})`,
      type: 'seismic',
      loads: nodalLoads,
      memberLoads: [],
      factor: 1.0,
    });

    setModal('en1998SeismicDialog', false);
  }, [results, params.direction, setModal]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setModal('en1998SeismicDialog', open)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            EN 1998 Seismic Load Generator
            <Badge variant="secondary" className="ml-2">EN 1998-1:2004</Badge>
          </DialogTitle>
          <DialogDescription>
            Calculate seismic loads per EN 1998-1 Lateral Force Method (Cl. 4.3.3.2)
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="site"><MapPin className="h-4 w-4 mr-1" />Ground</TabsTrigger>
            <TabsTrigger value="building"><Building2 className="h-4 w-4 mr-1" />Building</TabsTrigger>
            <TabsTrigger value="params"><Activity className="h-4 w-4 mr-1" />Parameters</TabsTrigger>
            <TabsTrigger value="results"><Calculator className="h-4 w-4 mr-1" />Results</TabsTrigger>
          </TabsList>

          {/* Ground / Site Tab */}
          <TabsContent value="site" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference Peak Ground Acceleration agR (g)</Label>
                <Input
                  type="number"
                  step={0.01}
                  min={0.01}
                  value={params.agR}
                  onChange={e => setParams(prev => ({ ...prev, agR: parseFloat(e.target.value) || 0.1 }))}
                />
                <p className="text-xs text-muted-foreground">From national annex seismic hazard map</p>
              </div>
              <div className="space-y-2">
                <Label>Ground Type (EN 1998-1 Table 3.1)</Label>
                <Select value={params.groundType} onValueChange={handleGroundChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUND_TYPES.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Ground Type Parameters</div>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                {(() => {
                  const gnd = GROUND_TYPES.find(g => g.value === params.groundType)!;
                  return (
                    <>
                      <div className="text-center"><div className="text-muted-foreground">S</div><div className="text-lg">{gnd.S}</div></div>
                      <div className="text-center"><div className="text-muted-foreground">TB (s)</div><div className="text-lg">{gnd.TB}</div></div>
                      <div className="text-center"><div className="text-muted-foreground">TC (s)</div><div className="text-lg">{gnd.TC}</div></div>
                      <div className="text-center"><div className="text-muted-foreground">TD (s)</div><div className="text-lg">{gnd.TD}</div></div>
                    </>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

          {/* Building Tab */}
          <TabsContent value="building" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Building Height (m)</Label>
                <Input
                  type="number"
                  value={params.height}
                  onChange={e => setParams(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Storeys</Label>
                <Input
                  type="number"
                  value={params.numStoreys}
                  onChange={e => setParams(prev => ({ ...prev, numStoreys: parseInt(e.target.value) || 1 }))}
                  min={1}
                  max={60}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Importance Class (EN 1998-1 Table 4.3)</Label>
                <Select value={params.importance} onValueChange={handleImportanceChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_CLASSES.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ductility Class & System (Table 5.1)</Label>
                <Select value={params.ductility} onValueChange={handleDuctilityChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DUCTILITY_CLASSES.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Floor weight editor */}
            {params.floors.length > 0 && (
              <div className="space-y-2">
                <Label>Floor Weights (kN)</Label>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-2 space-y-1">
                    <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground px-2">
                      <span>Level</span><span>Height (m)</span><span>Weight (kN)</span>
                    </div>
                    {params.floors.map((f, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-center px-2">
                        <span className="text-sm">{f.level}</span>
                        <span className="text-sm font-mono">{f.height.toFixed(1)}</span>
                        <Input
                          type="number"
                          className="h-7 text-sm"
                          value={f.weight}
                          onChange={e => {
                            const newFloors = [...params.floors];
                            newFloors[idx] = { ...f, weight: parseFloat(e.target.value) || 0 };
                            setParams(prev => ({ ...prev, floors: newFloors }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* Parameters Tab */}
          <TabsContent value="params" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seismic Direction</Label>
                <Select value={params.direction} onValueChange={v => setParams(prev => ({ ...prev, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X">X-Direction</SelectItem>
                    <SelectItem value="Z">Z-Direction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Behaviour Factor q</Label>
                <Input
                  type="number"
                  step={0.1}
                  value={params.q}
                  onChange={e => setParams(prev => ({ ...prev, q: parseFloat(e.target.value) || 1.5 }))}
                  min={1.0}
                />
                <p className="text-xs text-muted-foreground">Override if needed (auto-set from ductility class)</p>
              </div>
            </div>

            {results && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                <div className="text-sm font-medium">Design Parameters Summary</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">ag = </span><span className="font-mono">{results.ag.toFixed(3)}g</span></div>
                  <div><span className="text-muted-foreground">S = </span><span className="font-mono">{results.S.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">T₁ = </span><span className="font-mono">{results.T1.toFixed(3)} s</span></div>
                  <div><span className="text-muted-foreground">Sd(T₁) = </span><span className="font-mono">{results.Sd_T1.toFixed(3)} m/s²</span></div>
                  <div><span className="text-muted-foreground">q = </span><span className="font-mono">{params.q.toFixed(1)}</span></div>
                  <div><span className="text-muted-foreground">λ = </span><span className="font-mono">{results.lambda.toFixed(2)}</span></div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4 mt-4">
            {!results ? (
              <div className="flex items-center gap-2 p-4 text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Enter building data to see results</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Base Shear Fb</div>
                    <div className="text-xl font-bold font-mono">{results.Fb.toFixed(1)} kN</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Total Weight W</div>
                    <div className="text-xl font-bold font-mono">{results.W.toFixed(0)} kN</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Fb / W</div>
                    <div className="text-xl font-bold font-mono">{((results.Fb / results.W) * 100).toFixed(2)}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Storey Forces (Cl. 4.3.3.2.3)</Label>
                  <ScrollArea className="h-56 rounded-md border">
                    <div className="p-2">
                      <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground px-2 mb-1">
                        <span>Level</span><span>z (m)</span><span>W (kN)</span><span>F (kN)</span><span>V (kN)</span>
                      </div>
                      {results.Qi.map((q, idx) => (
                        <div key={idx} className="grid grid-cols-5 gap-1 text-sm font-mono px-2 py-0.5 even:bg-muted/50 rounded">
                          <span>{q.level}</span>
                          <span>{q.height.toFixed(1)}</span>
                          <span>{q.weight.toFixed(0)}</span>
                          <span className="text-blue-600">{q.force.toFixed(1)}</span>
                          <span className="text-red-600">{q.shear.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setModal('en1998SeismicDialog', false)}>Cancel</Button>
          <Button disabled={!results} onClick={handleApply}>
            Apply Seismic Loads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EN1998SeismicDialog;
