/**
 * ConstructionManagementService.ts
 * 
 * Construction Management & Project Planning Module
 * 
 * Features:
 * - CPM/PERT scheduling
 * - Resource leveling
 * - Cost estimation
 * - Earned value management
 * - Risk analysis
 */

// ============================================
// TYPES
// ============================================

export interface Activity {
    id: string;
    name: string;
    duration: number;         // days
    predecessors: string[];
    successors?: string[];
    resources?: ResourceRequirement[];
    cost?: number;
    optimistic?: number;      // PERT
    pessimistic?: number;     // PERT
    mostLikely?: number;      // PERT
}

export interface ResourceRequirement {
    resourceId: string;
    quantity: number;
    unit: 'person' | 'equipment' | 'material';
}

export interface ScheduleResult {
    activities: ActivitySchedule[];
    projectDuration: number;
    criticalPath: string[];
    totalFloat: Map<string, number>;
    freeFloat: Map<string, number>;
}

export interface ActivitySchedule {
    id: string;
    ES: number;               // Early Start
    EF: number;               // Early Finish
    LS: number;               // Late Start
    LF: number;               // Late Finish
    TF: number;               // Total Float
    FF: number;               // Free Float
    isCritical: boolean;
}

export interface EstimateItem {
    id: string;
    description: string;
    unit: string;
    quantity: number;
    unitRate: number;
    amount: number;
    category: 'earthwork' | 'concrete' | 'steel' | 'masonry' | 'finishes' | 'mep' | 'other';
}

export interface CostEstimate {
    directCosts: EstimateItem[];
    indirectCosts: {
        overhead: number;       // %
        profit: number;         // %
        contingency: number;    // %
    };
    totalDirect: number;
    totalIndirect: number;
    grandTotal: number;
}

export interface EarnedValueMetrics {
    BCWS: number;             // Budgeted Cost of Work Scheduled (PV)
    BCWP: number;             // Budgeted Cost of Work Performed (EV)
    ACWP: number;             // Actual Cost of Work Performed (AC)
    SV: number;               // Schedule Variance
    CV: number;               // Cost Variance
    SPI: number;              // Schedule Performance Index
    CPI: number;              // Cost Performance Index
    EAC: number;              // Estimate at Completion
    ETC: number;              // Estimate to Complete
    VAC: number;              // Variance at Completion
    TCPI: number;             // To Complete Performance Index
}

export interface RiskItem {
    id: string;
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    riskScore: number;
    mitigation: string;
    owner: string;
}

// ============================================
// UNIT RATES (INR)
// ============================================

const UNIT_RATES: Record<string, number> = {
    'earthwork_excavation': 150,         // per m³
    'earthwork_fill': 200,               // per m³
    'pcc_m15': 4500,                     // per m³
    'rcc_m20': 6500,                     // per m³
    'rcc_m25': 7500,                     // per m³
    'rcc_m30': 8500,                     // per m³
    'steel_reinforcement': 75000,        // per MT
    'structural_steel': 95000,           // per MT
    'brickwork_230': 5500,               // per m³
    'brickwork_115': 280,                // per m²
    'plastering_12mm': 220,              // per m²
    'plastering_20mm': 320,              // per m²
    'flooring_tiles': 1200,              // per m²
    'painting': 180,                     // per m²
    'formwork_steel': 450,               // per m²
    'formwork_plywood': 350,             // per m²
    'shuttering_removal': 50             // per m²
};

// ============================================
// CONSTRUCTION MANAGEMENT SERVICE
// ============================================

