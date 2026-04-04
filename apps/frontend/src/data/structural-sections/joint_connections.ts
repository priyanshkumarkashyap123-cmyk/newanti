export type ConnectionType = 
  | 'bolted_shear'      // Shear-only connection (simple)
  | 'bolted_moment'     // Moment-resisting connection (rigid)
  | 'welded_full'       // Full penetration butt weld
  | 'welded_fillet'     // Fillet welds
  | 'pinned'            // True pin connection (rotation free)
  | 'cable_socket'      // Cable anchorage socket
  | 'base_plate'        // Column base plate connection
  | 'splice'            // Member splice connection
  | 'gusset_plate';     // Gusset plate connection for bracing

export type BoltGrade = 
  | '4.6'     // 240 MPa yield, 400 MPa ultimate
  | '8.8'     // 640 MPa yield, 800 MPa ultimate  
  | '10.9'    // 900 MPa yield, 1000 MPa ultimate (HSFG)
  | '12.9'    // 1080 MPa yield, 1200 MPa ultimate
  | 'A325'    // ASTM equivalent to 8.8
  | 'A490';   // ASTM equivalent to 10.9

export type WeldType = 
  | 'CJP'     // Complete Joint Penetration (full strength)
  | 'PJP'     // Partial Joint Penetration
  | 'fillet'  // Fillet weld
  | 'plug'    // Plug or slot weld
  | 'flare';  // Flare groove weld

export interface JointConnection {
  id: string;
  name: string;
  type: ConnectionType;
  
  // Bolt specifications
  bolt?: {
    grade: BoltGrade;
    diameter: number;      // mm
    numBolts: number;
    rows: number;
    columns: number;
    pitch: number;         // mm (vertical spacing)
    gauge: number;         // mm (horizontal spacing)
    edgeDistance: number;  // mm (from bolt to edge)
    shearCapacity: number; // kN per bolt
    tensionCapacity: number; // kN per bolt
  };
  
  // Weld specifications  
  weld?: {
    type: WeldType;
    size: number;          // mm (throat or leg size)
    length: number;        // mm (total weld length)
    electrode: string;     // E70XX, E80XX, etc.
    strengthMPa: number;   // weld metal strength
    capacity: number;      // kN/mm of weld
  };
  
  // Plate specifications
  plate?: {
    thickness: number;     // mm
    width: number;         // mm
    length: number;        // mm
    grade: string;         // S355, S460, etc.
  };
  
  // Connection capacity
  capacity: {
    shear: number;         // kN
    moment?: number;       // kNm (for moment connections)
    axial?: number;        // kN (for tension/compression)
  };
  
  // Standards reference
  standard: string;
}

// ============================================
// CHENAB BRIDGE CONNECTION DETAILS
// ============================================
// Based on actual construction: HSFG bolts, site welding, golden joint

