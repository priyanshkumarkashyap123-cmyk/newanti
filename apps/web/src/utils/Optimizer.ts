/**
 * Optimizer - Section Optimization Engine
 * Iteratively finds optimal section based on utilization ratio
 * Target: 0.8 < Ratio < 1.0 (economical and safe)
 */

import { IS800_SteelDesignEngine, IS_SteelSection, IS_SteelMaterial, IS_MemberForces, IS_MemberProperties, IS_DesignResult } from './IS800_SteelDesignEngine';
import { SteelDesignEngine, SteelSection, SteelMaterial, MemberForces, MemberProperties, DesignResult } from './SteelDesignEngine';

// ============================================
// TYPES & INTERFACES
// ============================================

export type DesignCode = 'IS800' | 'AISC360';

export interface OptimizationInput {
    memberId: string;
    currentSectionId: string;
    forces: IS_MemberForces | MemberForces;
    material: IS_SteelMaterial | SteelMaterial;
    memberProps: IS_MemberProperties | MemberProperties;
    code: DesignCode;
}

export interface OptimizationResult {
    memberId: string;
    originalSectionId: string;
    recommendedSectionId: string;
    originalRatio: number;
    finalRatio: number;
    originalWeight: number;      // kg/m or lb/ft
    finalWeight: number;
    weightSavings: number;       // Percentage
    weightSavingsAbsolute: number;  // kg/m or lb/ft
    iterations: number;
    status: 'optimized' | 'unchanged' | 'failed' | 'at_limit';
    message: string;
}

export interface SectionDatabase {
    sections: Array<{ id: string; section: IS_SteelSection | SteelSection; weight: number }>;
}

// ============================================
// SECTION OPTIMIZER
// ============================================

export class Optimizer {
    // Optimization targets
    static readonly TARGET_MIN = 0.80;  // Minimum utilization (below = inefficient)
    static readonly TARGET_MAX = 1.00;  // Maximum utilization (above = unsafe)
    static readonly OPTIMAL_MIN = 0.80;
    static readonly OPTIMAL_MAX = 0.95;  // Leave some margin
    static readonly MAX_ITERATIONS = 20;

    /**
     * ISMB sections sorted by weight (ascending)
     */
    static readonly ISMB_DATABASE: SectionDatabase = {
        sections: [
            { id: 'ISMB 100', section: IS800_SteelDesignEngine.ISMB_SECTIONS['ISMB 100']!, weight: 8.9 },
            { id: 'ISMB 150', section: IS800_SteelDesignEngine.ISMB_SECTIONS['ISMB 150']!, weight: 14.9 },
            { id: 'ISMB 200', section: IS800_SteelDesignEngine.ISMB_SECTIONS['ISMB 200']!, weight: 25.4 },
            { id: 'ISMB 250', section: IS800_SteelDesignEngine.ISMB_SECTIONS['ISMB 250']!, weight: 37.3 },
            { id: 'ISMB 300', section: IS800_SteelDesignEngine.ISMB_SECTIONS['ISMB 300']!, weight: 46.0 },
        ].filter(s => s.section !== undefined)
    };

    /**
     * W sections sorted by weight (ascending)
     */
    static readonly W_DATABASE: SectionDatabase = {
        sections: [
            { id: 'W14x22', section: SteelDesignEngine.W_SECTIONS['W14x22']!, weight: 22 },
            { id: 'W14x30', section: SteelDesignEngine.W_SECTIONS['W14x30']!, weight: 30 },
            { id: 'W14x48', section: SteelDesignEngine.W_SECTIONS['W14x48']!, weight: 48 },
            { id: 'W21x44', section: SteelDesignEngine.W_SECTIONS['W21x44']!, weight: 44 },
        ].filter(s => s.section !== undefined).sort((a, b) => a.weight - b.weight)
    };

