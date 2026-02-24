/**
 * ConnectionDesignService.ts
 * 
 * AI-powered steel connection design and verification
 * 
 * Features:
 * - Connection type recommendation based on forces
 * - Bolt pattern optimization
 * - Weld sizing calculations
 * - Connection detail generation
 * - IS 800:2007 compliant design
 */

import { auditTrail } from './AuditTrailService';
import { CodeCheck } from './CodeComplianceEngine';

// ============================================
// TYPES
// ============================================

export type ConnectionType =
    | 'simple_shear'      // Shear tab, clip angle
    | 'moment_end_plate'  // End plate moment connection
    | 'moment_flange'     // Flange plate moment connection
    | 'baseplate'         // Column baseplate
    | 'splice'            // Column or beam splice
    | 'brace_gusset'      // Brace connection with gusset
    | 'truss_gusset';     // Truss node connection

export interface ConnectionForces {
    axial: number;     // kN
    shearY: number;    // kN
    shearZ: number;    // kN
    momentY: number;   // kN·m
    momentZ: number;   // kN·m
    torsion: number;   // kN·m
}

export interface BoltSpec {
    grade: '4.6' | '8.8' | '10.9' | '12.9';
    diameter: number;    // mm
    fub: number;         // Ultimate strength MPa
    fyb: number;         // Yield strength MPa
}

export interface BoltPattern {
    rows: number;
    columns: number;
    pitch: number;       // mm (vertical spacing)
    gauge: number;       // mm (horizontal spacing)
    edgeDistance: number; // mm
    boltSpec: BoltSpec;
    totalBolts: number;
    capacity: {
        shear: number;     // kN
        bearing: number;   // kN
        tension: number;   // kN
    };
}

export interface WeldSpec {
    type: 'fillet' | 'groove' | 'plug';
    size: number;        // mm (throat or leg size)
    length: number;      // mm
    electrode: 'E70' | 'E80' | 'E110';
    fuWeld: number;      // Ultimate strength MPa
    capacity: number;    // kN per mm
}

export interface PlateSpec {
    thickness: number;   // mm
    width: number;       // mm
    height: number;      // mm
    material: string;    // e.g., 'E250'
}

export interface ConnectionCheck extends CodeCheck {
    component: string;
}

export interface ConnectionDesign {
    type: ConnectionType;
    description: string;
    forces: ConnectionForces;
    bolts?: BoltPattern;
    welds?: WeldSpec[];
    plates?: PlateSpec[];
    stiffeners?: PlateSpec[];
    checks: ConnectionCheck[];
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    utilizationMax: number;
    drawingData?: ConnectionDrawingData;
    recommendations?: string[];
}

export interface ConnectionDrawingData {
    viewType: 'elevation' | 'plan' | 'section';
    dimensions: { name: string; value: number; unit: string }[];
    annotations: string[];
}

export interface SteelMember {
    section: string;
    depth: number;       // mm
    width: number;       // mm
    webThickness: number; // mm
    flangeThickness: number; // mm
    material: 'E250' | 'E350';
}

// ============================================
// BOLT DATABASE
// ============================================

export const BOLT_GRADES: Record<string, BoltSpec> = {
    '4.6_M12': { grade: '4.6', diameter: 12, fub: 400, fyb: 240 },
    '4.6_M16': { grade: '4.6', diameter: 16, fub: 400, fyb: 240 },
    '4.6_M20': { grade: '4.6', diameter: 20, fub: 400, fyb: 240 },
    '4.6_M24': { grade: '4.6', diameter: 24, fub: 400, fyb: 240 },
    '8.8_M12': { grade: '8.8', diameter: 12, fub: 800, fyb: 640 },
    '8.8_M16': { grade: '8.8', diameter: 16, fub: 800, fyb: 640 },
    '8.8_M20': { grade: '8.8', diameter: 20, fub: 800, fyb: 640 },
    '8.8_M24': { grade: '8.8', diameter: 24, fub: 800, fyb: 640 },
    '10.9_M16': { grade: '10.9', diameter: 16, fub: 1000, fyb: 900 },
    '10.9_M20': { grade: '10.9', diameter: 20, fub: 1000, fyb: 900 },
    '10.9_M24': { grade: '10.9', diameter: 24, fub: 1000, fyb: 900 }
};