const CHENAB_BRIDGE_CONNECTIONS: Record<string, JointConnection> = {
  // Golden Joint - Critical connection at arch crown
  // This is the final closing joint where arch halves meet
  GOLDEN_JOINT: {
    id: 'GOLDEN_JOINT',
    name: 'Golden Joint - Arch Crown Closure',
    type: 'bolted_moment',
    bolt: {
      grade: '10.9',
      diameter: 36,        // M36 HSFG bolts
      numBolts: 96,        // Heavy bolting for critical joint
      rows: 12,
      columns: 8,
      pitch: 100,
      gauge: 120,
      edgeDistance: 54,
      shearCapacity: 339,  // kN per bolt (friction grip)
      tensionCapacity: 458,
    },
    plate: {
      thickness: 50,       // 50mm splice plates
      width: 1000,
      length: 1400,
      grade: 'S460ML',
    },
    capacity: {
      shear: 32544,        // 96 × 339 kN
      moment: 45670,       // kNm
      axial: 44000,        // kN compression
    },
    standard: 'IRS/IS 800:2007, Clause 10.4',
  },

  // Arch segment splice - connecting prefab arch segments
  ARCH_SEGMENT_SPLICE: {
    id: 'ARCH_SEGMENT_SPLICE',
    name: 'Arch Segment Splice Connection',
    type: 'splice',
    bolt: {
      grade: '10.9',
      diameter: 30,
      numBolts: 64,
      rows: 8,
      columns: 8,
      pitch: 90,
      gauge: 100,
      edgeDistance: 45,
      shearCapacity: 235,
      tensionCapacity: 318,
    },
    weld: {
      type: 'CJP',
      size: 50,
      length: 12000,       // Full perimeter of box
      electrode: 'E7018-1H',
      strengthMPa: 490,
      capacity: 0.6,       // kN/mm
    },
    capacity: {
      shear: 15040,
      moment: 28500,
      axial: 35000,
    },
    standard: 'IS 800:2007, Eurocode 3',
  },

  // Hanger cable anchorage
  HANGER_SOCKET: {
    id: 'HANGER_SOCKET',
    name: 'Hanger Cable Socket Anchorage',
    type: 'cable_socket',
    bolt: {
      grade: '12.9',
      diameter: 24,
      numBolts: 8,
      rows: 2,
      columns: 4,
      pitch: 80,
      gauge: 80,
      edgeDistance: 36,
      shearCapacity: 176,
      tensionCapacity: 238,
    },
    plate: {
      thickness: 40,
      width: 400,
      length: 400,
      grade: 'S460',
    },
    capacity: {
      shear: 1408,
      axial: 2500,         // Cable breaking strength ~4000kN
    },
    standard: 'EN 1993-1-11 (Cable structures)',
  },

  // Deck girder to cross-beam connection
  DECK_GIRDER_CONNECTION: {
    id: 'DECK_GIRDER_CONNECTION',
    name: 'Deck Girder to Cross-Beam',
    type: 'bolted_shear',
    bolt: {
      grade: '8.8',
      diameter: 24,
      numBolts: 12,
      rows: 6,
      columns: 2,
      pitch: 75,
      gauge: 140,
      edgeDistance: 36,
      shearCapacity: 136,
      tensionCapacity: 184,
    },
    plate: {
      thickness: 16,
      width: 300,
      length: 500,
      grade: 'S355JR',
    },
    capacity: {
      shear: 1632,
    },
    standard: 'IS 800:2007, Clause 10.3',
  },

  // Arch K-brace gusset plate connection
  KBRACE_GUSSET: {
    id: 'KBRACE_GUSSET',
    name: 'K-Brace Gusset Plate Connection',
    type: 'gusset_plate',
    bolt: {
      grade: '10.9',
      diameter: 27,
      numBolts: 16,
      rows: 4,
      columns: 4,
      pitch: 85,
      gauge: 85,
      edgeDistance: 40,
      shearCapacity: 197,
      tensionCapacity: 266,
    },
    plate: {
      thickness: 25,
      width: 600,
      length: 800,
      grade: 'S355JR',
    },
    capacity: {
      shear: 3152,
      axial: 4256,
    },
    standard: 'IS 800:2007, AISC 360-16',
  },

  // Viaduct pier base plate
  PIER_BASE_PLATE: {
    id: 'PIER_BASE_PLATE',
    name: 'Viaduct Pier Base Plate',
    type: 'base_plate',
    bolt: {
      grade: '8.8',
      diameter: 42,        // Large anchor bolts
      numBolts: 24,
      rows: 6,
      columns: 4,
      pitch: 300,
      gauge: 400,
      edgeDistance: 100,
      shearCapacity: 358,
      tensionCapacity: 485,
    },
    plate: {
      thickness: 60,
      width: 2000,
      length: 2800,
      grade: 'S355J2',
    },
    capacity: {
      shear: 8592,
      moment: 12500,
      axial: 45000,
    },
    standard: 'IS 800:2007, Clause 10.4.4',
  },
};

// ============================================
// BURJ KHALIFA CONNECTION DETAILS
// ============================================
// Based on actual construction: Mega-connections, outrigger ties

const BURJ_KHALIFA_CONNECTIONS: Record<string, JointConnection> = {
  // Outrigger wall to perimeter column connection
  OUTRIGGER_CONNECTION: {
    id: 'OUTRIGGER_CONNECTION',
    name: 'Outrigger Wall to Mega Column',
    type: 'welded_full',
    weld: {
      type: 'CJP',
      size: 40,
      length: 8000,        // Full depth of outrigger
      electrode: 'E7018-1H',
      strengthMPa: 490,
      capacity: 0.6,
    },
    plate: {
      thickness: 60,
      width: 1500,
      length: 3000,
      grade: 'S460',
    },
    capacity: {
      shear: 12000,
      moment: 85000,       // Critical for lateral system
      axial: 25000,
    },
    standard: 'ACI 318, AWS D1.1',
  },

  // Belt truss connection at mechanical floors
  BELT_TRUSS_CONNECTION: {
    id: 'BELT_TRUSS_CONNECTION',
    name: 'Belt Truss to Core Wall',
    type: 'bolted_moment',
    bolt: {
      grade: 'A490',
      diameter: 36,
      numBolts: 48,
      rows: 8,
      columns: 6,
      pitch: 100,
      gauge: 120,
      edgeDistance: 54,
      shearCapacity: 339,
      tensionCapacity: 458,
    },
    weld: {
      type: 'CJP',
      size: 30,
      length: 4800,
      electrode: 'E80XX',
      strengthMPa: 550,
      capacity: 0.65,
    },
    capacity: {
      shear: 16272,
      moment: 42000,
    },
    standard: 'AISC 360-16, AWS D1.1',
  },

  // Floor beam to core wall connection
  FLOOR_BEAM_SHEAR: {
    id: 'FLOOR_BEAM_SHEAR',
    name: 'Floor Beam Shear Tab Connection',
    type: 'bolted_shear',
    bolt: {
      grade: '8.8',
      diameter: 20,
      numBolts: 6,
      rows: 3,
      columns: 2,
      pitch: 75,
      gauge: 120,
      edgeDistance: 30,
      shearCapacity: 94,
      tensionCapacity: 127,
    },
    plate: {
      thickness: 12,
      width: 150,
      length: 280,
      grade: 'S355JR',
    },
    capacity: {
      shear: 564,
    },
    standard: 'AISC 360-16, Table 10-1',
  },

  // Mega column splice (every 3 floors)
  MEGA_COLUMN_SPLICE: {
    id: 'MEGA_COLUMN_SPLICE',
    name: 'Mega Column Splice Connection',
    type: 'splice',
    bolt: {
      grade: 'A490',
      diameter: 30,
      numBolts: 80,
      rows: 10,
      columns: 8,
      pitch: 90,
      gauge: 100,
      edgeDistance: 45,
      shearCapacity: 235,
      tensionCapacity: 318,
    },
    weld: {
      type: 'CJP',
      size: 60,
      length: 9000,
      electrode: 'E80XX',
      strengthMPa: 550,
      capacity: 0.65,
    },
    capacity: {
      shear: 18800,
      moment: 65000,
      axial: 120000,       // Massive compression from above
    },
    standard: 'AISC 360-16, AWS D1.1',
  },

  // Base plate for perimeter columns
  PERIMETER_BASE: {
    id: 'PERIMETER_BASE',
    name: 'Perimeter Column Base Plate',
    type: 'base_plate',
    bolt: {
      grade: 'A490',
      diameter: 48,
      numBolts: 16,
      rows: 4,
      columns: 4,
      pitch: 250,
      gauge: 250,
      edgeDistance: 80,
      shearCapacity: 440,
      tensionCapacity: 595,
    },
    plate: {
      thickness: 80,
      width: 1200,
      length: 1200,
      grade: 'S460',
    },
    capacity: {
      shear: 7040,
      moment: 8500,
      axial: 55000,
    },
    standard: 'AISC 360-16, Base Plate Design',
  },
};