    /**
     * Main optimization function
     */
    static optimize(input: OptimizationInput): OptimizationResult {
        const { memberId, currentSectionId, forces, material, memberProps, code } = input;

        // Select database and design function
        const database = code === 'IS800' ? this.ISMB_DATABASE : this.W_DATABASE;
        const checkFn = code === 'IS800'
            ? (section: IS_SteelSection) => IS800_SteelDesignEngine.checkMember(
                forces as IS_MemberForces,
                section,
                material as IS_SteelMaterial,
                memberProps as IS_MemberProperties
            )
            : (section: SteelSection) => SteelDesignEngine.checkMember(
                forces as MemberForces,
                section as SteelSection,
                material as SteelMaterial,
                memberProps as MemberProperties
            );

        // Find current section index
        let currentIndex = database.sections.findIndex(s => s.id === currentSectionId);
        if (currentIndex === -1) {
            currentIndex = 0;  // Default to smallest
        }

        const originalSection = database.sections[currentIndex]!;
        const originalResult = checkFn(originalSection.section as any);
        const originalRatio = originalResult.utilizationRatio;
        const originalWeight = originalSection.weight;

        // Check if already optimal
        if (originalRatio >= this.OPTIMAL_MIN && originalRatio <= this.OPTIMAL_MAX) {
            return {
                memberId,
                originalSectionId: currentSectionId,
                recommendedSectionId: currentSectionId,
                originalRatio,
                finalRatio: originalRatio,
                originalWeight,
                finalWeight: originalWeight,
                weightSavings: 0,
                weightSavingsAbsolute: 0,
                iterations: 0,
                status: 'unchanged',
                message: `Section already optimal (${(originalRatio * 100).toFixed(1)}%)`
            };
        }

        let currentIdx = currentIndex;
        let iterations = 0;
        let lastResult = originalResult;
        let lastSection = originalSection;

        // Optimization loop
        while (iterations < this.MAX_ITERATIONS) {
            const ratio = lastResult.utilizationRatio;

            if (ratio > this.TARGET_MAX) {
                // Section too weak - go heavier
                if (currentIdx >= database.sections.length - 1) {
                    // Already at heaviest section
                    return {
                        memberId,
                        originalSectionId: currentSectionId,
                        recommendedSectionId: lastSection.id,
                        originalRatio,
                        finalRatio: ratio,
                        originalWeight,
                        finalWeight: lastSection.weight,
                        weightSavings: -((lastSection.weight - originalWeight) / originalWeight) * 100,
                        weightSavingsAbsolute: originalWeight - lastSection.weight,
                        iterations,
                        status: 'at_limit',
                        message: `Heaviest section still fails (${(ratio * 100).toFixed(1)}%)`
                    };
                }
                currentIdx++;
            } else if (ratio < this.TARGET_MIN) {
                // Section too strong - go lighter
                if (currentIdx <= 0) {
                    // Already at lightest section
                    return {
                        memberId,
                        originalSectionId: currentSectionId,
                        recommendedSectionId: lastSection.id,
                        originalRatio,
                        finalRatio: ratio,
                        originalWeight,
                        finalWeight: lastSection.weight,
                        weightSavings: ((originalWeight - lastSection.weight) / originalWeight) * 100,
                        weightSavingsAbsolute: originalWeight - lastSection.weight,
                        iterations,
                        status: 'at_limit',
                        message: `Lightest section still over-designed (${(ratio * 100).toFixed(1)}%)`
                    };
                }
                currentIdx--;
            } else {
                // In acceptable range (0.8 - 1.0)
                break;
            }

            // Try new section
            lastSection = database.sections[currentIdx]!;
            lastResult = checkFn(lastSection.section as any);
            iterations++;
        }

        const finalRatio = lastResult.utilizationRatio;
        const finalWeight = lastSection.weight;
        const weightSavingsAbs = originalWeight - finalWeight;
        const weightSavingsPct = (weightSavingsAbs / originalWeight) * 100;

        // Determine status
        let status: OptimizationResult['status'];
        let message: string;

        if (finalRatio > this.TARGET_MAX) {
            status = 'failed';
            message = `Could not find adequate section`;
        } else if (lastSection.id === currentSectionId) {
            status = 'unchanged';
            message = `Original section is optimal`;
        } else {
            status = 'optimized';
            message = weightSavingsAbs > 0
                ? `Reduced weight by ${weightSavingsPct.toFixed(1)}%`
                : `Increased weight by ${(-weightSavingsPct).toFixed(1)}% for safety`;
        }

        return {
            memberId,
            originalSectionId: currentSectionId,
            recommendedSectionId: lastSection.id,
            originalRatio,
            finalRatio,
            originalWeight,
            finalWeight,
            weightSavings: weightSavingsPct,
            weightSavingsAbsolute: weightSavingsAbs,
            iterations,
            status,
            message
        };
    }

