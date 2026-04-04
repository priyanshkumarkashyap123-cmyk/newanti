/**
 * PredictiveDesignService.ts - AI-Powered Design Predictions
 * 
 * Uses machine learning patterns to predict:
 * - Optimal section sizes before analysis
 * - Likely failure modes
 * - Cost-effective alternatives
 * - Design convergence likelihood
 */

import { adaptiveLearning } from './AdaptiveLearningService';

// ============================================
// TYPES
// ============================================

export interface DesignPrediction {
    prediction: string;
    confidence: number;
    reasoning: string;
    alternatives?: string[];
}

export interface SectionPrediction {
    recommended: string;
    confidence: number;
    utilization: number;
    alternatives: { section: string; utilization: number; cost: number }[];
}

export interface FailureModePrediction {
    mode: 'buckling' | 'yielding' | 'deflection' | 'fatigue' | 'connection' | 'stability';
    probability: number;
    location: string;
    preventiveMeasure: string;
}

export interface CostPrediction {
    materialCost: number;
    fabricationCost: number;
    totalCost: number;
    costPerMeter: number;
    potentialSavings: number;
    optimizationSuggestions: string[];
}

export interface StructureCharacteristics {
    type: 'beam' | 'column' | 'frame' | 'truss' | 'slab' | 'foundation';
    span?: number;
    height?: number;
    loadType: 'gravity' | 'lateral' | 'combined';
    loadMagnitude: number;
    material: 'steel' | 'concrete' | 'composite';
}

// ============================================
// PREDICTION MODELS (Rule-based + Learning)
// ============================================

const SECTION_RULES = {
    beam: {
        steel: {
            spans: [
                { max: 6, sections: ['ISMB 200', 'ISMB 225', 'ISMB 250'] },
                { max: 9, sections: ['ISMB 300', 'ISMB 350', 'ISMB 400'] },
                { max: 12, sections: ['ISMB 450', 'ISMB 500', 'ISMB 550'] },
                { max: 15, sections: ['ISMB 600', 'ISWB 500', 'ISWB 550'] },
                { max: 20, sections: ['ISWB 600', 'ISHB 350', 'ISHB 400'] },
            ]
        },
        concrete: {
            spans: [
                { max: 4, sections: ['230x350', '230x400', '250x400'] },
                { max: 6, sections: ['250x450', '300x450', '300x500'] },
                { max: 8, sections: ['300x550', '350x550', '350x600'] },
                { max: 10, sections: ['350x650', '400x650', '400x700'] },
            ]
        },
        composite: {
            spans: [
                { max: 8, sections: ['IPE 300 + 120mm slab', 'IPE 330 + 120mm slab'] },
                { max: 12, sections: ['IPE 400 + 150mm slab', 'HEA 300 + 150mm slab'] },
                { max: 16, sections: ['HEA 400 + 180mm slab', 'HEB 400 + 180mm slab'] },
            ]
        }
    },
    column: {
        steel: {
            heights: [
                { max: 4, sections: ['ISHB 150', 'ISHB 200', 'ISHB 225'] },
                { max: 6, sections: ['ISHB 250', 'ISHB 300', 'ISHB 350'] },
                { max: 8, sections: ['ISHB 350', 'ISHB 400', 'ISHB 450'] },
            ]
        }
    }
};

const COST_FACTORS = {
    steel: { material: 80, fabrication: 40 },  // ₹/kg
    concrete: { material: 6000, fabrication: 2000 },  // ₹/m³
};

// ============================================
// PREDICTIVE DESIGN SERVICE
// ============================================

class PredictiveDesignServiceClass {
    /**
     * Predict optimal section for given loading
     */
    predictSection(characteristics: StructureCharacteristics): SectionPrediction {
        const { type, span, height, material, loadMagnitude } = characteristics;

        // Get rule-based prediction
        let sections: string[] = [];

        if (type === 'beam' && span) {
            const beamRules = SECTION_RULES.beam as Record<string, { spans: { max: number; sections: string[] }[] }>;
            const rules = beamRules[material]?.spans || [];
            for (const rule of rules) {
                if (span <= rule.max) {
                    sections = rule.sections;
                    break;
                }
            }
        } else if (type === 'column' && height && material === 'steel') {
            const rules = SECTION_RULES.column.steel.heights;
            for (const rule of rules) {
                if (height <= rule.max) {
                    sections = rule.sections;
                    break;
                }
            }
        }

        // Get user preference from learning
        const userPreferred = adaptiveLearning.getSuggestedSections(type);

        // Combine rule-based and learned preferences
        let recommended = sections[0] || 'ISMB 300';
        if (userPreferred.length > 0 && sections.includes(userPreferred[0])) {
            recommended = userPreferred[0];
        }

        // Estimate utilization
        const baseUtilization = 0.6 + (loadMagnitude / 100) * 0.3;
        const utilization = Math.min(0.95, baseUtilization);

        // Generate alternatives
        const alternatives = sections.slice(0, 3).map((section, idx) => ({
            section,
            utilization: utilization + (idx - 1) * 0.1,
            cost: this.estimateSectionCost(section, material, span || 1)
        }));

        return {
            recommended,
            confidence: sections.length > 0 ? 0.85 : 0.5,
            utilization,
            alternatives
        };
    }