class ConstructionManagementServiceClass {
    /**
     * Calculate CPM schedule
     */
    calculateCPM(activities: Activity[]): ScheduleResult {
        const schedule = new Map<string, ActivitySchedule>();
        const activityMap = new Map(activities.map(a => [a.id, a]));

        // Initialize all activities
        for (const activity of activities) {
            schedule.set(activity.id, {
                id: activity.id,
                ES: 0,
                EF: 0,
                LS: Infinity,
                LF: Infinity,
                TF: 0,
                FF: 0,
                isCritical: false
            });
        }

        // Forward pass - calculate ES and EF
        const visited = new Set<string>();
        const sortedActivities = this.topologicalSort(activities);

        for (const actId of sortedActivities) {
            const activity = activityMap.get(actId)!;
            const sched = schedule.get(actId)!;

            // ES = max(EF of predecessors)
            let maxPredEF = 0;
            for (const predId of activity.predecessors) {
                const predSched = schedule.get(predId);
                if (predSched) {
                    maxPredEF = Math.max(maxPredEF, predSched.EF);
                }
            }
            sched.ES = maxPredEF;
            sched.EF = sched.ES + activity.duration;
        }

        // Project duration
        const projectDuration = Math.max(...Array.from(schedule.values()).map(s => s.EF));

        // Backward pass - calculate LS and LF
        for (let i = sortedActivities.length - 1; i >= 0; i--) {
            const actId = sortedActivities[i];
            const activity = activityMap.get(actId)!;
            const sched = schedule.get(actId)!;

            // LF = min(LS of successors), or project duration if no successors
            const successors = activities.filter(a => a.predecessors.includes(actId));

            if (successors.length === 0) {
                sched.LF = projectDuration;
            } else {
                sched.LF = Math.min(...successors.map(s => schedule.get(s.id)?.LS ?? projectDuration));
            }
            sched.LS = sched.LF - activity.duration;

            // Calculate floats
            sched.TF = sched.LS - sched.ES;

            // Free float
            const minSuccES = successors.length > 0
                ? Math.min(...successors.map(s => schedule.get(s.id)?.ES ?? projectDuration))
                : projectDuration;
            sched.FF = minSuccES - sched.EF;

            // Critical if TF = 0
            sched.isCritical = Math.abs(sched.TF) < 0.001;
        }

        // Find critical path
        const criticalPath = sortedActivities.filter(id => schedule.get(id)?.isCritical ?? false);

        // Create float maps
        const totalFloat = new Map<string, number>();
        const freeFloat = new Map<string, number>();
        for (const [id, sched] of schedule) {
            totalFloat.set(id, sched.TF);
            freeFloat.set(id, sched.FF);
        }

        return {
            activities: Array.from(schedule.values()),
            projectDuration,
            criticalPath,
            totalFloat,
            freeFloat
        };
    }

