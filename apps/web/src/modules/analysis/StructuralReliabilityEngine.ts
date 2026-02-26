/**
 * ============================================================================
 * STRUCTURAL RELIABILITY ENGINE
 * ============================================================================
 * 
 * Probabilistic structural reliability analysis:
 * - First-Order Reliability Method (FORM)
 * - Second-Order Reliability Method (SORM)
 * - Monte Carlo Simulation
 * - Importance Sampling
 * - Response Surface Methods
 * - Time-Dependent Reliability
 * - System Reliability
 * - Sensitivity Analysis
 * - Fragility Curves
 * - Risk Assessment
 * 
 * References:
 * - Haldar & Mahadevan: Probability, Reliability and Statistical Methods
 * - Melchers: Structural Reliability Analysis and Prediction
 * - Ang & Tang: Probability Concepts in Engineering
 * - ISO 2394: General principles on reliability
 * - EN 1990: Basis of structural design
 * - JCSS Probabilistic Model Code
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RandomVariable {
  name: string;
  distribution: 'normal' | 'lognormal' | 'gumbel' | 'weibull' | 'uniform' | 'exponential';
  mean: number;
  stdDev: number;
  cov?: number; // Coefficient of variation
  parameters?: Record<string, number>; // Additional distribution parameters
}

export interface ReliabilityResult {
  reliabilityIndex: number; // β
  probabilityOfFailure: number; // Pf
  designPoint: Record<string, number>;
  sensitivityFactors: Record<string, number>; // α
  importanceFactors: Record<string, number>; // α²
  convergenceInfo: {
    iterations: number;
    converged: boolean;
    tolerance: number;
  };
}

export interface MonteCarloResult {
  probabilityOfFailure: number;
  coefficientOfVariation: number;
  confidenceInterval: [number, number];
  numberOfSimulations: number;
  failedSamples: number;
}

export interface FragilityCurve {
  intensityMeasure: number[];
  probabilityOfExceedance: number[];
  medianCapacity: number;
  logStandardDeviation: number;
}

export interface SystemReliabilityResult {
  systemType: 'series' | 'parallel' | 'mixed';
  systemReliabilityIndex: number;
  systemPf: number;
  componentContributions: { name: string; contribution: number }[];
}

// ============================================================================
// PROBABILITY DISTRIBUTIONS
// ============================================================================

export class ProbabilityDistributions {
  /**
   * Standard normal PDF
   */
  static normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Standard normal CDF (approximation)
   */
  static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
    
    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Inverse standard normal CDF (Beasley-Springer-Moro approximation)
   */
  static normalInverseCDF(p: number): number {
    const a = [
      -3.969683028665376e+01,
      2.209460984245205e+02,
      -2.759285104469687e+02,
      1.383577518672690e+02,
      -3.066479806614716e+01,
      2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01,
      1.615858368580409e+02,
      -1.556989798598866e+02,
      6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
      4.374664141464968e+00,
      2.938163982698783e+00
    ];
    const d = [
      7.784695709041462e-03,
      3.224671290700398e-01,
      2.445134137142996e+00,
      3.754408661907416e+00
    ];
    
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    
    let q: number, r: number;
    
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  /**
   * Transform to standard normal space
   */
  static toStandardNormal(rv: RandomVariable, x: number): number {
    switch (rv.distribution) {
      case 'normal':
        return (x - rv.mean) / rv.stdDev;
      
      case 'lognormal': {
        const zeta = Math.sqrt(Math.log(1 + Math.pow(rv.stdDev / rv.mean, 2)));
        const lambda = Math.log(rv.mean) - 0.5 * zeta * zeta;
        return (Math.log(x) - lambda) / zeta;
      }
      
      case 'gumbel': {
        const beta = rv.stdDev * Math.sqrt(6) / Math.PI;
        const alpha = rv.mean - 0.5772 * beta;
        const F = Math.exp(-Math.exp(-(x - alpha) / beta));
        return this.normalInverseCDF(F);
      }
      
      case 'weibull': {
        const k = rv.parameters?.shape || 2;
        const lambda = rv.mean / this.gammaFunction(1 + 1/k);
        const F = 1 - Math.exp(-Math.pow(x / lambda, k));
        return this.normalInverseCDF(F);
      }
      
      case 'uniform': {
        const a = rv.mean - Math.sqrt(3) * rv.stdDev;
        const b = rv.mean + Math.sqrt(3) * rv.stdDev;
        const F = (x - a) / (b - a);
        return this.normalInverseCDF(Math.max(0.001, Math.min(0.999, F)));
      }
      
      case 'exponential': {
        const lambda = 1 / rv.mean;
        const F = 1 - Math.exp(-lambda * x);
        return this.normalInverseCDF(F);
      }
      
      default:
        return (x - rv.mean) / rv.stdDev;
    }
  }

  /**
   * Transform from standard normal space
   */
  static fromStandardNormal(rv: RandomVariable, u: number): number {
    switch (rv.distribution) {
      case 'normal':
        return rv.mean + u * rv.stdDev;
      
      case 'lognormal': {
        const zeta = Math.sqrt(Math.log(1 + Math.pow(rv.stdDev / rv.mean, 2)));
        const lambda = Math.log(rv.mean) - 0.5 * zeta * zeta;
        return Math.exp(lambda + zeta * u);
      }
      
      case 'gumbel': {
        const beta = rv.stdDev * Math.sqrt(6) / Math.PI;
        const alpha = rv.mean - 0.5772 * beta;
        const F = this.normalCDF(u);
        return alpha - beta * Math.log(-Math.log(F));
      }
      
      case 'weibull': {
        const k = rv.parameters?.shape || 2;
        const lambda = rv.mean / this.gammaFunction(1 + 1/k);
        const F = this.normalCDF(u);
        return lambda * Math.pow(-Math.log(1 - F), 1/k);
      }
      
      case 'uniform': {
        const a = rv.mean - Math.sqrt(3) * rv.stdDev;
        const b = rv.mean + Math.sqrt(3) * rv.stdDev;
        const F = this.normalCDF(u);
        return a + F * (b - a);
      }
      
      case 'exponential': {
        const lambda = 1 / rv.mean;
        const F = this.normalCDF(u);
        return -Math.log(1 - F) / lambda;
      }
      
      default:
        return rv.mean + u * rv.stdDev;
    }
  }

  /**
   * Gamma function approximation (Stirling's)
   */
  static gammaFunction(x: number): number {
    if (x <= 0) return NaN;
    if (x < 0.5) {
      return Math.PI / (Math.sin(Math.PI * x) * this.gammaFunction(1 - x));
    }
    x -= 1;
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
               771.32342877765313, -176.61502916214059, 12.507343278686905,
               -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let sum = c[0];
    for (let i = 1; i < g + 2; i++) {
      sum += c[i] / (x + i);
    }
    const t = x + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * sum;
  }
}

