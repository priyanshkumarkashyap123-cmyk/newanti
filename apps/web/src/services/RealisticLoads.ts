/**
 * RealisticLoads.ts - Actual Design Loads for Famous Structures
 * 
 * Based on international building codes:
 * - IS 875 (India)
 * - ASCE 7 (USA)
 * - EN 1991 (Europe)
 * - AS/NZS 1170 (Australia/New Zealand)
 */

export interface LoadDefinition {
    deadLoad: {
        floor?: number;      // kN/m² - slab, finishes, ceiling
        facade?: number;     // kN/m² - cladding, glazing
        mechanical?: number; // kN/m² - MEP systems
        deck?: number;       // kN/m² - bridge deck
        ballast?: number;    // kN/m² - railway ballast
        rails?: number;      // kN/m - rail weight
    };
    liveLoad: {
        office?: number;        // kN/m²
        residential?: number;   // kN/m²
        assembly?: number;      // kN/m²
        parking?: number;       // kN/m²
        trainLoad?: string;     // Standard (e.g., 'EUDL-25', 'Cooper E-80')
        intensity?: number;     // kN/m
    };
    windLoad?: {
        basicSpeed: number;     // m/s
        heightFactor?: boolean;
        importance?: number;    // Importance factor
        gustFactor?: number;
    };
    seismic?: {
        zone: string;           // Zone (e.g., 'V', 'IV', '0')
        Z: number;              // Zone factor
        importance?: number;
    };
    temperature?: {
        max: number;            // °C
        min: number;            // °C
    };
}

/**
 * Realistic Design Loads for Famous Structures
 * Based on actual structural design criteria
 */
