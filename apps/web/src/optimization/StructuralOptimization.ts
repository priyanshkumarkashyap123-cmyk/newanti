/**
 * StructuralOptimization.ts
 * 
 * Advanced Structural Optimization Engine:
 * 1. Topology Optimization (SIMP method)
 * 2. Size Optimization (cross-sections)
 * 3. Shape Optimization (geometry)
 * 4. Multi-objective Optimization
 * 5. Genetic Algorithms
 * 6. Gradient-based Methods
 * 7. Constraint Handling
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OptimizationProblem {
  type: 'topology' | 'size' | 'shape' | 'multi-objective';
  objective: ObjectiveFunction;
  constraints: Constraint[];
  designVariables: DesignVariable[];
  bounds?: { lower: number[]; upper: number[] };
}

export interface ObjectiveFunction {
  type: 'minimize-weight' | 'minimize-compliance' | 'minimize-cost' | 
        'maximize-stiffness' | 'minimize-displacement' | 'custom';
  weight?: number;
  customFunction?: (x: number[]) => number;
}

export interface Constraint {
  type: 'stress' | 'displacement' | 'buckling' | 'frequency' | 
        'volume-fraction' | 'manufacturability' | 'custom';
  value: number;
  operator: '<=' | '>=' | '==';
  tolerance?: number;
  customFunction?: (x: number[]) => number;
}

export interface DesignVariable {
  id: string;
  name: string;
  type: 'continuous' | 'discrete' | 'integer';
  initialValue: number;
  lowerBound: number;
  upperBound: number;
  discreteValues?: number[];
  linkedTo?: string[]; // Element IDs
}

export interface OptimizationResult {
  converged: boolean;
  iterations: number;
  finalObjective: number;
  optimalDesign: number[];
  history: OptimizationHistory;
  constraintViolations: number[];
  sensitivity?: number[];
  paretoFront?: ParetoPoint[];
}

export interface OptimizationHistory {
  objectives: number[];
  designs: number[][];
  constraints: number[][];
  timestamps: number[];
}

export interface ParetoPoint {
  objectives: number[];
  design: number[];
  dominates: number[];
  dominatedBy: number[];
}

export interface TopologyResult {
  densities: Float32Array;
  dimensions: { nx: number; ny: number; nz: number };
  threshold: number;
  volume: number;
  compliance: number;
}

// ============================================
// SIMP TOPOLOGY OPTIMIZER
// ============================================

export class TopologyOptimizer {
  private nx: number;
  private ny: number;
  private nz: number;
  private volfrac: number;
  private penal: number;
  private rmin: number;
  private maxIter: number;
  private tolx: number;
  
  constructor(config: {
    nx: number;
    ny: number;
    nz?: number;
    volumeFraction: number;
    penalization?: number;
    filterRadius?: number;
    maxIterations?: number;
    tolerance?: number;
  }) {
    this.nx = config.nx;
    this.ny = config.ny;
    this.nz = config.nz || 1;
    this.volfrac = config.volumeFraction;
    this.penal = config.penalization || 3;
    this.rmin = config.filterRadius || 1.5;
    this.maxIter = config.maxIterations || 100;
    this.tolx = config.tolerance || 0.01;
  }
  
  /**
   * Run SIMP topology optimization
   */
  optimize(
    K: Float64Array, // Global stiffness (sparse representation)
    F: Float64Array, // Load vector
    fixedDofs: number[],
    callback?: (iter: number, compliance: number, change: number) => void
  ): TopologyResult {
    const nElements = this.nx * this.ny * this.nz;
    
    // Initialize densities
    const x = new Float32Array(nElements).fill(this.volfrac);
    const xPhys = new Float32Array(nElements).fill(this.volfrac);
    const dc = new Float32Array(nElements);
    const dv = new Float32Array(nElements).fill(1);
    
    // Prepare filter weights
    const H = this.prepareFilter();
    const Hs = new Float32Array(nElements);
    for (let i = 0; i < nElements; i++) {
      Hs[i] = H[i].reduce((sum, w) => sum + w.weight, 0);
    }
    
    let change = 1;
    let loop = 0;
    let compliance = 0;
    
    while (change > this.tolx && loop < this.maxIter) {
      loop++;
      const xOld = x.slice();
      
      // Apply density filter
      for (let i = 0; i < nElements; i++) {
        let sum = 0;
        for (const { idx, weight } of H[i]) {
          sum += weight * x[idx];
        }
        xPhys[i] = sum / Hs[i];
      }
      
      // FE analysis (simplified - would use actual solver)
      const { U, c, ce } = this.solveSystem(K, F, xPhys, fixedDofs);
      compliance = c;
      
      // Compute sensitivities
      for (let i = 0; i < nElements; i++) {
        dc[i] = -this.penal * Math.pow(xPhys[i], this.penal - 1) * ce[i];
      }
      
      // Sensitivity filter
      const dcFiltered = new Float32Array(nElements);
      for (let i = 0; i < nElements; i++) {
        let sum = 0;
        for (const { idx, weight } of H[i]) {
          sum += weight * x[idx] * dc[idx];
        }
        dcFiltered[i] = sum / (Hs[i] * Math.max(0.001, x[i]));
      }
      
      // OC update
      const xNew = this.ocUpdate(x, dcFiltered, dv);
      
      // Compute change
      change = 0;
      for (let i = 0; i < nElements; i++) {
        change = Math.max(change, Math.abs(xNew[i] - xOld[i]));
        x[i] = xNew[i];
      }
      
      callback?.(loop, compliance, change);
    }
    
    // Calculate final volume
    let volume = 0;
    for (let i = 0; i < nElements; i++) {
      volume += xPhys[i];
    }
    volume /= nElements;
    
    return {
      densities: xPhys,
      dimensions: { nx: this.nx, ny: this.ny, nz: this.nz },
      threshold: 0.5,
      volume,
      compliance,
    };
  }
  
  /**
   * Prepare density filter weights
   */
  private prepareFilter(): Array<Array<{ idx: number; weight: number }>> {
    const nElements = this.nx * this.ny * this.nz;
    const H: Array<Array<{ idx: number; weight: number }>> = [];
    
    for (let k = 0; k < this.nz; k++) {
      for (let j = 0; j < this.ny; j++) {
        for (let i = 0; i < this.nx; i++) {
          const e1 = k * this.nx * this.ny + j * this.nx + i;
          const neighbors: Array<{ idx: number; weight: number }> = [];
          
          // Find neighbors within filter radius
          for (let kk = Math.max(0, k - Math.ceil(this.rmin)); kk <= Math.min(this.nz - 1, k + Math.ceil(this.rmin)); kk++) {
            for (let jj = Math.max(0, j - Math.ceil(this.rmin)); jj <= Math.min(this.ny - 1, j + Math.ceil(this.rmin)); jj++) {
              for (let ii = Math.max(0, i - Math.ceil(this.rmin)); ii <= Math.min(this.nx - 1, i + Math.ceil(this.rmin)); ii++) {
                const e2 = kk * this.nx * this.ny + jj * this.nx + ii;
                const dist = Math.sqrt(
                  Math.pow(i - ii, 2) + Math.pow(j - jj, 2) + Math.pow(k - kk, 2)
                );
                
                if (dist <= this.rmin) {
                  neighbors.push({
                    idx: e2,
                    weight: this.rmin - dist,
                  });
                }
              }
            }
          }
          
          H[e1] = neighbors;
        }
      }
    }
    
    return H;
  }
  
  /**
   * Simplified FE solve (placeholder)
   */
  private solveSystem(
    K: Float64Array,
    F: Float64Array,
    x: Float32Array,
    fixedDofs: number[]
  ): { U: Float64Array; c: number; ce: Float32Array } {
    const n = F.length;
    const U = new Float64Array(n);
    const ce = new Float32Array(x.length);
    
    // Simplified - would use actual sparse solver
    // For demonstration, compute compliance directly
    let c = 0;
    
    for (let i = 0; i < x.length; i++) {
      // Element compliance contribution
      const Emin = 1e-9;
      const E0 = 1;
      const Ee = Emin + Math.pow(x[i], this.penal) * (E0 - Emin);
      
      ce[i] = Ee * 0.1; // Simplified element compliance
      c += ce[i];
    }
    
    return { U, c, ce };
  }
  
  /**
   * Optimality Criteria update
   */
  private ocUpdate(x: Float32Array, dc: Float32Array, dv: Float32Array): Float32Array {
    const nElements = x.length;
    const xNew = new Float32Array(nElements);
    const move = 0.2;
    
    // Bi-section for Lagrange multiplier
    let l1 = 0;
    let l2 = 1e9;
    
    while ((l2 - l1) / (l1 + l2) > 1e-3) {
      const lmid = 0.5 * (l1 + l2);
      
      let sumV = 0;
      for (let i = 0; i < nElements; i++) {
        const Be = -dc[i] / (lmid * dv[i]);
        const xNewVal = Math.max(0.001, Math.max(
          x[i] - move,
          Math.min(1, Math.min(x[i] + move, x[i] * Math.sqrt(Be)))
        ));
        xNew[i] = xNewVal;
        sumV += xNewVal;
      }
      
      if (sumV / nElements > this.volfrac) {
        l1 = lmid;
      } else {
        l2 = lmid;
      }
    }
    
    return xNew;
  }
}