// ============================================================================
// FIRST-ORDER RELIABILITY METHOD (FORM)
// ============================================================================

export class FORM {
  /**
   * Hasofer-Lind-Rackwitz-Fiessler (HL-RF) algorithm
   */
  static analyze(
    limitStateFunction: (x: Record<string, number>) => number,
    randomVariables: RandomVariable[],
    options: {
      tolerance?: number;
      maxIterations?: number;
      stepSize?: number;
    } = {}
  ): ReliabilityResult {
    const { tolerance = 1e-6, maxIterations = 100, stepSize = 0.01 } = options;
    
    const n = randomVariables.length;
    
    // Initialize at mean values in standard normal space
    let u = new Array(n).fill(0);
    let beta = 0;
    let iterations = 0;
    let converged = false;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      iterations = iter + 1;
      
      // Transform to original space
      const x: Record<string, number> = {};
      randomVariables.forEach((rv, i) => {
        x[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, u[i]);
      });
      
      // Evaluate limit state function
      const g = limitStateFunction(x);
      
      // Calculate gradient numerically
      const gradient = this.numericalGradient(limitStateFunction, randomVariables, u, stepSize);
      
      // Gradient magnitude
      const gradMag = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
      if (gradMag < 1e-12) break;
      
      // Unit normal vector
      const alpha = gradient.map(g => -g / gradMag);
      
      // New beta
      const newBeta = Math.sqrt(u.reduce((sum, ui) => sum + ui * ui, 0));
      
      // Update design point using HL-RF
      const uDotAlpha = u.reduce((sum, ui, i) => sum + ui * alpha[i], 0);
      const uNew = alpha.map((ai, i) => ai * (uDotAlpha - g / gradMag));
      
      // Check convergence
      const deltaU = Math.sqrt(uNew.reduce((sum, ui, i) => sum + Math.pow(ui - u[i], 2), 0));
      
      if (deltaU < tolerance && Math.abs(g) < tolerance * 100) {
        converged = true;
        u = uNew;
        beta = newBeta;
        break;
      }
      
      u = uNew;
      beta = newBeta;
    }
    
