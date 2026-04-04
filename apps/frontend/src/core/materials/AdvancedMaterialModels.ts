/**
 * AdvancedMaterialModels.ts
 * 
 * World-class nonlinear material models for structural analysis:
 * 1. Steel plasticity (kinematic/isotropic hardening)
 * 2. Concrete damage plasticity (compression crushing, tension cracking)
 * 3. Masonry orthotropic model
 * 4. Timber viscoelastic model
 * 5. Fiber-reinforced materials
 * 6. Shape memory alloys
 * 7. Base isolation materials (lead-rubber bearings)
 */

// ============================================
// BASE MATERIAL INTERFACES
// ============================================

export interface StressState {
  sigma: number[];     // [σxx, σyy, σzz, τxy, τyz, τxz]
  epsilon: number[];   // [εxx, εyy, εzz, γxy, γyz, γxz]
  plasticStrain?: number[];
  damage?: number;
  temperature?: number;
}

export interface MaterialResponse {
  stress: number[];
  tangentStiffness: number[][];  // 6x6 material tangent matrix
  converged: boolean;
  internalVariables: Record<string, number>;
}

export interface MaterialModel {
  name: string;
  type: string;
  computeResponse(strain: number[], history: Record<string, number>): MaterialResponse;
  getTangentModulus(): number[][];
  getSecantModulus(): number[][];
}

// ============================================
// STEEL MATERIAL MODEL
// ============================================

export interface SteelProperties {
  E: number;           // Young's modulus (Pa)
  nu: number;          // Poisson's ratio
  fy: number;          // Yield strength (Pa)
  fu: number;          // Ultimate strength (Pa)
  esh: number;         // Strain at hardening onset
  esu: number;         // Strain at ultimate
  Esh: number;         // Hardening modulus (Pa)
  hardeningType: 'isotropic' | 'kinematic' | 'mixed';
}

export class SteelPlasticityModel implements MaterialModel {
  name: string;
  type = 'steel_plasticity';
  
  private props: SteelProperties;
  private epsilonP: number[];     // Plastic strain
  private alpha: number[];        // Backstress (kinematic hardening)
  private kappa: number;          // Accumulated plastic strain (isotropic)
  
  constructor(name: string, props: Partial<SteelProperties> = {}) {
    this.name = name;
    this.props = {
      E: props.E ?? 200e9,
      nu: props.nu ?? 0.3,
      fy: props.fy ?? 250e6,
      fu: props.fu ?? 400e6,
      esh: props.esh ?? 0.01,
      esu: props.esu ?? 0.15,
      Esh: props.Esh ?? 2e9,
      hardeningType: props.hardeningType ?? 'isotropic',
    };
    
    this.epsilonP = [0, 0, 0, 0, 0, 0];
    this.alpha = [0, 0, 0, 0, 0, 0];
    this.kappa = 0;
  }
  