    /**
     * Topological sort of activities
     */
    private topologicalSort(activities: Activity[]): string[] {
        const sorted: string[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const activityMap = new Map(activities.map(a => [a.id, a]));

        const visit = (id: string) => {
            if (visited.has(id)) return;
            if (visiting.has(id)) throw new Error('Circular dependency');

            visiting.add(id);
            const activity = activityMap.get(id);
            if (activity) {
                for (const predId of activity.predecessors) {
                    visit(predId);
                }
            }
            visiting.delete(id);
            visited.add(id);
            sorted.push(id);
        };

        for (const activity of activities) {
            visit(activity.id);
        }

        return sorted;
    }

    /**
     * PERT analysis
     */
    calculatePERT(activities: Activity[]): {
        expectedDuration: number;
        variance: number;
        standardDeviation: number;
        probability: (target: number) => number;
    } {
        let totalExpected = 0;
        let totalVariance = 0;

        // Get critical path activities
        const cpmResult = this.calculateCPM(activities);
        const criticalActivities = activities.filter(a =>
            cpmResult.criticalPath.includes(a.id)
        );

        for (const activity of criticalActivities) {
            const o = activity.optimistic || activity.duration * 0.8;
            const m = activity.mostLikely || activity.duration;
            const p = activity.pessimistic || activity.duration * 1.4;

            // Expected time: (o + 4m + p) / 6
            const te = (o + 4 * m + p) / 6;

            // Variance: ((p - o) / 6)²
            const variance = Math.pow((p - o) / 6, 2);

            totalExpected += te;
            totalVariance += variance;
        }

        const standardDeviation = Math.sqrt(totalVariance);

        return {
            expectedDuration: totalExpected,
            variance: totalVariance,
            standardDeviation,
            probability: (target: number) => {
                // Z = (target - expected) / σ
                const z = (target - totalExpected) / standardDeviation;
                // Standard normal CDF approximation
                return this.normalCDF(z);
            }
        };
    }

    /**
     * Standard normal CDF approximation
     */
    private normalCDF(x: number): number {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Create cost estimate
     */
    createEstimate(items: Array<Omit<EstimateItem, 'amount'>>): CostEstimate {
        const estimateItems: EstimateItem[] = items.map(item => ({
            ...item,
            amount: item.quantity * item.unitRate
        }));

        const totalDirect = estimateItems.reduce((sum, item) => sum + item.amount, 0);

        const indirectCosts = {
            overhead: 10,
            profit: 10,
            contingency: 5
        };

        const indirectAmount = totalDirect * (
            indirectCosts.overhead +
            indirectCosts.profit +
            indirectCosts.contingency
        ) / 100;

        return {
            directCosts: estimateItems,
            indirectCosts,
            totalDirect,
            totalIndirect: indirectAmount,
            grandTotal: totalDirect + indirectAmount
        };
    }

    /**
     * Calculate Earned Value metrics
     */
    calculateEarnedValue(
        BAC: number,              // Budget at Completion
        BCWS: number,             // Planned Value
        BCWP: number,             // Earned Value
        ACWP: number              // Actual Cost
    ): EarnedValueMetrics {
        const SV = BCWP - BCWS;
        const CV = BCWP - ACWP;
        const SPI = BCWS > 0 ? BCWP / BCWS : 0;
        const CPI = ACWP > 0 ? BCWP / ACWP : 0;
        const EAC = CPI > 0 ? BAC / CPI : BAC;
        const ETC = EAC - ACWP;
        const VAC = BAC - EAC;
        const TCPI = (BAC - BCWP) / (BAC - ACWP);

        return {
            BCWS,
            BCWP,
            ACWP,
            SV,
            CV,
            SPI,
            CPI,
            EAC,
            ETC,
            VAC,
            TCPI
        };
    }

    /**
     * Analyze project risks
     */
    analyzeRisks(risks: Omit<RiskItem, 'riskScore'>[]): RiskItem[] {
        const probabilityScores = { 'low': 1, 'medium': 2, 'high': 3 };
        const impactScores = { 'low': 1, 'medium': 2, 'high': 3 };

        return risks.map(risk => ({
            ...risk,
            riskScore: probabilityScores[risk.probability] * impactScores[risk.impact]
        })).sort((a, b) => b.riskScore - a.riskScore);
    }

    /**
     * Get unit rate
     */
    getUnitRate(item: string): number {
        return UNIT_RATES[item] || 0;
    }

    /**
     * Calculate building quantities (approximate)
     */
    estimateBuildingQuantities(
        builtUpArea: number,      // m²
        floors: number,
        buildingType: 'residential' | 'commercial' | 'industrial'
    ): EstimateItem[] {
        const items: EstimateItem[] = [];
        const totalArea = builtUpArea * floors;

        // Earthwork
        items.push({
            id: 'earthwork',
            description: 'Excavation for foundation',
            unit: 'm³',
            quantity: builtUpArea * 1.5,
            unitRate: UNIT_RATES['earthwork_excavation'],
            amount: 0,
            category: 'earthwork'
        });

        // PCC
        items.push({
            id: 'pcc',
            description: 'PCC M15 for bedding',
            unit: 'm³',
            quantity: builtUpArea * 0.1,
            unitRate: UNIT_RATES['pcc_m15'],
            amount: 0,
            category: 'concrete'
        });

        // RCC
        const rccRate = buildingType === 'commercial' ? 0.18 : 0.15;
        items.push({
            id: 'rcc',
            description: 'RCC M25 for structure',
            unit: 'm³',
            quantity: totalArea * rccRate,
            unitRate: UNIT_RATES['rcc_m25'],
            amount: 0,
            category: 'concrete'
        });

        // Steel reinforcement
        items.push({
            id: 'steel',
            description: 'Steel reinforcement',
            unit: 'MT',
            quantity: totalArea * rccRate * 0.1, // 100 kg/m³
            unitRate: UNIT_RATES['steel_reinforcement'],
            amount: 0,
            category: 'steel'
        });

        // Brickwork
        items.push({
            id: 'brickwork',
            description: 'Brickwork in superstructure',
            unit: 'm³',
            quantity: totalArea * 0.08,
            unitRate: UNIT_RATES['brickwork_230'],
            amount: 0,
            category: 'masonry'
        });

        // Plastering
        items.push({
            id: 'plaster',
            description: 'Internal plastering',
            unit: 'm²',
            quantity: totalArea * 3.5, // Walls both sides
            unitRate: UNIT_RATES['plastering_12mm'],
            amount: 0,
            category: 'finishes'
        });

        // Flooring
        items.push({
            id: 'flooring',
            description: 'Flooring tiles',
            unit: 'm²',
            quantity: totalArea,
            unitRate: UNIT_RATES['flooring_tiles'],
            amount: 0,
            category: 'finishes'
        });

        // Calculate amounts
        return items.map(item => ({
            ...item,
            amount: item.quantity * item.unitRate
        }));
    }
}

// ============================================
// SINGLETON
// ============================================

export const construction = new ConstructionManagementServiceClass();

export default ConstructionManagementServiceClass;