    // Final reliability index
    beta = Math.sqrt(u.reduce((sum, ui) => sum + ui * ui, 0));
    
    // Design point in original space
    const designPoint: Record<string, number> = {};
    randomVariables.forEach((rv, i) => {
      designPoint[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, u[i]);
    });
    
    // Sensitivity factors
    const uMag = Math.sqrt(u.reduce((sum, ui) => sum + ui * ui, 0));
    const alpha: Record<string, number> = {};
    const importance: Record<string, number> = {};
    randomVariables.forEach((rv, i) => {
      alpha[rv.name] = uMag > 0 ? u[i] / uMag : 0;
      importance[rv.name] = alpha[rv.name] * alpha[rv.name];
    });
    
    return {
      reliabilityIndex: beta,
      probabilityOfFailure: ProbabilityDistributions.normalCDF(-beta),
      designPoint,
      sensitivityFactors: alpha,
      importanceFactors: importance,
      convergenceInfo: {
        iterations,
        converged,
        tolerance
      }
    };
  }

  /**
   * Numerical gradient calculation
   */
  private static numericalGradient(
    func: (x: Record<string, number>) => number,
    randomVariables: RandomVariable[],
    u: number[],
    h: number
  ): number[] {
    const gradient: number[] = [];
    
    for (let i = 0; i < randomVariables.length; i++) {
      const uPlus = [...u];
      const uMinus = [...u];
      uPlus[i] += h;
      uMinus[i] -= h;
      
      const xPlus: Record<string, number> = {};
      const xMinus: Record<string, number> = {};
      
      randomVariables.forEach((rv, j) => {
        xPlus[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, uPlus[j]);
        xMinus[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, uMinus[j]);
      });
      
      const gPlus = func(xPlus);
      const gMinus = func(xMinus);
      
      gradient.push((gPlus - gMinus) / (2 * h));
    }
    
    return gradient;
  }

  /**
   * Convert reliability index to probability of failure
   */
  static betaToPf(beta: number): number {
    return ProbabilityDistributions.normalCDF(-beta);
  }

  /**
   * Convert probability of failure to reliability index
   */
  static pfToBeta(pf: number): number {
    return -ProbabilityDistributions.normalInverseCDF(pf);
  }
}

// ============================================================================
// MONTE CARLO SIMULATION
// ============================================================================

