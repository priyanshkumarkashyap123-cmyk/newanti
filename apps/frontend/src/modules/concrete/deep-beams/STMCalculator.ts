/**
 * Strut-and-Tie Model Design Calculator
 * Per ACI 318-19 Chapter 23
 * 
 * Features:
 * - Deep beam design
 * - Strut capacity (prismatic, bottle-shaped)
 * - Tie capacity and reinforcement design
 * - Nodal zone capacity
 * - Minimum skin reinforcement
 */

import {
  DRegionType,
  StrutType,
  NodeType,
  STMInput,
  STMResult,
  StrutCapacityResult,
  TieCapacityResult,
  NodeCapacityResult,
  StrutDefinition,
  TieDefinition,
  NodeDefinition,
  CalculationStep,
  STRUT_EFFECTIVENESS_FACTORS,
  NODE_EFFECTIVENESS_FACTORS,
  STM_RESISTANCE_FACTORS,
  DEEP_BEAM_MIN_REINFORCEMENT,
  REBAR_AREAS,
  isDeepBeam,
} from './STMTypes';

export class STMCalculator {
  private input: STMInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  // Model components
  private struts: StrutDefinition[] = [];
  private ties: TieDefinition[] = [];
  private nodes: NodeDefinition[] = [];
  
  constructor(input: STMInput) {
    this.input = input;
    
    // Initialize model from input or generate for deep beam
    if (input.struts && input.ties && input.nodes) {
      this.struts = input.struts;
      this.ties = input.ties;
      this.nodes = input.nodes;
    } else if (input.geometry && input.loading) {
      this.generateDeepBeamModel();
    }
  }
  
  /**
   * Main design method
   */
  public design(): STMResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { materials, geometry } = this.input;
    
    // Check if deep beam
    let isDeep = false;
    let spanToDepthRatio: number | undefined;
    if (geometry) {
      isDeep = isDeepBeam(geometry);
      spanToDepthRatio = geometry.ln / geometry.d;
      
      this.addStep(
        'Check if member is a deep beam',
        'Deep beam if ln/d ≤ 4',
        { ln: geometry.ln, d: geometry.d, 'ln/d': spanToDepthRatio.toFixed(2) },
        isDeep ? 'Yes - Deep beam' : 'No - Slender beam',
        undefined,
        'ACI 318-19 Section 9.9.1.1'
      );
    }
    
    // Step 1: Check strut capacities
    const strutResults = this.checkStruts();
    
    // Step 2: Check tie capacities
    const tieResults = this.checkTies();
    
    // Step 3: Check node capacities
    const nodeResults = this.checkNodes();
    
    // Step 4: Calculate minimum reinforcement (for deep beams)
    let minSkinReinf: { Ash: number; Asv: number } | undefined;
    if (geometry && isDeep) {
      minSkinReinf = this.calculateMinReinforcement();
    }
    
    // Determine governing ratios
    const strutRatio = Math.max(...strutResults.map(s => s.ratio), 0);
    const tieRatio = Math.max(...tieResults.map(t => t.ratio), 0);
    const nodeRatio = Math.max(...nodeResults.map(n => n.ratio), 0);
    const governingRatio = Math.max(strutRatio, tieRatio, nodeRatio);
    
    // Find governing element
    let governingElement = '';
    if (governingRatio === strutRatio && strutResults.length > 0) {
      governingElement = strutResults.find(s => s.ratio === strutRatio)?.strutId || '';
    } else if (governingRatio === tieRatio && tieResults.length > 0) {
      governingElement = tieResults.find(t => t.ratio === tieRatio)?.tieId || '';
    } else if (nodeResults.length > 0) {
      governingElement = nodeResults.find(n => n.ratio === nodeRatio)?.nodeId || '';
    }
    
    const isAdequate = 
      strutResults.every(s => s.isAdequate) &&
      tieResults.every(t => t.isAdequate) &&
      nodeResults.every(n => n.isAdequate);
    
