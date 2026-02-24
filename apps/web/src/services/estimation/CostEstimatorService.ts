/**
 * CostEstimatorService.ts
 * 
 * AI-Powered Structural Cost Estimation
 * 
 * Features:
 * - Material quantity takeoff
 * - Regional cost database
 * - Labor cost estimation
 * - Connection cost factors
 * - Bid-ready estimates
 */

// ============================================
// TYPES
// ============================================

export type Region = 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west' | 'india' | 'uk' | 'eu';
export type Currency = 'USD' | 'INR' | 'GBP' | 'EUR';

export interface MaterialQuantity {
    material: 'steel' | 'concrete' | 'rebar' | 'bolts' | 'welds' | 'studs' | 'deck';
    grade: string;
    quantity: number;
    unit: 'tons' | 'cy' | 'lbs' | 'each' | 'lf' | 'sf';
}

export interface CostBreakdown {
    category: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    currency: Currency;
}

export interface LaborEstimate {
    activity: string;
    hours: number;
    rate: number;
    cost: number;
}

export interface ProjectEstimate {
    projectId: string;
    projectName: string;
    region: Region;
    currency: Currency;
    generatedAt: Date;

    materials: CostBreakdown[];
    labor: LaborEstimate[];
    equipment: CostBreakdown[];

    subtotals: {
        materials: number;
        labor: number;
        equipment: number;
    };

    overhead: number;
    profit: number;
    contingency: number;

    totalCost: number;
    costPerSqFt?: number;

    confidence: 'low' | 'medium' | 'high';
}

// ============================================
// COST DATABASES (2024 rates)
// ============================================

const STEEL_COSTS: Record<Region, Record<string, number>> = {
    'northeast': { 'A992': 1.45, 'A572-50': 1.40, 'A36': 1.35 }, // $/lb
    'southeast': { 'A992': 1.35, 'A572-50': 1.30, 'A36': 1.25 },
    'midwest': { 'A992': 1.30, 'A572-50': 1.25, 'A36': 1.20 },
    'southwest': { 'A992': 1.40, 'A572-50': 1.35, 'A36': 1.30 },
    'west': { 'A992': 1.50, 'A572-50': 1.45, 'A36': 1.40 },
    'india': { 'Fe410': 0.55, 'Fe490': 0.60, 'Fe540': 0.65 },
    'uk': { 'S355': 1.80, 'S275': 1.70 },
    'eu': { 'S355': 1.75, 'S275': 1.65 }
};

const CONCRETE_COSTS: Record<Region, Record<number, number>> = {
    'northeast': { 3000: 145, 4000: 155, 5000: 170 }, // $/cy
    'southeast': { 3000: 130, 4000: 140, 5000: 155 },
    'midwest': { 3000: 125, 4000: 135, 5000: 150 },
    'southwest': { 3000: 140, 4000: 150, 5000: 165 },
    'west': { 3000: 160, 4000: 170, 5000: 185 },
    'india': { 25: 75, 30: 85, 35: 95 }, // M25, M30, M35 ($/cy equivalent)
    'uk': { 3000: 180, 4000: 195, 5000: 210 },
    'eu': { 3000: 175, 4000: 190, 5000: 205 }
};

const LABOR_RATES: Record<Region, Record<string, number>> = {
    'northeast': { ironworker: 85, carpenter: 75, laborer: 55 }, // $/hr
    'southeast': { ironworker: 70, carpenter: 60, laborer: 45 },
    'midwest': { ironworker: 75, carpenter: 65, laborer: 48 },
    'southwest': { ironworker: 72, carpenter: 62, laborer: 46 },
    'west': { ironworker: 95, carpenter: 85, laborer: 60 },
    'india': { ironworker: 8, carpenter: 7, laborer: 5 },
    'uk': { ironworker: 55, carpenter: 48, laborer: 35 },
    'eu': { ironworker: 52, carpenter: 45, laborer: 32 }
};

const CURRENCIES: Record<Region, Currency> = {
    'northeast': 'USD', 'southeast': 'USD', 'midwest': 'USD',
    'southwest': 'USD', 'west': 'USD',
    'india': 'INR', 'uk': 'GBP', 'eu': 'EUR'
};

// ============================================
// COST ESTIMATOR SERVICE
// ============================================