export class MonteCarloSimulation {
  /**
   * Direct Monte Carlo simulation
   */
  static simulate(
    limitStateFunction: (x: Record<string, number>) => number,
    randomVariables: RandomVariable[],
    options: {
      numberOfSimulations?: number;
      confidenceLevel?: number;
      seed?: number;
    } = {}
  ): MonteCarloResult {
    const { numberOfSimulations = 100000, confidenceLevel = 0.95 } = options;
    
    let failedSamples = 0;
    
    for (let i = 0; i < numberOfSimulations; i++) {
      // Generate random samples
      const x: Record<string, number> = {};
      
      for (const rv of randomVariables) {
        const u = this.generateStandardNormal();
        x[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, u);
      }
      
      // Evaluate limit state function
      const g = limitStateFunction(x);
      
      if (g < 0) {
        failedSamples++;
      }
    }
    
    const pf = failedSamples / numberOfSimulations;
    const cov = Math.sqrt((1 - pf) / (pf * numberOfSimulations));
    
    // Confidence interval
    const z = ProbabilityDistributions.normalInverseCDF((1 + confidenceLevel) / 2);
    const ciLower = pf - z * Math.sqrt(pf * (1 - pf) / numberOfSimulations);
    const ciUpper = pf + z * Math.sqrt(pf * (1 - pf) / numberOfSimulations);
    
    return {
      probabilityOfFailure: pf,
      coefficientOfVariation: cov,
      confidenceInterval: [Math.max(0, ciLower), ciUpper],
      numberOfSimulations,
      failedSamples
    };
  }

  /**
   * Importance Sampling Monte Carlo
   */
  static importanceSampling(
    limitStateFunction: (x: Record<string, number>) => number,
    randomVariables: RandomVariable[],
    designPoint: Record<string, number>,
    numberOfSimulations: number = 10000
  ): MonteCarloResult {
    let weightedSum = 0;
    let weightedSumSquared = 0;
    let failedSamples = 0;
    
    for (let i = 0; i < numberOfSimulations; i++) {
      const x: Record<string, number> = {};
      let logWeightRatio = 0;
      
      for (const rv of randomVariables) {
        // Sample from shifted distribution centered at design point
        const uDesign = ProbabilityDistributions.toStandardNormal(rv, designPoint[rv.name]);
        const u = this.generateStandardNormal() + uDesign;
        x[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, u);
        
        // Weight calculation
        logWeightRatio += 0.5 * u * u - 0.5 * (u - uDesign) * (u - uDesign);
      }
      
      const g = limitStateFunction(x);
      const weight = Math.exp(logWeightRatio);
      const indicator = g < 0 ? 1 : 0;
      
      if (indicator === 1) failedSamples++;
      
      weightedSum += indicator * weight;
      weightedSumSquared += indicator * weight * weight;
    }
    
    const pf = weightedSum / numberOfSimulations;
    const variance = (weightedSumSquared / numberOfSimulations - pf * pf) / (numberOfSimulations - 1);
    const cov = pf > 0 ? Math.sqrt(variance) / pf : Infinity;
    
    return {
      probabilityOfFailure: pf,
      coefficientOfVariation: cov,
      confidenceInterval: [pf - 1.96 * Math.sqrt(variance), pf + 1.96 * Math.sqrt(variance)],
      numberOfSimulations,
      failedSamples
    };
  }

  /**
   * Box-Muller transform for standard normal
   */
  private static generateStandardNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Latin Hypercube Sampling
   */
  static latinHypercubeSampling(
    randomVariables: RandomVariable[],
    numberOfSamples: number
  ): Record<string, number>[] {
    const samples: Record<string, number>[] = [];
    const n = numberOfSamples;
    
    // Generate stratified samples for each variable
    const stratifiedSamples: number[][] = randomVariables.map(() => {
      const strata: number[] = [];
      for (let i = 0; i < n; i++) {
        const u = (i + Math.random()) / n;
        strata.push(u);
      }
      // Shuffle
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [strata[i], strata[j]] = [strata[j], strata[i]];
      }
      return strata;
    });
    
    // Combine samples
    for (let i = 0; i < n; i++) {
      const sample: Record<string, number> = {};
      randomVariables.forEach((rv, j) => {
        const u = ProbabilityDistributions.normalInverseCDF(stratifiedSamples[j][i]);
        sample[rv.name] = ProbabilityDistributions.fromStandardNormal(rv, u);
      });
      samples.push(sample);
    }
    