// ============================================
// GENETIC ALGORITHM OPTIMIZER
// ============================================

export interface GeneticConfig {
  populationSize: number;
  maxGenerations: number;
  crossoverRate: number;
  mutationRate: number;
  eliteCount: number;
  tournamentSize?: number;
  niching?: boolean;
  nichingRadius?: number;
}

export class GeneticOptimizer {
  private config: GeneticConfig;
  private population: Individual[] = [];
  private bestIndividual: Individual | null = null;
  private generation = 0;
  
  constructor(config: GeneticConfig) {
    this.config = {
      tournamentSize: 3,
      niching: false,
      nichingRadius: 0.1,
      ...config,
    };
  }
  
  /**
   * Run genetic algorithm optimization
   */
  optimize(
    problem: OptimizationProblem,
    callback?: (gen: number, best: number, avg: number) => void
  ): OptimizationResult {
    const startTime = Date.now();
    const history: OptimizationHistory = {
      objectives: [],
      designs: [],
      constraints: [],
      timestamps: [],
    };
    
    // Initialize population
    this.initializePopulation(problem);
    this.evaluatePopulation(problem);
    this.generation = 0;
    
    // Evolution loop
    while (this.generation < this.config.maxGenerations) {
      this.generation++;
      
      // Selection
      const parents = this.selection();
      
      // Crossover
      const offspring = this.crossover(parents, problem);
      
      // Mutation
      this.mutate(offspring, problem);
      
      // Evaluate offspring
      this.evaluateIndividuals(offspring, problem);
      
      // Environmental selection
      this.environmentalSelection(offspring);
      
      // Apply niching if enabled
      if (this.config.niching) {
        this.applyNiching();
      }
      
      // Update best
      this.updateBest();
      
      // Record history
      const avgFitness = this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length;
      history.objectives.push(this.bestIndividual?.fitness || Infinity);
      history.designs.push([...this.bestIndividual?.genes || []]);
      history.timestamps.push(Date.now() - startTime);
      
      callback?.(this.generation, this.bestIndividual?.fitness || Infinity, avgFitness);
      
      // Check convergence
      if (this.checkConvergence(history)) {
        break;
      }
    }
    
    return {
      converged: this.generation < this.config.maxGenerations,
      iterations: this.generation,
      finalObjective: this.bestIndividual?.fitness || Infinity,
      optimalDesign: [...this.bestIndividual?.genes || []],
      history,
      constraintViolations: this.bestIndividual?.constraintViolation || [],
    };
  }
  