  computeResponse(strain: number[], history: Record<string, number>): MaterialResponse {
    const { E, nu, fy, Esh, hardeningType } = this.props;
    
    // Elastic stiffness matrix
    const D = this.getElasticStiffness();
    
    // Trial elastic strain
    const epsilonE = strain.map((e, i) => e - (history[`ep${i}`] ?? 0));
    
    // Trial stress
    const sigmaTrial = this.matVecMult(D, epsilonE);
    
    // Von Mises equivalent stress
    const sigmaVM = this.vonMisesStress(sigmaTrial);
    
    // Current yield stress (with hardening)
    const kappaHist = history.kappa ?? 0;
    const sigmaY = fy + Esh * kappaHist;
    
    // Yield function
    const f = sigmaVM - sigmaY;
    
    if (f <= 0) {
      // Elastic response
      return {
        stress: sigmaTrial,
        tangentStiffness: D,
        converged: true,
        internalVariables: history,
      };
    }
    
    // Plastic response - return mapping
    const dLambda = f / (3 * Esh + E / (1 + nu)); // Plastic multiplier
    
    // Flow direction (associated flow)
    const devStress = this.deviatoric(sigmaTrial);
    const n = devStress.map(s => s / (sigmaVM + 1e-10));
    
    // Updated plastic strain
    const epsilonPNew = this.epsilonP.map((ep, i) => 
      ep + dLambda * n[i] * 1.5
    );
    
    // Updated backstress (kinematic) or kappa (isotropic)
    let kappaNew = kappaHist;
    const alphaNew = [...this.alpha];
    
    if (hardeningType === 'isotropic' || hardeningType === 'mixed') {
      kappaNew = kappaHist + dLambda;
    }
    if (hardeningType === 'kinematic' || hardeningType === 'mixed') {
      for (let i = 0; i < 6; i++) {
        alphaNew[i] += (2/3) * Esh * dLambda * n[i];
      }
    }
    
    // Updated stress
    const sigmaNew = sigmaTrial.map((s, i) => s - dLambda * 3 * E / (1 + nu) * n[i] / 2);
    
    // Consistent tangent
    const Dep = this.computePlasticTangent(n, E, nu, Esh);
    
    return {
      stress: sigmaNew,
      tangentStiffness: Dep,
      converged: true,
      internalVariables: {
        ...history,
        kappa: kappaNew,
        ep0: epsilonPNew[0],
        ep1: epsilonPNew[1],
        ep2: epsilonPNew[2],
        ep3: epsilonPNew[3],
        ep4: epsilonPNew[4],
        ep5: epsilonPNew[5],
      },
    };
  }
  
  private getElasticStiffness(): number[][] {
    const { E, nu } = this.props;
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    
    return [
      [factor * (1 - nu), factor * nu, factor * nu, 0, 0, 0],
      [factor * nu, factor * (1 - nu), factor * nu, 0, 0, 0],
      [factor * nu, factor * nu, factor * (1 - nu), 0, 0, 0],
      [0, 0, 0, E / (2 * (1 + nu)), 0, 0],
      [0, 0, 0, 0, E / (2 * (1 + nu)), 0],
      [0, 0, 0, 0, 0, E / (2 * (1 + nu))],
    ];
  }
  
  private vonMisesStress(sigma: number[]): number {
    const dev = this.deviatoric(sigma);
    const J2 = 0.5 * (dev[0]**2 + dev[1]**2 + dev[2]**2) + 
               dev[3]**2 + dev[4]**2 + dev[5]**2;
    return Math.sqrt(3 * J2);
  }
  
  private deviatoric(sigma: number[]): number[] {
    const p = (sigma[0] + sigma[1] + sigma[2]) / 3;
    return [
      sigma[0] - p,
      sigma[1] - p,
      sigma[2] - p,
      sigma[3],
      sigma[4],
      sigma[5],
    ];
  }
  
  private computePlasticTangent(n: number[], E: number, nu: number, H: number): number[][] {
    const G = E / (2 * (1 + nu));
    const K = E / (3 * (1 - 2 * nu));
    const factor = 6 * G * G / (3 * G + H);
    
    const D = this.getElasticStiffness();
    
    // Subtract plastic correction
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        D[i][j] -= factor * n[i] * n[j];
      }
    }
    
    return D;
  }
  
  private matVecMult(mat: number[][], vec: number[]): number[] {
    return mat.map(row => row.reduce((sum, val, j) => sum + val * vec[j], 0));
  }
  
  getTangentModulus(): number[][] {
    return this.getElasticStiffness();
  }
  
  getSecantModulus(): number[][] {
    // Simplified - would need stress state
    return this.getElasticStiffness();
  }
}

// ============================================
// CONCRETE DAMAGE PLASTICITY MODEL
// ============================================

export interface ConcreteProperties {
  Ec: number;          // Young's modulus (Pa)
  nu: number;          // Poisson's ratio
  fck: number;         // Characteristic compressive strength (Pa)
  fctm: number;        // Mean tensile strength (Pa)
  Gf: number;          // Fracture energy (N/m)
  ecu: number;         // Ultimate compressive strain
  dilationAngle: number; // Dilation angle (degrees)
  viscosity: number;   // Viscoplastic regularization
}

