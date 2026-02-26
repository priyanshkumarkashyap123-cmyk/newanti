/**
 * SectionService.ts - API Service for Section Design & Calculation
 * 
 * Connecting to Python Backend implementation of Section Designer
 */

import { postJson, fetchJson } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';

export interface Point {
    x: number;
    y: number;
}

export interface CustomSectionRequest {
    points: Point[];
    name?: string;
    material_density?: number;
}

export interface StandardSectionRequest {
    shape_type: 'i_beam' | 'channel' | 'angle' | 'rectangular' | 'circular' | 'tee';
    dimensions: Record<string, number>;
    name?: string;
}

export interface SectionRecommendationRequest {
    member_type: 'beam' | 'column';
    required_Mx?: number;
    required_My?: number;
    required_P?: number; // Compression positive
    required_V?: number;
    length?: number; // mm
    section_type?: string;
    safety_factor?: number;
}

// API URL (default to Node proxy or direct Python)
const API_URL = API_CONFIG.baseUrl;

class SectionService {

    /**
     * Calculate properties for a custom polygon section
     */
    async calculateCustomSection(request: CustomSectionRequest) {
        return postJson<{ success: boolean; data: any }>(`${API_URL}/sections/custom/calculate`, request, {
            timeout: 20000 // 20 seconds for complex calculations
        });
    }

    /**
     * Create standard section with properties
     */
    async createStandardSection(request: StandardSectionRequest) {
        return postJson<{ success: boolean; data: any }>(`${API_URL}/sections/standard/create`, request, {
            timeout: 15000
        });
    }

    /**
     * Get section recommendations based on load
     */
    async getRecommendedSections(request: SectionRecommendationRequest) {
        return postJson<{ success: boolean; data: any }>(`${API_URL}/sections/recommend`, request, {
            timeout: 15000
        });
    }

    /**
     * Get list of available standard shapes and their required params
     */
    async getStandardShapesList() {
        try {
            const response = await fetch(`${API_URL}/sections/shapes/list`);
            if (!response.ok) throw new Error('Failed to list shapes');
            return await response.json();
        } catch (error) {
            console.error('Shape List Error:', error);
            // Fallback static list if API fails
            return {
                shapes: {
                    i_beam: { dimensions: ["depth", "width", "web_thickness", "flange_thickness"] },
                    channel: { dimensions: ["depth", "width", "web_thickness", "flange_thickness"] },
                    angle: { dimensions: ["leg1", "leg2", "thickness"] },
                    rectangular: { dimensions: ["width", "depth"] },
                    circular: { dimensions: ["diameter"] },
                    tee: { dimensions: ["width", "depth", "web_thickness", "flange_thickness"] }
                }
            };
        }
    }
}

export const sectionService = new SectionService();
export default sectionService;
