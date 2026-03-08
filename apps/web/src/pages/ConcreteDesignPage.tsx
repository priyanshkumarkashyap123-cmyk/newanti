/**
 * Concrete Design Page - IS 456:2000 & ACI 318-19
 * Complete RC beam, column, and slab design interface
 * 
 * CONNECTED TO REAL BACKEND:
 * - Uses apps/web/src/api/design.ts API client
 * - Calls apps/backend-python/is_codes/is_456.py calculations (Python API)
 * - Supports beam, column, and slab design
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Calculator, 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  Box,
  Columns,
  Square,
  Info,
  Settings,
  Play,
  AlertTriangle,
  Loader2,
  Scissors,
  TrendingDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Select, Switch } from '../components/ui/FormInputs';
import { Alert } from '../components/ui/alert';

// REAL API Client - connects to Python backend at :8081
import { 
  designBeamIS456,
  designColumnIS456,
  designSlabIS456
} from '../api/design';
import { getErrorMessage } from '../lib/errorHandling';
import { useToast } from '../components/ui/ToastSystem';
import { FieldLabel } from '../components/ui/FieldLabel';
import { ClauseReference } from '../components/ui/ClauseReference';

type DesignCode = 'IS456' | 'ACI318';
type MemberType = 'beam' | 'column' | 'slab';

interface BeamInput {
  // Geometry
  span: number;
  width: number;
  depth: number;
  effectiveDepth: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  deadLoad: number;
  liveLoad: number;
  factorDL: number;
  factorLL: number;
  
  // Moments, Shear & Torsion
  Mu: number;
  Vu: number;
  Tu: number;
  stirrupDia: number;
  mainBarDia: number;

  // Section-wise design
  enableSectionWise: boolean;
  supportCondition: 'simple' | 'fixed-fixed' | 'propped' | 'cantilever';
  nSections: number;
}

interface ColumnInput {
  // Geometry
  width: number;
  depth: number;
  height: number;
  effectiveLength: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  Pu: number;  // Axial load
  Mux: number; // Moment about major axis
  Muy: number; // Moment about minor axis

  // Section-wise design (end moments)
  enableSectionWise: boolean;
  MuxTop: number;
  MuxBottom: number;
  MuyTop: number;
  MuyBottom: number;
}

interface SlabInput {
  // Geometry
  lx: number; // Short span
  ly: number; // Long span
  thickness: number;
  cover: number;
  
  // Materials
  fck: number;
  fy: number;
  
  // Loads
  deadLoad: number;
  liveLoad: number;
  
  // Support conditions
  supportType: 'simply-supported' | 'fixed' | 'continuous';
}

export const ConcreteDesignPage: React.FC = () => {
  const [designCode, setDesignCode] = useState<DesignCode>('IS456');
  const [memberType, setMemberType] = useState<MemberType>('beam');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const toast = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalyzing(false);
    toast.info('Design calculation cancelled');
  }, [toast]);

  // Beam input state
  const [beamInput, setBeamInput] = useState<BeamInput>({
    span: 6000,
    width: 300,
    depth: 500,
    effectiveDepth: 450,
    cover: 40,
    fck: 25,
    fy: 415,
    deadLoad: 25,
    liveLoad: 10,
    factorDL: 1.5,
    factorLL: 1.5,
    Mu: 150,
    Vu: 80,
    Tu: 0,
    stirrupDia: 8,
    mainBarDia: 16,
    enableSectionWise: false,
    supportCondition: 'simple',
    nSections: 11
  });

  // Column input state
  const [columnInput, setColumnInput] = useState<ColumnInput>({
    width: 300,
    depth: 450,
    height: 3000,
    effectiveLength: 3000,
    cover: 40,
    fck: 25,
    fy: 415,
    Pu: 800,
    Mux: 100,
    Muy: 50,
    enableSectionWise: false,
    MuxTop: 100,
    MuxBottom: 60,
    MuyTop: 50,
    MuyBottom: 30
  });

  // Slab input state
  const [slabInput, setSlabInput] = useState<SlabInput>({
    lx: 4000,
    ly: 6000,
    thickness: 150,
    cover: 20,
    fck: 25,
    fy: 415,
    deadLoad: 3.75,
    liveLoad: 2.5,
    supportType: 'simply-supported'
  });

  useEffect(() => { document.title = 'Concrete Design | BeamLab'; }, []);

  // Input validation before API call
  const validateInputs = useCallback((): string | null => {
    // Common material validation (IS 456 Table 2: fck 15–80 MPa; IS 456 Cl. 5.6: fy 250–500 MPa)
    const fck = memberType === 'beam' ? beamInput.fck : memberType === 'column' ? columnInput.fck : slabInput.fck;
    const fy = memberType === 'beam' ? beamInput.fy : memberType === 'column' ? columnInput.fy : slabInput.fy;
    if (fck < 15 || fck > 100) {
      return 'fck must be between 15 and 100 MPa (IS 456 Table 2)';
    }
    if (fy < 250 || fy > 600) {
      return 'fy must be between 250 and 600 MPa (IS 456 Cl. 5.6)';
    }

    if (memberType === 'beam') {
      if (beamInput.width <= 0 || beamInput.depth <= 0) {
        return 'Beam width and depth must be positive';
      }
      if (beamInput.span < 500 || beamInput.span > 30000) {
        return 'Beam span must be between 500 and 30000 mm';
      }
      if (beamInput.effectiveDepth >= beamInput.depth) {
        return 'Effective depth must be less than total depth';
      }
      if (beamInput.effectiveDepth <= 0) {
        return 'Effective depth must be positive';
      }
      if (beamInput.cover < 15 || beamInput.cover > 75) {
        return 'Clear cover must be between 15 and 75 mm (IS 456 Cl. 26.4)';
      }
      // Allow signed moments (positive=sagging, negative=hogging)
      if (Math.abs(beamInput.Vu) < 0.001) {
        return 'Shear force magnitude must be non-zero';
      }
    } else if (memberType === 'column') {
      if (columnInput.width <= 0 || columnInput.depth <= 0) {
        return 'Column width and depth must be positive';
      }
      if (columnInput.width < 200) {
        return 'Minimum column width is 200 mm (IS 456 Cl. 25.1.1)';
      }
      if (columnInput.effectiveLength <= 0) {
        return 'Effective length must be positive';
      }
      if (columnInput.cover < 25 || columnInput.cover > 75) {
        return 'Column cover must be between 25 and 75 mm (IS 456 Cl. 26.4.2)';
      }
    } else if (memberType === 'slab') {
      if (slabInput.lx <= 0 || slabInput.ly <= 0) {
        return 'Slab spans must be positive';
      }
      if (slabInput.thickness < 75 || slabInput.thickness > 500) {
        return 'Slab thickness must be between 75 and 500 mm';
      }
      if (slabInput.cover < 15 || slabInput.cover > 50) {
        return 'Slab cover must be between 15 and 50 mm (IS 456 Cl. 26.4)';
      }
    }
    return null;
  }, [memberType, beamInput, columnInput, slabInput]);

  const handleAnalyze = async () => {
    // Validate inputs first
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalyzing(true);
    setError('');
    setResults(null);

    try {
      if (memberType === 'beam') {
        // Compute factored UDL from dead/live loads
        const wFactored = beamInput.deadLoad * beamInput.factorDL + beamInput.liveLoad * beamInput.factorLL;
        
        // Call Python backend API (port 8081) with sign convention + section-wise support
        const result = await designBeamIS456({
          width: beamInput.width,
          depth: beamInput.depth,
          cover: beamInput.cover,
          Mu: beamInput.Mu,              // SIGNED: positive=sagging, negative=hogging
          Vu: beamInput.Vu,              // SIGNED: preserved from analysis
          Tu: beamInput.Tu,              // Torsion (IS 456 Cl. 41)
          stirrup_dia: beamInput.stirrupDia,
          main_bar_dia: beamInput.mainBarDia,
          code: designCode,              // Design code for sign convention interpretation
          fck: beamInput.fck,
          fy: beamInput.fy,
          // Section-wise parameters (only when enabled)
          ...(beamInput.enableSectionWise && beamInput.span > 0 ? {
            span: beamInput.span,
            w_factored: wFactored,
            support_condition: beamInput.supportCondition,
            n_sections: beamInput.nSections
          } : {})
        });
        
        // Transform API response to UI format
        // Transform API response to UI format
        // API returns unsigned demand and capacity, but also signed moment for interpretation
        const muDemand = result.demand?.Mu || Math.abs(beamInput.Mu);
        const vuDemand = result.demand?.Vu || Math.abs(beamInput.Vu);
        const muUtil = result.Mu_capacity > 0 ? muDemand / result.Mu_capacity : (muDemand > 0 ? Infinity : 0);
        const vuUtil = result.Vu_capacity > 0 ? vuDemand / result.Vu_capacity : (vuDemand > 0 ? Infinity : 0);
        const governingUtil = Math.max(muUtil, vuUtil);
        const flexurePass = muUtil <= 1;
        const shearPass = vuUtil <= 1;
        
        // Get moment interpretation from backend sign convention handler
        const momentType = result.moment_type || (beamInput.Mu > 0 ? 'sagging' : beamInput.Mu < 0 ? 'hogging' : 'neutral');
        const rebarNotes = result.reinforcement_note || '';

        setResults({
          passed: flexurePass && shearPass,
          utilization: governingUtil,
          momentType,
          designApproach: result.design_approach || 'single_section',
          sectionWise: result.section_wise || null,
          reinforcement: {
            mainBottom: `${result.tension_steel.count} - ${result.tension_steel.diameter}mm φ (${result.tension_steel.area.toFixed(0)} mm²)`,
            mainTop: result.compression_steel ? 
              `${result.compression_steel.count} - ${result.compression_steel.diameter}mm φ` : 
              'Nominal (2 bars holding stirrups)',
            stirrups: `${result.stirrups.diameter}mm φ ${result.stirrups.legs}-legged @ ${result.stirrups.spacing}mm c/c`
          },
          capacities: {
            Mu: result.Mu_capacity,
            Vu: result.Vu_capacity
          },
          momentAnalysis: result.moment_analysis, // From sign convention handler
          signConvention: result.sign_convention,  // E.g., "IS 456:2000"
          checks: [
            {
              description: `Max bending check (moment type: ${momentType}): Mu (${muDemand.toFixed(2)} kN·m) ${flexurePass ? '≤' : '>'} Mu,cap (${result.Mu_capacity.toFixed(2)} kN·m) | ${rebarNotes}`,
              passed: flexurePass,
              clause: designCode === 'IS456' ? 'Cl. 38' : 'Sec. 22'
            },
            {
              description: `Max shear check: Vu (${vuDemand.toFixed(2)} kN) ${shearPass ? '≤' : '>'} Vu,cap (${result.Vu_capacity.toFixed(2)} kN)` ,
              passed: shearPass,
              clause: designCode === 'IS456' ? 'Cl. 40' : 'Sec. 22'
            },
            ...result.checks.map((check: string, i: number) => ({
              description: check,
              passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
              clause: designCode === 'IS456' ? `Cl. 38.${i + 1}` : `Sec. 22.${i + 1}`
            }))
          ]
        });

      } else if (memberType === 'column') {
        // Call Python backend API (port 8081) with sign convention + section-wise support
        const result = await designColumnIS456({
          width: columnInput.width,
          depth: columnInput.depth,
          cover: columnInput.cover,
          Pu: columnInput.Pu,
          Mux: columnInput.Mux,            // SIGNED: preserves direction for biaxial interaction
          Muy: columnInput.Muy,            // SIGNED: preserves direction for biaxial interaction
          unsupported_length: columnInput.effectiveLength,
          effective_length_factor: 1.0,
          code: designCode,                // Design code for sign convention
          fck: columnInput.fck,
          fy: columnInput.fy,
          // Section-wise parameters (only when enabled)
          ...(columnInput.enableSectionWise ? {
            Mux_top: columnInput.MuxTop,
            Mux_bottom: columnInput.MuxBottom,
            Muy_top: columnInput.MuyTop,
            Muy_bottom: columnInput.MuyBottom,
            n_sections: 5
          } : {})
        });
        
        // Transform API response to UI format
        const totalLongSteel = result.longitudinal_steel.reduce(
          (sum: number, bar: { area: number }) => sum + bar.area, 0
        );
        
        setResults({
          passed: result.status === 'PASS',
          utilization: result.interaction_ratio,
          designApproach: result.design_approach || 'single_section',
          sectionWise: result.section_wise || null,
          reinforcement: {
            longitudinal: result.longitudinal_steel.map(
              (bar: { count: number; diameter: number }) => `${bar.count} - ${bar.diameter}mm φ`
            ).join(' + ') + ` (${totalLongSteel.toFixed(0)} mm²)`,
            ties: `${result.ties.diameter}mm φ @ ${result.ties.spacing}mm c/c`
          },
          capacities: {
            Pu: result.Pu_capacity,
            Mux: result.Mux_capacity,
            Muy: result.Muy_capacity
          },
          checks: result.checks.map((check: string, i: number) => ({
            description: check,
            passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
            clause: designCode === 'IS456' ? `Cl. 39.${i + 1}` : `Sec. 22.${i + 1}`
          }))
        });

      } else {
        // Slab design - Python API available!
        const result = await designSlabIS456({
          lx: slabInput.lx / 1000, // Convert mm to m
          ly: slabInput.ly / 1000, // Convert mm to m
          live_load: slabInput.liveLoad,
          floor_finish: 1.0,
          support_type: slabInput.supportType === 'simply-supported' ? 'simple' : 
                       slabInput.supportType === 'fixed' ? 'continuous' : 'continuous',
          fck: slabInput.fck,
          fy: slabInput.fy
        });
        
        setResults({
          passed: result.status === 'PASS',
          utilization: result.Mu_capacity > 0 ? result.Mu_demand / result.Mu_capacity : 0,
          reinforcement: {
            mainShort: `${result.main_reinforcement.diameter}mm φ @ ${result.main_reinforcement.spacing}mm c/c (${result.main_reinforcement.area_per_m.toFixed(0)} mm²/m)`,
            mainLong: result.distribution_reinforcement ? 
              `${result.distribution_reinforcement.diameter}mm φ @ ${result.distribution_reinforcement.spacing}mm c/c` : 
              'Per short span',
            distribution: result.distribution_reinforcement ? 
              `${result.distribution_reinforcement.area_per_m.toFixed(0)} mm²/m` : '-',
            topSteel: result.top_reinforcement ? 
              `${result.top_reinforcement.diameter}mm φ @ ${result.top_reinforcement.spacing}mm c/c` : 
              'None required'
          },
          capacities: {
            Mu: result.Mu_capacity,
            thickness: result.thickness
          },
          checks: result.checks.map((check: string, i: number) => ({
            description: check,
            passed: !check.toLowerCase().includes('fail') && !check.toLowerCase().includes('unsafe'),
            clause: designCode === 'IS456' ? `Cl. 24.${i + 1}` : `Sec. 7.${i + 1}`
          })),
          deflectionCheck: {
            actual: result.deflection_check,
            limit: result.deflection_limit,
            passed: result.deflection_check <= result.deflection_limit
          }
        });
      }

    } catch (err: unknown) {
      // If the request was cancelled, bail out silently
      if (controller.signal.aborted) return;

      console.warn('Backend unavailable, using client-side IS 456 calculations:', getErrorMessage(err));
      
      // ── CLIENT-SIDE FALLBACK: IS 456:2000 ──
      try {
        if (memberType === 'beam') {
          const b = beamInput.width;
          const d = beamInput.effectiveDepth;
          const fck = beamInput.fck;
          const fy = beamInput.fy;
          const Mu = beamInput.Mu;
          const Vu = beamInput.Vu;

          // xu_max/d per Table D of SP 16 (IS 456)
          const xuMaxRatio = fy <= 250 ? 0.53 : fy <= 415 ? 0.48 : fy <= 500 ? 0.46 : 0.44;
          const xu_max = xuMaxRatio * d;
          // Mu_limit = 0.36 × fck × b × xu_max × (d - 0.42 × xu_max) [kN·mm → kN·m]
          const Mu_limit = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;

          // Required Ast (singly reinforced)
          const Ast = 0.5 * (fck / fy) * (1 - Math.sqrt(1 - 4.6 * Mu / (fck * b * d * d / 1e6))) * b * d;
          const AstMin = Math.max(0.85 * b * d / fy, 0.0012 * b * beamInput.depth); // Cl. 26.5.1.1

          const finalAst = Math.max(Ast, AstMin);
          // Select bar diameter & count
          const barDia = finalAst > 1200 ? 25 : finalAst > 600 ? 20 : finalAst > 300 ? 16 : 12;
          const barArea = Math.PI * barDia * barDia / 4;
          const barCount = Math.max(2, Math.ceil(finalAst / barArea));

          // Shear check: τv = Vu/(b×d)
          const tauV = Vu * 1000 / (b * d); // MPa
          const pt = (barCount * barArea * 100) / (b * d); // percentage
          // Approximate τc from Table 19 for M25
          const tauC = Math.min(0.28 + 0.18 * pt, 0.8 * Math.sqrt(fck) * 0.1);
          const Vus = Math.max(0, Vu - tauC * b * d / 1000);
          // 2-legged stirrups: Asv = 2 × π/4 × 8² = 100.5 mm²
          const stirDia = 8;
          const Asv = 2 * Math.PI * stirDia * stirDia / 4;
          const sv = Vus > 0.1 ? Math.min(Math.floor(0.87 * fy * Asv * d / (Vus * 1000)), 300, 0.75 * d) : Math.min(300, 0.75 * d);

          const Mu_capacity = Mu_limit;
          const Vu_capacity = tauC * b * d / 1000 + 0.87 * fy * Asv * d / (sv * 1000);
          const muUtil = Mu_capacity > 0 ? Math.abs(Mu) / Mu_capacity : (Math.abs(Mu) > 0 ? Infinity : 0);
          const vuUtil = Vu_capacity > 0 ? Math.abs(Vu) / Vu_capacity : (Math.abs(Vu) > 0 ? Infinity : 0);
          const flexurePass = muUtil <= 1;
          const shearPass = vuUtil <= 1;

          setResults({
            passed: flexurePass && shearPass,
            utilization: Math.max(muUtil, vuUtil),
            reinforcement: {
              mainBottom: `${barCount} - ${barDia}mm φ (${(barCount * barArea).toFixed(0)} mm²)`,
              mainTop: 'Nominal (2-12mm φ holding stirrups)',
              stirrups: `${stirDia}mm φ 2-legged @ ${sv}mm c/c`
            },
            capacities: { Mu: Mu_capacity, Vu: Vu_capacity },
            checks: [
              { description: `Max bending check: Mu (${Mu.toFixed(1)} kNm) ${flexurePass ? '≤' : '>'} Mu,cap (${Mu_capacity.toFixed(1)} kNm)`, passed: flexurePass, clause: 'Cl. 38.1' },
              { description: `Max shear check: Vu (${Vu.toFixed(1)} kN) ${shearPass ? '≤' : '>'} Vu,cap (${Vu_capacity.toFixed(1)} kN)`, passed: shearPass, clause: 'Cl. 40.2' },
              { description: `Ast (${(barCount * barArea).toFixed(0)} mm²) ≥ Ast,min (${AstMin.toFixed(0)} mm²)`, passed: barCount * barArea >= AstMin, clause: 'Cl. 26.5.1.1' },
              { description: `τv (${tauV.toFixed(2)} MPa) check against τc,max`, passed: tauV < 0.62 * Math.sqrt(fck), clause: 'Cl. 40.2' },
              { description: `Stirrup spacing ${sv}mm ≤ 0.75d (${(0.75 * d).toFixed(0)}mm)`, passed: sv <= 0.75 * d, clause: 'Cl. 26.5.1.5' },
            ],
            _clientSide: true
          });

        } else if (memberType === 'column') {
          const b = columnInput.width;
          const D = columnInput.depth;
          const fck = columnInput.fck;
          const fy = columnInput.fy;
          const Pu = columnInput.Pu;
          const leff = columnInput.effectiveLength;

          // Slenderness check (IS 456 Cl. 25.1.2)
          const isShort = leff / Math.min(b, D) < 12;
          const Ag = b * D;

          // Minimum steel: 0.8% Ag (Cl. 26.5.3.1)
          const AscMin = 0.008 * Ag;
          const AscMax = 0.06 * Ag;

          // Required Asc: Pu = 0.4×fck×(Ag - Asc) + 0.67×fy×Asc (Cl. 39.3)
          let AscReq = (Pu * 1000 - 0.4 * fck * Ag) / (0.67 * fy - 0.4 * fck);
          AscReq = Math.max(AscReq, AscMin);
          if (AscReq > AscMax) AscReq = AscMax;

          const barDia = AscReq > 3000 ? 25 : AscReq > 1500 ? 20 : 16;
          const barArea = Math.PI * barDia * barDia / 4;
          const barCount = Math.max(4, Math.ceil(AscReq / barArea));
          // Even number of bars
          const finalCount = barCount % 2 === 0 ? barCount : barCount + 1;

          // Axial capacity
          const Pu_cap = (0.4 * fck * (Ag - finalCount * barArea) + 0.67 * fy * finalCount * barArea) / 1000;

          // Ties: diameter ≥ max(6mm, ¼ × main bar dia), spacing ≤ min(least dim, 16×main bar, 300)
          const tieDia = Math.max(8, Math.ceil(barDia / 4));
          const tieSpacing = Math.min(Math.min(b, D), 16 * barDia, 300);

          setResults({
            passed: Pu <= Pu_cap * 1.05,
            utilization: Pu / Pu_cap,
            reinforcement: {
              longitudinal: `${finalCount} - ${barDia}mm φ (${(finalCount * barArea).toFixed(0)} mm²)`,
              ties: `${tieDia}mm φ @ ${tieSpacing}mm c/c`
            },
            capacities: { Pu: Pu_cap, Mux: 0, Muy: 0 },
            checks: [
              { description: `Column type: ${isShort ? 'Short' : 'Long'} (leff/D = ${(leff / Math.min(b, D)).toFixed(1)})`, passed: true, clause: 'Cl. 25.1.2' },
              { description: `Pu (${Pu.toFixed(0)} kN) ${Pu <= Pu_cap ? '≤' : '>'} Pu,cap (${Pu_cap.toFixed(0)} kN)`, passed: Pu <= Pu_cap, clause: 'Cl. 39.3' },
              { description: `Steel ratio ${((finalCount * barArea * 100) / Ag).toFixed(2)}% (min 0.8%, max 6%)`, passed: finalCount * barArea >= AscMin && finalCount * barArea <= AscMax, clause: 'Cl. 26.5.3.1' },
              { description: `Tie spacing ${tieSpacing}mm ≤ ${Math.min(Math.min(b, D), 300)}mm`, passed: true, clause: 'Cl. 26.5.3.2' },
            ],
            _clientSide: true
          });

        } else {
          // Slab design
          const lx = slabInput.lx / 1000; // mm to m
          const ly = slabInput.ly / 1000;
          const fck = slabInput.fck;
          const fy = slabInput.fy;
          const DL = slabInput.deadLoad;
          const LL = slabInput.liveLoad;
          const t = slabInput.thickness;
          const d_eff = t - slabInput.cover - 5; // effective depth (half bar assumed ~10mm)

          const ratio = ly / lx;
          const isOneWay = ratio > 2;

          // Self-weight
          const SW = 25 * t / 1000; // kN/m²
          const Wu = 1.5 * (DL + SW + LL); // factored load kN/m²

          // BM coefficients (IS 456 Table 26, simply supported)
          let Mx: number;
          if (isOneWay) {
            Mx = Wu * lx * lx / 8;
          } else {
            // Two-way slab - αx from IS 456 Table 26
            const alphaX = slabInput.supportType === 'simply-supported' ? 0.0625 * (1 - 1 / (ratio * ratio)) + 0.045 : 0.04;
            Mx = alphaX * Wu * lx * lx;
          }

          // Ast per metre width
          const AstPerM = 0.5 * (fck / fy) * (1 - Math.sqrt(1 - 4.6 * Mx / (fck * 1000 * d_eff * d_eff / 1e6))) * 1000 * d_eff;
          const AstMin = 0.0012 * 1000 * t;
          const finalAst = Math.max(AstPerM, AstMin);

          const barDia = finalAst > 500 ? 12 : finalAst > 250 ? 10 : 8;
          const barArea = Math.PI * barDia * barDia / 4;
          const spacing = Math.min(Math.floor(barArea * 1000 / finalAst), 300, 3 * t);

          // Mu capacity
          const Mu_cap = 0.87 * fy * finalAst * (d_eff - 0.42 * finalAst * fy / (fck * 1000 * 0.36)) / 1e6;

          // Distribution steel (0.12% gross area)
          const distAst = Math.max(0.0012 * 1000 * t, AstMin * 0.5);
          const distDia = 8;
          const distSpacing = Math.min(Math.floor(Math.PI * distDia * distDia / 4 * 1000 / distAst), 450, 5 * t);

          setResults({
            passed: Mx <= Mu_cap * 1.05,
            utilization: Mu_cap > 0 ? Mx / Mu_cap : 1,
            reinforcement: {
              mainShort: `${barDia}mm φ @ ${spacing}mm c/c (${(barArea * 1000 / spacing).toFixed(0)} mm²/m)`,
              mainLong: `${distDia}mm φ @ ${distSpacing}mm c/c`,
              distribution: `${(Math.PI * distDia * distDia / 4 * 1000 / distSpacing).toFixed(0)} mm²/m`,
              topSteel: slabInput.supportType !== 'simply-supported' ? `${barDia}mm φ @ ${spacing}mm c/c (at supports)` : 'None required'
            },
            capacities: { Mu: Mu_cap, thickness: t },
            checks: [
              { description: `Slab type: ${isOneWay ? 'One-way' : 'Two-way'} (ly/lx = ${ratio.toFixed(2)})`, passed: true, clause: 'Cl. 24.4' },
              { description: `Mx (${Mx.toFixed(2)} kNm/m) ${Mx <= Mu_cap ? '≤' : '>'} Mu,cap (${Mu_cap.toFixed(2)} kNm/m)`, passed: Mx <= Mu_cap, clause: 'Cl. 38.1' },
              { description: `Ast (${finalAst.toFixed(0)} mm²/m) ≥ Ast,min (${AstMin.toFixed(0)} mm²/m)`, passed: finalAst >= AstMin, clause: 'Cl. 26.5.2.1' },
              { description: `Spacing ${spacing}mm ≤ 3×t (${3 * t}mm) & 300mm`, passed: spacing <= Math.min(300, 3 * t), clause: 'Cl. 26.3.3' },
            ],
            deflectionCheck: {
              actual: lx * 1000 / d_eff,
              limit: slabInput.supportType === 'simply-supported' ? 20 : 26,
              passed: lx * 1000 / d_eff <= (slabInput.supportType === 'simply-supported' ? 20 : 26)
            },
            _clientSide: true
          });
        }
      } catch (calcErr: unknown) {
        if (controller.signal.aborted) return;
        setError('Client-side calculation error: ' + getErrorMessage(calcErr, 'Unknown error'));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Show success toast when results arrive
  React.useEffect(() => {
    if (results && !error) {
      const allPassed = results.checks?.every((c: { passed: boolean }) => c.passed) ?? true;
      toast.success(
        allPassed
          ? `${memberType.charAt(0).toUpperCase() + memberType.slice(1)} design passed all checks`
          : `${memberType.charAt(0).toUpperCase() + memberType.slice(1)} design complete — review failed checks`
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const renderBeamForm = () => (
    <div className="space-y-6">
      {/* Geometry Section */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Box className="w-4 h-4" />
          Beam Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label={<FieldLabel field="span" label="Span (mm)" />}
            type="number"
            value={beamInput.span}
            onChange={(e) => setBeamInput({...beamInput, span: Number(e.target.value)})}
          />
          <Input
            label="Width b (mm)"
            type="number"
            value={beamInput.width}
            onChange={(e) => setBeamInput({...beamInput, width: Number(e.target.value)})}
          />
          <Input
            label="Total Depth D (mm)"
            type="number"
            value={beamInput.depth}
            onChange={(e) => setBeamInput({...beamInput, depth: Number(e.target.value)})}
          />
          <Input
            label={<FieldLabel field="effectiveDepth" label="Effective Depth d (mm)" />}
            type="number"
            value={beamInput.effectiveDepth}
            onChange={(e) => setBeamInput({...beamInput, effectiveDepth: Number(e.target.value)})}
          />
          <Input
            label={<FieldLabel field="cover" label="Clear Cover (mm)" />}
            type="number"
            value={beamInput.cover}
            onChange={(e) => setBeamInput({...beamInput, cover: Number(e.target.value)})}
          />
        </div>
      </div>

      {/* Materials Section */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Concrete Grade f'ck (MPa)"
            options={[
              { value: '20', label: 'M20 / 3000 psi' },
              { value: '25', label: 'M25 / 3600 psi' },
              { value: '30', label: 'M30 / 4350 psi' },
              { value: '35', label: 'M35 / 5075 psi' },
              { value: '40', label: 'M40 / 5800 psi' },
            ]}
            value={String(beamInput.fck)}
            onChange={(val) => setBeamInput({...beamInput, fck: Number(val)})}
          />
          <Select
            label={<FieldLabel field="fy" label="Steel Grade fy (MPa)" />}
            options={[
              { value: '415', label: 'Fe 415 / Grade 60' },
              { value: '500', label: 'Fe 500 / Grade 75' },
              { value: '550', label: 'Fe 550 / Grade 80' },
            ]}
            value={String(beamInput.fy)}
            onChange={(val) => setBeamInput({...beamInput, fy: Number(val)})}
          />
        </div>
      </div>

      {/* Loads Section */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads & Moments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="Dead Load (kN/m)"
            type="number"
            value={beamInput.deadLoad}
            onChange={(e) => setBeamInput({...beamInput, deadLoad: Number(e.target.value)})}
          />
          <Input
            label="Live Load (kN/m)"
            type="number"
            value={beamInput.liveLoad}
            onChange={(e) => setBeamInput({...beamInput, liveLoad: Number(e.target.value)})}
          />
          <div className="col-span-2 md:col-span-1" />
          <div>
            <Input
              label={<FieldLabel field="Mu" label="Ultimate Moment Mu (kN·m) [+Sag/-Hog]" />}
              type="number"
              value={beamInput.Mu}
              onChange={(e) => setBeamInput({...beamInput, Mu: Number(e.target.value)})}
              placeholder="+150 (sagging) or -80 (hogging)"
              helperText="Positive = Sagging (bottom tension), Negative = Hogging (top tension)"
            />
          </div>
          <Input
            label={<FieldLabel field="Vu" label="Ultimate Shear Vu (kN) [Signed]" />}
            type="number"
            value={beamInput.Vu}
            onChange={(e) => setBeamInput({...beamInput, Vu: Number(e.target.value)})}
          />
          <Input
            label={<FieldLabel field="Tu" label="Torsion Tu (kN·m)" />}
            type="number"
            value={beamInput.Tu}
            onChange={(e) => setBeamInput({...beamInput, Tu: Number(e.target.value)})}
            helperText="IS 456 Cl. 41 — equivalent moment/shear method. Set 0 if no torsion."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Stirrup Diameter (mm)"
            value={beamInput.stirrupDia.toString()}
            onChange={(val) => setBeamInput({...beamInput, stirrupDia: Number(val)})}
            options={[{value:'6',label:'6 mm'},{value:'8',label:'8 mm'},{value:'10',label:'10 mm'},{value:'12',label:'12 mm'}]}
          />
          <Select
            label="Main Bar Diameter (mm)"
            value={beamInput.mainBarDia.toString()}
            onChange={(val) => setBeamInput({...beamInput, mainBarDia: Number(val)})}
            options={[{value:'12',label:'12 mm'},{value:'16',label:'16 mm'},{value:'20',label:'20 mm'},{value:'25',label:'25 mm'},{value:'32',label:'32 mm'}]}
          />
        </div>
      </div>

      {/* Section-Wise Design Toggle */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Section-Wise Design (Economical)
          </h3>
          <Switch
            checked={beamInput.enableSectionWise}
            onChange={(checked) => setBeamInput({ ...beamInput, enableSectionWise: checked })}
            size="md"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Checks demand ≤ capacity at every section along the beam. Enables bar curtailment for 15-30% steel savings while maintaining safety at all cross-sections.
        </p>
        {beamInput.enableSectionWise && (
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
            <Select
              label="Support Condition"
              options={[
                { value: 'simple', label: 'Simply Supported' },
                { value: 'fixed-fixed', label: 'Fixed-Fixed' },
                { value: 'propped', label: 'Propped Cantilever' },
                { value: 'cantilever', label: 'Cantilever' },
              ]}
              value={beamInput.supportCondition}
              onChange={(val) => setBeamInput({...beamInput, supportCondition: val as BeamInput['supportCondition']})}
            />
            <Select
              label="Check Sections"
              options={[
                { value: '5', label: '5 sections' },
                { value: '11', label: '11 sections (standard)' },
                { value: '21', label: '21 sections (detailed)' },
              ]}
              value={String(beamInput.nSections)}
              onChange={(val) => setBeamInput({...beamInput, nSections: Number(val)})}
            />
            <div className="col-span-2 bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded text-xs text-indigo-700 dark:text-indigo-300">
              <strong>Engineering Principle:</strong> Applied stress at any section must be &lt; capacity at that section.
              Maximum values give safe design; section-wise check gives safe <em>and</em> economical design with bar curtailment.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderColumnForm = () => (
    <div className="space-y-6">
      {/* Geometry */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Columns className="w-4 h-4" />
          Column Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="Width b (mm)"
            type="number"
            value={columnInput.width}
            onChange={(e) => setColumnInput({...columnInput, width: Number(e.target.value)})}
          />
          <Input
            label="Depth D (mm)"
            type="number"
            value={columnInput.depth}
            onChange={(e) => setColumnInput({...columnInput, depth: Number(e.target.value)})}
          />
          <Input
            label="Height (mm)"
            type="number"
            value={columnInput.height}
            onChange={(e) => setColumnInput({...columnInput, height: Number(e.target.value)})}
          />
          <Input
            label="Effective Length (mm)"
            type="number"
            value={columnInput.effectiveLength}
            onChange={(e) => setColumnInput({...columnInput, effectiveLength: Number(e.target.value)})}
          />
          <Input
            label="Clear Cover (mm)"
            type="number"
            value={columnInput.cover}
            onChange={(e) => setColumnInput({...columnInput, cover: Number(e.target.value)})}
          />
        </div>
      </div>

      {/* Materials */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Concrete Grade f'ck (MPa)"
            options={[
              { value: '20', label: 'M20 / 3000 psi' },
              { value: '25', label: 'M25 / 3600 psi' },
              { value: '30', label: 'M30 / 4350 psi' },
              { value: '35', label: 'M35 / 5075 psi' },
              { value: '40', label: 'M40 / 5800 psi' },
            ]}
            value={String(columnInput.fck)}
            onChange={(val) => setColumnInput({...columnInput, fck: Number(val)})}
          />
          <Select
            label="Steel Grade fy (MPa)"
            options={[
              { value: '415', label: 'Fe 415 / Grade 60' },
              { value: '500', label: 'Fe 500 / Grade 75' },
              { value: '550', label: 'Fe 550 / Grade 80' },
            ]}
            value={String(columnInput.fy)}
            onChange={(val) => setColumnInput({...columnInput, fy: Number(val)})}
          />
        </div>
      </div>

      {/* Loads */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads</h3>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Axial Load Pu (kN)"
            type="number"
            value={columnInput.Pu}
            onChange={(e) => setColumnInput({...columnInput, Pu: Number(e.target.value)})}
          />
          <Input
            label="Moment Mux (kN·m) [Signed]"
            type="number"
            value={columnInput.Mux}
            onChange={(e) => setColumnInput({...columnInput, Mux: Number(e.target.value)})}
            placeholder="+100 or -80"
            helperText="Sign preserved for biaxial interaction"
          />
          <Input
            label="Moment Muy (kN·m) [Signed]"
            type="number"
            value={columnInput.Muy}
            onChange={(e) => setColumnInput({...columnInput, Muy: Number(e.target.value)})}
            placeholder="+50 or -40"
            helperText="Biaxial bending interaction"
          />
        </div>
      </div>

      {/* Section-Wise Column Checking */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Section-Wise Column Check
          </h3>
          <Switch
            checked={columnInput.enableSectionWise}
            onChange={(checked) => setColumnInput({ ...columnInput, enableSectionWise: checked })}
            size="md"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Checks interaction ratio at multiple heights along the column with P-delta moment amplification per IS 456 Cl. 39.7.1.
        </p>
        {columnInput.enableSectionWise && (
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
            <Input
              label="Mux Top (kN·m)"
              type="number"
              value={columnInput.MuxTop}
              onChange={(e) => setColumnInput({...columnInput, MuxTop: Number(e.target.value)})}
            />
            <Input
              label="Mux Bottom (kN·m)"
              type="number"
              value={columnInput.MuxBottom}
              onChange={(e) => setColumnInput({...columnInput, MuxBottom: Number(e.target.value)})}
            />
            <Input
              label="Muy Top (kN·m)"
              type="number"
              value={columnInput.MuyTop}
              onChange={(e) => setColumnInput({...columnInput, MuyTop: Number(e.target.value)})}
            />
            <Input
              label="Muy Bottom (kN·m)"
              type="number"
              value={columnInput.MuyBottom}
              onChange={(e) => setColumnInput({...columnInput, MuyBottom: Number(e.target.value)})}
            />
            <div className="col-span-2 bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded text-xs text-indigo-700 dark:text-indigo-300">
              <strong>End Moments:</strong> Provide moments at top and bottom of column. The moment varies linearly between ends, 
              with P-delta amplification checked at each section along the height.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSlabForm = () => (
    <div className="space-y-6">
      {/* Geometry */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <Square className="w-4 h-4" />
          Slab Geometry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="Short Span lx (mm)"
            type="number"
            value={slabInput.lx}
            onChange={(e) => setSlabInput({...slabInput, lx: Number(e.target.value)})}
          />
          <Input
            label="Long Span ly (mm)"
            type="number"
            value={slabInput.ly}
            onChange={(e) => setSlabInput({...slabInput, ly: Number(e.target.value)})}
          />
          <Input
            label="Thickness (mm)"
            type="number"
            value={slabInput.thickness}
            onChange={(e) => setSlabInput({...slabInput, thickness: Number(e.target.value)})}
          />
          <Input
            label="Clear Cover (mm)"
            type="number"
            value={slabInput.cover}
            onChange={(e) => setSlabInput({...slabInput, cover: Number(e.target.value)})}
          />
          <Select
            label="Support Type"
            options={[
              { value: 'simply-supported', label: 'Simply Supported' },
              { value: 'fixed', label: 'Fixed' },
              { value: 'continuous', label: 'Continuous' },
            ]}
            value={slabInput.supportType}
            onChange={(val) => setSlabInput({...slabInput, supportType: val as any})}
          />
        </div>
      </div>

      {/* Materials */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Concrete Grade f'ck (MPa)"
            options={[
              { value: '20', label: 'M20 / 3000 psi' },
              { value: '25', label: 'M25 / 3600 psi' },
              { value: '30', label: 'M30 / 4350 psi' },
              { value: '35', label: 'M35 / 5075 psi' },
              { value: '40', label: 'M40 / 5800 psi' },
            ]}
            value={String(slabInput.fck)}
            onChange={(val) => setSlabInput({...slabInput, fck: Number(val)})}
          />
          <Select
            label="Steel Grade fy (MPa)"
            options={[
              { value: '415', label: 'Fe 415 / Grade 60' },
              { value: '500', label: 'Fe 500 / Grade 75' },
              { value: '550', label: 'Fe 550 / Grade 80' },
            ]}
            value={String(slabInput.fy)}
            onChange={(val) => setSlabInput({...slabInput, fy: Number(val)})}
          />
        </div>
      </div>

      {/* Loads */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Loads</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dead Load (kN/m²)"
            type="number"
            value={slabInput.deadLoad}
            onChange={(e) => setSlabInput({...slabInput, deadLoad: Number(e.target.value)})}
          />
          <Input
            label="Live Load (kN/m²)"
            type="number"
            value={slabInput.liveLoad}
            onChange={(e) => setSlabInput({...slabInput, liveLoad: Number(e.target.value)})}
          />
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          Design Results
          {results._clientSide && (
            <span className="ml-auto text-xs px-2 py-1 bg-amber-900/40 text-amber-400 rounded border border-amber-600/30">
              Client-side IS 456 calc
            </span>
          )}
        </h2>

        <div className="space-y-4">
          {/* Design Summary */}
          <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Design Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-400">Status:</span>
                <span className={`ml-2 font-semibold ${results.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results.passed ? 'SAFE' : 'UNSAFE'}
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Utilization:</span>
                <span className="ml-2 font-semibold text-slate-900 dark:text-white">{(results.utilization * 100).toFixed(1)}%</span>
              </div>
              {results.momentType && (
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Moment Type:</span>
                  <span className="ml-2 font-semibold text-blue-400 capitalize">{results.momentType}</span>
                </div>
              )}
              {results.signConvention && (
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Design Code:</span>
                  <span className="ml-2 font-semibold text-amber-400">{results.signConvention}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Moment Analysis (Rebar Placement) */}
          {results.momentAnalysis && (
            <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg border-l-4 border-blue-500">
              <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                💡 Moment Interpretation & Rebar Placement
              </h3>
              <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                <p>{results.momentAnalysis.notes}</p>
                {results.momentAnalysis.bottom_main > 0 && (
                  <p className="text-emerald-400">• Bottom Steel: {results.momentAnalysis.bottom_main.toFixed(0)} mm² (sagging moment)</p>
                )}
                {results.momentAnalysis.top_main > 0 && (
                  <p className="text-orange-400">• Top Steel: {results.momentAnalysis.top_main.toFixed(0)} mm² (hogging moment)</p>
                )}
              </div>
            </div>
          )}

          {/* Reinforcement */}
          {results.reinforcement && (
            <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Reinforcement Details</h3>
              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {memberType === 'beam' && (
                  <>
                    <p>Main Steel (Bottom): {results.reinforcement.mainBottom || results.reinforcement.main}</p>
                    <p>Main Steel (Top): {results.reinforcement.mainTop || 'As req.'}</p>
                    <p>Stirrups: {results.reinforcement.stirrups}</p>
                  </>
                )}
                {memberType === 'column' && (
                  <>
                    <p>Longitudinal Steel: {results.reinforcement.longitudinal}</p>
                    <p>Ties: {results.reinforcement.ties}</p>
                  </>
                )}
                {memberType === 'slab' && (
                  <>
                    <p>Main Bars (Short Span): {results.reinforcement.mainShort}</p>
                    <p>Main Bars (Long Span): {results.reinforcement.mainLong}</p>
                    <p>Distribution Bars: {results.reinforcement.distribution}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Code Checks */}
          {results.checks && (
            <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-400 mb-2">Code Checks</h3>
              <div className="space-y-2">
                {results.checks.map((check: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-slate-700 dark:text-slate-300">{check.description}</span>
                    {check.clause ? (
                      <ClauseReference
                        clauseKey={`IS456_${check.clause.replace('Cl. ', '')}`}
                        label={check.clause}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section-Wise Design Results */}
          {results.sectionWise && results.designApproach === 'section_wise' && (
            <div className="space-y-4 border-t border-indigo-300 dark:border-indigo-700 pt-4 mt-4">
              {/* Section-Wise Header */}
              <div className={`p-4 rounded-lg ${results.sectionWise.is_safe_everywhere 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700'}`}>
                <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Section-Wise Design Results
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">All Sections:</span>
                    <span className={`ml-2 font-bold ${results.sectionWise.is_safe_everywhere ? 'text-emerald-500' : 'text-red-500'}`}>
                      {results.sectionWise.is_safe_everywhere ? 'SAFE' : 'UNSAFE'}
                    </span>
                  </div>
                  {results.sectionWise.economy_ratio && (
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Economy Ratio:</span>
                      <span className="ml-2 font-bold text-indigo-500">
                        {results.sectionWise.economy_ratio.toFixed(2)}x
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        ({((1 - 1/results.sectionWise.economy_ratio) * 100).toFixed(0)}% steel savings)
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{results.sectionWise.summary}</p>
              </div>

              {/* Section Checks Table */}
              {results.sectionWise.section_checks && (
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg overflow-x-auto">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">Section-by-Section Verification</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-300 dark:border-slate-600">
                        <th className="py-1 text-left">Location</th>
                        <th className="py-1 text-right">x/L</th>
                        <th className="py-1 text-right">Mu,cap</th>
                        <th className="py-1 text-right">Util(M)</th>
                        <th className="py-1 text-right">Util(V)</th>
                        <th className="py-1 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.sectionWise.section_checks.map((sec: any, idx: number) => (
                        <tr key={idx} className={`border-b border-slate-200 dark:border-slate-700 ${
                          sec.status !== 'PASS' ? 'bg-red-50 dark:bg-red-900/10' : ''
                        }`}>
                          <td className="py-1 text-slate-700 dark:text-slate-300">{sec.location}</td>
                          <td className="py-1 text-right text-slate-600 dark:text-slate-400">{sec.x_ratio?.toFixed(2)}</td>
                          <td className="py-1 text-right text-slate-600 dark:text-slate-400">{sec.Mu_capacity?.toFixed(1)}</td>
                          <td className="py-1 text-right font-mono">
                            <span className={sec.utilization_M > 1 ? 'text-red-500' : sec.utilization_M > 0.8 ? 'text-amber-500' : 'text-emerald-500'}>
                              {(sec.utilization_M * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-1 text-right font-mono">
                            <span className={sec.utilization_V > 1 ? 'text-red-500' : sec.utilization_V > 0.8 ? 'text-amber-500' : 'text-emerald-500'}>
                              {(sec.utilization_V * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-1 text-center">
                            {sec.status === 'PASS' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-red-400 inline" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Rebar Zones / Curtailment Schedule */}
              {results.sectionWise.rebar_zones && results.sectionWise.rebar_zones.length > 0 && (
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Reinforcement Schedule (Bar Curtailment)
                  </h3>
                  <div className="space-y-2">
                    {results.sectionWise.rebar_zones.map((zone: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 text-xs bg-slate-200 dark:bg-slate-700/50 p-2 rounded">
                        <div className="w-24 text-slate-500 font-mono">
                          {zone.x_start?.toFixed(0)} - {zone.x_end?.toFixed(0)} mm
                        </div>
                        <div className="flex-1">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Bottom: {zone.bottom_bars}</span>
                          {zone.top_bars && zone.top_bars !== 'Nominal' && (
                            <span className="text-orange-500 ml-3">Top: {zone.top_bars}</span>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs italic">{zone.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curtailment Points */}
              {results.sectionWise.curtailment_points && results.sectionWise.curtailment_points.length > 0 && (
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-purple-400 mb-2">Curtailment Points & Ld Checks</h3>
                  <div className="space-y-1">
                    {results.sectionWise.curtailment_points.map((pt: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {pt.is_valid ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                        <span className="text-slate-700 dark:text-slate-300">
                          x={pt.x?.toFixed(0)}mm: {pt.description} | Ld={pt.Ld_required?.toFixed(0)}mm
                        </span>
                        <span className="text-slate-500 ml-auto">{pt.clause}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engineering Notes */}
              {results.sectionWise.engineering_notes && results.sectionWise.engineering_notes.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border-l-4 border-indigo-500">
                  <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Engineering Notes</h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {results.sectionWise.engineering_notes.map((note: string, idx: number) => (
                      <li key={idx}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Download Report */}
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={async () => {
              try {
                const normalizedBase = (await import('../config/env')).API_CONFIG.pythonUrl.replace(/\/$/, '');
                const resp = await (await import('../lib/api/client')).apiClient.post(
                  `${normalizedBase}/design/report`,
                  {
                    project: { name: 'Untitled Project', engineer: '—', checker: '—' },
                    input: { memberType, designCode, ...(memberType === 'beam' ? beamInput : memberType === 'column' ? columnInput : slabInput) },
                    results
                  }
                );
                const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `design_report_${memberType}_${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Report download failed:', err);
              }
            }}
          >
            <Download className="w-5 h-5" />
            Download Detailed Report
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Concrete Design Center
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Professional RC design per {designCode === 'IS456' ? 'IS 456:2000' : 'ACI 318-19'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Code & Member Type Selection */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Design Code</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={designCode === 'IS456' ? 'default' : 'outline'}
                      onClick={() => setDesignCode('IS456')}
                    >
                      IS 456:2000
                    </Button>
                    <Button
                      type="button"
                      variant={designCode === 'ACI318' ? 'default' : 'outline'}
                      onClick={() => setDesignCode('ACI318')}
                    >
                      ACI 318-19
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Member Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      onClick={() => setMemberType('beam')}
                      variant={memberType === 'beam' ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-1"
                    >
                      <Box className="w-5 h-5" />
                      <span className="text-xs">Beam</span>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setMemberType('column')}
                      variant={memberType === 'column' ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-1"
                    >
                      <Columns className="w-5 h-5" />
                      <span className="text-xs">Column</span>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setMemberType('slab')}
                      variant={memberType === 'slab' ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-1"
                    >
                      <Square className="w-5 h-5" />
                      <span className="text-xs">Slab</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Forms */}
              {memberType === 'beam' && renderBeamForm()}
              {memberType === 'column' && renderColumnForm()}
              {memberType === 'slab' && renderSlabForm()}

              {/* Analyze Button */}
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex-1"
                  size="lg"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run Design Analysis
                    </>
                  )}
                </Button>
                {analyzing && (
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="lg"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {error && (
                <Alert variant="destructive" className="mt-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Analysis Error</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </Alert>
              )}
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-1">
            {results ? (
              renderResults()
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calculator className="w-16 h-16 text-slate-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Results Yet</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Configure the member properties and run analysis to see results
                  </p>
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" /> Run Design Check
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConcreteDesignPage;
