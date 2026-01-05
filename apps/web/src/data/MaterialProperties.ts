/**
 * MaterialProperties.ts - Comprehensive Material Property Database
 * 
 * Contains accurate material properties for structural analysis:
 * - Steel grades (Indian IS, ASTM, European EN)
 * - Concrete grades (IS 456, ACI 318, Eurocode)
 * - Aluminum alloys
 * - Timber grades
 * 
 * Units: SI (kN, m, kN/m², kg/m³)
 */

// ============================================
// MATERIAL INTERFACE
// ============================================

export interface MaterialProperties {
    name: string;
    grade: string;
    category: 'steel' | 'concrete' | 'aluminum' | 'timber' | 'cable';

    // Mechanical Properties
    E: number;              // Young's Modulus (kN/m² = kPa)
    fy: number;             // Yield Strength (kN/m²)
    fu?: number;            // Ultimate Strength (kN/m²)
    G?: number;             // Shear Modulus (kN/m²)
    nu: number;             // Poisson's Ratio

    // Physical Properties
    density: number;        // Density (kg/m³)
    thermalExpansion: number; // Coefficient of thermal expansion (1/°C)

    // Design Properties
    partialSafetyFactor?: number;  // γm for limit state design
    designStrength?: number;       // fy/γm
}

// ============================================
// STEEL MATERIALS (Indian Standards IS 800:2007)
// ============================================

export const STEEL_MATERIALS: Record<string, MaterialProperties> = {
    // Indian Standard Steel Grades
    'Fe250': {
        name: 'Mild Steel',
        grade: 'Fe 250',
        category: 'steel',
        E: 200e6,           // 200 GPa = 200,000 MPa = 200e6 kN/m²
        fy: 250e3,          // 250 MPa = 250,000 kN/m²
        fu: 410e3,          // 410 MPa
        G: 76.9e6,          // 76.9 GPa
        nu: 0.3,
        density: 7850,      // kg/m³
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 227.3e3
    },
    'Fe410': {
        name: 'Standard Steel',
        grade: 'Fe 410',
        category: 'steel',
        E: 200e6,
        fy: 250e3,
        fu: 410e3,
        G: 76.9e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 227.3e3
    },
    'Fe490': {
        name: 'High Strength Steel',
        grade: 'Fe 490',
        category: 'steel',
        E: 200e6,
        fy: 350e3,          // 350 MPa
        fu: 490e3,          // 490 MPa
        G: 76.9e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 318.2e3
    },
    'E250': {
        name: 'IS 2062 Steel E250',
        grade: 'E 250 (Fe 410 W)',
        category: 'steel',
        E: 200e6,
        fy: 250e3,
        fu: 410e3,
        G: 76.9e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 227.3e3
    },
    'E350': {
        name: 'IS 2062 Steel E350',
        grade: 'E 350 (Fe 490)',
        category: 'steel',
        E: 200e6,
        fy: 350e3,
        fu: 490e3,
        G: 76.9e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 318.2e3
    },
    'E450': {
        name: 'IS 2062 Steel E450',
        grade: 'E 450',
        category: 'steel',
        E: 200e6,
        fy: 450e3,
        fu: 570e3,
        G: 76.9e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.1,
        designStrength: 409.1e3
    },

    // ASTM Steel Grades
    'A36': {
        name: 'ASTM A36 Steel',
        grade: 'A36',
        category: 'steel',
        E: 200e6,
        fy: 250e3,          // 36 ksi ≈ 250 MPa
        fu: 400e3,          // 58 ksi ≈ 400 MPa
        G: 77.2e6,
        nu: 0.26,
        density: 7850,
        thermalExpansion: 11.7e-6,
        partialSafetyFactor: 1.67,  // ASD Ω
        designStrength: 149.7e3
    },
    'A572-50': {
        name: 'ASTM A572 Grade 50',
        grade: 'A572 Gr.50',
        category: 'steel',
        E: 200e6,
        fy: 345e3,          // 50 ksi ≈ 345 MPa
        fu: 450e3,          // 65 ksi ≈ 450 MPa
        G: 77.2e6,
        nu: 0.26,
        density: 7850,
        thermalExpansion: 11.7e-6,
        partialSafetyFactor: 1.67,
        designStrength: 206.6e3
    },
    'A992': {
        name: 'ASTM A992 Steel',
        grade: 'A992',
        category: 'steel',
        E: 200e6,
        fy: 345e3,          // 50 ksi
        fu: 450e3,          // 65 ksi
        G: 77.2e6,
        nu: 0.26,
        density: 7850,
        thermalExpansion: 11.7e-6,
        partialSafetyFactor: 1.67,
        designStrength: 206.6e3
    },

    // European Steel Grades
    'S235': {
        name: 'European S235',
        grade: 'S235',
        category: 'steel',
        E: 210e6,           // Eurocode uses 210 GPa
        fy: 235e3,
        fu: 360e3,
        G: 81e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.0,
        designStrength: 235e3
    },
    'S275': {
        name: 'European S275',
        grade: 'S275',
        category: 'steel',
        E: 210e6,
        fy: 275e3,
        fu: 430e3,
        G: 81e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.0,
        designStrength: 275e3
    },
    'S355': {
        name: 'European S355',
        grade: 'S355',
        category: 'steel',
        E: 210e6,
        fy: 355e3,
        fu: 510e3,
        G: 81e6,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 1.0,
        designStrength: 355e3
    }
};

