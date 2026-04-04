/**
 * Base Optimizer class
 * Provides common functionality for all optimization strategies
 */

import {
  OptimizationProblem,
  OptimizationResult,
  OptimizationHistory,
  ConstraintEvaluation,
  DesignVariable,
  Constraint,
} from '../types.js';

export abstract class BaseOptimizer {
  protected problem: OptimizationProblem | null = null;
  protected history: OptimizationHistory = {
    objectives: [],
    designs: [],
    constraints: [],
    timestamps: [],
  };
  protected iterations = 0;
  protected startTime = 0;

  /**
   * Abstract optimize method - must be implemented by subclasses
   */
  abstract optimize(problem: OptimizationProblem): Promise<OptimizationResult>;

  /**
   * Reset optimizer state
   */
  reset(): void {
    this.problem = null;
    this.history = {
      objectives: [],
      designs: [],
      constraints: [],
      timestamps: [],
    };
    this.iterations = 0;
    this.startTime = 0;
  }

  /**
   * Record optimization state in history
   */
  protected recordHistory(
    design: number[],
    objective: number,
    constraints: number[]
  ): void {
    this.history.designs.push([...design]);
    this.history.objectives.push(objective);
    this.history.constraints.push([...constraints]);
    this.history.timestamps.push(Date.now() - this.startTime);
  }

  /**
   * Evaluate constraints for a design
   * Returns violation data and penalty value for constraint handling
   */
  protected evaluateConstraints(design: number[]): ConstraintEvaluation {
    if (!this.problem) {
      return {
        violations: [],
        totalViolation: 0,
        feasible: true,
        penaltyValue: 0,
      };
    }

    const violations: number[] = [];
    let totalViolation = 0;

    for (const constraint of this.problem.constraints) {
      let value = 0;

      if (constraint.customFunction) {
        value = constraint.customFunction(design);
      } else {
        // Built-in constraint types would evaluate based on problem type
        // This is where design analysis would feed into constraints
        value = 0; // Placeholder
      }

      // Calculate violation
      const violation = this.calculateConstraintViolation(value, constraint);
      violations.push(violation);
      totalViolation += Math.max(0, violation);
    }

    // Penalty method: add penalty to objective based on constraint violations
    const penaltyWeight = 100;
    const penaltyValue = penaltyWeight * totalViolation;

    return {
      violations,
      totalViolation,
      feasible: totalViolation <= 1e-6,
      penaltyValue,
    };
  }

  /**
   * Calculate single constraint violation value
   */
  private calculateConstraintViolation(value: number, constraint: Constraint): number {
    const { operator, value: limit, tolerance = 1e-6 } = constraint;

    switch (operator) {
      case '<=':
        return Math.max(0, value - limit + tolerance);
      case '>=':
        return Math.max(0, limit - value + tolerance);
      case '==':
        return Math.abs(value - limit);
      default:
        return 0;
    }
  }

  /**
   * Check if design is within bounds
   */
  protected isWithinBounds(design: number[]): boolean {
    if (!this.problem || !this.problem.bounds) {
      return true;
    }

    const { lower, upper } = this.problem.bounds;
    return design.every((val, i) => val >= lower[i] && val <= upper[i]);
  }

  /**
   * Clamp design variables to bounds
   */
  protected clampToBounds(design: number[]): number[] {
    if (!this.problem || !this.problem.bounds) {
      return design;
    }

    const { lower, upper } = this.problem.bounds;
    return design.map((val, i) => Math.max(lower[i], Math.min(upper[i], val)));
  }

  /**
   * Initialize design variables from problem definition
   */
  protected initializeDesign(): number[] {
    return this.problem?.designVariables.map((v) => v.initialValue) || [];
  }

  /**
   * Generate random design within bounds
   */
  protected generateRandomDesign(): number[] {
    if (!this.problem) {
      return [];
    }

    return this.problem.designVariables.map((variable) => {
      if (variable.type === 'discrete' && variable.discreteValues) {
        const randomIndex = Math.floor(
          Math.random() * variable.discreteValues.length
        );
        return variable.discreteValues[randomIndex];
      } else {
        return (
          variable.lowerBound +
          Math.random() * (variable.upperBound - variable.lowerBound)
        );
      }
    });
  }

  /**
   * Get design variable bounds
   */
  protected getVariableBounds(): { lower: number[]; upper: number[] } {
    if (!this.problem) {
      return { lower: [], upper: [] };
    }

    return {
      lower: this.problem.designVariables.map((v) => v.lowerBound),
      upper: this.problem.designVariables.map((v) => v.upperBound),
    };
  }

  /**
   * Build optimization result
   */
  protected buildResult(
    converged: boolean,
    optimalDesign: number[],
    finalObjective: number
  ): OptimizationResult {
    const constraints = this.evaluateConstraints(optimalDesign);

    return {
      converged,
      iterations: this.iterations,
      finalObjective,
      optimalDesign,
      history: { ...this.history },
      constraintViolations: constraints.violations,
      sensitivity: undefined,
      paretoFront: undefined,
    };
  }
}