export const REALISTIC_LOADS: Record<string, LoadDefinition> = {
    // ============================================
    // BURJ KHALIFA - Dubai, UAE
    // ============================================
    'burj-khalifa': {
        deadLoad: {
            floor: 5.0,         // Typical slab (200mm) + finishes
            facade: 2.5,        // Aluminum & glass curtain wall
            mechanical: 3.0     // HVAC, plumbing per floor
        },
        liveLoad: {
            office: 2.5,        // IS 875 Part 2 - Office buildings
            residential: 2.0,   // Residential apartments
            assembly: 5.0       // Observation decks
        },
        windLoad: {
            basicSpeed: 45,     // Dubai basic wind speed (m/s)
            heightFactor: true, // Varies with height (critical!)
            importance: 1.15,   // Category IV - essential facility
            gustFactor: 2.0
        },
        seismic: {
            zone: '0',          // Dubai - very low seismic
            Z: 0.10,            // Minimal seismic consideration
            importance: 1.5
        },
        temperature: {
            max: 50,            // Desert climate
            min: 10
        }
    },

    // ============================================
    // CHENAB BRIDGE - Jammu & Kashmir, India
    // ============================================
    'chenab-bridge': {
        deadLoad: {
            deck: 8.0,          // Concrete deck slab
            ballast: 12.0,      // Railway ballast layer
            rails: 1.2          // 52 kg/m rails (per rail)
        },
        liveLoad: {
            trainLoad: 'EUDL-25',  // European Universal Distributed Load
            intensity: 125      // kN/m per track (double track)
        },
        windLoad: {
            basicSpeed: 47,     // Himalayan wind conditions
            heightFactor: true,
            gustFactor: 2.5,    // Mountain gusts
            importance: 1.2
        },
        seismic: {
            zone: 'V',          // Highest seismic zone (Himalayas)
            Z: 0.36,            // IS 1893 - Zone V
            importance: 1.5     // Critical infrastructure
        },
        temperature: {
            max: 40,            // Summer temperature
            min: -10            // Himalayan winter
        }
    },

    // ============================================
    // BANDRA-WORLI SEA LINK - Mumbai, India
    // ============================================
    'bandra-worli': {
        deadLoad: {
            deck: 10.0,         // Pre-stressed concrete deck
            facade: 0.5         // Railing, lighting
        },
        liveLoad: {
            intensity: 40       // kN/m (highway loading - IRC Class A)
        },
        windLoad: {
            basicSpeed: 50,     // Coastal Mumbai
            importance: 1.15,
            gustFactor: 2.0
        },
        seismic: {
            zone: 'III',        // Mumbai seismic zone
            Z: 0.16,            // IS 1893
            importance: 1.2
        },
        temperature: {
            max: 42,
            min: 15
        }
    },

    // ============================================
    // HOWRAH BRIDGE - Kolkata, India
    // ============================================
    'howrah-bridge': {
        deadLoad: {
            deck: 6.0,          // Steel grid deck
            rails: 0.8          // Tramway rails
        },
        liveLoad: {
            intensity: 35       // kN/m (combined vehicular + pedestrian)
        },
        windLoad: {
            basicSpeed: 44,     // Kolkata wind
            importance: 1.1
        },
        seismic: {
            zone: 'III',
            Z: 0.16
        },
        temperature: {
            max: 45,
            min: 12
        }
    },

    // ============================================
    // GOLDEN GATE BRIDGE - San Francisco, USA
    // ============================================
    'golden-gate': {
        deadLoad: {
            deck: 7.5,          // Concrete-filled steel grid
            facade: 1.5         // Railing, lighting
        },
        liveLoad: {
            intensity: 45       // kN/m (ASCE highway loading)
        },
        windLoad: {
            basicSpeed: 60,     // Bay area strong winds
            heightFactor: true,
            gustFactor: 2.8,
            importance: 1.25
        },
        seismic: {
            zone: 'D2',         // High seismic (San Andreas Fault)
            Z: 0.40,            // ASCE 7
            importance: 1.5
        },
        temperature: {
            max: 30,
            min: 5
        }
    },

    // ============================================
    // COMMON TEMPLATES
    // ============================================
    'signature-bridge': {  // Delhi
        deadLoad: {
            deck: 9.0,
            facade: 1.2
        },
        liveLoad: {
            intensity: 38       // IRC Class A
        },
        windLoad: {
            basicSpeed: 47,
            importance: 1.15
        },
        seismic: {
            zone: 'IV',
            Z: 0.24
        },
        temperature: {
            max: 48,
            min: 4
        }
    },

    'metro-viaduct': {
        deadLoad: {
            deck: 12.0,         // Heavy concrete viaduct
            ballast: 8.0
        },
        liveLoad: {
            trainLoad: 'Metro-Standard',
            intensity: 80       // kN/m (metro train)
        },
        windLoad: {
            basicSpeed: 44,
            importance: 1.2
        },
        seismic: {
            zone: 'IV',
            Z: 0.24,
            importance: 1.5
        },
        temperature: {
            max: 45,
            min: 5
        }
    },

    'warren-truss': {       // Generic railway bridge
        deadLoad: {
            deck: 8.0,
            ballast: 10.0,
            rails: 1.0
        },
        liveLoad: {
            trainLoad: 'Cooper E-80',
            intensity: 100
        },
        windLoad: {
            basicSpeed: 45,
            importance: 1.1
        },
        seismic: {
            zone: 'III',
            Z: 0.16
        },
        temperature: {
            max: 42,
            min: 0
        }
    },

    'stack-interchange': {  // Highway interchange
        deadLoad: {
            deck: 9.0
        },
        liveLoad: {
            intensity: 40       // IRC/AASHTO highway
        },
        windLoad: {
            basicSpeed: 44
        },
        seismic: {
            zone: 'II',
            Z: 0.10
        },
        temperature: {
            max: 48,
            min: -5
        }
    },

    'box-girder': {         // Modern highway bridge
        deadLoad: {
            deck: 11.0          // Prestressed concrete box
        },
        liveLoad: {
            intensity: 42
        },
        windLoad: {
            basicSpeed: 47,
            importance: 1.15
        },
        seismic: {
            zone: 'III',
            Z: 0.16
        },
        temperature: {
            max: 45,
            min: 0
        }
    }
};

/**
 * Get realistic loads for a structure
 */
export function getRealisticLoads(structureId: string): LoadDefinition | undefined {
    return REALISTIC_LOADS[structureId];
}

/**
 * Calculate total dead load for a floor area
 */
export function calculateTotalDeadLoad(loads: LoadDefinition['deadLoad']): number {
    return (loads.floor || 0) + (loads.facade || 0) + (loads.mechanical || 0);
}

/**
 * Apply load factors per building code
 */
export function applyLoadFactors(load: number, loadType: 'dead' | 'live' | 'wind' | 'seismic'): number {
    const factors = {
        dead: 1.2,      // IS 875 / ASCE 7
        live: 1.6,
        wind: 1.6,
        seismic: 1.0    // Already factored
    };
    return load * factors[loadType];
}

export default {
    REALISTIC_LOADS,
    getRealisticLoads,
    calculateTotalDeadLoad,
    applyLoadFactors
};
