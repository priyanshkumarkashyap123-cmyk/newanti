
export interface Activity {
    id: string;
    name: string;
    duration: number;
    predecessors: string[];
}

export interface ScheduledActivity extends Activity {
    ES: number; // Early Start
    EF: number; // Early Finish
    LS: number; // Late Start
    LF: number; // Late Finish
    TF: number; // Total Float
    FF: number; // Free Float
    isCritical: boolean;
}

export interface ScheduleResult {
    activities: ScheduledActivity[];
    projectDuration: number;
    criticalPath: string[]; // List of IDs
}

export interface EstimateItem {
    description: string;
    unit: string;
    quantity: number;
    unitRate: number;
    amount: number;
}

export interface CostEstimate {
    directCosts: EstimateItem[];
    totalDirect: number;
    totalIndirect: number;
    grandTotal: number;
}

export const construction = {
    calculateCPM: (activities: Activity[]): ScheduleResult => {
        // 1. Initialize
        const map = new Map<string, ScheduledActivity>();
        activities.forEach(a => {
            map.set(a.id, { ...a, ES: 0, EF: 0, LS: Infinity, LF: Infinity, TF: 0, FF: 0, isCritical: false });
        });

        // 2. Forward Pass
        // Sort topologically or simpler iterative approach (since max deps is small)
        // Simple approach: loop until changes settle roughly
        let changed = true;
        while (changed) {
            changed = false;
            activities.forEach(act => {
                const s = map.get(act.id)!;
                let maxPrevEF = 0;
                act.predecessors.forEach(pId => {
                    const p = map.get(pId);
                    if (p && p.EF > maxPrevEF) maxPrevEF = p.EF;
                });

                if (s.ES !== maxPrevEF) {
                    s.ES = maxPrevEF;
                    s.EF = s.ES + s.duration;
                    changed = true;
                }
            });
        }

        const projectDuration = Math.max(...Array.from(map.values()).map(a => a.EF));

        // 3. Backward Pass
        // Initialize End nodes LF to Project Duration
        Array.from(map.values()).forEach(a => {
            a.LF = projectDuration;
            a.LS = a.LF - a.duration;
        });

        // Iterate backwards needs topological sort really, or just iterate enough times
        for (let i = 0; i < activities.length * 2; i++) {
            activities.forEach(act => {
                const s = map.get(act.id)!;
                // LF is min(LS of successors)
                // Find successors
                const successors = activities.filter(other => other.predecessors.includes(act.id));
                if (successors.length > 0) {
                    const minSuccLS = Math.min(...successors.map(succ => map.get(succ.id)!.LS));
                    s.LF = minSuccLS;
                    s.LS = s.LF - s.duration;
                }
            });
        }

        // 4. Calculate Float & Critical Path
        const resultActivities: ScheduledActivity[] = [];
        const criticalPath: string[] = [];

        Array.from(map.values()).forEach(a => {
            a.TF = a.LS - a.ES;
            a.FF = 0; // Simplified
            a.isCritical = a.TF <= 0.001; // FP tolerance
            resultActivities.push(a);
            if (a.isCritical) criticalPath.push(a.id);
        });

        // Sort Critical path by timeline for display
        criticalPath.sort((a, b) => map.get(a)!.ES - map.get(b)!.ES);

        return {
            activities: resultActivities,
            projectDuration,
            criticalPath
        };
    },

    estimateBuildingQuantities: (areaM2: number, floors: number, type: 'residential' | 'commercial' | 'industrial'): EstimateItem[] => {
        // Plinth Area Rate Method (Approximate)
        // Constants derived from general estimation data
        const items: EstimateItem[] = [];
        const totalBuiltUp = areaM2 * floors;

        // Rates (INR approx for 2024-25)
        const rateFactor = type === 'commercial' ? 1.2 : type === 'industrial' ? 0.9 : 1.0;

        // 1. Excavation & Earthwork (Approx 1.5 * footprint area * depth)
        const footprint = areaM2;
        items.push({
            description: 'Earthwork in Excavation',
            unit: 'cum',
            quantity: footprint * 1.5, // 1.5m depth approx avg
            unitRate: 350 * rateFactor,
            amount: 0
        });

        // 2. Concrete (PCC/RCC) - Approx 0.15 cum per sqm of builtup
        items.push({
            description: 'RCC Work (M25) for Columns/Beams/Slabs',
            unit: 'cum',
            quantity: totalBuiltUp * 0.18,
            unitRate: 8500 * rateFactor,
            amount: 0
        });

        // 3. Steel Reinforcement - Approx 100 kg/cum of concrete
        items.push({
            description: 'Steel Reinforcement (Fe550)',
            unit: 'kg',
            quantity: (totalBuiltUp * 0.18) * 110, // 110 kg/cum
            unitRate: 85, // per kg
            amount: 0
        });

        // 4. Brickwork - Approx 0.25 cum per sqm builtup
        items.push({
            description: 'Brickwork / AAC Blocks',
            unit: 'cum',
            quantity: totalBuiltUp * 0.22,
            unitRate: 5500 * rateFactor,
            amount: 0
        });

        // 5. Flooring - Builtup area - walls (10%)
        items.push({
            description: 'Flooring (Vitrified/Granite)',
            unit: 'sqm',
            quantity: totalBuiltUp * 0.85,
            unitRate: 1200 * rateFactor,
            amount: 0
        });

        // 6. Finishing (Plaster + Paint) - Wall area approx 2.5 * Floor area
        items.push({
            description: 'Internal & External Plastering',
            unit: 'sqm',
            quantity: totalBuiltUp * 2.5,
            unitRate: 450 * rateFactor,
            amount: 0
        });
        items.push({
            description: 'Painting (Emulsion/Weather Coat)',
            unit: 'sqm',
            quantity: totalBuiltUp * 2.5,
            unitRate: 150 * rateFactor,
            amount: 0
        });

        // Calculate amounts
        items.forEach(i => i.amount = i.quantity * i.unitRate);

        return items;
    },

    createEstimate: (items: EstimateItem[]): CostEstimate => {
        const totalDirect = items.reduce((sum, i) => sum + i.amount, 0);

        // Indirect Costs
        const contingencies = totalDirect * 0.03; // 3%
        const waterElectric = totalDirect * 0.02; // 2%
        const contractorProfit = totalDirect * 0.10; // 10%

        const totalIndirect = contingencies + waterElectric + contractorProfit;

        return {
            directCosts: items,
            totalDirect,
            totalIndirect,
            grandTotal: totalDirect + totalIndirect
        };
    }
};