    return samples;
  }
}

// ============================================================================
// FRAGILITY ANALYSIS
// ============================================================================

export class FragilityAnalysis {
  /**
   * Generate fragility curve from cloud analysis
   */
  static cloudAnalysis(
    intensityMeasures: number[],
    demandMeasures: number[],
    capacity: number
  ): FragilityCurve {
    const n = intensityMeasures.length;
    
    // Linear regression in log-log space
    const logIM = intensityMeasures.map(im => Math.log(im));
    const logDemand = demandMeasures.map(d => Math.log(d));
    
    const meanLogIM = logIM.reduce((a, b) => a + b, 0) / n;
    const meanLogDemand = logDemand.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (logIM[i] - meanLogIM) * (logDemand[i] - meanLogDemand);
      denominator += Math.pow(logIM[i] - meanLogIM, 2);
    }
    
    const b = numerator / denominator;
    const a = meanLogDemand - b * meanLogIM;
    
    // Standard error
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const predicted = a + b * logIM[i];
      sse += Math.pow(logDemand[i] - predicted, 2);
    }
    const se = Math.sqrt(sse / (n - 2));
    
    // Median capacity
    const logMedianCapacity = (Math.log(capacity) - a) / b;
    const medianCapacity = Math.exp(logMedianCapacity);
    
    // Log standard deviation (accounting for dispersion)
    const beta = se / b;
    
    // Generate fragility curve
    const imRange: number[] = [];
    const probExceedance: number[] = [];
    
    for (let i = 0; i <= 100; i++) {
      const im = medianCapacity * Math.exp((i - 50) * 0.1);
      imRange.push(im);
      probExceedance.push(ProbabilityDistributions.normalCDF(Math.log(im / medianCapacity) / beta));
    }
    
    return {
      intensityMeasure: imRange,
      probabilityOfExceedance: probExceedance,
      medianCapacity,
      logStandardDeviation: beta
    };
  }

  /**
   * Incremental Dynamic Analysis (IDA) based fragility
   */
  static idaFragility(
    idaResults: { im: number; edp: number }[][],
    limitState: number
  ): FragilityCurve {
    // Collect collapse intensities
    const collapseIntensities: number[] = [];
    
    for (const curve of idaResults) {
      // Find first exceedance
      for (let i = 0; i < curve.length; i++) {
        if (curve[i].edp >= limitState) {
          collapseIntensities.push(curve[i].im);
          break;
        }
      }
    }
    
    if (collapseIntensities.length === 0) {
      throw new Error('No collapses detected in IDA results');
    }
    
    // Fit lognormal distribution
    const logCollapse = collapseIntensities.map(c => Math.log(c));
    const meanLogCollapse = logCollapse.reduce((a, b) => a + b, 0) / logCollapse.length;
    const varLogCollapse = logCollapse.reduce((sum, lc) => sum + Math.pow(lc - meanLogCollapse, 2), 0) / (logCollapse.length - 1);
    
    const medianCapacity = Math.exp(meanLogCollapse);
    const beta = Math.sqrt(varLogCollapse);
    
    // Generate curve
    const imRange: number[] = [];
    const probExceedance: number[] = [];
    
    for (let i = 0; i <= 100; i++) {
      const im = medianCapacity * Math.exp((i - 50) * 0.1);
      imRange.push(im);
      probExceedance.push(ProbabilityDistributions.normalCDF(Math.log(im / medianCapacity) / beta));
    }
    
    return {
      intensityMeasure: imRange,
      probabilityOfExceedance: probExceedance,
      medianCapacity,
      logStandardDeviation: beta
    };
  }

  /**
   * Combine fragility curves for multiple limit states
   */
  static combinedFragility(
    curves: FragilityCurve[],
    combinationType: 'series' | 'parallel'
  ): number[] {
    const combinedProb: number[] = [];
    
    for (let i = 0; i < curves[0].probabilityOfExceedance.length; i++) {
      const probs = curves.map(c => c.probabilityOfExceedance[i]);
      
      if (combinationType === 'series') {
        // Union: P(A∪B) = P(A) + P(B) - P(A)P(B) for independent
        let pCombined = 0;
        for (const p of probs) {
          pCombined = pCombined + p - pCombined * p;
        }
        combinedProb.push(pCombined);
      } else {
        // Intersection: P(A∩B) = P(A)P(B) for independent
        combinedProb.push(probs.reduce((a, b) => a * b, 1));
      }
    }
    
    return combinedProb;
  }
}