// ============================================
// CABLE/WIRE MATERIALS
// ============================================

export const CABLE_MATERIALS: Record<string, MaterialProperties> = {
    'STRAND-1770': {
        name: 'High Strength Steel Strand',
        grade: '1770 MPa Strand',
        category: 'cable',
        E: 195e6,           // Cables have slightly lower E
        fy: 1770e3,         // 1770 MPa
        fu: 1860e3,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 2.2
    },
    'STRAND-1860': {
        name: 'Super High Strength Strand',
        grade: '1860 MPa Strand',
        category: 'cable',
        E: 195e6,
        fy: 1860e3,
        fu: 1960e3,
        nu: 0.3,
        density: 7850,
        thermalExpansion: 12e-6,
        partialSafetyFactor: 2.2
    },
    'WIRE-ROPE': {
        name: 'Structural Wire Rope',
        grade: 'Wire Rope',
        category: 'cable',
        E: 100e6,           // Lower E due to strand geometry
        fy: 1200e3,
        fu: 1400e3,
        nu: 0.3,
        density: 6400,      // Lower due to void space
        thermalExpansion: 12e-6,
        partialSafetyFactor: 3.0
    }
};

// ============================================
// CONCRETE MATERIALS (IS 456:2000)
// ============================================

export const CONCRETE_MATERIALS: Record<string, MaterialProperties> = {
    // Indian Standard Concrete Grades
    'M20': {
        name: 'M20 Concrete',
        grade: 'M20',
        category: 'concrete',
        E: 22360e3,         // 5000√fck = 5000√20 = 22360 MPa
        fy: 20e3,           // fck = 20 MPa
        fu: 20e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 13.33e3
    },
    'M25': {
        name: 'M25 Concrete',
        grade: 'M25',
        category: 'concrete',
        E: 25000e3,         // 5000√25 = 25000 MPa
        fy: 25e3,
        fu: 25e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 16.67e3
    },
    'M30': {
        name: 'M30 Concrete',
        grade: 'M30',
        category: 'concrete',
        E: 27386e3,         // 5000√30 = 27386 MPa
        fy: 30e3,
        fu: 30e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 20e3
    },
    'M35': {
        name: 'M35 Concrete',
        grade: 'M35',
        category: 'concrete',
        E: 29580e3,
        fy: 35e3,
        fu: 35e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 23.33e3
    },
    'M40': {
        name: 'M40 Concrete',
        grade: 'M40',
        category: 'concrete',
        E: 31623e3,
        fy: 40e3,
        fu: 40e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 26.67e3
    },
    'M60': {
        name: 'M60 High Strength Concrete',
        grade: 'M60',
        category: 'concrete',
        E: 38730e3,
        fy: 60e3,
        fu: 60e3,
        nu: 0.2,
        density: 2500,
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 40e3
    },
    'M80': {
        name: 'M80 Ultra High Strength',
        grade: 'M80',
        category: 'concrete',
        E: 44721e3,
        fy: 80e3,
        fu: 80e3,
        nu: 0.2,
        density: 2600,      // Slightly higher for HSC
        thermalExpansion: 10e-6,
        partialSafetyFactor: 1.5,
        designStrength: 53.33e3
    }
};