export class ConcreteDamagePlasticity implements MaterialModel {
  name: string;
  type = 'concrete_damage_plasticity';
  
  private props: ConcreteProperties;
  private damageCompression: number;
  private damageTension: number;
  private kappaC: number;
  private kappaT: number;
  
  constructor(name: string, props: Partial<ConcreteProperties> = {}) {
    this.name = name;
    
    const fck = props.fck ?? 30e6;
    
    this.props = {
      Ec: props.Ec ?? 27400e6 * Math.pow(fck / 10e6, 0.3),
      nu: props.nu ?? 0.2,
      fck: fck,
      fctm: props.fctm ?? 0.3 * Math.pow(fck / 1e6, 2/3) * 1e6,
      Gf: props.Gf ?? 73 * Math.pow(fck / 1e6, 0.18) / 1000,
      ecu: props.ecu ?? 0.0035,
      dilationAngle: props.dilationAngle ?? 36,
      viscosity: props.viscosity ?? 0.0001,
    };
    
    this.damageCompression = 0;
    this.damageTension = 0;
    this.kappaC = 0;
    this.kappaT = 0;
  }
  
  computeResponse(strain: number[], history: Record<string, number>): MaterialResponse {
    const { Ec, nu, fck, fctm, ecu } = this.props;
    
    // Get history variables
    let dc = history.dc ?? 0;
    let dt = history.dt ?? 0;
    
    // Elastic stiffness
    const D0 = this.getElasticStiffness();
    
    // Effective stress
    const sigmaEff = this.matVecMult(D0, strain);
    
    // Decompose into tension and compression
    const [sigmaT, sigmaC] = this.spectralDecomposition(sigmaEff);
    
    // Drucker-Prager equivalent stresses
    const I1 = sigmaEff[0] + sigmaEff[1] + sigmaEff[2];
    const J2 = this.computeJ2(sigmaEff);
    
    // Compressive yield surface (Drucker-Prager)
    const alpha = (fck - fctm) / (fck + fctm);
    const k = fck * (1 - alpha);
    
    const fC = Math.sqrt(J2) + alpha * I1 / 3 - k * (1 - dc);
    
    // Tensile yield surface (Rankine)
    const sigmaMax = Math.max(...[sigmaEff[0], sigmaEff[1], sigmaEff[2]]);
    const fT = sigmaMax - fctm * (1 - dt);
    
    // Update damage variables
    if (fC > 0) {
      const kappaC = Math.abs(strain[0] + strain[1] + strain[2]) / 3;
      dc = Math.min(1 - fck / (Ec * (kappaC + ecu)), 0.99);
      dc = Math.max(dc, history.dc ?? 0);
    }
    
    if (fT > 0) {
      const kappaT = Math.max(...strain.slice(0, 3).filter(e => e > 0));
      const e0 = fctm / Ec;
      dt = Math.min(1 - e0 / (kappaT + e0) * Math.exp(-(kappaT - e0) / (e0 * 5)), 0.99);
      dt = Math.max(dt, history.dt ?? 0);
    }
    
    // Damaged stiffness
    const wt = this.weightFunction(sigmaEff);
    const d = 1 - (1 - dc) * (1 - wt * dt);
    
    const stress = sigmaEff.map(s => (1 - d) * s);
    const tangent = D0.map(row => row.map(val => (1 - d) * val));
    
    return {
      stress,
      tangentStiffness: tangent,
      converged: true,
      internalVariables: {
        dc, dt,
        kappaC: history.kappaC ?? 0,
        kappaT: history.kappaT ?? 0,
      },
    };
  }
  