  private initializePopulation(problem: OptimizationProblem): void {
    this.population = [];
    
    for (let i = 0; i < this.config.populationSize; i++) {
      const genes: number[] = [];
      
      for (const dv of problem.designVariables) {
        if (dv.type === 'discrete' && dv.discreteValues) {
          const idx = Math.floor(Math.random() * dv.discreteValues.length);
          genes.push(dv.discreteValues[idx]);
        } else {
          const range = dv.upperBound - dv.lowerBound;
          genes.push(dv.lowerBound + Math.random() * range);
        }
      }
      
      this.population.push({
        genes,
        fitness: Infinity,
        constraintViolation: [],
        rank: 0,
        crowdingDistance: 0,
      });
    }
  }
  
  private evaluatePopulation(problem: OptimizationProblem): void {
    this.evaluateIndividuals(this.population, problem);
    this.updateBest();
  }
  
  private evaluateIndividuals(individuals: Individual[], problem: OptimizationProblem): void {
    for (const ind of individuals) {
      // Evaluate objective
      if (problem.objective.customFunction) {
        ind.fitness = problem.objective.customFunction(ind.genes);
      } else {
        ind.fitness = this.defaultObjective(ind.genes, problem);
      }
      
      // Evaluate constraints
      ind.constraintViolation = [];
      for (const constraint of problem.constraints) {
        const value = constraint.customFunction?.(ind.genes) ?? this.defaultConstraint(ind.genes, constraint);
        
        let violation = 0;
        switch (constraint.operator) {
          case '<=':
            violation = Math.max(0, value - constraint.value);
            break;
          case '>=':
            violation = Math.max(0, constraint.value - value);
            break;
          case '==':
            violation = Math.abs(value - constraint.value);
            break;
        }
        
        ind.constraintViolation.push(violation);
      }
      
      // Penalize constraint violations
      const totalViolation = ind.constraintViolation.reduce((sum, v) => sum + v, 0);
      ind.fitness += totalViolation * 1000; // Penalty factor
    }
  }
  