class CostEstimatorServiceClass {
    /**
     * Generate full project estimate
     */
    estimateProject(
        projectName: string,
        quantities: MaterialQuantity[],
        region: Region,
        floorArea?: number,
        options?: {
            overheadPercent?: number;
            profitPercent?: number;
            contingencyPercent?: number;
        }
    ): ProjectEstimate {
        const currency = CURRENCIES[region];
        const materials: CostBreakdown[] = [];
        const labor: LaborEstimate[] = [];
        const equipment: CostBreakdown[] = [];

        // Material costs
        for (const qty of quantities) {
            const cost = this.getMaterialCost(qty, region);
            materials.push({
                category: qty.material,
                description: `${qty.grade} ${qty.material}`,
                quantity: qty.quantity,
                unit: qty.unit,
                unitCost: cost.unitCost,
                totalCost: cost.total,
                currency
            });

            // Estimate labor based on material
            const laborHours = this.estimateLabor(qty);
            const rate = LABOR_RATES[region].ironworker;
            labor.push({
                activity: `Install ${qty.material}`,
                hours: laborHours,
                rate,
                cost: laborHours * rate
            });
        }

        // Equipment costs (typically 10-15% of labor)
        const laborSubtotal = labor.reduce((sum, l) => sum + l.cost, 0);
        equipment.push({
            category: 'Equipment',
            description: 'Cranes, lifts, tools',
            quantity: 1,
            unit: 'ls',
            unitCost: laborSubtotal * 0.12,
            totalCost: laborSubtotal * 0.12,
            currency
        });

        const subtotals = {
            materials: materials.reduce((sum, m) => sum + m.totalCost, 0),
            labor: laborSubtotal,
            equipment: equipment.reduce((sum, e) => sum + e.totalCost, 0)
        };

        const directCost = subtotals.materials + subtotals.labor + subtotals.equipment;

        const overheadPercent = options?.overheadPercent ?? 12;
        const profitPercent = options?.profitPercent ?? 10;
        const contingencyPercent = options?.contingencyPercent ?? 5;

        const overhead = directCost * (overheadPercent / 100);
        const profit = (directCost + overhead) * (profitPercent / 100);
        const contingency = (directCost + overhead + profit) * (contingencyPercent / 100);

        const totalCost = directCost + overhead + profit + contingency;

        return {
            projectId: `est_${Date.now()}`,
            projectName,
            region,
            currency,
            generatedAt: new Date(),
            materials,
            labor,
            equipment,
            subtotals,
            overhead,
            profit,
            contingency,
            totalCost,
            costPerSqFt: floorArea ? totalCost / floorArea : undefined,
            confidence: this.assessConfidence(quantities)
        };
    }

    /**
     * Get material cost for a quantity
     */
    private getMaterialCost(
        qty: MaterialQuantity,
        region: Region
    ): { unitCost: number; total: number } {
        let unitCost = 0;

        switch (qty.material) {
            case 'steel':
                const steelCosts = STEEL_COSTS[region];
                unitCost = steelCosts[qty.grade] || Object.values(steelCosts)[0];
                // Convert tons to lbs if needed
                if (qty.unit === 'tons') {
                    return { unitCost: unitCost * 2000, total: qty.quantity * unitCost * 2000 };
                }
                break;

            case 'concrete':
                const concCosts = CONCRETE_COSTS[region];
                unitCost = concCosts[parseInt(qty.grade)] || Object.values(concCosts)[0];
                break;

            case 'rebar':
                unitCost = 1.10; // $/lb average
                break;

            case 'bolts':
                unitCost = 2.50; // $/each average
                break;

            case 'studs':
                unitCost = 1.75; // $/each
                break;

            case 'deck':
                unitCost = 3.50; // $/sf
                break;
        }

        return { unitCost, total: qty.quantity * unitCost };
    }

    /**
     * Estimate labor hours for a material quantity
     */
    private estimateLabor(qty: MaterialQuantity): number {
        // Hours per unit based on industry standards
        const rates: Record<string, number> = {
            'steel-tons': 8,      // 8 hrs per ton
            'concrete-cy': 0.5,   // 0.5 hrs per CY
            'rebar-lbs': 0.02,    // 2 hrs per 100 lbs
            'bolts-each': 0.25,   // 15 min per bolt
            'studs-each': 0.1,    // 6 min per stud
            'deck-sf': 0.01       // 1 hr per 100 sf
        };

        const key = `${qty.material}-${qty.unit}`;
        const rate = rates[key] || 0.5;

        return qty.quantity * rate;
    }

    /**
     * Assess confidence level based on data quality
     */
    private assessConfidence(quantities: MaterialQuantity[]): 'low' | 'medium' | 'high' {
        if (quantities.length < 3) return 'low';
        if (quantities.every(q => q.grade !== '')) return 'high';
        return 'medium';
    }

    /**
     * Quick cost estimate from structural model
     */
    estimateFromModel(
        steelTons: number,
        concreteCY: number,
        connectionCount: number,
        region: Region = 'midwest',
        floorArea?: number
    ): ProjectEstimate {
        const quantities: MaterialQuantity[] = [
            { material: 'steel', grade: 'A992', quantity: steelTons, unit: 'tons' },
            { material: 'concrete', grade: '4000', quantity: concreteCY, unit: 'cy' },
            { material: 'bolts', grade: 'A325', quantity: connectionCount * 8, unit: 'each' }
        ];

        return this.estimateProject('Quick Estimate', quantities, region, floorArea);
    }

    /**
     * Cost comparison between design alternatives
     */
    compareAlternatives(
        alternatives: Array<{
            name: string;
            steelTons: number;
            concreteCY: number;
            connectionCount: number;
        }>,
        region: Region
    ): Array<{ name: string; cost: number; savings: number; savingsPercent: number }> {
        const estimates = alternatives.map(alt => ({
            name: alt.name,
            cost: this.estimateFromModel(
                alt.steelTons, alt.concreteCY, alt.connectionCount, region
            ).totalCost
        }));

        const baseCost = estimates[0].cost;

        return estimates.map(est => ({
            name: est.name,
            cost: est.cost,
            savings: baseCost - est.cost,
            savingsPercent: ((baseCost - est.cost) / baseCost) * 100
        }));
    }

    /**
     * Format cost for display
     */
    formatCost(amount: number, currency: Currency): string {
        const symbols: Record<Currency, string> = {
            'USD': '$', 'INR': '₹', 'GBP': '£', 'EUR': '€'
        };

        return `${symbols[currency]}${amount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })}`;
    }
}

// ============================================
// SINGLETON
// ============================================

export const costEstimator = new CostEstimatorServiceClass();

export default CostEstimatorServiceClass;