// ============================================================================
// SYSTEM RELIABILITY
// ============================================================================

export class SystemReliability {
  /**
   * Series system (weakest link)
   */
  static seriesSystem(componentBetas: number[], correlationMatrix?: number[][]): SystemReliabilityResult {
    const n = componentBetas.length;
    
    if (!correlationMatrix) {
      // Independent components - upper bound
      let pfSystem = 0;
      for (const beta of componentBetas) {
        pfSystem += ProbabilityDistributions.normalCDF(-beta);
      }
      pfSystem = Math.min(pfSystem, 1);
      
      return {
        systemType: 'series',
        systemReliabilityIndex: FORM.pfToBeta(pfSystem),
        systemPf: pfSystem,
        componentContributions: componentBetas.map((beta, i) => ({
          name: `Component ${i + 1}`,
          contribution: ProbabilityDistributions.normalCDF(-beta) / pfSystem
        }))
      };
    } else {
      // Correlated components - use bounds
      // First-order bounds (Ditlevsen)
      const pfs = componentBetas.map(beta => ProbabilityDistributions.normalCDF(-beta));
      
      // Lower bound
      let pfLower = pfs[0];
      for (let i = 1; i < n; i++) {
        let maxCorr = 0;
        for (let j = 0; j < i; j++) {
          const rho = correlationMatrix[i][j];
          const pij = this.bivariateNormalCDF(-componentBetas[i], -componentBetas[j], rho);
          maxCorr = Math.max(maxCorr, pij);
        }
        pfLower += Math.max(0, pfs[i] - maxCorr);
      }
      
      // Upper bound
      let pfUpper = 0;
      for (const pf of pfs) {
        pfUpper = pfUpper + pf - pfUpper * pf; // Simplified union bound
      }
      
      const pfSystem = (pfLower + pfUpper) / 2; // Use average
      
      return {
        systemType: 'series',
        systemReliabilityIndex: FORM.pfToBeta(pfSystem),
        systemPf: pfSystem,
        componentContributions: componentBetas.map((beta, i) => ({
          name: `Component ${i + 1}`,
          contribution: pfs[i] / pfs.reduce((a, b) => a + b, 0)
        }))
      };
    }
  }

  /**
   * Parallel system (redundant)
   */
  static parallelSystem(componentBetas: number[], correlationMatrix?: number[][]): SystemReliabilityResult {
    // For parallel system, all components must fail
    const pfs = componentBetas.map(beta => ProbabilityDistributions.normalCDF(-beta));
    
    if (!correlationMatrix) {
      // Independent - product of individual Pf
      const pfSystem = pfs.reduce((a, b) => a * b, 1);
      
      return {
        systemType: 'parallel',
        systemReliabilityIndex: FORM.pfToBeta(pfSystem),
        systemPf: pfSystem,
        componentContributions: componentBetas.map((beta, i) => ({
          name: `Component ${i + 1}`,
          contribution: 1 / pfs.length // Equal contribution for parallel
        }))
      };
    } else {
      // Correlated - use bounds (simplified)
      const pfSystem = Math.max(...pfs) * Math.pow(pfs.reduce((a, b) => a * b, 1), 0.5);
      
      return {
        systemType: 'parallel',
        systemReliabilityIndex: FORM.pfToBeta(Math.min(pfSystem, 1)),
        systemPf: Math.min(pfSystem, 1),
        componentContributions: componentBetas.map((beta, i) => ({
          name: `Component ${i + 1}`,
          contribution: 1 / pfs.length
        }))
      };
    }
  }