  private defaultObjective(x: number[], problem: OptimizationProblem): number {
    switch (problem.objective.type) {
      case 'minimize-weight':
        return x.reduce((sum, v) => sum + v, 0);
      case 'minimize-compliance':
        return 1 / (x.reduce((sum, v) => sum + v, 0) + 0.001);
      default:
        return x.reduce((sum, v) => sum + v * v, 0);
    }
  }
  
  private defaultConstraint(x: number[], constraint: Constraint): number {
    switch (constraint.type) {
      case 'stress':
        return Math.max(...x.map(v => v * 100)); // Simplified stress calc
      case 'displacement':
        return x.reduce((sum, v) => sum + 1 / (v + 0.001), 0);
      case 'volume-fraction':
        return x.reduce((sum, v) => sum + v, 0) / x.length;
      default:
        return 0;
    }
  }
  
  private selection(): Individual[] {
    const parents: Individual[] = [];
    
    for (let i = 0; i < this.config.populationSize; i++) {
      parents.push(this.tournamentSelect());
    }
    
    return parents;
  }
  
  private tournamentSelect(): Individual {
    const tournament: Individual[] = [];
    
    for (let i = 0; i < (this.config.tournamentSize || 3); i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }
    
    return tournament.reduce((best, ind) => ind.fitness < best.fitness ? ind : best);
  }
  
  private crossover(parents: Individual[], problem: OptimizationProblem): Individual[] {
    const offspring: Individual[] = [];
    
    for (let i = 0; i < parents.length - 1; i += 2) {
      if (Math.random() < this.config.crossoverRate) {
        const [child1, child2] = this.sbxCrossover(parents[i], parents[i + 1], problem);
        offspring.push(child1, child2);
      } else {
        offspring.push(
          { ...parents[i], genes: [...parents[i].genes] },
          { ...parents[i + 1], genes: [...parents[i + 1].genes] }
        );
      }
    }
    
    return offspring;
  }
  