// ============================================
// CONNECTION DESIGN SERVICE
// ============================================

export class ConnectionDesignService {
    private gammaM0 = 1.10;
    private gammaM1 = 1.25;
    private gammaMb = 1.25; // For bolts
    private gammaMw = 1.25; // For welds

    /**
     * Suggest connection type based on forces
     */
    suggestConnectionType(forces: ConnectionForces): {
        recommended: ConnectionType;
        alternatives: ConnectionType[];
        reasoning: string;
    } {
        const hasSignificantMoment = Math.abs(forces.momentZ) > 10 || Math.abs(forces.momentY) > 10;
        const hasSignificantAxial = Math.abs(forces.axial) > 50;
        const shear = Math.sqrt(forces.shearY ** 2 + forces.shearZ ** 2);

        let recommended: ConnectionType;
        let alternatives: ConnectionType[] = [];
        let reasoning: string;

        if (!hasSignificantMoment && !hasSignificantAxial) {
            // Pure shear connection
            recommended = 'simple_shear';
            alternatives = ['brace_gusset'];
            reasoning = `Shear-only connection (V=${shear.toFixed(0)}kN). Simple shear connection is economical.`;
        } else if (hasSignificantMoment && hasSignificantAxial) {
            // Full moment connection with axial
            recommended = 'moment_end_plate';
            alternatives = ['moment_flange', 'splice'];
            reasoning = `Combined moment (M=${Math.abs(forces.momentZ).toFixed(0)}kNm) and axial (N=${forces.axial.toFixed(0)}kN). End plate provides moment capacity.`;
        } else if (hasSignificantMoment) {
            // Moment connection
            recommended = 'moment_end_plate';
            alternatives = ['moment_flange'];
            reasoning = `Moment transfer required (M=${Math.abs(forces.momentZ).toFixed(0)}kNm). End plate is common choice.`;
        } else {
            // Axial with shear
            recommended = 'brace_gusset';
            alternatives = ['splice', 'simple_shear'];
            reasoning = `Axial load dominant (N=${forces.axial.toFixed(0)}kN). Gusset plate provides direct load path.`;
        }

        auditTrail.logAIRecommendation(
            'connection_type',
            `Recommended ${recommended} connection`,
            0.85,
            reasoning
        );

        return { recommended, alternatives, reasoning };
    }

    /**
     * Design bolt pattern for given shear force
     */
    designBoltPattern(
        shearForce: number,    // kN
        plateThickness: number, // mm
        boltGrade: string = '8.8_M20',
        fu: number = 410       // Plate ultimate strength MPa
    ): BoltPattern {
        const bolt = BOLT_GRADES[boltGrade];
        if (!bolt) throw new Error(`Unknown bolt grade: ${boltGrade}`);

        const d = bolt.diameter;
        const dHole = d + 2; // Standard hole
        const An = (Math.PI / 4) * d * d; // Shank area

        // Single bolt shear capacity (Table 12, IS 800)
        // Vdsb = fub × nn × Anb / (√3 × γmb)
        const Vdsb = (bolt.fub * 1 * 0.78 * An) / (Math.sqrt(3) * this.gammaMb * 1000); // kN

        // Single bolt bearing capacity
        // Vdpb = 2.5 × kb × d × t × fu / γmb
        const e = 1.5 * dHole; // Edge distance
        const p = 2.5 * d; // Pitch
        const kb = Math.min(e / (3 * dHole), p / (3 * dHole) - 0.25, bolt.fub / fu, 1.0);
        const Vdpb = (2.5 * kb * d * plateThickness * fu) / (this.gammaMb * 1000); // kN

        // Governing capacity per bolt
        const capacityPerBolt = Math.min(Vdsb, Vdpb);

        // Number of bolts required
        const nRequired = Math.ceil(shearForce / capacityPerBolt);

        // Arrange in pattern
        const cols = Math.min(nRequired, 2);
        const rows = Math.ceil(nRequired / cols);
        const totalBolts = rows * cols;

        const pattern: BoltPattern = {
            rows,
            columns: cols,
            pitch: 3 * d,
            gauge: 100, // Typical gauge
            edgeDistance: Math.max(1.5 * dHole, 40),
            boltSpec: bolt,
            totalBolts,
            capacity: {
                shear: capacityPerBolt * totalBolts,
                bearing: Vdpb * totalBolts,
                tension: 0 // Would need tension design
            }
        };

        return pattern;
    }