// ============================================
// GOLDEN GATE BRIDGE CONNECTION DETAILS
// ============================================

const GOLDEN_GATE_CONNECTIONS: Record<string, JointConnection> = {
  // Main cable saddle connection at tower top
  CABLE_SADDLE: {
    id: 'CABLE_SADDLE',
    name: 'Main Cable Saddle at Tower',
    type: 'cable_socket',
    bolt: {
      grade: 'A490',
      diameter: 76,        // Very large bolts
      numBolts: 32,
      rows: 4,
      columns: 8,
      pitch: 200,
      gauge: 250,
      edgeDistance: 100,
      shearCapacity: 1100,
      tensionCapacity: 1490,
    },
    plate: {
      thickness: 100,
      width: 2200,
      length: 2000,
      grade: 'S460',
    },
    capacity: {
      shear: 35200,
      axial: 250000,       // Main cable force
    },
    standard: 'AASHTO LRFD Bridge Design',
  },

  // Suspender cable socket
  SUSPENDER_SOCKET: {
    id: 'SUSPENDER_SOCKET',
    name: 'Suspender Cable Socket',
    type: 'cable_socket',
    bolt: {
      grade: '10.9',
      diameter: 24,
      numBolts: 4,
      rows: 2,
      columns: 2,
      pitch: 80,
      gauge: 80,
      edgeDistance: 36,
      shearCapacity: 176,
      tensionCapacity: 238,
    },
    plate: {
      thickness: 25,
      width: 250,
      length: 250,
      grade: 'S355',
    },
    capacity: {
      shear: 704,
      axial: 950,
    },
    standard: 'EN 1993-1-11',
  },

  // Stiffening truss panel point
  TRUSS_PANEL_POINT: {
    id: 'TRUSS_PANEL_POINT',
    name: 'Stiffening Truss Panel Point',
    type: 'gusset_plate',
    bolt: {
      grade: 'A325',
      diameter: 27,
      numBolts: 24,
      rows: 4,
      columns: 6,
      pitch: 85,
      gauge: 85,
      edgeDistance: 40,
      shearCapacity: 197,
      tensionCapacity: 266,
    },
    plate: {
      thickness: 20,
      width: 800,
      length: 1000,
      grade: 'S355',
    },
    capacity: {
      shear: 4728,
      axial: 6384,
    },
    standard: 'AASHTO LRFD, AISC 360-16',
  },
};

// Export connection databases
export const JOINT_CONNECTIONS: Record<string, JointConnection> = {
  ...CHENAB_BRIDGE_CONNECTIONS,
  ...BURJ_KHALIFA_CONNECTIONS,
  ...GOLDEN_GATE_CONNECTIONS,
};

// Helper functions for connections
export function getConnection(connectionId: string): JointConnection | undefined {
  return JOINT_CONNECTIONS[connectionId];
}

export function getChenabBridgeConnections(): Record<string, JointConnection> {
  return CHENAB_BRIDGE_CONNECTIONS;
}

export function getBurjKhalifaConnections(): Record<string, JointConnection> {
  return BURJ_KHALIFA_CONNECTIONS;
}

export function getGoldenGateConnections(): Record<string, JointConnection> {
  return GOLDEN_GATE_CONNECTIONS;
}

// ============================================