  /**
   * Simulated Binary Crossover (SBX)
   */
  private sbxCrossover(p1: Individual, p2: Individual, problem: OptimizationProblem): [Individual, Individual] {
    const eta = 15; // Distribution index
    const c1: number[] = [];
    const c2: number[] = [];
    
    for (let i = 0; i < p1.genes.length; i++) {
      const dv = problem.designVariables[i];
      
      if (Math.random() < 0.5) {
        const y1 = Math.min(p1.genes[i], p2.genes[i]);
        const y2 = Math.max(p1.genes[i], p2.genes[i]);
        
        if (Math.abs(y2 - y1) > 1e-10) {
          const beta1 = 1 + (2 * (y1 - dv.lowerBound) / (y2 - y1));
          const beta2 = 1 + (2 * (dv.upperBound - y2) / (y2 - y1));
          
          const alpha1 = 2 - Math.pow(beta1, -(eta + 1));
          const alpha2 = 2 - Math.pow(beta2, -(eta + 1));
          
          const rand1 = Math.random();
          const rand2 = Math.random();
          
          const betaq1 = rand1 <= 1 / alpha1
            ? Math.pow(rand1 * alpha1, 1 / (eta + 1))
            : Math.pow(1 / (2 - rand1 * alpha1), 1 / (eta + 1));
          
          const betaq2 = rand2 <= 1 / alpha2
            ? Math.pow(rand2 * alpha2, 1 / (eta + 1))
            : Math.pow(1 / (2 - rand2 * alpha2), 1 / (eta + 1));
          
          c1.push(Math.max(dv.lowerBound, Math.min(dv.upperBound, 0.5 * ((y1 + y2) - betaq1 * (y2 - y1)))));
          c2.push(Math.max(dv.lowerBound, Math.min(dv.upperBound, 0.5 * ((y1 + y2) + betaq2 * (y2 - y1)))));
        } else {
          c1.push(p1.genes[i]);
          c2.push(p2.genes[i]);
        }
      } else {
        c1.push(p1.genes[i]);
        c2.push(p2.genes[i]);
      }
    }
    
    return [
      { genes: c1, fitness: Infinity, constraintViolation: [], rank: 0, crowdingDistance: 0 },
      { genes: c2, fitness: Infinity, constraintViolation: [], rank: 0, crowdingDistance: 0 },
    ];
  }
  
  private mutate(offspring: Individual[], problem: OptimizationProblem): void {
    for (const ind of offspring) {
      for (let i = 0; i < ind.genes.length; i++) {
        if (Math.random() < this.config.mutationRate) {
          const dv = problem.designVariables[i];
          
          if (dv.type === 'discrete' && dv.discreteValues) {
            const idx = Math.floor(Math.random() * dv.discreteValues.length);
            ind.genes[i] = dv.discreteValues[idx];
          } else {
            // Polynomial mutation
            const eta = 20;
            const delta = Math.random();
            const deltaq = delta < 0.5
              ? Math.pow(2 * delta, 1 / (eta + 1)) - 1
              : 1 - Math.pow(2 * (1 - delta), 1 / (eta + 1));
            
            ind.genes[i] += deltaq * (dv.upperBound - dv.lowerBound);
            ind.genes[i] = Math.max(dv.lowerBound, Math.min(dv.upperBound, ind.genes[i]));
          }
        }
      }
    }
  }
  
  private environmentalSelection(offspring: Individual[]): void {
    // Combine population and offspring
    const combined = [...this.population, ...offspring];
    
    // Sort by fitness
    combined.sort((a, b) => a.fitness - b.fitness);
    
    // Keep best individuals (elitism)
    const newPopulation: Individual[] = [];
    
    // Elite individuals
    for (let i = 0; i < this.config.eliteCount && i < combined.length; i++) {
      newPopulation.push(combined[i]);
    }
    
    // Fill rest
    for (let i = this.config.eliteCount; i < this.config.populationSize; i++) {
      if (i < combined.length) {
        newPopulation.push(combined[i]);
      }
    }
    
    this.population = newPopulation;
  }
  