  /**
   * Bivariate normal CDF approximation
   */
  private static bivariateNormalCDF(x1: number, x2: number, rho: number): number {
    // Drezner-Wesolowsky approximation
    if (Math.abs(rho) < 1e-10) {
      return ProbabilityDistributions.normalCDF(x1) * ProbabilityDistributions.normalCDF(x2);
    }
    
    const a = [-0.944899272, 0.5345460, -0.276297527, 0.078820478];
    const b = [0.6494393, 0.2491692, 0.0573944, 0.0061466];
    
    let sum = 0;
    const signRho = rho >= 0 ? 1 : -1;
    const absRho = Math.abs(rho);
    
    for (let i = 0; i < 4; i++) {
      const r = Math.sqrt(1 - Math.pow(absRho, 2)) * a[i];
      const term = Math.exp(-0.5 * (x1 * x1 + x2 * x2 - 2 * signRho * r * x1 * x2) / (1 - r * r));
      sum += b[i] * term;
    }
    
    const phi1 = ProbabilityDistributions.normalCDF(x1);
    const phi2 = ProbabilityDistributions.normalCDF(signRho * x2);
    
    return phi1 * phi2 + signRho * sum * Math.sqrt(1 - absRho * absRho) / (2 * Math.PI);
  }
}

// ============================================================================
// TARGET RELIABILITY
// ============================================================================

export class TargetReliability {
  /**
   * Target reliability indices per EN 1990
   */
  static eurocode(
    consequenceClass: 'CC1' | 'CC2' | 'CC3',
    referencePerod: 1 | 50 = 50
  ): { beta: number; Pf: number; description: string } {
    const targets: Record<string, Record<number, { beta: number; desc: string }>> = {
      'CC1': {
        1: { beta: 4.2, desc: 'Low consequence - 1 year' },
        50: { beta: 3.3, desc: 'Low consequence - 50 years' }
      },
      'CC2': {
        1: { beta: 4.7, desc: 'Medium consequence - 1 year' },
        50: { beta: 3.8, desc: 'Medium consequence - 50 years' }
      },
      'CC3': {
        1: { beta: 5.2, desc: 'High consequence - 1 year' },
        50: { beta: 4.3, desc: 'High consequence - 50 years' }
      }
    };
    
    const target = targets[consequenceClass][referencePerod];
    
    return {
      beta: target.beta,
      Pf: FORM.betaToPf(target.beta),
      description: target.desc
    };
  }

  /**
   * Target reliability per ASCE 7
   */
  static asce7(
    riskCategory: 'I' | 'II' | 'III' | 'IV'
  ): { beta: number; Pf: number; description: string } {
    const targets: Record<string, { beta: number; desc: string }> = {
      'I': { beta: 2.5, desc: 'Agricultural, minor storage' },
      'II': { beta: 3.0, desc: 'Ordinary buildings' },
      'III': { beta: 3.5, desc: 'High occupancy' },
      'IV': { beta: 4.0, desc: 'Essential facilities' }
    };
    
    const target = targets[riskCategory];
    
    return {
      beta: target.beta,
      Pf: FORM.betaToPf(target.beta),
      description: target.desc
    };
  }

  /**
   * Convert between reference periods
   */
  static convertReferencePeriod(
    beta: number,
    fromPeriod: number,
    toPeriod: number
  ): number {
    const Pf_from = FORM.betaToPf(beta);
    const annualPf = 1 - Math.pow(1 - Pf_from, 1 / fromPeriod);
    const Pf_to = 1 - Math.pow(1 - annualPf, toPeriod);
    return FORM.pfToBeta(Pf_to);
  }
}