    /**
     * Predict likely failure modes
     */
    predictFailureModes(characteristics: StructureCharacteristics): FailureModePrediction[] {
        const predictions: FailureModePrediction[] = [];
        const { type, span, height, loadType, material } = characteristics;

        // Beam failure modes
        if (type === 'beam') {
            if (span && span > 8) {
                predictions.push({
                    mode: 'deflection',
                    probability: 0.7,
                    location: 'Midspan',
                    preventiveMeasure: 'Consider deeper section or add camber'
                });
            }
            if (material === 'steel' && span && span > 6) {
                predictions.push({
                    mode: 'buckling',
                    probability: 0.4,
                    location: 'Compression flange',
                    preventiveMeasure: 'Provide lateral bracing at L/4 intervals'
                });
            }
        }

        // Column failure modes
        if (type === 'column') {
            if (height && height > 5) {
                predictions.push({
                    mode: 'buckling',
                    probability: 0.6,
                    location: 'Weak axis',
                    preventiveMeasure: 'Check slenderness ratio, consider bracing'
                });
            }
            if (loadType === 'combined') {
                predictions.push({
                    mode: 'stability',
                    probability: 0.5,
                    location: 'Base',
                    preventiveMeasure: 'Verify P-Delta effects, stiffen base connection'
                });
            }
        }

        // Connection failure (common for all)
        predictions.push({
            mode: 'connection',
            probability: 0.3,
            location: 'End connections',
            preventiveMeasure: 'Design connections for 1.2x member capacity'
        });

        return predictions.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Predict project cost
     */
    predictCost(
        characteristics: StructureCharacteristics,
        sectionSize: string,
        length: number
    ): CostPrediction {
        const { material } = characteristics;

        let weight = 0;
        let materialCost = 0;
        let fabricationCost = 0;

        if (material === 'steel') {
            // Estimate steel weight from section name
            const sizeMatch = sectionSize.match(/\d+/);
            const depth = sizeMatch ? parseInt(sizeMatch[0]) : 300;
            weight = depth * 0.5 * length; // Rough kg/m estimate

            materialCost = weight * COST_FACTORS.steel.material;
            fabricationCost = weight * COST_FACTORS.steel.fabrication;
        } else {
            // Concrete volume estimate
            const sizeMatch = sectionSize.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
                const b = parseInt(sizeMatch[1]) / 1000;
                const d = parseInt(sizeMatch[2]) / 1000;
                const volume = b * d * length;
                materialCost = volume * COST_FACTORS.concrete.material;
                fabricationCost = volume * COST_FACTORS.concrete.fabrication;
            }
        }

        const totalCost = materialCost + fabricationCost;
        const costPerMeter = length > 0 ? totalCost / length : 0;

        // Potential savings analysis
        const potentialSavings = totalCost * 0.1; // Assume 10% optimization possible

        return {
            materialCost,
            fabricationCost,
            totalCost,
            costPerMeter,
            potentialSavings,
            optimizationSuggestions: [
                'Consider composite action to reduce steel',
                'Optimize connection details for fabrication',
                'Use standard section sizes for availability'
            ]
        };
    }

    /**
     * Predict design convergence
     */
    predictConvergence(
        currentUtilization: number,
        targetUtilization: number = 0.9
    ): DesignPrediction {
        const gap = targetUtilization - currentUtilization;

        if (gap < 0) {
            return {
                prediction: 'OVERSTRESSED',
                confidence: 0.95,
                reasoning: `Member is ${(-gap * 100).toFixed(0)}% over capacity`,
                alternatives: ['Increase section size', 'Add bracing', 'Reduce loading']
            };
        } else if (gap < 0.1) {
            return {
                prediction: 'OPTIMAL',
                confidence: 0.9,
                reasoning: `Utilization within 10% of target - efficient design`,
                alternatives: []
            };
        } else if (gap < 0.3) {
            return {
                prediction: 'UNDER-UTILIZED',
                confidence: 0.85,
                reasoning: `Section has ${(gap * 100).toFixed(0)}% spare capacity`,
                alternatives: ['Consider smaller section', 'Increase bay width']
            };
        } else {
            return {
                prediction: 'OVER-DESIGNED',
                confidence: 0.8,
                reasoning: `Significant excess capacity - ${(gap * 100).toFixed(0)}% unused`,
                alternatives: ['Reduce section by 1-2 sizes', 'Reconsider design assumptions']
            };
        }
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private estimateSectionCost(section: string, material: string, length: number): number {
        if (material === 'steel') {
            const sizeMatch = section.match(/\d+/);
            const depth = sizeMatch ? parseInt(sizeMatch[0]) : 300;
            const weight = depth * 0.5 * length;
            return weight * (COST_FACTORS.steel.material + COST_FACTORS.steel.fabrication);
        }
        return 10000 * length; // Default
    }
}

// ============================================
// SINGLETON
// ============================================

export const predictiveDesign = new PredictiveDesignServiceClass();
export default PredictiveDesignServiceClass;