  private applyNiching(): void {
    const radius = this.config.nichingRadius || 0.1;
    
    for (let i = 0; i < this.population.length; i++) {
      let nicheCount = 0;
      
      for (let j = 0; j < this.population.length; j++) {
        if (i !== j) {
          const dist = this.distance(this.population[i].genes, this.population[j].genes);
          if (dist < radius) {
            nicheCount++;
          }
        }
      }
      
      // Penalize fitness based on niche count
      if (nicheCount > 0) {
        this.population[i].fitness *= (1 + 0.1 * nicheCount);
      }
    }
  }
  
  private distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }
  
  private updateBest(): void {
    for (const ind of this.population) {
      if (!this.bestIndividual || ind.fitness < this.bestIndividual.fitness) {
        this.bestIndividual = { ...ind, genes: [...ind.genes] };
      }
    }
  }
  
  private checkConvergence(history: OptimizationHistory): boolean {
    if (history.objectives.length < 10) return false;
    
    const recent = history.objectives.slice(-10);
    const maxChange = Math.max(...recent) - Math.min(...recent);
    
    return maxChange < 0.001 * Math.abs(recent[0]);
  }
}

interface Individual {
  genes: number[];
  fitness: number;
  constraintViolation: number[];
  rank: number;
  crowdingDistance: number;
}

// ============================================
// GRADIENT-BASED OPTIMIZER
// ============================================

export class GradientOptimizer {
  private maxIterations: number;
  private tolerance: number;
  private stepSize: number;
  
  constructor(config: {
    maxIterations?: number;
    tolerance?: number;
    stepSize?: number;
  } = {}) {
    this.maxIterations = config.maxIterations || 100;
    this.tolerance = config.tolerance || 1e-6;
    this.stepSize = config.stepSize || 0.01;
  }
  
  /**
   * BFGS optimization
   */
  optimizeBFGS(
    objective: (x: number[]) => number,
    gradient: (x: number[]) => number[],
    x0: number[],
    bounds?: { lower: number[]; upper: number[] }
  ): OptimizationResult {
    const n = x0.length;
    let x = [...x0];
    
    // Initialize inverse Hessian approximation
    let H = this.eye(n);
    
    let g = gradient(x);
    let f = objective(x);
    
    const history: OptimizationHistory = {
      objectives: [f],
      designs: [[...x]],
      constraints: [],
      timestamps: [0],
    };
    
    const startTime = Date.now();
    let iter = 0;
    
    while (iter < this.maxIterations) {
      iter++;
      
      // Check gradient convergence
      const gNorm = Math.sqrt(g.reduce((sum, gi) => sum + gi * gi, 0));
      if (gNorm < this.tolerance) {
        break;
      }
      
      // Compute search direction
      const p = this.matVecMult(H, g).map(v => -v);
      
      // Line search
      const alpha = this.lineSearch(objective, x, p, f, g, bounds);
      
      // Update x
      const xNew = x.map((xi, i) => xi + alpha * p[i]);
      
      // Apply bounds
      if (bounds) {
        for (let i = 0; i < n; i++) {
          xNew[i] = Math.max(bounds.lower[i], Math.min(bounds.upper[i], xNew[i]));
        }
      }
      
      // Compute new gradient
      const gNew = gradient(xNew);
      const fNew = objective(xNew);
      
      // Check convergence
      const xChange = Math.sqrt(x.reduce((sum, xi, i) => sum + Math.pow(xNew[i] - xi, 2), 0));
      if (xChange < this.tolerance) {
        x = xNew;
        break;
      }
      
      // BFGS update
      const s = xNew.map((xi, i) => xi - x[i]);
      const y = gNew.map((gi, i) => gi - g[i]);
      
      const rho = 1 / this.dot(y, s);
      
      if (isFinite(rho) && rho > 0) {
        // Update H using BFGS formula
        const I = this.eye(n);
        const ssT = this.outerProduct(s, s);
        const syT = this.outerProduct(s, y);
        const ysT = this.outerProduct(y, s);
        
        // H = (I - rho*s*y') * H * (I - rho*y*s') + rho*s*s'
        const term1 = this.matSub(I, this.matScale(syT, rho));
        const term2 = this.matSub(I, this.matScale(ysT, rho));
        const term3 = this.matMult(this.matMult(term1, H), term2);
        H = this.matAdd(term3, this.matScale(ssT, rho));
      }
      
      x = xNew;
      g = gNew;
      f = fNew;
      
      history.objectives.push(f);
      history.designs.push([...x]);
      history.timestamps.push(Date.now() - startTime);
    }
    
    return {
      converged: iter < this.maxIterations,
      iterations: iter,
      finalObjective: objective(x),
      optimalDesign: x,
      history,
      constraintViolations: [],
      sensitivity: gradient(x),
    };
  }
  