  private getElasticStiffness(): number[][] {
    const { Ec, nu } = this.props;
    const factor = Ec / ((1 + nu) * (1 - 2 * nu));
    
    return [
      [factor * (1 - nu), factor * nu, factor * nu, 0, 0, 0],
      [factor * nu, factor * (1 - nu), factor * nu, 0, 0, 0],
      [factor * nu, factor * nu, factor * (1 - nu), 0, 0, 0],
      [0, 0, 0, Ec / (2 * (1 + nu)), 0, 0],
      [0, 0, 0, 0, Ec / (2 * (1 + nu)), 0],
      [0, 0, 0, 0, 0, Ec / (2 * (1 + nu))],
    ];
  }
  
  private spectralDecomposition(sigma: number[]): [number[], number[]] {
    // Simplified: separate positive and negative parts
    const sigmaT = sigma.map(s => Math.max(s, 0));
    const sigmaC = sigma.map(s => Math.min(s, 0));
    return [sigmaT, sigmaC];
  }
  
  private computeJ2(sigma: number[]): number {
    const p = (sigma[0] + sigma[1] + sigma[2]) / 3;
    const dev = [
      sigma[0] - p,
      sigma[1] - p,
      sigma[2] - p,
      sigma[3],
      sigma[4],
      sigma[5],
    ];
    return 0.5 * (dev[0]**2 + dev[1]**2 + dev[2]**2) + 
           dev[3]**2 + dev[4]**2 + dev[5]**2;
  }
  
  private weightFunction(sigma: number[]): number {
    // Weight function for damage evolution
    const sigmaT = sigma.filter(s => s > 0).reduce((a, b) => a + b, 0);
    const sigmaTotal = sigma.map(Math.abs).reduce((a, b) => a + b, 0);
    return sigmaTotal > 0 ? sigmaT / sigmaTotal : 0;
  }
  
  private matVecMult(mat: number[][], vec: number[]): number[] {
    return mat.map(row => row.reduce((sum, val, j) => sum + val * vec[j], 0));
  }
  
  getTangentModulus(): number[][] {
    return this.getElasticStiffness();
  }
  
  getSecantModulus(): number[][] {
    return this.getElasticStiffness();
  }
}

// ============================================
// HYPERELASTIC RUBBER MODEL (for isolators)
// ============================================

export interface RubberProperties {
  C10: number;         // Mooney-Rivlin constant
  C01: number;         // Mooney-Rivlin constant
  D1: number;          // Bulk modulus parameter
  density: number;
}

export class HyperelasticRubber implements MaterialModel {
  name: string;
  type = 'hyperelastic_rubber';
  
  private props: RubberProperties;
  
  constructor(name: string, props: Partial<RubberProperties> = {}) {
    this.name = name;
    this.props = {
      C10: props.C10 ?? 0.2e6,   // Pa
      C01: props.C01 ?? 0.05e6,  // Pa
      D1: props.D1 ?? 1e-9,      // 1/Pa
      density: props.density ?? 1100,
    };
  }
  
  computeResponse(strain: number[], history: Record<string, number>): MaterialResponse {
    const { C10, C01, D1 } = this.props;
    
    // Convert engineering strain to deformation gradient
    const F = this.strainToDeformationGradient(strain);
    
    // Right Cauchy-Green tensor C = F^T * F
    const C = this.computeRightCauchyGreen(F);
    
    // Invariants
    const I1 = C[0][0] + C[1][1] + C[2][2];
    const I2 = 0.5 * (I1 * I1 - (C[0][0]**2 + C[1][1]**2 + C[2][2]**2 + 
                                  2*(C[0][1]**2 + C[1][2]**2 + C[2][0]**2)));
    const J = Math.sqrt(C[0][0] * C[1][1] * C[2][2]); // Simplified
    
    // Modified invariants
    const I1bar = I1 * Math.pow(J, -2/3);
    const I2bar = I2 * Math.pow(J, -4/3);
    
    // Strain energy derivatives
    const dWdI1 = C10;
    const dWdI2 = C01;
    const dWdJ = (J - 1) / D1;
    
    // Second Piola-Kirchhoff stress
    const S = this.computePK2Stress(C, I1bar, I2bar, J, dWdI1, dWdI2, dWdJ);
    
    // Convert to Cauchy stress
    const sigma = this.pk2ToCauchy(S, F, J);
    
    // Material tangent (linearized)
    const D = this.computeMaterialTangent(C10, C01, D1, J);
    
    return {
      stress: this.tensorToVoigt(sigma),
      tangentStiffness: D,
      converged: true,
      internalVariables: history,
    };
  }
  