    /**
     * Design fillet weld for given force
     */
    designFilletWeld(
        force: number,          // kN
        length: number,         // mm (available length)
        plateThickness: number, // mm
        fu: number = 410        // Base metal ultimate MPa
    ): WeldSpec {
        const fuWeld = 410; // E70 electrode

        // Weld strength (Clause 10.5.7, IS 800)
        // Design strength: fwd = fu/(√3 × γmw)
        const fwd = fuWeld / (Math.sqrt(3) * this.gammaMw); // MPa

        // Required throat area
        // Force = fwd × tt × length
        // tt = required throat thickness
        const ttRequired = (force * 1000) / (fwd * length); // mm

        // Throat = 0.7 × leg size
        const legRequired = ttRequired / 0.7;

        // Round up to standard sizes (3, 4, 5, 6, 8, 10 mm)
        const standardSizes = [3, 4, 5, 6, 8, 10, 12];
        let legSize = standardSizes.find(s => s >= legRequired) || 12;

        // Check against plate thickness (max weld size = t - 1.5mm)
        const maxWeld = plateThickness - 1.5;
        if (legSize > maxWeld) {
            legSize = Math.floor(maxWeld);
        }

        // Capacity
        const tt = 0.7 * legSize;
        const capacity = (fwd * tt * length) / 1000; // kN

        return {
            type: 'fillet',
            size: legSize,
            length,
            electrode: 'E70',
            fuWeld,
            capacity
        };
    }

