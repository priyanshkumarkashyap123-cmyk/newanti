/**
 * CarbonCalculator - Embodied Carbon Analysis
 * 
 * Calculates total embodied carbon (kgCO2e) for structural elements
 * based on material type, volume, and carbon emission factors.
 */

import carbonFactorsData from './CarbonFactors.json';

// ============================================
// TYPES
// ============================================

export interface CarbonFactors {
    version: string;
    materials: Record<string, MaterialData>;
    benchmarks: Record<string, Record<string, BenchmarkLevel>>;
}

export interface MaterialData {
    name: string;
    carbonFactor?: number;
    unit: string;
    density: number;
    densityUnit: string;
    variants?: Record<string, { carbonFactor: number; unit?: string }>;
}

export interface BenchmarkLevel {
    max: number;
    unit: string;
    description?: string;
}

export type MaterialType = 'steel' | 'concrete' | 'rebar' | 'timber' | 'aluminum' | 'masonry';
export type SustainabilityRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type BuildingType = 'office' | 'residential' | 'industrial';

export interface StructuralMember {
    id: string;
    materialType: MaterialType;
    materialVariant?: string;
    length: number;          // meters
    crossSectionArea: number; // m²
    volume?: number;         // m³ (override)
    weight?: number;         // kg (override for rebar)
}

export interface ConcreteElement {
    id: string;
    concreteGrade: string;   // e.g., "C30"
    volume: number;          // m³
    rebarWeight?: number;    // kg of reinforcement
}

export interface CarbonResult {
    memberId: string;
    materialType: MaterialType;
    materialName: string;
    volume: number;          // m³
    weight: number;          // kg
    carbonFactor: number;    // kgCO2e/kg or /m³
    embodiedCarbon: number;  // kgCO2e
    percentageOfTotal: number;
}

export interface CarbonSummary {
    totalCO2e: number;              // kgCO2e
    totalCO2eTonnes: number;        // tCO2e
    memberResults: CarbonResult[];
    byMaterial: Record<string, {
        totalCO2e: number;
        totalWeight: number;
        percentage: number;
    }>;
    sustainabilityRating: SustainabilityRating;
    buildingIntensity?: number;     // kgCO2e/m² (if floor area provided)
    recommendations: string[];
}

// ============================================
// CARBON CALCULATOR CLASS
// ============================================

export class CarbonCalculator {
    private factors: CarbonFactors;

    constructor() {
        this.factors = carbonFactorsData as unknown as CarbonFactors;
    }

    /**
     * Calculate embodied carbon for all structural members
     */
    calculateTotal(
        members: StructuralMember[],
        concreteElements?: ConcreteElement[],
        floorArea?: number,
        buildingType: BuildingType = 'office'
    ): CarbonSummary {
        const memberResults: CarbonResult[] = [];
        let totalCO2e = 0;

        // Process steel/timber/aluminum members
        for (const member of members) {
            const result = this.calculateMemberCarbon(member);
            memberResults.push(result);
            totalCO2e += result.embodiedCarbon;
        }

        // Process concrete elements
        if (concreteElements) {
            for (const element of concreteElements) {
                const result = this.calculateConcreteCarbon(element);
                memberResults.push(result);
                totalCO2e += result.embodiedCarbon;
            }
        }

        // Calculate percentages
        for (const result of memberResults) {
            result.percentageOfTotal = totalCO2e > 0
                ? (result.embodiedCarbon / totalCO2e) * 100
                : 0;
        }

        // Aggregate by material
        const byMaterial = this.aggregateByMaterial(memberResults, totalCO2e);

        // Calculate building intensity and rating
        const buildingIntensity = floorArea ? totalCO2e / floorArea : undefined;
        const sustainabilityRating = this.calculateRating(buildingIntensity, buildingType);

        // Generate recommendations
        const recommendations = this.generateRecommendations(byMaterial, sustainabilityRating);

        return {
            totalCO2e,
            totalCO2eTonnes: totalCO2e / 1000,
            memberResults,
            byMaterial,
            sustainabilityRating,
            buildingIntensity,
            recommendations
        };
    }

    /**
     * Calculate carbon for a single structural member
     */
    calculateMemberCarbon(member: StructuralMember): CarbonResult {
        const material = this.factors.materials[member.materialType];

        if (!material) {
            throw new Error(`Unknown material type: ${member.materialType}`);
        }

        // Calculate volume
        const volume = member.volume ?? (member.length * member.crossSectionArea);

        // Get density and weight
        const density = material.density;
        const weight = member.weight ?? (volume * density);

        // Get carbon factor (check for variant)
        let carbonFactor: number;
        if (member.materialVariant && material.variants?.[member.materialVariant]) {
            carbonFactor = material.variants[member.materialVariant].carbonFactor;
        } else {
            carbonFactor = material.carbonFactor ?? 0;
        }

        // Calculate embodied carbon
        // For concrete, factor is per m³; for others, per kg
        const embodiedCarbon = member.materialType === 'concrete'
            ? volume * carbonFactor
            : weight * carbonFactor;

        return {
            memberId: member.id,
            materialType: member.materialType,
            materialName: material.name,
            volume,
            weight,
            carbonFactor,
            embodiedCarbon,
            percentageOfTotal: 0 // Will be calculated later
        };
    }

