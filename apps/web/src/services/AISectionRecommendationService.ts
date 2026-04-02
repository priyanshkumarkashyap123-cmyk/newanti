/**
 * AISectionRecommendationService.ts - AI-Powered Section Recommendation Service
 *
 * Provides intelligent section recommendations using ML and optimization algorithms
 */

import { postJson } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';

export interface AISectionRecommendationRequest {
    axial_force: number; // kN
    shear_force: number; // kN
    bending_moment: number; // kN·m
    deflection_limit?: number; // mm
    span_length?: number; // m
    code: 'IS800' | 'AISC360' | 'EC3';
    material: 'steel' | 'concrete';
    utilization_target: number; // Target utilization ratio (0.8 = 80%)
    max_results: number;
}

export interface AISectionOptimizationRequest {
    axial_force: number;
    shear_force: number;
    bending_moment: number;
    deflection_limit?: number;
    span_length?: number;
    code: 'IS800' | 'AISC360' | 'EC3';
    material: 'steel' | 'concrete';
    utilization_target: number;
    optimization_goal: 'cost' | 'weight' | 'safety' | 'balanced';
    constraints?: {
        max_cost_per_m?: number;
        max_weight_per_m?: number;
        min_section_modulus?: number;
        max_deflection?: number;
    };
}

export interface SectionRecommendation {
    section_name: string;
    section_type: string;
    material: string;
    properties: {
        area: number; // mm²
        Ix: number; // mm⁴
        Iy: number; // mm⁴
        Zx: number; // mm³
        Zy: number; // mm³
        rx: number; // mm
        ry: number; // mm
        weight_per_m: number; // kg/m
    };
    design_checks: {
        axial_capacity: number; // kN
        shear_capacity: number; // kN
        moment_capacity: number; // kN·m
        deflection_check?: number; // mm
        utilization_axial: number;
        utilization_shear: number;
        utilization_moment: number;
        overall_utilization: number;
    };
    score: number; // Recommendation score (0-100)
    reasoning: string[];
}

export interface OptimizationResult {
    optimal_section: SectionRecommendation;
    optimization_metrics: {
        goal_achieved: number;
        constraints_satisfied: boolean;
        alternatives_considered: number;
    };
    cost_breakdown?: {
        material_cost: number;
        fabrication_cost: number;
        total_cost_per_m: number;
    };
}

class AISectionRecommendationService {
    // Route through Node gateway for auth/quotas; Node forwards to Python AI service
    private readonly API_URL = `${API_CONFIG.baseUrl}/api/ai`;

    /**
     * Get AI-powered section recommendations
     */
    async getRecommendations(request: AISectionRecommendationRequest): Promise<{
        success: boolean;
        recommendations: SectionRecommendation[];
        count: number;
        error?: string;
    }> {
        try {
            const response = await postJson<{
                success: boolean;
                recommendations: SectionRecommendation[];
                count: number;
            }>(`${this.API_URL}/section-recommend`, request, {
                timeout: 30000 // 30 seconds for AI processing
            });

            return response;
        } catch (error) {
            console.error('AI Section Recommendation Error:', error);
            return {
                success: false,
                recommendations: [],
                count: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Optimize section selection using advanced algorithms
     */
    async optimizeSection(request: AISectionOptimizationRequest): Promise<{
        success: boolean;
        optimization: OptimizationResult | null;
        error?: string;
    }> {
        try {
            const response = await postJson<{
                success: boolean;
                optimization: OptimizationResult;
            }>(`${this.API_URL}/section-optimize`, request, {
                timeout: 45000 // 45 seconds for optimization
            });

            return response;
        } catch (error) {
            console.error('AI Section Optimization Error:', error);
            return {
                success: false,
                optimization: null,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get section database statistics
     */
    async getSectionStats(): Promise<{
        total_sections: number;
        codes_supported: string[];
        materials_supported: string[];
        last_updated: string;
    }> {
        // This would be a future endpoint to get database stats
        return {
            total_sections: 150, // Placeholder
            codes_supported: ['IS800', 'AISC360', 'EC3'],
            materials_supported: ['steel', 'concrete'],
            last_updated: new Date().toISOString()
        };
    }
}

export const aiSectionRecommendationService = new AISectionRecommendationService();
export default aiSectionRecommendationService;