    /**
     * Design simple shear connection (shear tab)
     */
    designSimpleShearConnection(
        beam: SteelMember,
        forces: ConnectionForces
    ): ConnectionDesign {
        const checks: ConnectionCheck[] = [];
        const recommendations: string[] = [];

        const shear = Math.abs(forces.shearY);

        // Plate sizing
        const plateThickness = Math.max(6, Math.ceil(beam.webThickness * 1.5));
        const plateHeight = beam.depth - 2 * beam.flangeThickness - 20; // Clear of flanges
        const plateWidth = 100; // Typical

        const plate: PlateSpec = {
            thickness: plateThickness,
            width: plateWidth,
            height: plateHeight,
            material: 'E250'
        };

        // Bolt design
        const boltPattern = this.designBoltPattern(shear, plateThickness);

        // Bolt shear check
        const boltUtilization = shear / boltPattern.capacity.shear;
        checks.push({
            id: `conn-bolt-shear-${Date.now()}`,
            code: 'IS_800',
            clause: '10.3.3',
            title: 'Bolt Shear Capacity',
            description: `V=${shear.toFixed(1)}kN / Vd=${boltPattern.capacity.shear.toFixed(1)}kN`,
            demand: shear,
            capacity: boltPattern.capacity.shear,
            ratio: boltUtilization,
            unit: 'kN',
            status: boltUtilization <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Bolts'
        });

        // Weld to column design
        const weldOneSide = this.designFilletWeld(shear / 2, plateHeight, plateThickness);
        const weldCapacity = weldOneSide.capacity * 2;
        const weldUtilization = shear / weldCapacity;

        checks.push({
            id: `conn-weld-${Date.now()}`,
            code: 'IS_800',
            clause: '10.5.7',
            title: 'Weld Capacity',
            description: `V=${shear.toFixed(1)}kN / Vd=${weldCapacity.toFixed(1)}kN (2×${weldOneSide.size}mm fillet)`,
            demand: shear,
            capacity: weldCapacity,
            ratio: weldUtilization,
            unit: 'kN',
            status: weldUtilization <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Welds'
        });

        // Plate block shear check
        const e = boltPattern.edgeDistance;
        const Avg = plateThickness * (boltPattern.rows - 1) * boltPattern.pitch; // Shear area
        const Atn = plateThickness * (e + (boltPattern.columns - 1) * boltPattern.gauge / 2); // Tension area
        const fy = 250; const fu = 410;
        const Tdb = (Avg * fy / (Math.sqrt(3) * this.gammaM0) + 0.9 * Atn * fu / this.gammaM1) / 1000;
        const blockShearUtil = shear / Tdb;

        checks.push({
            id: `conn-block-shear-${Date.now()}`,
            code: 'IS_800',
            clause: '6.4',
            title: 'Block Shear',
            description: `V=${shear.toFixed(1)}kN / Tdb=${Tdb.toFixed(1)}kN`,
            demand: shear,
            capacity: Tdb,
            ratio: blockShearUtil,
            unit: 'kN',
            status: blockShearUtil <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Plate'
        });

        const maxUtil = Math.max(boltUtilization, weldUtilization, blockShearUtil);
        const failedChecks = checks.filter(c => c.status === 'FAIL');

        if (failedChecks.length > 0) {
            recommendations.push('Connection is inadequate. Consider:');
            if (boltUtilization > 1) recommendations.push('- Increase number of bolts or use higher grade');
            if (weldUtilization > 1) recommendations.push('- Increase weld size or length');
            if (blockShearUtil > 1) recommendations.push('- Increase plate thickness');
        }

        auditTrail.log('design_check', 'simple_shear_connection',
            `Designed simple shear connection for V=${shear}kN`, {
            aiGenerated: true,
            metadata: { boltPattern, plate, weldOneSide, maxUtil }
        });

        return {
            type: 'simple_shear',
            description: `Simple shear tab connection with ${boltPattern.totalBolts}× M${boltPattern.boltSpec.diameter} ${boltPattern.boltSpec.grade} bolts`,
            forces,
            bolts: boltPattern,
            welds: [weldOneSide, { ...weldOneSide }], // Two welds
            plates: [plate],
            checks,
            overallStatus: failedChecks.length > 0 ? 'FAIL' : 'PASS',
            utilizationMax: maxUtil,
            recommendations,
            drawingData: {
                viewType: 'elevation',
                dimensions: [
                    { name: 'Plate Height', value: plateHeight, unit: 'mm' },
                    { name: 'Plate Width', value: plateWidth, unit: 'mm' },
                    { name: 'Plate Thickness', value: plateThickness, unit: 'mm' },
                    { name: 'Bolt Pitch', value: boltPattern.pitch, unit: 'mm' },
                    { name: 'Edge Distance', value: boltPattern.edgeDistance, unit: 'mm' },
                    { name: 'Weld Size', value: weldOneSide.size, unit: 'mm' }
                ],
                annotations: [
                    `${boltPattern.totalBolts}× M${boltPattern.boltSpec.diameter} ${boltPattern.boltSpec.grade}`,
                    `${weldOneSide.size}mm fillet weld both sides`
                ]
            }
        };
    }