    /**
     * Optimize multiple members
     */
    static optimizeAll(inputs: OptimizationInput[]): OptimizationResult[] {
        return inputs.map(input => this.optimize(input));
    }

    /**
     * Get optimization summary
     */
    static getSummary(results: OptimizationResult[]): string {
        const totalOriginalWeight = results.reduce((sum, r) => sum + r.originalWeight, 0);
        const totalFinalWeight = results.reduce((sum, r) => sum + r.finalWeight, 0);
        const totalSavings = totalOriginalWeight - totalFinalWeight;
        const savingsPct = (totalSavings / totalOriginalWeight) * 100;

        const optimized = results.filter(r => r.status === 'optimized').length;
        const failed = results.filter(r => r.status === 'failed').length;
        const unchanged = results.filter(r => r.status === 'unchanged').length;

        return [
            `=== Section Optimization Summary ===`,
            `Members analyzed: ${results.length}`,
            `Optimized: ${optimized}`,
            `Unchanged: ${unchanged}`,
            `Failed: ${failed}`,
            ``,
            `Original total weight: ${totalOriginalWeight.toFixed(1)} kg/m`,
            `Optimized total weight: ${totalFinalWeight.toFixed(1)} kg/m`,
            `Weight savings: ${totalSavings.toFixed(1)} kg/m (${savingsPct.toFixed(1)}%)`
        ].join('\n');
    }

    /**
     * Find optimal section directly (without knowing current section)
     */
    static findOptimalSection(
        forces: IS_MemberForces | MemberForces,
        material: IS_SteelMaterial | SteelMaterial,
        memberProps: IS_MemberProperties | MemberProperties,
        code: DesignCode
    ): { sectionId: string; ratio: number; weight: number } | null {
        const database = code === 'IS800' ? this.ISMB_DATABASE : this.W_DATABASE;

        const checkFn = code === 'IS800'
            ? (section: IS_SteelSection) => IS800_SteelDesignEngine.checkMember(
                forces as IS_MemberForces,
                section,
                material as IS_SteelMaterial,
                memberProps as IS_MemberProperties
            )
            : (section: SteelSection) => SteelDesignEngine.checkMember(
                forces as MemberForces,
                section as SteelSection,
                material as SteelMaterial,
                memberProps as MemberProperties
            );

        // Find lightest section that passes
        for (const entry of database.sections) {
            const result = checkFn(entry.section as any);
            if (result.utilizationRatio <= this.TARGET_MAX && result.utilizationRatio >= this.TARGET_MIN) {
                return {
                    sectionId: entry.id,
                    ratio: result.utilizationRatio,
                    weight: entry.weight
                };
            }
        }

        // If no optimal found, find first that passes
        for (const entry of database.sections) {
            const result = checkFn(entry.section as any);
            if (result.passed) {
                return {
                    sectionId: entry.id,
                    ratio: result.utilizationRatio,
                    weight: entry.weight
                };
            }
        }

        return null;  // No adequate section found
    }
}

export default Optimizer;