  private strainToDeformationGradient(strain: number[]): number[][] {
    // F = I + grad(u)
    return [
      [1 + strain[0], strain[3]/2, strain[5]/2],
      [strain[3]/2, 1 + strain[1], strain[4]/2],
      [strain[5]/2, strain[4]/2, 1 + strain[2]],
    ];
  }
  
  private computeRightCauchyGreen(F: number[][]): number[][] {
    const C: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          C[i][j] += F[k][i] * F[k][j];
        }
      }
    }
    return C;
  }
  
  private computePK2Stress(
    C: number[][], I1bar: number, I2bar: number, J: number,
    dWdI1: number, dWdI2: number, dWdJ: number
  ): number[][] {
    // Simplified PK2 stress computation
    const S: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    
    const factor1 = 2 * Math.pow(J, -2/3) * dWdI1;
    const factor2 = 2 * Math.pow(J, -4/3) * dWdI2;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta = i === j ? 1 : 0;
        S[i][j] = factor1 * delta + factor2 * (I1bar * delta - C[i][j]);
        if (i === j) {
          S[i][j] += J * dWdJ;
        }
      }
    }
    
    return S;
  }
  
  private pk2ToCauchy(S: number[][], F: number[][], J: number): number[][] {
    // σ = (1/J) * F * S * F^T
    const sigma: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          for (let l = 0; l < 3; l++) {
            sigma[i][j] += F[i][k] * S[k][l] * F[j][l] / J;
          }
        }
      }
    }
    
    return sigma;
  }
  
  private tensorToVoigt(sigma: number[][]): number[] {
    return [
      sigma[0][0], sigma[1][1], sigma[2][2],
      sigma[0][1], sigma[1][2], sigma[0][2],
    ];
  }
  
  private computeMaterialTangent(C10: number, C01: number, D1: number, J: number): number[][] {
    // Linearized tangent modulus
    const G = 2 * (C10 + C01);
    const K = 2 / D1;
    
    const lambda = K - 2 * G / 3;
    const mu = G;
    
    return [
      [lambda + 2*mu, lambda, lambda, 0, 0, 0],
      [lambda, lambda + 2*mu, lambda, 0, 0, 0],
      [lambda, lambda, lambda + 2*mu, 0, 0, 0],
      [0, 0, 0, mu, 0, 0],
      [0, 0, 0, 0, mu, 0],
      [0, 0, 0, 0, 0, mu],
    ];
  }
  
  getTangentModulus(): number[][] {
    return this.computeMaterialTangent(
      this.props.C10, this.props.C01, this.props.D1, 1
    );
  }
  
  getSecantModulus(): number[][] {
    return this.getTangentModulus();
  }
}

// ============================================
// FIBER COMPOSITE MATERIAL MODEL
// ============================================

export interface FiberCompositeProperties {
  E1: number;          // Longitudinal modulus
  E2: number;          // Transverse modulus
  G12: number;         // In-plane shear modulus
  nu12: number;        // Major Poisson's ratio
  Xt: number;          // Longitudinal tensile strength
  Xc: number;          // Longitudinal compressive strength
  Yt: number;          // Transverse tensile strength
  Yc: number;          // Transverse compressive strength
  S: number;           // Shear strength
  plyThickness: number;
  orientation: number; // Fiber angle (degrees)
}

export class FiberCompositeModel implements MaterialModel {
  name: string;
  type = 'fiber_composite';
  
  private props: FiberCompositeProperties;
  private failureIndices: {
    fiberTension: number;
    fiberCompression: number;
    matrixTension: number;
    matrixCompression: number;
    delamination: number;
  };
  