    /**
     * Design moment end plate connection
     */
    designMomentEndPlate(
        beam: SteelMember,
        column: SteelMember,
        forces: ConnectionForces
    ): ConnectionDesign {
        const checks: ConnectionCheck[] = [];
        const recommendations: string[] = [];

        const M = Math.abs(forces.momentZ); // kN·m
        const V = Math.abs(forces.shearY);  // kN

        // End plate sizing
        const plateWidth = column.width + 40; // Beyond column flanges
        const plateHeight = beam.depth + 100; // Extended above and below
        const plateThickness = Math.max(12, Math.ceil(beam.flangeThickness * 1.5));

        const plate: PlateSpec = {
            thickness: plateThickness,
            width: plateWidth,
            height: plateHeight,
            material: 'E250'
        };

        // Bolt force from moment
        // Simplified: T = M / (lever arm)
        const leverArm = beam.depth - beam.flangeThickness; // mm
        const tensionForce = (M * 1000) / leverArm; // kN

        // Tension bolts in flanges (4 bolts typical per flange)
        const nTensionBolts = 4;
        const tensionPerBolt = tensionForce / nTensionBolts;

        // Check bolt tension capacity
        const bolt = BOLT_GRADES['8.8_M20'];
        const An = (Math.PI / 4) * bolt.diameter * bolt.diameter * 0.78; // Tensile stress area
        const Tdb = (0.9 * bolt.fub * An) / (this.gammaMb * 1000); // kN per bolt

        const tensionUtil = tensionPerBolt / Tdb;
        checks.push({
            id: `conn-bolt-tension-${Date.now()}`,
            code: 'IS_800',
            clause: '10.3.5',
            title: 'Bolt Tension Capacity',
            description: `T/bolt=${tensionPerBolt.toFixed(1)}kN / Tdb=${Tdb.toFixed(1)}kN`,
            demand: tensionPerBolt,
            capacity: Tdb,
            ratio: tensionUtil,
            unit: 'kN',
            status: tensionUtil <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Tension Bolts'
        });

        // Shear bolts (use remaining bolts)
        const nShearBolts = 4; // In web region
        const Vdsb = (bolt.fub * 1 * 0.78 * An) / (Math.sqrt(3) * this.gammaMb * 1000);
        const shearCapacity = Vdsb * nShearBolts;
        const shearUtil = V / shearCapacity;

        checks.push({
            id: `conn-bolt-shear-m-${Date.now()}`,
            code: 'IS_800',
            clause: '10.3.3',
            title: 'Bolt Shear Capacity',
            description: `V=${V.toFixed(1)}kN / Vd=${shearCapacity.toFixed(1)}kN`,
            demand: V,
            capacity: shearCapacity,
            ratio: shearUtil,
            unit: 'kN',
            status: shearUtil <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Web Bolts'
        });

        // Beam flange weld (full penetration groove or large fillet)
        const flangeWeldLength = beam.width;
        const flangeWeldSize = Math.ceil(beam.flangeThickness * 0.8);
        const flangeWeldCapacity = (0.7 * flangeWeldSize * 410 * flangeWeldLength) / (Math.sqrt(3) * this.gammaMw * 1000);
        const flangeForce = tensionForce;
        const flangeWeldUtil = flangeForce / flangeWeldCapacity;

        checks.push({
            id: `conn-flange-weld-${Date.now()}`,
            code: 'IS_800',
            clause: '10.5.7',
            title: 'Flange Weld Capacity',
            description: `T=${flangeForce.toFixed(1)}kN / Capacity=${flangeWeldCapacity.toFixed(1)}kN`,
            demand: flangeForce,
            capacity: flangeWeldCapacity,
            ratio: flangeWeldUtil,
            unit: 'kN',
            status: flangeWeldUtil <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Flange Weld'
        });

        const maxUtil = Math.max(tensionUtil, shearUtil, flangeWeldUtil);

        // Bolt pattern for moment connection
        const boltPattern: BoltPattern = {
            rows: 4, // 2 rows above flange, 2 below
            columns: 2,
            pitch: 80,
            gauge: column.width - 40,
            edgeDistance: 40,
            boltSpec: bolt,
            totalBolts: 8,
            capacity: {
                shear: shearCapacity,
                bearing: 0,
                tension: Tdb * nTensionBolts
            }
        };

        const failedChecks = checks.filter(c => c.status === 'FAIL');

        if (maxUtil > 0.9 && maxUtil <= 1.0) {
            recommendations.push('Connection is heavily utilized (>90%). Consider reviewing for construction tolerances.');
        }
        if (failedChecks.length > 0) {
            recommendations.push('Connection is inadequate. Consider:');
            if (tensionUtil > 1) recommendations.push('- Use more or larger tension bolts');
            if (flangeWeldUtil > 1) recommendations.push('- Increase flange weld size');
        }

        return {
            type: 'moment_end_plate',
            description: `Moment end plate connection: ${M.toFixed(0)}kNm, 8× M${bolt.diameter} ${bolt.grade}`,
            forces,
            bolts: boltPattern,
            welds: [
                { type: 'fillet', size: flangeWeldSize, length: flangeWeldLength, electrode: 'E70', fuWeld: 410, capacity: flangeWeldCapacity },
                { type: 'fillet', size: 6, length: beam.depth - 2 * beam.flangeThickness, electrode: 'E70', fuWeld: 410, capacity: 0 }
            ],
            plates: [plate],
            checks,
            overallStatus: failedChecks.length > 0 ? 'FAIL' : 'PASS',
            utilizationMax: maxUtil,
            recommendations,
            drawingData: {
                viewType: 'elevation',
                dimensions: [
                    { name: 'End Plate Width', value: plateWidth, unit: 'mm' },
                    { name: 'End Plate Height', value: plateHeight, unit: 'mm' },
                    { name: 'End Plate Thickness', value: plateThickness, unit: 'mm' },
                    { name: 'Bolt Gauge', value: boltPattern.gauge, unit: 'mm' },
                    { name: 'Flange Weld Size', value: flangeWeldSize, unit: 'mm' }
                ],
                annotations: [
                    `8× M${bolt.diameter} ${bolt.grade} HSFG bolts`,
                    `${flangeWeldSize}mm fillet weld to flanges`,
                    `6mm fillet weld to web`
                ]
            }
        };
    }

