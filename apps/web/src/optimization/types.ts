/**
 * Optimization type definitions and interfaces
 * Shared across all optimization strategies
 */

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

// Optimizer base interface for all strategy implementations
export interface Optimizer {
  optimize(problem: OptimizationProblem): Promise<OptimizationResult>;
  reset(): void;
}

// Constraint handling result
export interface ConstraintEvaluation {
  violations: number[];
  totalViolation: number;
  feasible: boolean;
  penaltyValue: number;
}