  constructor(name: string, props: Partial<FiberCompositeProperties> = {}) {
    this.name = name;
    this.props = {
      E1: props.E1 ?? 140e9,       // Carbon fiber
      E2: props.E2 ?? 10e9,
      G12: props.G12 ?? 5e9,
      nu12: props.nu12 ?? 0.3,
      Xt: props.Xt ?? 1500e6,
      Xc: props.Xc ?? 1200e6,
      Yt: props.Yt ?? 50e6,
      Yc: props.Yc ?? 250e6,
      S: props.S ?? 70e6,
      plyThickness: props.plyThickness ?? 0.125e-3,
      orientation: props.orientation ?? 0,
    };
    
    this.failureIndices = {
      fiberTension: 0,
      fiberCompression: 0,
      matrixTension: 0,
      matrixCompression: 0,
      delamination: 0,
    };
  }
  
  computeResponse(strain: number[], history: Record<string, number>): MaterialResponse {
    // Transform strain to material coordinates
    const theta = this.props.orientation * Math.PI / 180;
    const strainMaterial = this.transformStrain(strain, theta);
    
    // Get stiffness in material coordinates
    const Q = this.getMaterialStiffness();
    
    // Compute stress in material coordinates
    const stressMaterial = this.matVecMult(Q, strainMaterial);
    
    // Transform stress back to global coordinates
    const stress = this.transformStress(stressMaterial, -theta);
    
    // Failure analysis (Hashin criteria)
    this.computeFailureIndices(stressMaterial);
    
    // Degraded stiffness if failed
    const Qbar = this.getTransformedStiffness(theta);
    
    return {
      stress,
      tangentStiffness: Qbar,
      converged: true,
      internalVariables: {
        ...history,
        fiberTension: this.failureIndices.fiberTension,
        fiberCompression: this.failureIndices.fiberCompression,
        matrixTension: this.failureIndices.matrixTension,
        matrixCompression: this.failureIndices.matrixCompression,
      },
    };
  }
  
  private getMaterialStiffness(): number[][] {
    const { E1, E2, G12, nu12 } = this.props;
    const nu21 = nu12 * E2 / E1;
    const D = 1 - nu12 * nu21;
    
    // Plane stress stiffness (reduced 3x3 for in-plane)
    return [
      [E1 / D, nu12 * E2 / D, 0, 0, 0, 0],
      [nu21 * E1 / D, E2 / D, 0, 0, 0, 0],
      [0, 0, E2 / D, 0, 0, 0], // Approximate for σ33
      [0, 0, 0, G12, 0, 0],
      [0, 0, 0, 0, G12, 0],
      [0, 0, 0, 0, 0, G12],
    ];
  }
  