    /**
     * Calculate carbon for concrete elements (with optional rebar)
     */
    calculateConcreteCarbon(element: ConcreteElement): CarbonResult {
        const concreteMaterial = this.factors.materials['concrete'];
        const rebarMaterial = this.factors.materials['rebar'];

        // Get concrete carbon factor for grade
        const gradeKey = element.concreteGrade;
        const concreteVariant = concreteMaterial.variants?.[gradeKey];
        const concreteFactor = concreteVariant?.carbonFactor ?? 240; // Default C30

        // Calculate concrete carbon
        const concreteCO2e = element.volume * concreteFactor;

        // Calculate rebar carbon if provided
        let rebarCO2e = 0;
        if (element.rebarWeight && rebarMaterial) {
            rebarCO2e = element.rebarWeight * (rebarMaterial.carbonFactor ?? 1.99);
        }

        const totalCO2e = concreteCO2e + rebarCO2e;
        const weight = (element.volume * (concreteMaterial.density || 2400)) + (element.rebarWeight || 0);

        return {
            memberId: element.id,
            materialType: 'concrete',
            materialName: `Concrete ${element.concreteGrade}${element.rebarWeight ? ' + Rebar' : ''}`,
            volume: element.volume,
            weight,
            carbonFactor: concreteFactor,
            embodiedCarbon: totalCO2e,
            percentageOfTotal: 0
        };
    }

    /**
     * Aggregate results by material type
     */
    private aggregateByMaterial(
        results: CarbonResult[],
        totalCO2e: number
    ): Record<string, { totalCO2e: number; totalWeight: number; percentage: number }> {
        const byMaterial: Record<string, { totalCO2e: number; totalWeight: number; percentage: number }> = {};

        for (const result of results) {
            const key = result.materialType;
            if (!byMaterial[key]) {
                byMaterial[key] = { totalCO2e: 0, totalWeight: 0, percentage: 0 };
            }
            byMaterial[key].totalCO2e += result.embodiedCarbon;
            byMaterial[key].totalWeight += result.weight;
        }

        // Calculate percentages
        for (const key of Object.keys(byMaterial)) {
            byMaterial[key].percentage = totalCO2e > 0
                ? (byMaterial[key].totalCO2e / totalCO2e) * 100
                : 0;
        }

        return byMaterial;
    }

    /**
     * Calculate sustainability rating (A-F)
     */
    calculateRating(
        buildingIntensity: number | undefined,
        buildingType: BuildingType
    ): SustainabilityRating {
        if (!buildingIntensity) return 'C'; // Default if no floor area

        const benchmarks = this.factors.benchmarks[buildingType];
        if (!benchmarks) return 'C';

        const ratings: SustainabilityRating[] = ['A', 'B', 'C', 'D', 'E', 'F'];
        for (const rating of ratings) {
            if (buildingIntensity <= benchmarks[rating].max) {
                return rating;
            }
        }
        return 'F';
    }

    /**
     * Get color for carbon intensity (for heatmap)
     * Returns grayscale: white (low) to black (high)
     */
    getIntensityColor(carbonValue: number, maxCarbon: number): string {
        const normalized = Math.min(carbonValue / maxCarbon, 1);
        // Gradient from light gray (#E5E5E5) to dark gray/black (#1A1A1A)
        const grayValue = Math.round(229 - (normalized * 200));
        return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    }

    /**
     * Get color for sustainability rating
     */
    getRatingColor(rating: SustainabilityRating): string {
        const colors: Record<SustainabilityRating, string> = {
            'A': '#22C55E', // Green
            'B': '#84CC16', // Lime
            'C': '#EAB308', // Yellow
            'D': '#F97316', // Orange
            'E': '#EF4444', // Red
            'F': '#991B1B', // Dark Red
        };
        return colors[rating];
    }

    /**
     * Generate sustainability recommendations
     */
    private generateRecommendations(
        byMaterial: Record<string, { totalCO2e: number; percentage: number }>,
        rating: SustainabilityRating
    ): string[] {
        const recommendations: string[] = [];

        // Check steel usage
        if (byMaterial['steel']?.percentage > 50) {
            recommendations.push(
                '🔧 Consider using recycled steel (up to 65% carbon reduction)',
                '🔧 Optimize steel sections to reduce weight'
            );
        }

        // Check concrete usage
        if (byMaterial['concrete']?.percentage > 40) {
            recommendations.push(
                '🏗️ Specify low-carbon concrete mixes (GGBS or PFA replacement)',
                '🏗️ Consider reducing concrete volume through optimized design'
            );
        }

        // Rating-based recommendations
        if (rating === 'D' || rating === 'E' || rating === 'F') {
            recommendations.push(
                '⚠️ Consider alternative structural systems (timber, hybrid)',
                '⚠️ Review member sizes for over-design'
            );
        }

        if (rating === 'A' || rating === 'B') {
            recommendations.push(
                '✅ Low carbon design achieved!',
                '✅ Consider documenting for sustainability certification'
            );
        }

        return recommendations;
    }

    /**
     * Get carbon factor for a material
     */
    getCarbonFactor(materialType: MaterialType, variant?: string): number {
        const material = this.factors.materials[materialType];
        if (!material) return 0;

        if (variant && material.variants?.[variant]) {
            return material.variants[variant].carbonFactor;
        }
        return material.carbonFactor ?? 0;
    }

    /**
     * Get all available materials
     */
    getAvailableMaterials(): { type: MaterialType; name: string; variants: string[] }[] {
        return Object.entries(this.factors.materials).map(([type, data]) => ({
            type: type as MaterialType,
            name: data.name,
            variants: data.variants ? Object.keys(data.variants) : []
        }));
    }
}

// Export singleton instance
export const carbonCalculator = new CarbonCalculator();

export default CarbonCalculator;
