/**
 * ============================================================================
 * STRUCTURAL OPTIMIZATION ENGINE
 * ============================================================================
 * 
 * Advanced optimization capabilities including:
 * - Weight Optimization
 * - Cost Optimization
 * - Topology Optimization
 * - Section Size Optimization
 * - Multi-Objective Optimization
 * - Constraint Handling
 * - Genetic Algorithms
 * - Gradient-Based Methods
 * - Particle Swarm Optimization
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type OptimizationType = 'weight' | 'cost' | 'topology' | 'section' | 'multi_objective';
export type OptimizationMethod = 'genetic' | 'gradient' | 'pso' | 'simulated_annealing' | 'hybrid';
export type ConstraintType = 'stress' | 'displacement' | 'buckling' | 'frequency' | 'fabrication';

export interface OptimizationConfig {
  type: OptimizationType;
  method: OptimizationMethod;
  objective: ObjectiveFunction;
  constraints: Constraint[];
  designVariables: DesignVariable[];
  parameters: OptimizationParameters;
  callbacks?: OptimizationCallbacks;
}

export interface ObjectiveFunction {
  type: 'minimize' | 'maximize';
  name: string;
  weights?: number[]; // For multi-objective
  evaluate: (design: Design) => number;
}

export interface Constraint {
  name: string;
  type: ConstraintType;
  limitType: 'upper' | 'lower' | 'equality';
  limit: number;
  tolerance?: number;
  penalty?: number;
  evaluate: (design: Design) => number;
}

export interface DesignVariable {
  id: string;
  name: string;
  type: 'continuous' | 'discrete' | 'integer' | 'section';
  lowerBound: number;
  upperBound: number;
  discreteValues?: number[] | string[];
  initialValue?: number;
  linkedTo?: string[]; // For symmetry constraints
}

export interface OptimizationParameters {
  maxIterations: number;
  convergenceTolerance: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  elitismRate?: number;
  temperature?: number;
  coolingRate?: number;
  inertiaWeight?: number;
  cognitiveWeight?: number;
  socialWeight?: number;
}

export interface OptimizationCallbacks {
  onIteration?: (result: IterationResult) => void;
  onImprovement?: (result: IterationResult) => void;
  onComplete?: (result: OptimizationResult) => void;
  shouldStop?: () => boolean;
}

export interface Design {
  variables: Map<string, number | string>;
  objective?: number;
  constraints?: Map<string, number>;
  feasible?: boolean;
  penalty?: number;
}

export interface IterationResult {
  iteration: number;
  bestObjective: number;
  averageObjective: number;
  worstObjective: number;
  bestDesign: Design;
  feasibleCount: number;
  convergence: number;
  elapsedTime: number;
}

export interface OptimizationResult {
  success: boolean;
  bestDesign: Design;
  finalObjective: number;
  iterations: number;
  convergenceHistory: number[];
  constraintViolations: Map<string, number>;
  elapsedTime: number;
  method: OptimizationMethod;
  statistics: OptimizationStatistics;
}

export interface OptimizationStatistics {
  totalEvaluations: number;
  feasibleDesigns: number;
  infeasibleDesigns: number;
  improvementRate: number;
  diversityMetric: number;
  paretoFrontSize?: number;
}

// ============================================================================
// MAIN OPTIMIZATION ENGINE CLASS
// ============================================================================

export class StructuralOptimizationEngine {
  private config: OptimizationConfig;
  private bestDesign: Design | null = null;
  private population: Design[] = [];
  private convergenceHistory: number[] = [];
  private startTime: number = 0;
  private evaluationCount: number = 0;

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  // --------------------------------------------------------------------------
  // MAIN OPTIMIZATION
  // --------------------------------------------------------------------------

  async optimize(): Promise<OptimizationResult> {
    this.startTime = Date.now();
    this.evaluationCount = 0;
    this.convergenceHistory = [];
    
    let result: OptimizationResult;
    
    switch (this.config.method) {
      case 'genetic':
        result = await this.geneticAlgorithm();
        break;
      case 'pso':
        result = await this.particleSwarmOptimization();
        break;
      case 'simulated_annealing':
        result = await this.simulatedAnnealing();
        break;
      case 'gradient':
        result = await this.gradientDescent();
        break;
      case 'hybrid':
        result = await this.hybridOptimization();
        break;
      default:
        result = await this.geneticAlgorithm();
    }
    
    if (this.config.callbacks?.onComplete) {
      this.config.callbacks.onComplete(result);
    }
    
    return result;
  }

  // --------------------------------------------------------------------------
  // GENETIC ALGORITHM
  // --------------------------------------------------------------------------

  private async geneticAlgorithm(): Promise<OptimizationResult> {
    const { parameters, designVariables, objective, constraints } = this.config;
    const {
      maxIterations,
      convergenceTolerance,
      populationSize = 50,
      mutationRate = 0.1,
      crossoverRate = 0.8,
      elitismRate = 0.1,
    } = parameters;
    
    // Initialize population
    this.population = this.initializePopulation(populationSize);
    
    // Evaluate initial population
    await this.evaluatePopulation();
    this.sortPopulation();
    
    this.bestDesign = this.population[0];
    this.convergenceHistory.push(this.bestDesign.objective!);
    
    let convergenceCounter = 0;
    let previousBest = this.bestDesign.objective!;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Check for early termination
      if (this.config.callbacks?.shouldStop?.()) break;
      
      // Selection
      const parents = this.tournamentSelection(populationSize);
      
      // Crossover
      const offspring: Design[] = [];
      for (let i = 0; i < parents.length - 1; i += 2) {
        if (Math.random() < crossoverRate) {
          const [child1, child2] = this.crossover(parents[i], parents[i + 1]);
          offspring.push(child1, child2);
        } else {
          offspring.push(this.cloneDesign(parents[i]), this.cloneDesign(parents[i + 1]));
        }
      }
      
      // Mutation
      for (const design of offspring) {
        if (Math.random() < mutationRate) {
          this.mutate(design);
        }
      }
      
      // Elitism
      const eliteCount = Math.ceil(populationSize * elitismRate);
      const elites = this.population.slice(0, eliteCount);
      
      // Replace population
      this.population = [...elites, ...offspring.slice(0, populationSize - eliteCount)];
      
      // Evaluate new population
      await this.evaluatePopulation();
      this.sortPopulation();
      
      // Update best design
      if (this.population[0].objective! < this.bestDesign.objective!) {
        this.bestDesign = this.population[0];
        
        if (this.config.callbacks?.onImprovement) {
          this.config.callbacks.onImprovement(this.createIterationResult(iteration));
        }
      }
      
      this.convergenceHistory.push(this.bestDesign.objective!);
      
      // Convergence check
      if (Math.abs(previousBest - this.bestDesign.objective!) < convergenceTolerance) {
        convergenceCounter++;
        if (convergenceCounter >= 10) break;
      } else {
        convergenceCounter = 0;
        previousBest = this.bestDesign.objective!;
      }
      
      // Callback
      if (this.config.callbacks?.onIteration) {
        this.config.callbacks.onIteration(this.createIterationResult(iteration));
      }
    }
    
    return this.createOptimizationResult();
  }

  private initializePopulation(size: number): Design[] {
    const population: Design[] = [];
    
    for (let i = 0; i < size; i++) {
      const design = this.createRandomDesign();
      population.push(design);
    }
    
    return population;
  }

  private createRandomDesign(): Design {
    const variables = new Map<string, number | string>();
    
    for (const dv of this.config.designVariables) {
      if (dv.type === 'continuous') {
        variables.set(dv.id, dv.lowerBound + Math.random() * (dv.upperBound - dv.lowerBound));
      } else if (dv.type === 'discrete' && dv.discreteValues) {
        const index = Math.floor(Math.random() * dv.discreteValues.length);
        variables.set(dv.id, dv.discreteValues[index]);
      } else if (dv.type === 'integer') {
        variables.set(dv.id, Math.floor(dv.lowerBound + Math.random() * (dv.upperBound - dv.lowerBound + 1)));
      } else if (dv.type === 'section' && dv.discreteValues) {
        const index = Math.floor(Math.random() * dv.discreteValues.length);
        variables.set(dv.id, dv.discreteValues[index]);
      }
    }
    
    return { variables };
  }

  private async evaluatePopulation(): Promise<void> {
    for (const design of this.population) {
      await this.evaluateDesign(design);
    }
  }

  private async evaluateDesign(design: Design): Promise<void> {
    this.evaluationCount++;
    
    // Evaluate objective
    design.objective = this.config.objective.evaluate(design);
    
    // Evaluate constraints
    design.constraints = new Map();
    design.feasible = true;
    design.penalty = 0;
    
    for (const constraint of this.config.constraints) {
      const value = constraint.evaluate(design);
      design.constraints.set(constraint.name, value);
      
      let violation = 0;
      
      if (constraint.limitType === 'upper' && value > constraint.limit) {
        violation = (value - constraint.limit) / Math.abs(constraint.limit || 1);
        design.feasible = false;
      } else if (constraint.limitType === 'lower' && value < constraint.limit) {
        violation = (constraint.limit - value) / Math.abs(constraint.limit || 1);
        design.feasible = false;
      } else if (constraint.limitType === 'equality') {
        const tol = constraint.tolerance || 0.01;
        if (Math.abs(value - constraint.limit) > tol) {
          violation = Math.abs(value - constraint.limit) / Math.abs(constraint.limit || 1);
          design.feasible = false;
        }
      }
      
      design.penalty! += violation * (constraint.penalty || 1000);
    }
    
    // Add penalty to objective for infeasible designs
    if (!design.feasible) {
      design.objective! += design.penalty!;
    }
  }

  private sortPopulation(): void {
    this.population.sort((a, b) => {
      if (this.config.objective.type === 'minimize') {
        return a.objective! - b.objective!;
      } else {
        return b.objective! - a.objective!;
      }
    });
  }

  private tournamentSelection(count: number, tournamentSize: number = 3): Design[] {
    const selected: Design[] = [];
    
    for (let i = 0; i < count; i++) {
      let best: Design | null = null;
      
      for (let j = 0; j < tournamentSize; j++) {
        const candidate = this.population[Math.floor(Math.random() * this.population.length)];
        
        if (!best || candidate.objective! < best.objective!) {
          best = candidate;
        }
      }
      
      selected.push(this.cloneDesign(best!));
    }
    
    return selected;
  }

  private crossover(parent1: Design, parent2: Design): [Design, Design] {
    const child1: Design = { variables: new Map() };
    const child2: Design = { variables: new Map() };
    
    for (const dv of this.config.designVariables) {
      const val1 = parent1.variables.get(dv.id);
      const val2 = parent2.variables.get(dv.id);
      
      if (dv.type === 'continuous') {
        // BLX-alpha crossover
        const alpha = 0.5;
        const d = Math.abs((val1 as number) - (val2 as number));
        const min = Math.min(val1 as number, val2 as number) - alpha * d;
        const max = Math.max(val1 as number, val2 as number) + alpha * d;
        
        child1.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, min + Math.random() * (max - min))));
        child2.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, min + Math.random() * (max - min))));
      } else {
        // Uniform crossover for discrete variables
        if (Math.random() < 0.5) {
          child1.variables.set(dv.id, val1!);
          child2.variables.set(dv.id, val2!);
        } else {
          child1.variables.set(dv.id, val2!);
          child2.variables.set(dv.id, val1!);
        }
      }
    }
    
    return [child1, child2];
  }

  private mutate(design: Design): void {
    for (const dv of this.config.designVariables) {
      if (Math.random() < 1 / this.config.designVariables.length) {
        if (dv.type === 'continuous') {
          // Gaussian mutation
          const current = design.variables.get(dv.id) as number;
          const sigma = (dv.upperBound - dv.lowerBound) * 0.1;
          const mutated = current + this.gaussianRandom() * sigma;
          design.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, mutated)));
        } else if (dv.discreteValues) {
          // Random reset for discrete
          const index = Math.floor(Math.random() * dv.discreteValues.length);
          design.variables.set(dv.id, dv.discreteValues[index]);
        } else if (dv.type === 'integer') {
          design.variables.set(dv.id, Math.floor(dv.lowerBound + Math.random() * (dv.upperBound - dv.lowerBound + 1)));
        }
      }
    }
  }

  private cloneDesign(design: Design): Design {
    return {
      variables: new Map(design.variables),
      objective: design.objective,
      constraints: design.constraints ? new Map(design.constraints) : undefined,
      feasible: design.feasible,
      penalty: design.penalty,
    };
  }

  // --------------------------------------------------------------------------
  // PARTICLE SWARM OPTIMIZATION
  // --------------------------------------------------------------------------

  private async particleSwarmOptimization(): Promise<OptimizationResult> {
    const { parameters, designVariables } = this.config;
    const {
      maxIterations,
      convergenceTolerance,
      populationSize = 50,
      inertiaWeight = 0.7,
      cognitiveWeight = 1.5,
      socialWeight = 1.5,
    } = parameters;
    
    // Initialize particles
    const particles: Particle[] = [];
    let globalBest: Design | null = null;
    
    for (let i = 0; i < populationSize; i++) {
      const design = this.createRandomDesign();
      await this.evaluateDesign(design);
      
      const velocity = new Map<string, number>();
      for (const dv of designVariables) {
        if (dv.type === 'continuous' || dv.type === 'integer') {
          velocity.set(dv.id, (Math.random() - 0.5) * (dv.upperBound - dv.lowerBound) * 0.1);
        }
      }
      
      particles.push({
        position: design,
        velocity,
        personalBest: this.cloneDesign(design),
      });
      
      if (!globalBest || design.objective! < globalBest.objective!) {
        globalBest = this.cloneDesign(design);
      }
    }
    
    this.bestDesign = globalBest!;
    this.convergenceHistory.push(this.bestDesign.objective!);
    
    let convergenceCounter = 0;
    let previousBest = this.bestDesign.objective!;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (this.config.callbacks?.shouldStop?.()) break;
      
      // Adaptive inertia weight
      const w = inertiaWeight - (inertiaWeight - 0.4) * iteration / maxIterations;
      
      for (const particle of particles) {
        // Update velocity and position
        for (const dv of designVariables) {
          if (dv.type === 'continuous' || dv.type === 'integer') {
            const currentPos = particle.position.variables.get(dv.id) as number;
            const personalBestPos = particle.personalBest.variables.get(dv.id) as number;
            const globalBestPos = globalBest!.variables.get(dv.id) as number;
            const currentVel = particle.velocity.get(dv.id)!;
            
            const r1 = Math.random();
            const r2 = Math.random();
            
            const newVel = w * currentVel +
                          cognitiveWeight * r1 * (personalBestPos - currentPos) +
                          socialWeight * r2 * (globalBestPos - currentPos);
            
            const vMax = (dv.upperBound - dv.lowerBound) * 0.2;
            const clampedVel = Math.max(-vMax, Math.min(vMax, newVel));
            
            particle.velocity.set(dv.id, clampedVel);
            
            let newPos = currentPos + clampedVel;
            newPos = Math.max(dv.lowerBound, Math.min(dv.upperBound, newPos));
            
            if (dv.type === 'integer') {
              newPos = Math.round(newPos);
            }
            
            particle.position.variables.set(dv.id, newPos);
          }
        }
        
        // Evaluate new position
        await this.evaluateDesign(particle.position);
        
        // Update personal best
        if (particle.position.objective! < particle.personalBest.objective!) {
          particle.personalBest = this.cloneDesign(particle.position);
          
          // Update global best
          if (particle.position.objective! < globalBest!.objective!) {
            globalBest = this.cloneDesign(particle.position);
            
            if (this.config.callbacks?.onImprovement) {
              this.config.callbacks.onImprovement(this.createIterationResult(iteration));
            }
          }
        }
      }
      
      this.bestDesign = globalBest!;
      this.convergenceHistory.push(this.bestDesign.objective!);
      
      // Convergence check
      if (Math.abs(previousBest - this.bestDesign.objective!) < convergenceTolerance) {
        convergenceCounter++;
        if (convergenceCounter >= 15) break;
      } else {
        convergenceCounter = 0;
        previousBest = this.bestDesign.objective!;
      }
      
      if (this.config.callbacks?.onIteration) {
        this.config.callbacks.onIteration(this.createIterationResult(iteration));
      }
    }
    
    return this.createOptimizationResult();
  }

  // --------------------------------------------------------------------------
  // SIMULATED ANNEALING
  // --------------------------------------------------------------------------

  private async simulatedAnnealing(): Promise<OptimizationResult> {
    const { parameters } = this.config;
    const {
      maxIterations,
      convergenceTolerance,
      temperature = 1000,
      coolingRate = 0.995,
    } = parameters;
    
    // Initialize
    let currentDesign = this.createRandomDesign();
    await this.evaluateDesign(currentDesign);
    
    this.bestDesign = this.cloneDesign(currentDesign);
    let T = temperature;
    
    this.convergenceHistory.push(this.bestDesign.objective!);
    
    let convergenceCounter = 0;
    let previousBest = this.bestDesign.objective!;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (this.config.callbacks?.shouldStop?.()) break;
      if (T < 0.001) break;
      
      // Generate neighbor
      const neighbor = this.generateNeighbor(currentDesign);
      await this.evaluateDesign(neighbor);
      
      // Acceptance criterion
      const deltaE = neighbor.objective! - currentDesign.objective!;
      
      if (deltaE < 0 || Math.random() < Math.exp(-deltaE / T)) {
        currentDesign = neighbor;
        
        if (currentDesign.objective! < this.bestDesign.objective!) {
          this.bestDesign = this.cloneDesign(currentDesign);
          
          if (this.config.callbacks?.onImprovement) {
            this.config.callbacks.onImprovement(this.createIterationResult(iteration));
          }
        }
      }
      
      // Cool down
      T *= coolingRate;
      
      this.convergenceHistory.push(this.bestDesign.objective!);
      
      // Convergence check
      if (Math.abs(previousBest - this.bestDesign.objective!) < convergenceTolerance) {
        convergenceCounter++;
        if (convergenceCounter >= 50) break;
      } else {
        convergenceCounter = 0;
        previousBest = this.bestDesign.objective!;
      }
      
      if (this.config.callbacks?.onIteration) {
        this.config.callbacks.onIteration(this.createIterationResult(iteration));
      }
    }
    
    return this.createOptimizationResult();
  }

  private generateNeighbor(design: Design): Design {
    const neighbor = this.cloneDesign(design);
    
    // Randomly select a variable to modify
    const dvIndex = Math.floor(Math.random() * this.config.designVariables.length);
    const dv = this.config.designVariables[dvIndex];
    
    if (dv.type === 'continuous') {
      const current = neighbor.variables.get(dv.id) as number;
      const range = (dv.upperBound - dv.lowerBound) * 0.1;
      const newValue = current + (Math.random() - 0.5) * 2 * range;
      neighbor.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, newValue)));
    } else if (dv.discreteValues) {
      const currentVal = neighbor.variables.get(dv.id);
      const currentIndex = dv.discreteValues.findIndex(v => v === currentVal);
      const delta = Math.random() < 0.5 ? -1 : 1;
      const newIndex = Math.max(0, Math.min(dv.discreteValues.length - 1, currentIndex + delta));
      neighbor.variables.set(dv.id, dv.discreteValues[newIndex] as string | number);
    } else if (dv.type === 'integer') {
      const current = neighbor.variables.get(dv.id) as number;
      const delta = Math.floor((Math.random() - 0.5) * 4);
      neighbor.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, current + delta)));
    }
    
    return neighbor;
  }

  // --------------------------------------------------------------------------
  // GRADIENT DESCENT
  // --------------------------------------------------------------------------

  private async gradientDescent(): Promise<OptimizationResult> {
    const { parameters, designVariables } = this.config;
    const { maxIterations, convergenceTolerance } = parameters;
    
    // Only works with continuous variables
    const continuousVars = designVariables.filter(dv => dv.type === 'continuous');
    
    // Initialize
    const currentDesign = this.createRandomDesign();
    await this.evaluateDesign(currentDesign);
    
    this.bestDesign = this.cloneDesign(currentDesign);
    this.convergenceHistory.push(this.bestDesign.objective!);
    
    let stepSize = 0.1;
    let convergenceCounter = 0;
    let previousObjective = currentDesign.objective!;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (this.config.callbacks?.shouldStop?.()) break;
      
      // Calculate gradient numerically
      const gradient = new Map<string, number>();
      const h = 1e-6;
      
      for (const dv of continuousVars) {
        const currentValue = currentDesign.variables.get(dv.id) as number;
        
        // Forward difference
        currentDesign.variables.set(dv.id, currentValue + h);
        await this.evaluateDesign(currentDesign);
        const fPlus = currentDesign.objective!;
        
        // Backward difference
        currentDesign.variables.set(dv.id, currentValue - h);
        await this.evaluateDesign(currentDesign);
        const fMinus = currentDesign.objective!;
        
        gradient.set(dv.id, (fPlus - fMinus) / (2 * h));
        currentDesign.variables.set(dv.id, currentValue);
      }
      
      // Update design (gradient descent step)
      for (const dv of continuousVars) {
        const currentValue = currentDesign.variables.get(dv.id) as number;
        const grad = gradient.get(dv.id)!;
        const newValue = currentValue - stepSize * grad;
        currentDesign.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, newValue)));
      }
      
      // Evaluate new design
      await this.evaluateDesign(currentDesign);
      
      // Line search (backtracking)
      let tries = 0;
      while (currentDesign.objective! > previousObjective && tries < 10) {
        stepSize *= 0.5;
        
        for (const dv of continuousVars) {
          const prevValue = this.bestDesign.variables.get(dv.id) as number;
          const grad = gradient.get(dv.id)!;
          const newValue = prevValue - stepSize * grad;
          currentDesign.variables.set(dv.id, Math.max(dv.lowerBound, Math.min(dv.upperBound, newValue)));
        }
        
        await this.evaluateDesign(currentDesign);
        tries++;
      }
      
      // Update best
      if (currentDesign.objective! < this.bestDesign.objective!) {
        this.bestDesign = this.cloneDesign(currentDesign);
        stepSize = Math.min(stepSize * 1.2, 1.0); // Increase step size on success
        
        if (this.config.callbacks?.onImprovement) {
          this.config.callbacks.onImprovement(this.createIterationResult(iteration));
        }
      }
      
      this.convergenceHistory.push(this.bestDesign.objective!);
      
      // Convergence check
      if (Math.abs(previousObjective - currentDesign.objective!) < convergenceTolerance) {
        convergenceCounter++;
        if (convergenceCounter >= 5) break;
      } else {
        convergenceCounter = 0;
      }
      
      previousObjective = currentDesign.objective!;
      
      if (this.config.callbacks?.onIteration) {
        this.config.callbacks.onIteration(this.createIterationResult(iteration));
      }
    }
    
    return this.createOptimizationResult();
  }

  // --------------------------------------------------------------------------
  // HYBRID OPTIMIZATION
  // --------------------------------------------------------------------------

  private async hybridOptimization(): Promise<OptimizationResult> {
    // Start with genetic algorithm for global search
    const gaConfig = { ...this.config };
    gaConfig.parameters = {
      ...this.config.parameters,
      maxIterations: Math.floor(this.config.parameters.maxIterations * 0.7),
    };
    
    const gaEngine = new StructuralOptimizationEngine(gaConfig);
    const gaResult = await gaEngine.optimize();
    
    // Refine with gradient descent for local optimization
    const gradientConfig = { ...this.config };
    gradientConfig.method = 'gradient';
    gradientConfig.parameters = {
      ...this.config.parameters,
      maxIterations: Math.floor(this.config.parameters.maxIterations * 0.3),
    };
    
    // Set initial design from GA result
    for (const dv of gradientConfig.designVariables) {
      dv.initialValue = gaResult.bestDesign.variables.get(dv.id) as number;
    }
    
    const gradientEngine = new StructuralOptimizationEngine(gradientConfig);
    const gradientResult = await gradientEngine.optimize();
    
    // Return the better result
    if (gradientResult.finalObjective < gaResult.finalObjective) {
      return gradientResult;
    }
    return gaResult;
  }

  // --------------------------------------------------------------------------
  // TOPOLOGY OPTIMIZATION
  // --------------------------------------------------------------------------

  static createTopologyOptimization(config: TopologyOptConfig): StructuralOptimizationEngine {
    const { domain, volumeFraction, penalization, filterRadius, minMemberSize } = config;
    
    // Create design variables (element densities)
    const designVariables: DesignVariable[] = [];
    
    for (let i = 0; i < domain.numElements; i++) {
      designVariables.push({
        id: `rho_${i}`,
        name: `Element ${i} Density`,
        type: 'continuous',
        lowerBound: 0.001,
        upperBound: 1.0,
        initialValue: volumeFraction,
      });
    }
    
    // Objective: Minimize compliance (maximize stiffness)
    const objective: ObjectiveFunction = {
      type: 'minimize',
      name: 'Compliance',
      evaluate: (design: Design) => {
        // SIMP method: E(rho) = E0 * rho^p
        let compliance = 0;
        
        for (let i = 0; i < domain.numElements; i++) {
          const rho = design.variables.get(`rho_${i}`) as number;
          const E_eff = domain.E0 * Math.pow(rho, penalization);
          compliance += domain.elementStrainEnergy[i] / E_eff;
        }
        
        return compliance;
      },
    };
    
    // Volume constraint
    const constraints: Constraint[] = [
      {
        name: 'Volume Fraction',
        type: 'stress',
        limitType: 'upper',
        limit: volumeFraction * domain.totalVolume,
        evaluate: (design: Design) => {
          let volume = 0;
          for (let i = 0; i < domain.numElements; i++) {
            const rho = design.variables.get(`rho_${i}`) as number;
            volume += rho * domain.elementVolumes[i];
          }
          return volume;
        },
      },
    ];
    
    return new StructuralOptimizationEngine({
      type: 'topology',
      method: 'gradient',
      objective,
      constraints,
      designVariables,
      parameters: {
        maxIterations: 200,
        convergenceTolerance: 0.001,
      },
    });
  }

  // --------------------------------------------------------------------------
  // SECTION OPTIMIZATION
  // --------------------------------------------------------------------------

  static createSectionOptimization(config: SectionOptConfig): StructuralOptimizationEngine {
    const { members, availableSections, loadCases, code } = config;
    
    // Create design variables (section assignments)
    const designVariables: DesignVariable[] = members.map(member => ({
      id: `section_${member.id}`,
      name: `${member.name} Section`,
      type: 'section' as const,
      lowerBound: 0,
      upperBound: availableSections.length - 1,
      discreteValues: availableSections.map(s => s.designation),
    }));
    
    // Objective: Minimize total weight
    const objective: ObjectiveFunction = {
      type: 'minimize',
      name: 'Total Weight',
      evaluate: (design: Design) => {
        let totalWeight = 0;
        
        for (const member of members) {
          const sectionId = design.variables.get(`section_${member.id}`) as string;
          const section = availableSections.find(s => s.designation === sectionId);
          if (section) {
            totalWeight += section.weight * member.length;
          }
        }
        
        return totalWeight;
      },
    };
    
    // Constraints: Stress, deflection, etc.
    const constraints: Constraint[] = [
      {
        name: 'Maximum Utilization',
        type: 'stress',
        limitType: 'upper',
        limit: 1.0,
        penalty: 10000,
        evaluate: (design: Design) => {
          let maxUtil = 0;
          
          for (const member of members) {
            const sectionId = design.variables.get(`section_${member.id}`) as string;
            const section = availableSections.find(s => s.designation === sectionId);
            if (section) {
              // Calculate utilization based on member forces and section capacity
              const util = member.maxForce / (section.area * 250 / 1.1); // Simplified
              maxUtil = Math.max(maxUtil, util);
            }
          }
          
          return maxUtil;
        },
      },
    ];
    
    return new StructuralOptimizationEngine({
      type: 'section',
      method: 'genetic',
      objective,
      constraints,
      designVariables,
      parameters: {
        maxIterations: 100,
        convergenceTolerance: 0.01,
        populationSize: 50,
        mutationRate: 0.1,
        crossoverRate: 0.8,
        elitismRate: 0.1,
      },
    });
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private createIterationResult(iteration: number): IterationResult {
    const objectives = this.population.map(d => d.objective!);
    const feasibleCount = this.population.filter(d => d.feasible).length;
    
    return {
      iteration,
      bestObjective: Math.min(...objectives),
      averageObjective: objectives.reduce((a, b) => a + b, 0) / objectives.length,
      worstObjective: Math.max(...objectives),
      bestDesign: this.bestDesign!,
      feasibleCount,
      convergence: this.calculateConvergence(),
      elapsedTime: (Date.now() - this.startTime) / 1000,
    };
  }

  private createOptimizationResult(): OptimizationResult {
    const constraintViolations = new Map<string, number>();
    
    if (this.bestDesign?.constraints) {
      for (const constraint of this.config.constraints) {
        const value = this.bestDesign.constraints.get(constraint.name)!;
        let violation = 0;
        
        if (constraint.limitType === 'upper' && value > constraint.limit) {
          violation = value - constraint.limit;
        } else if (constraint.limitType === 'lower' && value < constraint.limit) {
          violation = constraint.limit - value;
        }
        
        constraintViolations.set(constraint.name, violation);
      }
    }
    
    const feasibleCount = this.population.filter(d => d.feasible).length;
    
    return {
      success: this.bestDesign?.feasible ?? false,
      bestDesign: this.bestDesign!,
      finalObjective: this.bestDesign?.objective ?? Infinity,
      iterations: this.convergenceHistory.length,
      convergenceHistory: this.convergenceHistory,
      constraintViolations,
      elapsedTime: (Date.now() - this.startTime) / 1000,
      method: this.config.method,
      statistics: {
        totalEvaluations: this.evaluationCount,
        feasibleDesigns: feasibleCount,
        infeasibleDesigns: this.population.length - feasibleCount,
        improvementRate: this.calculateImprovementRate(),
        diversityMetric: this.calculateDiversity(),
      },
    };
  }

  private calculateConvergence(): number {
    if (this.convergenceHistory.length < 10) return 1;
    
    const recent = this.convergenceHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    return Math.abs(first - last) / Math.abs(first || 1);
  }

  private calculateImprovementRate(): number {
    if (this.convergenceHistory.length < 2) return 0;
    
    const initial = this.convergenceHistory[0];
    const final = this.convergenceHistory[this.convergenceHistory.length - 1];
    
    return (initial - final) / initial;
  }

  private calculateDiversity(): number {
    if (this.population.length < 2) return 0;
    
    let sumDistance = 0;
    let count = 0;
    
    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        sumDistance += this.designDistance(this.population[i], this.population[j]);
        count++;
      }
    }
    
    return sumDistance / count;
  }

  private designDistance(d1: Design, d2: Design): number {
    let sumSq = 0;
    
    for (const dv of this.config.designVariables) {
      const v1 = d1.variables.get(dv.id);
      const v2 = d2.variables.get(dv.id);
      
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        const normalized = (v1 - v2) / (dv.upperBound - dv.lowerBound);
        sumSq += normalized * normalized;
      }
    }
    
    return Math.sqrt(sumSq);
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

// ============================================================================
// ADDITIONAL INTERFACES
// ============================================================================

interface Particle {
  position: Design;
  velocity: Map<string, number>;
  personalBest: Design;
}

interface TopologyOptConfig {
  domain: {
    numElements: number;
    E0: number;
    elementVolumes: number[];
    elementStrainEnergy: number[];
    totalVolume: number;
  };
  volumeFraction: number;
  penalization: number;
  filterRadius: number;
  minMemberSize: number;
}

interface SectionOptConfig {
  members: {
    id: string;
    name: string;
    length: number;
    maxForce: number;
  }[];
  availableSections: {
    designation: string;
    area: number;
    weight: number;
    Ix: number;
    Zx: number;
  }[];
  loadCases: string[];
  code: string;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createOptimizationEngine = (config: OptimizationConfig) => new StructuralOptimizationEngine(config);

export default StructuralOptimizationEngine;