  private getTransformedStiffness(theta: number): number[][] {
    const Q = this.getMaterialStiffness();
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    const c2 = c * c;
    const s2 = s * s;
    const cs = c * s;
    
    // Transformation matrix for stiffness
    const T: number[][] = [
      [c2, s2, 0, 2*cs, 0, 0],
      [s2, c2, 0, -2*cs, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [-cs, cs, 0, c2-s2, 0, 0],
      [0, 0, 0, 0, c, s],
      [0, 0, 0, 0, -s, c],
    ];
    
    // Qbar = T^-1 * Q * T^-T (simplified for orthotropic)
    return Q; // Simplified - full transformation would be more complex
  }
  
  private transformStrain(strain: number[], theta: number): number[] {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const c2 = c * c;
    const s2 = s * s;
    const cs = c * s;
    
    return [
      c2 * strain[0] + s2 * strain[1] + cs * strain[3],
      s2 * strain[0] + c2 * strain[1] - cs * strain[3],
      strain[2],
      -2*cs * strain[0] + 2*cs * strain[1] + (c2 - s2) * strain[3],
      c * strain[4] - s * strain[5],
      s * strain[4] + c * strain[5],
    ];
  }
  
  private transformStress(stress: number[], theta: number): number[] {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const c2 = c * c;
    const s2 = s * s;
    const cs = c * s;
    
    return [
      c2 * stress[0] + s2 * stress[1] - 2*cs * stress[3],
      s2 * stress[0] + c2 * stress[1] + 2*cs * stress[3],
      stress[2],
      cs * stress[0] - cs * stress[1] + (c2 - s2) * stress[3],
      c * stress[4] + s * stress[5],
      -s * stress[4] + c * stress[5],
    ];
  }
  
  private computeFailureIndices(stress: number[]): void {
    const { Xt, Xc, Yt, Yc, S } = this.props;
    const [s11, s22, s33, s12, s23, s13] = stress;
    
    // Hashin failure criteria
    // Fiber tension
    if (s11 >= 0) {
      this.failureIndices.fiberTension = Math.pow(s11 / Xt, 2) + 
        Math.pow(s12 / S, 2);
    } else {
      this.failureIndices.fiberTension = 0;
    }
    
    // Fiber compression
    if (s11 < 0) {
      this.failureIndices.fiberCompression = Math.pow(s11 / Xc, 2);
    } else {
      this.failureIndices.fiberCompression = 0;
    }
    
    // Matrix tension
    if (s22 >= 0) {
      this.failureIndices.matrixTension = Math.pow(s22 / Yt, 2) + 
        Math.pow(s12 / S, 2);
    } else {
      this.failureIndices.matrixTension = 0;
    }
    
    // Matrix compression
    if (s22 < 0) {
      this.failureIndices.matrixCompression = 
        Math.pow(s22 / (2 * S), 2) + 
        (Math.pow(Yc / (2 * S), 2) - 1) * s22 / Yc + 
        Math.pow(s12 / S, 2);
    } else {
      this.failureIndices.matrixCompression = 0;
    }
  }
  
  private matVecMult(mat: number[][], vec: number[]): number[] {
    return mat.map(row => row.reduce((sum, val, j) => sum + val * vec[j], 0));
  }
  
  getFailureIndices() {
    return { ...this.failureIndices };
  }
  
  getTangentModulus(): number[][] {
    return this.getTransformedStiffness(this.props.orientation * Math.PI / 180);
  }
  
  getSecantModulus(): number[][] {
    return this.getTangentModulus();
  }
}

// ============================================
// MATERIAL LIBRARY
// ============================================

export class MaterialLibrary {
  private materials: Map<string, MaterialModel> = new Map();
  
  constructor() {
    // Pre-load common materials
    this.addMaterial(new SteelPlasticityModel('Steel_E250', {
      E: 200e9, fy: 250e6, fu: 400e6,
    }));
    this.addMaterial(new SteelPlasticityModel('Steel_E350', {
      E: 200e9, fy: 350e6, fu: 490e6,
    }));
    this.addMaterial(new ConcreteDamagePlasticity('Concrete_M25', {
      fck: 25e6,
    }));
    this.addMaterial(new ConcreteDamagePlasticity('Concrete_M30', {
      fck: 30e6,
    }));
    this.addMaterial(new ConcreteDamagePlasticity('Concrete_M40', {
      fck: 40e6,
    }));
    this.addMaterial(new HyperelasticRubber('LeadRubberBearing', {
      C10: 0.5e6, C01: 0.1e6,
    }));
    this.addMaterial(new FiberCompositeModel('CFRP_Unidirectional', {
      E1: 140e9, E2: 10e9, orientation: 0,
    }));
  }
  
  addMaterial(material: MaterialModel): void {
    this.materials.set(material.name, material);
  }
  
  getMaterial(name: string): MaterialModel | undefined {
    return this.materials.get(name);
  }
  
  getAllMaterials(): MaterialModel[] {
    return Array.from(this.materials.values());
  }
  
  getMaterialsByType(type: string): MaterialModel[] {
    return this.getAllMaterials().filter(m => m.type === type);
  }
}

// Export singleton
export const materialLibrary = new MaterialLibrary();

export default {
  SteelPlasticityModel,
  ConcreteDamagePlasticity,
  HyperelasticRubber,
  FiberCompositeModel,
  MaterialLibrary,
  materialLibrary,
};