  /**
   * Backtracking line search
   */
  private lineSearch(
    objective: (x: number[]) => number,
    x: number[],
    p: number[],
    f: number,
    g: number[],
    bounds?: { lower: number[]; upper: number[] }
  ): number {
    const c1 = 1e-4;
    const c2 = 0.9;
    let alpha = 1;
    const alphaMin = 1e-10;
    
    const gp = this.dot(g, p);
    
    while (alpha > alphaMin) {
      const xNew = x.map((xi, i) => xi + alpha * p[i]);
      
      // Apply bounds
      if (bounds) {
        for (let i = 0; i < x.length; i++) {
          xNew[i] = Math.max(bounds.lower[i], Math.min(bounds.upper[i], xNew[i]));
        }
      }
      
      const fNew = objective(xNew);
      
      // Armijo condition
      if (fNew <= f + c1 * alpha * gp) {
        return alpha;
      }
      
      alpha *= 0.5;
    }
    
    return alpha;
  }
  
  // Matrix/vector utilities
  private eye(n: number): number[][] {
    const I: number[][] = [];
    for (let i = 0; i < n; i++) {
      I[i] = new Array(n).fill(0);
      I[i][i] = 1;
    }
    return I;
  }
  
  private dot(a: number[], b: number[]): number {
    return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  }
  
  private matVecMult(A: number[][], x: number[]): number[] {
    return A.map(row => this.dot(row, x));
  }
  
  private outerProduct(a: number[], b: number[]): number[][] {
    return a.map(ai => b.map(bi => ai * bi));
  }
  
  private matAdd(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((v, j) => v + B[i][j]));
  }
  
  private matSub(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((v, j) => v - B[i][j]));
  }
  
  private matScale(A: number[][], s: number): number[][] {
    return A.map(row => row.map(v => v * s));
  }
  
  private matMult(A: number[][], B: number[][]): number[][] {
    const n = A.length;
    const m = B[0].length;
    const p = B.length;
    
    const C: number[][] = [];
    for (let i = 0; i < n; i++) {
      C[i] = [];
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < p; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    
    return C;
  }
}

// ============================================
// MULTI-OBJECTIVE OPTIMIZER (NSGA-II)
// ============================================

export class MultiObjectiveOptimizer {
  private config: GeneticConfig;
  private objectives: ObjectiveFunction[];
  
  constructor(config: GeneticConfig, objectives: ObjectiveFunction[]) {
    this.config = config;
    this.objectives = objectives;
  }
  
  /**
   * Run NSGA-II multi-objective optimization
   */
  optimize(
    problem: OptimizationProblem,
    callback?: (gen: number, paretoSize: number) => void
  ): OptimizationResult {
    const ga = new GeneticOptimizer(this.config);
    
    // Modify problem for multi-objective handling
    const mobjProblem: OptimizationProblem = {
      ...problem,
      objective: {
        type: 'custom',
        customFunction: (x) => {
          // Return weighted sum for single-objective methods
          return this.objectives.reduce((sum, obj, i) => {
            const w = obj.weight || 1;
            const val = obj.customFunction?.(x) || 0;
            return sum + w * val;
          }, 0);
        },
      },
    };
    
    // Run optimization
    const result = ga.optimize(mobjProblem, (gen, best, avg) => {
      callback?.(gen, 1); // Simplified
    });
    
    // Build Pareto front (simplified - would need full NSGA-II implementation)
    result.paretoFront = [{
      objectives: this.objectives.map(obj => obj.customFunction?.(result.optimalDesign) || 0),
      design: result.optimalDesign,
      dominates: [],
      dominatedBy: [],
    }];
    
    return result;
  }
}