    /**
     * Design column baseplate
     */
    designBaseplate(
        column: SteelMember,
        axial: number,      // kN (positive = compression)
        moment: number,     // kN·m
        fck: number = 25    // Concrete grade MPa
    ): ConnectionDesign {
        const checks: ConnectionCheck[] = [];

        const N = Math.abs(axial);
        const M = Math.abs(moment);

        // Bearing area required
        const fcd = 0.45 * fck; // Allowable bearing stress (MPa)
        const ARequired = (N * 1000) / fcd; // mm²

        // Plate dimensions
        const B = column.width + 100; // mm
        const L = column.depth + 100; // mm
        const A = B * L;

        // Check bearing
        const bearingStress = (N * 1000) / A;
        const bearingUtil = bearingStress / fcd;

        checks.push({
            id: `bp-bearing-${Date.now()}`,
            code: 'IS_800',
            clause: '10.7',
            title: 'Concrete Bearing',
            description: `σ=${bearingStress.toFixed(2)}MPa / fcd=${fcd.toFixed(2)}MPa`,
            demand: bearingStress,
            capacity: fcd,
            ratio: bearingUtil,
            unit: 'MPa',
            status: bearingUtil <= 1.0 ? 'PASS' : 'FAIL',
            component: 'Concrete'
        });

        // Plate thickness (bending)
        const overhang = (B - column.width) / 2;
        const fy = 250;
        const tRequired = overhang * Math.sqrt((3 * bearingStress) / fy);
        const t = Math.max(Math.ceil(tRequired / 2) * 2, 16); // Round up to even mm, min 16mm

        // Anchor bolt design (simplified)
        const anchorDiameter = M > 50 ? 24 : M > 20 ? 20 : 16;
        const nAnchors = M > 100 ? 8 : 4;

        const plate: PlateSpec = {
            thickness: t,
            width: B,
            height: L,
            material: 'E250'
        };

        checks.push({
            id: `bp-thickness-${Date.now()}`,
            code: 'IS_800',
            clause: '10.7',
            title: 'Plate Bending',
            description: `t=${t}mm (required: ${tRequired.toFixed(1)}mm)`,
            demand: tRequired,
            capacity: t,
            ratio: tRequired / t,
            unit: 'mm',
            status: tRequired <= t ? 'PASS' : 'FAIL',
            component: 'Baseplate'
        });

        return {
            type: 'baseplate',
            description: `Baseplate ${B}×${L}×${t}mm with ${nAnchors}× M${anchorDiameter} anchors`,
            forces: { axial, shearY: 0, shearZ: 0, momentY: 0, momentZ: moment, torsion: 0 },
            plates: [plate],
            checks,
            overallStatus: checks.some(c => c.status === 'FAIL') ? 'FAIL' : 'PASS',
            utilizationMax: Math.max(...checks.map(c => c.ratio)),
            drawingData: {
                viewType: 'plan',
                dimensions: [
                    { name: 'Length', value: L, unit: 'mm' },
                    { name: 'Width', value: B, unit: 'mm' },
                    { name: 'Thickness', value: t, unit: 'mm' }
                ],
                annotations: [
                    `${nAnchors}× M${anchorDiameter} anchor bolts`,
                    `Grout thickness: 25mm`
                ]
            }
        };
    }