// ============================================================================
// PARTIAL SAFETY FACTORS
// ============================================================================

export class PartialSafetyFactors {
  /**
   * Derive partial factors from FORM analysis
   */
  static deriveFromFORM(
    formResult: ReliabilityResult,
    randomVariables: RandomVariable[]
  ): { name: string; partialFactor: number; direction: 'load' | 'resistance' }[] {
    const factors: { name: string; partialFactor: number; direction: 'load' | 'resistance' }[] = [];
    
    for (const rv of randomVariables) {
      const designValue = formResult.designPoint[rv.name];
      const meanValue = rv.mean;
      const alpha = formResult.sensitivityFactors[rv.name];
      
      // Loads have positive alpha, resistances have negative
      const direction = alpha > 0 ? 'load' : 'resistance';
      
      // Partial factor as ratio of design to characteristic
      const charValue = direction === 'load' ? 
        rv.mean + 1.65 * rv.stdDev : // 95th percentile for loads
        rv.mean - 1.65 * rv.stdDev;  // 5th percentile for resistance
      
      const partialFactor = designValue / charValue;
      
      factors.push({
        name: rv.name,
        partialFactor: Math.abs(partialFactor),
        direction
      });
    }
    
    return factors;
  }

  /**
   * JCSS recommended COVs
   */
  static jcssRecommendedCOV(): Record<string, { cov: number; distribution: string }> {
    return {
      'permanent_load': { cov: 0.10, distribution: 'normal' },
      'variable_load_office': { cov: 0.25, distribution: 'gumbel' },
      'variable_load_residential': { cov: 0.30, distribution: 'gumbel' },
      'wind_load': { cov: 0.35, distribution: 'gumbel' },
      'snow_load': { cov: 0.40, distribution: 'gumbel' },
      'concrete_fc': { cov: 0.15, distribution: 'lognormal' },
      'steel_fy': { cov: 0.07, distribution: 'lognormal' },
      'timber_fb': { cov: 0.25, distribution: 'lognormal' },
      'geometry': { cov: 0.05, distribution: 'normal' },
      'model_uncertainty_moment': { cov: 0.10, distribution: 'lognormal' },
      'model_uncertainty_shear': { cov: 0.15, distribution: 'lognormal' }
    };
  }
}

// ============================================================================
// TIME-DEPENDENT RELIABILITY
// ============================================================================

export class TimeDependentReliability {
  /**
   * First passage probability (outcrossing)
   */
  static firstPassage(
    thresholdCrossings: number[], // Mean crossings per unit time
    duration: number
  ): number {
    const totalCrossings = thresholdCrossings.reduce((a, b) => a + b, 0) * duration;
    // Poisson approximation
    return 1 - Math.exp(-totalCrossings);
  }

  /**
   * Degradation model (power law)
   */
  static degradation(
    initialValue: number,
    time: number,
    degradationRate: number,
    powerExponent: number = 1
  ): number {
    return initialValue - degradationRate * Math.pow(time, powerExponent);
  }

  /**
   * Time-variant reliability with degradation
   */
  static timeVariantReliability(
    initialBeta: number,
    degradationRateOfBeta: number, // Per year
    time: number
  ): { beta: number; Pf: number } {
    const beta = initialBeta - degradationRateOfBeta * time;
    return {
      beta,
      Pf: FORM.betaToPf(beta)
    };
  }

  /**
   * Estimate service life for target reliability
   */
  static estimateServiceLife(
    initialBeta: number,
    targetBeta: number,
    degradationRateOfBeta: number
  ): number {
    return (initialBeta - targetBeta) / degradationRateOfBeta;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ProbabilityDistributions,
  FORM,
  MonteCarloSimulation,
  FragilityAnalysis,
  SystemReliability,
  TargetReliability,
  PartialSafetyFactors,
  TimeDependentReliability
};