// ============================================
// ALUMINUM MATERIALS
// ============================================

export const ALUMINUM_MATERIALS: Record<string, MaterialProperties> = {
    '6061-T6': {
        name: 'Aluminum 6061-T6',
        grade: '6061-T6',
        category: 'aluminum',
        E: 68.9e6,
        fy: 276e3,
        fu: 310e3,
        G: 26e6,
        nu: 0.33,
        density: 2700,
        thermalExpansion: 23.6e-6,
        partialSafetyFactor: 1.65
    },
    '6063-T5': {
        name: 'Aluminum 6063-T5',
        grade: '6063-T5',
        category: 'aluminum',
        E: 68.9e6,
        fy: 145e3,
        fu: 186e3,
        G: 25.8e6,
        nu: 0.33,
        density: 2700,
        thermalExpansion: 23.6e-6,
        partialSafetyFactor: 1.65
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get material by ID from any category
 */
export function getMaterial(materialId: string): MaterialProperties | null {
    // Check all material databases
    if (STEEL_MATERIALS[materialId]) return STEEL_MATERIALS[materialId];
    if (CABLE_MATERIALS[materialId]) return CABLE_MATERIALS[materialId];
    if (CONCRETE_MATERIALS[materialId]) return CONCRETE_MATERIALS[materialId];
    if (ALUMINUM_MATERIALS[materialId]) return ALUMINUM_MATERIALS[materialId];

    // Default to standard steel if not found
    return STEEL_MATERIALS['Fe250'];
}

/**
 * Get default structural steel
 */
export function getDefaultSteel(): MaterialProperties {
    return STEEL_MATERIALS['E250'];
}

/**
 * Get material for section type
 */
export function getMaterialForSection(sectionId: string): MaterialProperties {
    const upper = sectionId.toUpperCase();

    // Indian/European steel sections
    if (upper.startsWith('ISMB') || upper.startsWith('ISMC') ||
        upper.startsWith('ISA') || upper.startsWith('HE') ||
        upper.startsWith('UB') || upper.startsWith('UC')) {
        return STEEL_MATERIALS['E250'];
    }

    // American sections
    if (upper.startsWith('W') || upper.startsWith('HSS') ||
        upper.startsWith('L') || upper.startsWith('C')) {
        return STEEL_MATERIALS['A992'];
    }

    // Cable sections
    if (upper.includes('CABLE') || upper.includes('STRAND')) {
        return CABLE_MATERIALS['STRAND-1770'];
    }

    // Default
    return STEEL_MATERIALS['E250'];
}

/**
 * Calculate weight per unit length (kN/m)
 */
export function calculateSelfWeight(area: number, density: number): number {
    // weight = A (m²) × ρ (kg/m³) × g (9.81 m/s²) / 1000 = kN/m
    return area * density * 9.81 / 1000;
}

// Export combined database
export const ALL_MATERIALS: Record<string, MaterialProperties> = {
    ...STEEL_MATERIALS,
    ...CABLE_MATERIALS,
    ...CONCRETE_MATERIALS,
    ...ALUMINUM_MATERIALS
};