    /**
     * Generate connection design summary
     */
    summarizeDesign(design: ConnectionDesign): string {
        let summary = `## ${design.type.replace(/_/g, ' ').toUpperCase()} CONNECTION\n\n`;
        summary += `**${design.description}**\n\n`;

        // Status
        const emoji = design.overallStatus === 'PASS' ? '✅' : design.overallStatus === 'WARNING' ? '⚠️' : '❌';
        summary += `### Status: ${emoji} ${design.overallStatus}\n`;
        summary += `Max Utilization: ${(design.utilizationMax * 100).toFixed(1)}%\n\n`;

        // Components
        if (design.bolts) {
            summary += `### Bolts\n`;
            summary += `- ${design.bolts.totalBolts}× M${design.bolts.boltSpec.diameter} Grade ${design.bolts.boltSpec.grade}\n`;
            summary += `- Pattern: ${design.bolts.rows} rows × ${design.bolts.columns} columns\n`;
            summary += `- Pitch: ${design.bolts.pitch}mm, Edge: ${design.bolts.edgeDistance}mm\n\n`;
        }

        if (design.welds && design.welds.length > 0) {
            summary += `### Welds\n`;
            design.welds.forEach((w, i) => {
                summary += `- Weld ${i + 1}: ${w.size}mm ${w.type} × ${w.length}mm (${w.electrode})\n`;
            });
            summary += '\n';
        }

        if (design.plates && design.plates.length > 0) {
            summary += `### Plates\n`;
            design.plates.forEach((p, i) => {
                summary += `- Plate ${i + 1}: ${p.width}×${p.height}×${p.thickness}mm (${p.material})\n`;
            });
            summary += '\n';
        }

        // Checks
        summary += `### Design Checks\n\n`;
        summary += `| Check | Demand | Capacity | Ratio | Status |\n`;
        summary += `|-------|--------|----------|-------|--------|\n`;
        for (const check of design.checks) {
            const statusEmoji = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
            summary += `| ${check.title} | ${check.demand.toFixed(1)} | ${check.capacity.toFixed(1)} | ${(check.ratio * 100).toFixed(1)}% | ${statusEmoji} |\n`;
        }

        if (design.recommendations && design.recommendations.length > 0) {
            summary += `\n### Recommendations\n`;
            design.recommendations.forEach(r => summary += `- ${r}\n`);
        }

        return summary;
    }
}

// Export singleton
export const connectionDesign = new ConnectionDesignService();
export default ConnectionDesignService;