// ============================================
// SIZE OPTIMIZER
// ============================================

export class SizeOptimizer {
  private sectionCatalog: Map<string, { area: number; Ix: number; Iy: number; weight: number }>;
  
  constructor() {
    this.sectionCatalog = new Map();
    this.initializeCatalog();
  }
  
  private initializeCatalog(): void {
    // Common steel sections
    const sections = [
      { name: 'W8x21', area: 6.16, Ix: 75.3, Iy: 9.77, weight: 21 },
      { name: 'W10x33', area: 9.71, Ix: 170, Iy: 36.6, weight: 33 },
      { name: 'W12x40', area: 11.8, Ix: 310, Iy: 44.1, weight: 40 },
      { name: 'W14x48', area: 14.1, Ix: 485, Iy: 51.4, weight: 48 },
      { name: 'W16x57', area: 16.8, Ix: 758, Iy: 43.1, weight: 57 },
      { name: 'W18x71', area: 20.8, Ix: 1170, Iy: 60.3, weight: 71 },
      { name: 'W21x93', area: 27.3, Ix: 2070, Iy: 92.9, weight: 93 },
      { name: 'W24x117', area: 34.4, Ix: 3540, Iy: 164, weight: 117 },
      { name: 'W27x146', area: 42.9, Ix: 5630, Iy: 443, weight: 146 },
      { name: 'W30x173', area: 50.8, Ix: 8200, Iy: 598, weight: 173 },
    ];
    
    for (const s of sections) {
      this.sectionCatalog.set(s.name, { area: s.area, Ix: s.Ix, Iy: s.Iy, weight: s.weight });
    }
  }
  
  /**
   * Optimize member sizes
   */
  optimizeSizes(
    members: Array<{ id: string; length: number; requiredIx: number; requiredIy: number }>,
    stressLimit: number,
    deflectionLimit: number
  ): Map<string, string> {
    const result = new Map<string, string>();
    
    for (const member of members) {
      let selectedSection = '';
      let minWeight = Infinity;
      
      for (const [name, props] of this.sectionCatalog) {
        // Check moment of inertia requirements
        if (props.Ix >= member.requiredIx && props.Iy >= member.requiredIy) {
          if (props.weight < minWeight) {
            minWeight = props.weight;
            selectedSection = name;
          }
        }
      }
      
      result.set(member.id, selectedSection || 'W30x173'); // Default to largest if none found
    }
    
    return result;
  }
  
  /**
   * Get available sections
   */
  getSections(): string[] {
    return Array.from(this.sectionCatalog.keys());
  }
  
  /**
   * Get section properties
   */
  getSectionProperties(name: string): { area: number; Ix: number; Iy: number; weight: number } | undefined {
    return this.sectionCatalog.get(name);
  }
}

// ============================================
// EXPORTS
// ============================================

export const topologyOptimizer = new TopologyOptimizer({
  nx: 60,
  ny: 20,
  volumeFraction: 0.5,
});

export const geneticOptimizer = new GeneticOptimizer({
  populationSize: 100,
  maxGenerations: 200,
  crossoverRate: 0.9,
  mutationRate: 0.1,
  eliteCount: 5,
});

export const gradientOptimizer = new GradientOptimizer();
export const sizeOptimizer = new SizeOptimizer();

export default {
  TopologyOptimizer,
  GeneticOptimizer,
  GradientOptimizer,
  MultiObjectiveOptimizer,
  SizeOptimizer,
  topologyOptimizer,
  geneticOptimizer,
  gradientOptimizer,
  sizeOptimizer,
};