    return {
      isAdequate,
      regionType: this.input.regionType,
      struts: strutResults,
      ties: tieResults,
      nodes: nodeResults,
      strutRatio,
      tieRatio,
      nodeRatio,
      governingRatio,
      governingElement,
      isDeepBeam: isDeep,
      spanToDepthRatio,
      minSkinReinf,
      calculations: this.calculations,
      codeReference: 'ACI 318-19 Chapter 23',
    };
  }
  
  /**
   * Generate STM model for a simple deep beam
   */
  private generateDeepBeamModel(): void {
    const { geometry, loading, materials } = this.input;
    if (!geometry || !loading) return;
    
    const { ln, h, bw, d, a_load } = geometry;
    const { Pu, loadType } = loading;
    
    // Simple single-point load deep beam model
    if (loadType === 'SINGLE_POINT') {
      const a = a_load || ln / 2;
      
      // Calculate strut angle
      const jd = 0.9 * d; // Approximate lever arm
      const theta = Math.atan(jd / a) * 180 / Math.PI;
      
      // Reactions
      const R_left = Pu * (ln - a) / ln;
      const R_right = Pu * a / ln;
      
      // Strut forces (compression)
      const F_strut_left = R_left / Math.sin(theta * Math.PI / 180);
      const F_strut_right = R_right / Math.sin(theta * Math.PI / 180);
      
      // Tie force (tension)
      const T_tie = R_left / Math.tan(theta * Math.PI / 180);
      
      // Bearing plate width (assume or use input)
      const wt = this.input.bearingPlateWidth || Math.min(bw, h / 5);
      
      // Create nodes
      this.nodes = [
        {
          id: 'N1',
          type: NodeType.CCT, // Support node with tie
          x: wt / 2,
          y: 0,
          width: wt,
          height: wt * Math.tan(theta * Math.PI / 180),
          struts: ['S1'],
          ties: ['T1'],
          Pu: R_left,
        },
        {
          id: 'N2',
          type: NodeType.CCC, // Load node (compression only)
          x: a,
          y: jd,
          width: wt,
          height: (d - jd) * 2,
          struts: ['S1', 'S2'],
          ties: [],
          Pu: Pu,
        },
        {
          id: 'N3',
          type: NodeType.CCT, // Support node with tie
          x: ln - wt / 2,
          y: 0,
          width: wt,
          height: wt * Math.tan(theta * Math.PI / 180),
          struts: ['S2'],
          ties: ['T1'],
          Pu: R_right,
        },
      ];
      
      // Create struts
      this.struts = [
        {
          id: 'S1',
          type: StrutType.BOTTLE_SHAPED_REINFORCED,
          length: Math.sqrt(a * a + jd * jd),
          width: wt * Math.sin(theta * Math.PI / 180),
          angle: theta,
          Fu: F_strut_left,
          startNode: 'N1',
          endNode: 'N2',
        },
        {
          id: 'S2',
          type: StrutType.BOTTLE_SHAPED_REINFORCED,
          length: Math.sqrt((ln - a) * (ln - a) + jd * jd),
          width: wt * Math.sin(theta * Math.PI / 180),
          angle: theta,
          Fu: F_strut_right,
          startNode: 'N2',
          endNode: 'N3',
        },
      ];
      
      // Create tie
      this.ties = [
        {
          id: 'T1',
          length: ln - wt,
          width: h - d + 2, // Tie zone depth
          angle: 0,
          Tu: T_tie,
          startNode: 'N1',
          endNode: 'N3',
        },
      ];
      
      this.addStep(
        'Generate STM model for deep beam',
        'Single point load at a from left support',
        {
          a: a.toFixed(1) + ' in',
          theta: theta.toFixed(1) + '°',
          R_left: R_left.toFixed(1) + ' kips',
          R_right: R_right.toFixed(1) + ' kips',
        },
        'Model with 2 struts, 1 tie, 3 nodes',
        undefined,
        'ACI 318-19 Chapter 23'
      );
    }
  }
  
  /**
   * Check strut capacities
   */
  private checkStruts(): StrutCapacityResult[] {
    const { materials } = this.input;
    const phi = STM_RESISTANCE_FACTORS.phi_strut;
    const lambda = materials.lambda || 1.0;
    
    const results: StrutCapacityResult[] = [];
    
    for (const strut of this.struts) {
      // Strut effectiveness factor
      const beta_s = STRUT_EFFECTIVENESS_FACTORS[strut.type] * lambda;
      
      // Effective compressive strength
      const fce = 0.85 * beta_s * materials.fc; // psi
      
      // Strut area (use minimum at nodes)
      const Acs = strut.width * (this.input.geometry?.bw || strut.width);
      
      // Nominal strength
      const Fns = fce * Acs / 1000; // kips
      
      // Design strength
      const phi_Fns = phi * Fns;
      
      // Ratio
      const ratio = strut.Fu / phi_Fns;
      
      results.push({
        strutId: strut.id,
        strutType: strut.type,
        fce,
        Fns,
        phi_Fns,
        Fu: strut.Fu,
        ratio,
        isAdequate: ratio <= 1.0,
        beta_s,
        Acs,
        angle: strut.angle,
      });
      
      this.addStep(
        `Check strut ${strut.id} capacity`,
        'φFns = φ × 0.85βsfc\' × Acs',
        {
          beta_s: beta_s.toFixed(2),
          fce: (fce / 1000).toFixed(2) + ' ksi',
          Acs: Acs.toFixed(1) + ' in²',
          Fu: strut.Fu.toFixed(1) + ' kips',
        },
        `φFns = ${phi_Fns.toFixed(1)} kips, Ratio = ${ratio.toFixed(3)}`,
        undefined,
        'ACI 318-19 Eq. 23.4.1'
      );
    }
    
    return results;
  }
  
  /**
   * Check tie capacities
   */
  private checkTies(): TieCapacityResult[] {
    const { materials } = this.input;
    const phi = STM_RESISTANCE_FACTORS.phi_tie;
    
    const results: TieCapacityResult[] = [];
    
    for (const tie of this.ties) {
      // Required reinforcement
      const As_required = tie.Tu * 1000 / (phi * materials.fy);
      
      // Provided reinforcement (or select)
      let As_provided = tie.As || 0;
      let barSize = tie.barSize || '';
      let nBars = tie.nBars || 0;
      
      if (!tie.As) {
        // Select reinforcement
        const selection = this.selectTieReinforcement(As_required);
        As_provided = selection.As;
        barSize = selection.barSize;
        nBars = selection.nBars;
      }
      
      // Nominal strength
      const Fnt = As_provided * materials.fy / 1000; // kips
      
      // Design strength
      const phi_Fnt = phi * Fnt;
      
      // Ratio
      const ratio = tie.Tu / phi_Fnt;
      
      results.push({
        tieId: tie.id,
        Fnt,
        phi_Fnt,
        Tu: tie.Tu,
        ratio,
        isAdequate: ratio <= 1.0,
        As_required,
        As_provided,
        barSize,
        nBars,
      });
      
      this.addStep(
        `Check tie ${tie.id} capacity`,
        'φFnt = φ × As × fy',
        {
          Tu: tie.Tu.toFixed(1) + ' kips',
          As_required: As_required.toFixed(2) + ' in²',
          As_provided: As_provided.toFixed(2) + ' in²',
          reinforcement: `${nBars}-${barSize}`,
        },
        `φFnt = ${phi_Fnt.toFixed(1)} kips, Ratio = ${ratio.toFixed(3)}`,
        undefined,
        'ACI 318-19 Section 23.7'
      );
    }
    
    return results;
  }
  
  /**
   * Check node capacities
   */
  private checkNodes(): NodeCapacityResult[] {
    const { materials } = this.input;
    const phi = STM_RESISTANCE_FACTORS.phi_node;
    const lambda = materials.lambda || 1.0;
    
    const results: NodeCapacityResult[] = [];
    
    for (const node of this.nodes) {
      // Node effectiveness factor
      const beta_n = NODE_EFFECTIVENESS_FACTORS[node.type] * lambda;
      
      // Effective compressive strength
      const fce = 0.85 * beta_n * materials.fc; // psi
      
      // Nodal zone area
      const Anz = node.width * (this.input.geometry?.bw || node.width);
      
      // Nominal strength
      const Fnn = fce * Anz / 1000; // kips
      
      // Design strength
      const phi_Fnn = phi * Fnn;
      
      // Maximum force at node (bearing or strut force component)
      const Fn = node.Pu || 0;
      
      // Ratio
      const ratio = Fn / phi_Fnn;
      
      results.push({
        nodeId: node.id,
        nodeType: node.type,
        fce,
        Fnn,
        phi_Fnn,
        Fn,
        ratio,
        isAdequate: ratio <= 1.0,
        beta_n,
        Anz,
      });
      
      this.addStep(
        `Check node ${node.id} (${node.type}) capacity`,
        'φFnn = φ × 0.85βnfc\' × Anz',
        {
          nodeType: node.type,
          beta_n: beta_n.toFixed(2),
          fce: (fce / 1000).toFixed(2) + ' ksi',
          Anz: Anz.toFixed(1) + ' in²',
          Fn: Fn.toFixed(1) + ' kips',
        },
        `φFnn = ${phi_Fnn.toFixed(1)} kips, Ratio = ${ratio.toFixed(3)}`,
        undefined,
        'ACI 318-19 Section 23.9'
      );
    }
    
    return results;
  }
  
  /**
   * Calculate minimum skin reinforcement for deep beams
   */
  private calculateMinReinforcement(): { Ash: number; Asv: number } {
    const { geometry } = this.input;
    if (!geometry) return { Ash: 0, Asv: 0 };
    
    const { bw, d } = geometry;
    
    // Minimum ratios per ACI 318-19 Section 9.9.3.1
    const rho_h = DEEP_BEAM_MIN_REINFORCEMENT.rho_h;
    const rho_v = DEEP_BEAM_MIN_REINFORCEMENT.rho_v;
    
    // Reinforcement per foot of height/length
    const Ash = rho_h * bw * 12; // in²/ft height
    const Asv = rho_v * bw * 12; // in²/ft length
    
    // Maximum spacing
    const s_max = Math.min(d / 5, DEEP_BEAM_MIN_REINFORCEMENT.max_spacing_h);
    
    this.addStep(
      'Calculate minimum distributed reinforcement',
      'ρh ≥ 0.0025, ρv ≥ 0.0025',
      {
        bw: bw.toFixed(1) + ' in',
        rho_h: (rho_h * 100).toFixed(2) + '%',
        rho_v: (rho_v * 100).toFixed(2) + '%',
        s_max: s_max.toFixed(1) + ' in',
      },
      `Ash = ${Ash.toFixed(2)} in²/ft, Asv = ${Asv.toFixed(2)} in²/ft`,
      undefined,
      'ACI 318-19 Section 9.9.3.1'
    );
    
    return { Ash, Asv };
  }
  
  /**
   * Select tie reinforcement
   */
  private selectTieReinforcement(As_required: number): { As: number; barSize: string; nBars: number } {
    const barSizes = ['#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11'];
    
    for (const barSize of barSizes) {
      const Ab = REBAR_AREAS[barSize];
      for (let nBars = 2; nBars <= 12; nBars++) {
        const As = nBars * Ab;
        if (As >= As_required) {
          return { As, barSize, nBars };
        }
      }
    }
    
    // Fallback: use #11 bars
    const nBars = Math.ceil(As_required / REBAR_AREAS['#11']);
    return { As: nBars * REBAR_AREAS['#11'], barSize: '#11', nBars };
  }
  
  /**
   * Add calculation step
   */
  private addStep(
    description: string,
    formula?: string,
    values?: Record<string, number | string>,
    result?: number | string,
    unit?: string,
    reference?: string
  ): void {
    this.calculations.push({
      step: this.stepCounter++,
      description,
      formula,
      values,
      result: result ?? '',
      unit,
      reference,
    });
  }
}

// Export convenience function
export function designSTM(input: STMInput): STMResult {
  const calculator = new STMCalculator(input);
  return calculator.design();
}
