/**
 * Structural Optimization Module - Public API
 * Provides multiple optimization strategies for structural design
 *
 * Available Optimizers:
 * - TopologyOptimizer: SIMP-based material distribution
 * - SizeOptimizer: Cross-section optimization
 * - ShapeOptimizer: Geometry optimization
 * - GeneticOptimizer: Evolutionary algorithms
 * - GradientOptimizer: Sensitivity-based methods
 * - MultiObjectiveOptimizer: Pareto front generation
 */

// Re-export all types
export type {
  OptimizationProblem,
  ObjectiveFunction,
  Constraint,
  DesignVariable,
  OptimizationResult,
  OptimizationHistory,
  ParetoPoint,
  TopologyResult,
  GeneticConfig,
  Optimizer,
  ConstraintEvaluation,
} from './types.js';

// Re-export base optimizer for extension
export { BaseOptimizer } from './core/BaseOptimizer.js';

// For now, keep importing from the original file for backward compatibility
// This allows gradual migration while maintaining API stability
// TODO: Replace these imports with decomposed module imports as they're implemented
import {
  TopologyOptimizer,
  GeneticOptimizer,
  GradientOptimizer,
  MultiObjectiveOptimizer,
  SizeOptimizer,
} from './StructuralOptimization.js';

export {
  TopologyOptimizer,
  GeneticOptimizer,
  GradientOptimizer,
  MultiObjectiveOptimizer,
  SizeOptimizer,
} from './StructuralOptimization.js';

/**
 * Create an optimizer for a specific optimization type
 * Factory function for easier instantiation
 */
export function createOptimizer(type: 'topology' | 'size' | 'shape' | 'genetic' | 'gradient' | 'multi-objective') {
  switch (type) {
    case 'topology':
      return new TopologyOptimizer({
        nx: 30,
        ny: 30,
        volumeFraction: 0.5,
        penalization: 3,
        filterRadius: 1.5,
      });
    case 'genetic':
      return new GeneticOptimizer({
        populationSize: 50,
        maxGenerations: 100,
        crossoverRate: 0.8,
        mutationRate: 0.1,
        eliteCount: 5,
      });
    case 'multi-objective':
      return new MultiObjectiveOptimizer({
        populationSize: 50,
        maxGenerations: 100,
        crossoverRate: 0.8,
        mutationRate: 0.1,
        eliteCount: 5,
      }, []);
    case 'gradient':
      return new GradientOptimizer({ stepSize: 0.01, tolerance: 1e-5 });
    case 'size':
      return new SizeOptimizer();
    default:
      throw new Error(`Unknown optimizer type: ${type}`);
  }
}
