/**
 * CivilEngineeringKnowledgeBase.ts
 * 
 * Comprehensive Civil Engineering Knowledge Base for AI Architect
 * Covers: Structural, Geotechnical, Transportation, Hydraulic, Environmental Engineering
 * 
 * This module provides the AI with deep domain expertise to understand and
 * respond to all civil engineering queries with professional-level knowledge.
 */

// ============================================
// STRUCTURAL ENGINEERING KNOWLEDGE
// ============================================

export const STRUCTURAL_ENGINEERING = {
  // Fundamental Mechanics
  mechanics: {
    stressStrain: {
      normalStress: 'σ = P/A (force per unit area)',
      shearStress: 'τ = V/A (parallel force per unit area)',
      bendingStress: 'σ = My/I (fiber stress due to bending)',
      torsionalStress: 'τ = Tr/J (shear stress due to twisting)',
      principalStress: 'σ₁,₂ = (σx+σy)/2 ± √[(σx-σy)/2)² + τxy²]',
      vonMises: 'σvm = √(σ₁² - σ₁σ₂ + σ₂²) for 2D',
      mohrCircle: 'Graphical representation of stress transformation',
    },
    
    deflection: {
      simplySupported: {
        pointLoadCenter: 'δ = PL³/(48EI)',
        udl: 'δ = 5wL⁴/(384EI)',
        pointLoadAny: 'δ = Pa²b²/(3EIL) at load point',
        triangular: 'δ = wL⁴/(120EI)',
      },
      cantilever: {
        pointLoadEnd: 'δ = PL³/(3EI)',
        udl: 'δ = wL⁴/(8EI)',
        pointLoadAny: 'δ = Pa²(3L-a)/(6EI) at free end',
        moment: 'δ = ML²/(2EI)',
      },
      fixedFixed: {
        pointLoadCenter: 'δ = PL³/(192EI)',
        udl: 'δ = wL⁴/(384EI)',
      },
      propped: {
        udl: 'δ = wL⁴/(185EI) approx',
      },
    },
    
    bendingMoments: {
      simplySupported: {
        pointLoadCenter: 'M_max = PL/4',
        udl: 'M_max = wL²/8',
        pointLoadAny: 'M = Pab/L at load point',
      },
      cantilever: {
        pointLoadEnd: 'M_max = PL at support',
        udl: 'M_max = wL²/2 at support',
      },
      fixedFixed: {
        udl: 'M_support = wL²/12, M_midspan = wL²/24',
        pointLoadCenter: 'M_support = PL/8, M_midspan = PL/8',
      },
      continuous: {
        twoEqualSpans: 'M_internal = wL²/8 (negative)',
        threeEqualSpans: 'M_internal = 0.1wL² (negative)',
      },
    },
    
    shearForce: {
      simplySupported: {
        pointLoadCenter: 'V_max = P/2',
        udl: 'V_max = wL/2',
      },
      cantilever: {
        pointLoadEnd: 'V_max = P (constant)',
        udl: 'V_max = wL at support',
      },
    },
    
    buckling: {
      euler: 'Pcr = π²EI/(KL)²',
      effectiveLengthFactors: {
        'fixed-fixed': 0.5,
        'fixed-pinned': 0.7,
        'pinned-pinned': 1.0,
        'fixed-free': 2.0,
        'fixed-guided': 1.0,
      },
      slenderness: 'λ = KL/r where r = √(I/A)',
      criticalStress: 'σcr = π²E/(KL/r)²',
      inelasticBuckling: 'Use tangent modulus Et for σ > 0.5σy',
    },
    
    torsion: {
      circular: 'T = GJθ/L, τ = Tr/J',
      rectangular: 'T = C₁ab³Gθ/L (C₁ from table)',
      openSection: 'J = Σ(bt³/3)',
      warpingTorsion: 'For I-sections: bimoment and warping',
    },
  },

  // Analysis Methods
  analysisMethods: {
    linear: {
      matrixStiffness: 'K·U = F (direct stiffness method)',
      momentDistribution: 'Hardy Cross iterative method',
      slopeDeflection: 'M = 2EI/L(2θA + θB - 3ψ) + FEM',
      forceMethod: 'Compatibility-based, good for indeterminate',
      conjugateBeam: 'Elastic curve geometry method',
      virtualWork: 'δ = ∫(Mm/EI)dx for deflections',
    },
    
    nonlinear: {
      geometric: 'P-Delta, large deformation effects',
      material: 'Plasticity, cracking, yielding',
      pDelta: 'B2 = 1/(1 - ΣPu/ΣPe)',
      arcLength: 'Track post-buckling behavior',
      newtonRaphson: 'Iterative solver for nonlinear',
    },
    
    dynamic: {
      freeVibration: 'mü + ku = 0, ω = √(k/m)',
      damped: 'mü + cú + ku = 0',
      forced: 'mü + cú + ku = F(t)',
      modalAnalysis: 'Eigenvalue: [K - ω²M]φ = 0',
      responseSpectrum: 'Sa vs T for design spectra',
      timeHistory: 'Step-by-step integration (Newmark, Wilson)',
    },
    
    finite_element: {
      elements: ['Truss', 'Beam', 'Frame', 'Plate', 'Shell', 'Solid'],
      shapeFunction: 'N(ξ) for displacement interpolation',
      assembly: 'Global K from element contributions',
      convergence: 'h-refinement, p-refinement',
    },
  },

  // Modeling & Robustness (Strengthening the models)
  modelingAndRobustness: {
    modelingPrinciples: {
      elementSelection: 'Use frame (6-DOF) for beams/columns; truss for axial-only; shell for slabs/walls; solid for thick/complex zones',
      releases: 'Model end releases only where actual hinges exist; avoid over-releasing that creates mechanisms',
      offsets: 'Use rigid offsets for eccentric connections; verify shear center alignment for unsymmetric sections',
      rigidDiaphragm: 'Use master–slave constraints for floors when in-plane stiffness is high',
    },
    loadPathIntegrity: {
      verticalContinuity: 'Ensure columns/walls are continuous; avoid floating columns without transfer design',
      lateralSystem: 'Define a clear lateral force-resisting system (frames, bracing, shear walls, dual)',
      diaphragms: 'Explicitly model diaphragm constraints (rigid/semi-rigid) and collectors',
      torsionControl: 'Place lateral elements to minimize accidental torsion; check eccentricities',
    },
    redundancy: {
      alternatePaths: 'Provide alternate load paths; avoid single-point dependencies',
      memberDuplication: 'Use multiple braces/frames to reduce single-element failure risk',
      balancedStiffness: 'Balance stiffness in orthogonal directions to avoid soft/weak stories',
    },
    robustnessChecks: {
      stabilityIndex: 'θ = PΔ / Vh < 0.1 (ASCE 7) for drift amplification; otherwise use 2nd-order',
      pDelta: 'Include P-Delta for slender frames or drift > H/400; iterate to convergence',
      notionalLoads: 'Apply 0.002·ΣP per story for direct analysis (AISC 360, IS 800 guidance)',
      uplift: 'Check uplift at supports under wind/seismic; anchor or add dead load',
    },
    serviceability: {
      drift: 'Story drift limits: 0.004h (wind), 0.002–0.003h (seismic per code)',
      deflection: 'L/250–L/360 typical; stricter for brittle finishes',
      vibration: 'For floors, fn > 8–10 Hz (office) or > 3 Hz (residential) to avoid perceptible vibration',
      crackControl: 'For RC, check bar spacing/cover; for steel, limit tension to service stresses',
    },
    seismicDetailing: {
      capacityDesign: 'Design beams to yield before columns (strong-column/weak-beam); protect brittle components',
      confinement: 'Provide hoop/tie spacing per ductility class; ensure joint shear capacity',
      development: 'Check bar development, lap lengths outside plastic hinges',
      panelZones: 'Model and verify panel zone shear in moment frames',
    },
    progressiveCollapse: {
      removalCheck: 'Check alternate load path after removal of a key column (GSA/DoD guidance)',
      tieForces: 'Provide peripheral and internal ties in RC/steel frames',
      bridging: 'Use transfer beams/slabs sized for abnormal loads with rotation capacity',
    },
    QAQC: {
      zeroLength: 'Scan for zero-length/duplicate nodes; merge within tolerance',
      connectivity: 'Ensure every node is connected and supported; no free bodies unless intended',
      boundaryConditions: 'Review supports/restraints for over/under-constraint',
      materialSections: 'Verify material/section references exist and units are consistent',
      loadSanity: 'Check load magnitudes/directions; confirm self-weight on/off as intended',
      meshQuality: 'For shells/solids, keep aspect ratio < 5 and avoid warped/quadrilateral distortion',
    },
  },

  // Structural Systems
  structuralSystems: {
    frames: {
      portalFrame: {
        description: 'Single-story rigid frame for industrial buildings',
        typicalSpan: '12-60m',
        aspectRatio: 'height/span = 0.3-0.5',
        connections: 'Moment-resisting at eaves and base',
        applications: ['warehouses', 'factories', 'aircraft hangars'],
      },
      momentFrame: {
        description: 'Multi-story frame with moment connections',
        types: ['OMRF (R=3)', 'IMRF (R=4)', 'SMRF (R=5-8)'],
        heightLimit: '25 stories (SMRF), 15 stories (OMRF)',
        drift: 'Typically controls design',
      },
      bracedFrame: {
        description: 'Lateral resistance through diagonal bracing',
        types: ['X-bracing', 'V-bracing', 'Chevron', 'K-bracing'],
        advantages: 'Efficient for lateral loads',
        heightLimit: '40+ stories',
      },
      dualSystem: {
        description: 'Combination of moment frame and bracing/walls',
        requirement: 'Frame resists 25% of lateral load',
        heightLimit: '50+ stories',
      },
    },
    
    trusses: {
      pratt: {
        pattern: 'Verticals in compression, diagonals in tension',
        bestFor: 'Steel structures, gravity loads',
        efficiency: 'High for uniform loads',
      },
      howe: {
        pattern: 'Verticals in tension, diagonals in compression',
        bestFor: 'Timber structures',
        note: 'Opposite of Pratt',
      },
      warren: {
        pattern: 'No verticals, equilateral triangles',
        bestFor: 'Bridges, long spans',
        efficiency: 'Very efficient material use',
      },
      kTruss: {
        pattern: 'K-shaped web members',
        bestFor: 'Very long spans',
        advantage: 'Reduced buckling length',
      },
      vierendeel: {
        pattern: 'Rectangular panels, moment connections',
        bestFor: 'Architectural applications',
        note: 'Actually a frame, not true truss',
      },
      bowstring: {
        pattern: 'Curved top chord, straight bottom',
        bestFor: 'Tied arch effect',
      },
    },
    
    arches: {
      parabolic: {
        ideal: 'Uniform horizontal load (cable inverted)',
        equation: 'y = 4f(x/L)(1 - x/L)',
        thrust: 'H = wL²/(8f)',
      },
      circular: {
        common: 'Masonry arches',
        analysis: 'Three-hinged determinate',
      },
      catenary: {
        ideal: 'Self-weight only',
        equation: 'y = a·cosh(x/a)',
      },
      tiedArch: {
        advantage: 'No horizontal thrust on supports',
        applications: ['Bridges', 'roofs'],
      },
    },
    
    shells: {
      cylindrical: 'Long span roofs, hangars',
      spherical: 'Domes, tanks',
      hyperbolicParaboloid: 'Saddle shape, architectural',
      conical: 'Hoppers, tanks',
      foldedPlate: 'Multiple planes for stiffness',
    },
    
    foundations: {
      shallow: {
        isolated: 'Single column footings',
        combined: 'Multiple columns on one footing',
        strip: 'Continuous under wall',
        mat: 'Entire building footprint',
      },
      deep: {
        driven: 'Displacement piles',
        bored: 'Replacement piles (CFA, etc.)',
        caisson: 'Hand-dug or drilled shafts',
        micropile: 'Small diameter, high capacity',
      },
    },
  },

  // Design Codes
  designCodes: {
    steel: {
      IS800: {
        year: 2007,
        method: 'Limit State Design',
        gamma_m0: 1.10,
        gamma_m1: 1.25,
        deflectionLimits: {
          grav: 'L/300',
          total: 'L/250',
          cantilever: 'L/150',
        },
        steelGrades: ['E250 (fy=250)', 'E300', 'E350', 'E410', 'E450'],
      },
      AISC360: {
        year: 2022,
        method: 'LRFD and ASD',
        phi_b: 0.9,
        phi_c: 0.9,
        phi_v: 0.9,
        phi_t: 0.9,
        deflectionLimits: {
          floor: 'L/360',
          roof: 'L/240',
        },
      },
      Eurocode3: {
        method: 'Limit State',
        gamma_M0: 1.0,
        gamma_M1: 1.0,
        gamma_M2: 1.25,
      },
    },
    
    concrete: {
      IS456: {
        year: 2000,
        method: 'Limit State Design',
        gamma_c: 1.5,
        gamma_s: 1.15,
        concreteGrades: ['M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'],
        coverRequirements: {
          mild: '20-25mm',
          moderate: '30-45mm',
          severe: '45-50mm',
          extreme: '75mm',
        },
      },
      ACI318: {
        year: 2019,
        phi_flexure: 0.9,
        phi_shear: 0.75,
        phi_compression: 0.65,
      },
      Eurocode2: {
        gamma_c: 1.5,
        gamma_s: 1.15,
      },
    },
    
    seismic: {
      IS1893: {
        year: 2016,
        zones: {
          II: { Z: 0.10, description: 'Low seismicity' },
          III: { Z: 0.16, description: 'Moderate' },
          IV: { Z: 0.24, description: 'Severe' },
          V: { Z: 0.36, description: 'Very severe' },
        },
        responseFactors: {
          OMRF: 3.0,
          SMRF: 5.0,
          SCBF: 4.0,
          OCBF: 3.5,
        },
        baseShear: 'VB = (Z/2)(I/R)(Sa/g)W',
        driftLimit: 'h/250 for masonry, h/400 for frame',
      },
      ASCE7: {
        year: 2022,
        riskCategories: ['I', 'II', 'III', 'IV'],
        sdcCategories: ['A', 'B', 'C', 'D', 'E', 'F'],
      },
    },
    
    loads: {
      IS875: {
        part1: 'Dead loads',
        part2: 'Imposed loads',
        part3: 'Wind loads',
        part4: 'Snow loads',
        part5: 'Special loads',
        combinations: [
          '1.5 DL + 1.5 LL',
          '1.2 DL + 1.2 LL + 1.2 WL',
          '1.5 DL + 1.5 WL',
          '0.9 DL + 1.5 WL (uplift)',
          '1.2 DL + 1.2 LL + 1.2 EQ',
          '1.5 DL + 1.5 EQ',
          '0.9 DL + 1.5 EQ',
        ],
      },
      ASCE7: {
        lrfdCombinations: [
          '1.4D',
          '1.2D + 1.6L + 0.5Lr',
          '1.2D + 1.6Lr + L',
          '1.2D + 1.0W + L + 0.5Lr',
          '1.2D + 1.0E + L',
          '0.9D + 1.0W',
          '0.9D + 1.0E',
        ],
      },
    },
  },

  // Standard Sections (IS/AISC/European)
  sections: {
    indianStandard: {
      ISMB: {
        100: { d: 100, bf: 75, tw: 4.0, tf: 7.2, A: 11.5, Ix: 257, weight: 9.0 },
        150: { d: 150, bf: 80, tw: 4.8, tf: 7.6, A: 16.1, Ix: 726, weight: 12.6 },
        200: { d: 200, bf: 100, tw: 5.7, tf: 10.8, A: 32.3, Ix: 2235, weight: 25.4 },
        250: { d: 250, bf: 125, tw: 6.1, tf: 12.5, A: 47.5, Ix: 5132, weight: 37.3 },
        300: { d: 300, bf: 140, tw: 7.5, tf: 13.1, A: 58.7, Ix: 8603, weight: 46.1 },
        350: { d: 350, bf: 140, tw: 8.1, tf: 14.2, A: 66.7, Ix: 13630, weight: 52.4 },
        400: { d: 400, bf: 140, tw: 8.9, tf: 16.0, A: 78.5, Ix: 20458, weight: 61.6 },
        450: { d: 450, bf: 150, tw: 9.4, tf: 17.4, A: 92.3, Ix: 30390, weight: 72.4 },
        500: { d: 500, bf: 180, tw: 10.2, tf: 17.2, A: 110.7, Ix: 45218, weight: 86.9 },
        550: { d: 550, bf: 190, tw: 11.2, tf: 19.3, A: 132.1, Ix: 64893, weight: 103.7 },
        600: { d: 600, bf: 210, tw: 12.0, tf: 20.8, A: 156.2, Ix: 91800, weight: 122.6 },
      },
      ISHB: {
        150: { d: 150, bf: 150, tw: 5.4, tf: 9.0, A: 34.5, Ix: 1456, weight: 27.1 },
        200: { d: 200, bf: 200, tw: 6.1, tf: 9.0, A: 47.5, Ix: 3608, weight: 37.3 },
        225: { d: 225, bf: 225, tw: 6.5, tf: 9.1, A: 54.9, Ix: 5279, weight: 43.1 },
        250: { d: 250, bf: 250, tw: 6.9, tf: 9.7, A: 65.0, Ix: 7737, weight: 51.0 },
        300: { d: 300, bf: 250, tw: 7.6, tf: 10.6, A: 75.8, Ix: 12545, weight: 59.5 },
        350: { d: 350, bf: 250, tw: 8.3, tf: 11.6, A: 87.5, Ix: 19158, weight: 68.7 },
        400: { d: 400, bf: 250, tw: 9.1, tf: 12.7, A: 100.9, Ix: 28083, weight: 79.2 },
        450: { d: 450, bf: 250, tw: 9.8, tf: 13.7, A: 114.0, Ix: 39210, weight: 89.5 },
      },
      ISMC: {
        75: { d: 75, bf: 40, tw: 4.4, tf: 7.3, A: 8.7, Ix: 76, weight: 6.8 },
        100: { d: 100, bf: 50, tw: 5.0, tf: 7.7, A: 11.7, Ix: 187, weight: 9.2 },
        125: { d: 125, bf: 65, tw: 5.3, tf: 8.2, A: 16.2, Ix: 416, weight: 12.7 },
        150: { d: 150, bf: 75, tw: 5.7, tf: 9.0, A: 21.0, Ix: 779, weight: 16.5 },
        200: { d: 200, bf: 75, tw: 6.1, tf: 11.4, A: 28.2, Ix: 1819, weight: 22.1 },
        250: { d: 250, bf: 80, tw: 7.1, tf: 14.1, A: 39.0, Ix: 3817, weight: 30.6 },
        300: { d: 300, bf: 90, tw: 7.8, tf: 13.6, A: 46.3, Ix: 6420, weight: 36.3 },
      },
      ISA: {
        '50x50x5': { legs: [50, 50], t: 5, A: 4.8, Ix: 11.0, weight: 3.8 },
        '65x65x6': { legs: [65, 65], t: 6, A: 7.4, Ix: 26.0, weight: 5.8 },
        '75x75x8': { legs: [75, 75], t: 8, A: 11.4, Ix: 50.0, weight: 8.9 },
        '90x90x10': { legs: [90, 90], t: 10, A: 17.0, Ix: 107, weight: 13.4 },
        '100x100x10': { legs: [100, 100], t: 10, A: 19.0, Ix: 148, weight: 14.9 },
        '150x150x12': { legs: [150, 150], t: 12, A: 34.5, Ix: 566, weight: 27.1 },
      },
    },
  },
};

// ============================================
// GEOTECHNICAL ENGINEERING KNOWLEDGE
// ============================================

export const GEOTECHNICAL_ENGINEERING = {
  soilMechanics: {
    classification: {
      unified: 'USCS - GW, GP, GM, GC, SW, SP, SM, SC, ML, CL, MH, CH, OL, OH, Pt',
      indian: 'IS 1498 - Similar to USCS',
      aashto: 'A-1 to A-7 classification',
      grainSize: {
        gravel: '>4.75mm',
        sand: '0.075-4.75mm',
        silt: '0.002-0.075mm',
        clay: '<0.002mm',
      },
    },
    
    properties: {
      voidRatio: 'e = Vv/Vs',
      porosity: 'n = Vv/V = e/(1+e)',
      waterContent: 'w = Ww/Ws × 100%',
      saturation: 'S = Vw/Vv × 100%',
      specificGravity: 'Gs = γs/γw (typically 2.65-2.75)',
      unitWeight: {
        bulk: 'γ = W/V',
        dry: 'γd = Ws/V',
        saturated: 'γsat = (Gs + e)γw/(1+e)',
        submerged: 'γ\' = γsat - γw',
      },
      relativeDensity: 'Dr = (emax - e)/(emax - emin)',
      consistencyLimits: {
        liquidLimit: 'wL = water content at 25 blows',
        plasticLimit: 'wP = water content at crumbling',
        plasticityIndex: 'IP = wL - wP',
        liquidityIndex: 'IL = (w - wP)/IP',
      },
    },
    
    permeability: {
      darcy: 'v = ki, Q = kiA',
      typicalValues: {
        gravel: '1-100 cm/s',
        sand: '10⁻⁴ to 1 cm/s',
        silt: '10⁻⁷ to 10⁻⁴ cm/s',
        clay: '<10⁻⁷ cm/s',
      },
      seepage: {
        flowNet: 'q = kHNf/Nd',
        quickCondition: 'ic = (Gs-1)/(1+e) ≈ 1.0',
      },
    },
    
    compaction: {
      proctor: {
        standard: '600 kJ/m³ energy',
        modified: '2700 kJ/m³ energy',
        optimumMoisture: 'OMC at maximum dry density',
      },
      fieldControl: {
        sandCone: 'Field density measurement',
        nucleardensity: 'Quick field testing',
        relativeCompaction: 'RC = γd_field/γd_max × 100%',
      },
    },
  },
  
  bearingCapacity: {
    terzaghi: {
      stripFooting: 'qu = cNc + qNq + 0.5γBNγ',
      squareFooting: 'qu = 1.3cNc + qNq + 0.4γBNγ',
      circularFooting: 'qu = 1.3cNc + qNq + 0.3γBNγ',
      factors: {
        Nc: '(Nq-1)cot(φ)',
        Nq: 'tan²(45+φ/2)exp(πtanφ)',
        Nγ: '2(Nq+1)tanφ',
      },
    },
    
    meyerhof: {
      general: 'Includes shape, depth, and inclination factors',
      shapeFactors: 'sc, sq, sγ',
      depthFactors: 'dc, dq, dγ',
      inclinationFactors: 'ic, iq, iγ',
    },
    
    IS6403: {
      year: 1981,
      safeBC: 'qa = qu/FOS (FOS = 2.5-3.0)',
      settlement: 'Check both shear and settlement criteria',
    },
    
    plateBearing: {
      sandCorrection: 'qf/qp = Bf/Bp',
      clayNoCorrection: 'qu same for all sizes',
      settlementCorrection: 'Sf = Sp[(Bf(Bp+0.3))/(Bp(Bf+0.3))]²',
    },
  },
  
  earthPressure: {
    atRest: {
      coefficient: 'K0 = 1 - sinφ (NC soil)',
      pressure: 'p = K0γz',
      OCsoil: 'K0_OC = K0_NC × √OCR',
    },
    
    rankine: {
      active: 'Ka = tan²(45° - φ/2) = (1-sinφ)/(1+sinφ)',
      passive: 'Kp = tan²(45° + φ/2) = (1+sinφ)/(1-sinφ)',
      pressureActive: 'pa = Kaγz - 2c√Ka',
      pressurePassive: 'pp = Kpγz + 2c√Kp',
    },
    
    coulomb: {
      includesWallFriction: 'δ = wall-soil friction angle',
      activeFormula: 'Complex with wall slope and backfill slope',
      passiveFormula: 'Use with caution (unconservative)',
    },
    
    retainingWalls: {
      types: ['Gravity', 'Cantilever', 'Counterfort', 'Buttress', 'MSE', 'Sheet pile'],
      stability: {
        sliding: 'FOS_sliding = μΣV/ΣH ≥ 1.5',
        overturning: 'FOS_OT = ΣMR/ΣMO ≥ 2.0',
        bearingCapacity: 'Check eccentricity and BC',
      },
    },
  },
  
  settlement: {
    immediate: {
      elastic: 'Si = qBIρ(1-ν²)/E',
      influenceFactors: 'Iρ from charts (Steinbrenner)',
    },
    
    consolidation: {
      primary: {
        normallyConsolidated: 'Sc = CcH/(1+e0) × log[(σ0+Δσ)/σ0]',
        overConsolidated: 'Use Cs for recompression, Cc after σp',
        compressionIndex: 'Cc = 0.009(wL - 10) approx',
        recompressionIndex: 'Cs = Cc/5 to Cc/10',
      },
      timeRate: {
        terzaghi: 'Tv = cv×t/H²',
        cv: 'Coefficient of consolidation',
        U50: 'Tv = 0.197 for 50% consolidation',
        U90: 'Tv = 0.848 for 90% consolidation',
      },
    },
    
    secondary: {
      creep: 'Ss = CαH × log(t2/t1)',
      Cα: 'Secondary compression index ≈ 0.04Cc',
    },
    
    limits: {
      total: '25-50mm for isolated footings',
      differential: 'δ/L ≤ 1/300 to 1/500',
      angular: '1/150 for damage to panels',
    },
  },
  
  slopStability: {
    infiniteSlope: {
      drySlope: 'FOS = tanφ/tanβ',
      submergedSlope: 'FOS = (γ\'/γsat) × (tanφ/tanβ)',
      seepageParallel: 'FOS = (γ\'/γsat) × (tanφ/tanβ)',
    },
    
    circularSlip: {
      swedishMethod: 'FOS = ΣMR/ΣMD = Σ(c×L + Wcosα×tanφ)/(ΣWsinα)',
      bishop: 'Simplified Bishop (iterative)',
      janbu: 'Non-circular slip surfaces',
    },
    
    targetFOS: {
      temporary: 1.25,
      permanent: 1.50,
      dams: 1.50,
      earthquakeAdded: 1.10,
    },
  },
  
  pileFoundations: {
    bearingCapacity: {
      static: 'Qu = Qp + Qs = qpAp + ΣfsAs',
      tipResistance: {
        sand: 'qp = σv\'Nq (Nq from Berezantsev)',
        clay: 'qp = 9cu',
      },
      skinFriction: {
        sand: 'fs = Kσv\'tanδ',
        clay: 'fs = αcu (α-method) or fs = βσv\' (β-method)',
      },
    },
    
    dynamicFormulae: {
      hiley: 'Ru = ηWH/(S + C/2)',
      ENR: 'Qu = WH/(S+2.54) (factor of 6 for allowable)',
    },
    
    settlement: {
      elastic: 'From Vesic or Poulos charts',
      groupAction: 'Consider equivalent footing',
      negFriction: 'Downdrag in consolidating soils',
    },
    
    lateralCapacity: {
      brom: 'For restrained and free-head piles',
      pY_curves: 'API or Reese methods',
      groupEffects: 'Reduce capacity for closely spaced',
    },
  },
};

// ============================================
// TRANSPORTATION ENGINEERING KNOWLEDGE
// ============================================

export const TRANSPORTATION_ENGINEERING = {
  highwayGeometrics: {
    horizontalAlignment: {
      simpleCircular: 'R = V²/(127e + f)',
      superelevation: 'e_max = 0.07 (rural), 0.04 (urban)',
      friction: 'f = 0.15 at high speeds to 0.40 at low',
      sightDistance: {
        stopping: 'SSD = 0.278Vt + V²/(254f±g)',
        passing: 'PSD for two-lane roads',
        decision: 'For complex situations',
      },
      transitionCurves: {
        spiralLength: 'Ls = V³/(46.5CR)',
        clothoid: 'RL = A² (spiral constant)',
      },
    },
    
    verticalAlignment: {
      grades: {
        max: '7% mountain, 4-5% rolling, 3% flat',
        min: '0.3% for drainage',
      },
      verticalCurves: {
        crest: 'L = KA where K = V²/(2(h1+h2))',
        sag: 'L = KA based on headlight distance',
        minimumLength: 'L ≥ 0.6V',
      },
    },
    
    crossSection: {
      laneWidth: '3.5m standard, 3.75m expressway',
      shoulder: '2.5m paved, 1.5m earthen',
      camber: '2-2.5% for bituminous, 3-4% for earthen',
      carriageway: 'Based on LOS and design year traffic',
    },
  },
  
  pavementDesign: {
    flexible: {
      IRC37: {
        method: 'Mechanistic-empirical approach',
        inputs: 'Traffic (msa), Subgrade CBR, Climate',
        layers: ['Surface course', 'Binder course', 'Base', 'Sub-base', 'Subgrade'],
        stresses: 'Tensile at bottom of bituminous, Compressive on subgrade',
      },
      cbr: {
        soakedCBR: 'For subgrade evaluation',
        designCBR: '90th percentile value',
        correlation: 'MR (psi) = 1500 × CBR',
      },
      esal: 'Equivalent Single Axle Load conversions',
    },
    
    rigid: {
      IRC58: {
        method: 'Fatigue and erosion criteria',
        stresses: {
          warping: 'From temperature differential',
          load: 'From wheel loads (edge, corner, interior)',
          combined: 'Critical at edge during night',
        },
        slab: {
          thickness: '150-350mm typical',
          joints: ['Contraction', 'Expansion', 'Construction', 'Longitudinal'],
          dowels: 'Load transfer at transverse joints',
          tieBars: 'Hold adjacent lanes together',
        },
      },
      westergaard: {
        interior: 'σi = 0.316P/h² × (4log10(l/b) + 1.069)',
        edge: 'σe = 0.572P/h² × (4log10(l/b) + 0.359)',
        corner: 'σc = 3P/h² × [1-(a√2/l)^0.6]',
        radiusRelativeStiffness: 'l = [Eh³/(12k(1-ν²))]^0.25',
      },
    },
  },
  
  trafficEngineering: {
    flowCharacteristics: {
      fundamental: 'q = k × v (flow = density × speed)',
      greenshields: 'v = vf(1 - k/kj)',
      capacity: 'qmax = vf × kj / 4',
      pcuFactors: {
        car: 1.0,
        bus: 3.0,
        truck: 3.5,
        twowheeler: 0.5,
        autorickshaw: 1.0,
        cycle: 0.5,
      },
    },
    
    intersectionDesign: {
      signalized: {
        webstersCycle: 'C0 = (1.5L + 5)/(1 - Y)',
        greenTime: 'g = (y/Y)(C - L)',
        saturationFlow: 's = 1900 PCU/hr/lane (urban)',
        levelOfService: 'Based on control delay',
      },
      unsignalized: {
        gapAcceptance: 'Critical gap and follow-up time',
        priority: 'Major and minor street flows',
      },
      roundabout: {
        circulatingFlow: 'Circulating flow vs Entry Capacity relationship',
        geometry: 'ICD, entry width, inscribed circle',
      },
    },
    
    capacity: {
      HCM: {
        basicSegment: '2400 PCU/hr/lane ideal',
        weaving: 'Reduced based on weave length',
        ramps: 'Merge and diverge analysis',
        intersections: 'Signal timing optimization',
      },
    },
  },
};

// ============================================
// HYDRAULIC ENGINEERING KNOWLEDGE
// ============================================

export const HYDRAULIC_ENGINEERING = {
  fluidMechanics: {
    continuity: 'A₁V₁ = A₂V₂ (incompressible)',
    bernoulli: 'p/ρg + V²/2g + z = constant',
    energyEquation: 'H₁ + hp = H₂ + hf + hm',
    momentum: 'ΣF = ρQ(V₂ - V₁)',
  },
  
  pipeFlow: {
    headLoss: {
      darcyWeisbach: 'hf = f(L/D)(V²/2g)',
      hazenWilliams: 'V = 0.849CR^0.63S^0.54',
      manning: 'V = (1/n)R^(2/3)S^(1/2)',
      frictionFactor: {
        laminar: 'f = 64/Re',
        turbulentSmooth: 'Blasius: f = 0.316/Re^0.25',
        turbulentRough: 'Colebrook-White equation',
        moodyChart: 'f vs Re for different ε/D',
      },
    },
    
    minorLosses: {
      general: 'hm = K(V²/2g)',
      entrance: 'K = 0.5 (sharp), 0.04 (bell-mouth)',
      exit: 'K = 1.0',
      bend: 'K = 0.1-1.0 depending on angle',
      valve: 'K varies with valve type and opening',
    },
    
    networks: {
      hardyCross: 'Iterative flow correction method',
      nodalMethod: 'Solve for heads at nodes',
      equivalentPipes: 'Series and parallel combinations',
    },
  },
  
  openChannelFlow: {
    classification: {
      steady: 'No change with time',
      uniform: 'No change with distance',
      gradually: 'Gradual depth changes',
      rapidly: 'Rapid depth changes (jumps)',
    },
    
    uniformFlow: {
      manningEquation: 'Q = (1/n)AR^(2/3)S^(1/2)',
      chezyChezy: 'V = C√(RS)',
      normalDepth: 'Depth for given Q and S',
      manningsN: {
        concrete: '0.013-0.015',
        earth: '0.020-0.030',
        gravel: '0.025-0.035',
        natural: '0.030-0.070',
      },
    },
    
    specificEnergy: {
      E: 'E = y + V²/2g = y + Q²/(2gA²)',
      critical: 'Ec = 1.5yc (rectangular)',
      froude: 'Fr = V/√(gD) where D = A/T',
      subcritical: 'Fr < 1, y > yc',
      supercritical: 'Fr > 1, y < yc',
    },
    
    hydraulicJump: {
      sequentDepth: 'y₂/y₁ = 0.5(√(1 + 8Fr₁²) - 1)',
      energyLoss: 'ΔE = (y₂ - y₁)³/(4y₁y₂)',
      length: 'Lj ≈ 6y₂',
    },
    
    graduallyVariedFlow: {
      equation: 'dy/dx = (S₀ - Sf)/(1 - Fr²)',
      profiles: ['M1', 'M2', 'M3', 'S1', 'S2', 'S3', 'C1', 'C3', 'H2', 'H3', 'A2', 'A3'],
      computation: 'Standard step or direct step method',
    },
  },
  
  hydrology: {
    precipitation: {
      thiessen: 'Weighted average by polygon area',
      isohyetal: 'Area between isohyets × avg depth',
      arithmetic: 'Simple average of station data',
      IDF: 'Intensity-Duration-Frequency curves',
    },
    
    runoff: {
      rationalMethod: 'Q = CIA/360 (Q in m³/s)',
      coefficientC: {
        urban: '0.70-0.95',
        suburban: '0.50-0.70',
        rural: '0.30-0.50',
        forest: '0.10-0.30',
      },
      SCS_CN: {
        equation: 'Q = (P - 0.2S)²/(P + 0.8S)',
        S: 'S = 25400/CN - 254',
        CNtables: 'Based on land use and soil type',
      },
    },
    
    unitHydrograph: {
      definition: 'Runoff from 1cm excess rainfall over unit time',
      Shydrograph: 'Cumulative response',
      synthetic: {
        snyder: 'tp = Ct(L×Lc)^0.3',
        SCS: 'Triangular approximation',
        clark: 'Time-area method',
      },
    },
    
    floodRouting: {
      muskingum: 'S = K[xI + (1-x)O]',
      muskingumCunge: 'Physically based parameters',
      reservoir: 'Storage indication method',
    },
  },
  
  irrigation: {
    waterRequirements: {
      consumptiveUse: 'ET = Kc × ET₀',
      cropCoefficient: 'Kc varies with growth stage',
      dutyDelta: 'D = 8.64B/Δ (hectares/cumec)',
    },
    
    canals: {
      laceyRegime: {
        velocity: 'V = 10.8R^(2/3)S^(1/3)',
        perimeter: 'P = 4.75√Q',
        siltFactor: 'f = 1.76√d',
      },
      kennedyTheory: {
        criticalVelocity: 'V₀ = 0.55D^0.64',
        CVR: 'm = V/V₀ (0.7-1.3)',
      },
    },
  },
};

// ============================================
// ENVIRONMENTAL ENGINEERING KNOWLEDGE
// ============================================

export const ENVIRONMENTAL_ENGINEERING = {
  waterTreatment: {
    stages: [
      'Screening',
      'Aeration',
      'Coagulation/Flocculation',
      'Sedimentation',
      'Filtration',
      'Disinfection',
    ],
    
    coagulation: {
      chemicals: ['Alum', 'Ferric chloride', 'Ferric sulfate', 'PAC'],
      jarTest: 'Optimum dose determination',
      zeta: 'Surface potential of particles',
    },
    
    sedimentation: {
      overflowRate: 'SOR = Q/A (typically 20-40 m³/m²/day)',
      detention: 't = V/Q (2-4 hours)',
      stokes: 'vs = gd²(ρs-ρ)/(18μ)',
      tubeSettlers: 'Increase effective area',
    },
    
    filtration: {
      types: ['Slow sand', 'Rapid gravity', 'Pressure', 'Dual media'],
      rates: {
        slowSand: '0.1-0.4 m/hr',
        rapidGravity: '4-12 m/hr',
      },
      backwash: 'Expansion 20-50%',
    },
    
    disinfection: {
      chlorine: 'Ct value for inactivation',
      breakpoint: 'Complete oxidation of ammonia',
      residual: '0.2 mg/L minimum in distribution',
      alternatives: ['UV', 'Ozone', 'Chloramine'],
    },
  },
  
  wastewaterTreatment: {
    stages: {
      preliminary: ['Screening', 'Grit removal', 'Flow equalization'],
      primary: ['Sedimentation', 'Skimming'],
      secondary: ['Biological treatment', 'Secondary clarification'],
      tertiary: ['Nutrient removal', 'Filtration', 'Disinfection'],
    },
    
    activated_sludge: {
      equation: 'dX/dt = YrX - kdX',
      F_M: 'F/M = QS₀/(VX) (0.2-0.6 typical)',
      SRT: 'θc = VX/(QwXr + QeXe)',
      MLSS: '2000-4000 mg/L typical',
      SVI: 'Sludge Volume Index (good < 100)',
    },
    
    trickling_filter: {
      BOD_removal: 'Eckenfelder or NRC formula',
      hydraulicLoading: '10-40 m³/m²/day',
      organicLoading: '0.3-1.0 kg BOD/m³/day',
    },
    
    anaerobic: {
      stages: ['Hydrolysis', 'Acidogenesis', 'Methanogenesis'],
      UASB: 'Upflow Anaerobic Sludge Blanket',
      biogas: '0.35 m³ CH₄ per kg COD removed',
    },
    
    sludgeHandling: {
      thickening: 'Gravity or DAF',
      digestion: 'Aerobic or anaerobic',
      dewatering: ['Belt press', 'Centrifuge', 'Filter press'],
      disposal: ['Land application', 'Landfill', 'Incineration'],
    },
  },
  
  airPollution: {
    pollutants: {
      criteria: ['PM', 'SO₂', 'NO₂', 'CO', 'O₃', 'Pb'],
      standards: 'NAAQS (National Ambient Air Quality Standards)',
    },
    
    dispersion: {
      gaussian: 'C = Q/(2πσyσzu)exp(-y²/2σy²)exp(-(z-H)²/2σz²)',
      stabilityClasses: ['A (unstable)', 'B', 'C', 'D (neutral)', 'E', 'F (stable)'],
      stackHeight: 'H = h + Δh (plume rise)',
    },
    
    control: {
      particulate: ['Cyclone', 'ESP', 'Bag filter', 'Scrubber'],
      gases: ['Absorption', 'Adsorption', 'Incineration', 'SCR'],
    },
  },
  
  solidWaste: {
    characterization: {
      composition: ['Organic', 'Paper', 'Plastic', 'Glass', 'Metal'],
      properties: ['Moisture', 'Density', 'Calorific value'],
    },
    
    collection: {
      hauled: 'Container emptied at site',
      stationary: 'Container left at site',
      frequency: 'Daily to weekly depending on area',
    },
    
    disposal: {
      landfill: {
        components: ['Liner', 'Leachate collection', 'Gas collection', 'Cover'],
        leachate: 'Collect and treat or recirculate',
        gas: 'LFG recovery for energy',
      },
      incineration: 'Mass burn or RDF',
      composting: 'Aerobic decomposition of organics',
    },
  },
};

// ============================================
// CONSTRUCTION & PROJECT MANAGEMENT
// ============================================

export const CONSTRUCTION_MANAGEMENT = {
  scheduling: {
    CPM: {
      activities: 'Define scope and sequence',
      duration: 'PERT: te = (a + 4m + b)/6',
      criticalPath: 'Longest path, zero float',
      float: {
        total: 'TF = LS - ES = LF - EF',
        free: 'FF = ESj - EFi (for successor j)',
      },
      crashing: 'Cost-time tradeoff',
    },
    
    PERT: {
      mean: 'te = (a + 4m + b)/6',
      variance: 'σ² = [(b-a)/6]²',
      probability: 'Z = (Ts - Te)/σpath',
    },
    
    LOB: 'Line of Balance for repetitive work',
    gantt: 'Bar chart visualization',
  },
  
  costEstimation: {
    types: {
      preliminary: '±30% accuracy',
      detailed: '±10-15% accuracy',
      definitive: '±5% accuracy',
    },
    
    methods: {
      unitCost: 'Cost per unit area/volume',
      itemRate: 'Detailed quantity × rate',
      costIndex: 'Historical data with escalation',
    },
    
    components: ['Direct costs', 'Indirect costs', 'Contingency', 'Profit'],
  },
  
  contracts: {
    types: {
      lumpSum: 'Fixed price for defined scope',
      itemRate: 'Payment per measured quantity',
      costPlus: 'Actual cost + fee',
      BOT: 'Build-Operate-Transfer',
      EPC: 'Engineering-Procurement-Construction',
    },
    
    procurement: {
      ICB: 'International Competitive Bidding',
      NCB: 'National Competitive Bidding',
      shopping: 'Limited competition',
      directPurchase: 'Single source',
    },
  },
  
  qualityControl: {
    concrete: {
      cubeTest: '150mm cubes at 7 and 28 days',
      acceptance: 'Characteristic strength criteria',
      NDT: ['Rebound hammer', 'UPV', 'Core test'],
    },
    
    steel: {
      tensile: 'fy, fu, elongation',
      bend: 'Bendability without cracking',
      UTM: 'Universal Testing Machine',
    },
    
    soil: {
      compaction: 'Field density tests',
      CBR: 'California Bearing Ratio',
      proctor: 'OMC and MDD',
    },
  },
};

// ============================================
// NATURAL LANGUAGE PATTERNS FOR INTERPRETATION
// ============================================

export const NLP_PATTERNS = {
  // Structural intent patterns
  structural: {
    create: [
      /(?:create|design|make|build|generate|model|draw|construct)\s+(?:a|an|the)?\s*(.+?)(?:\s+(?:for|with|having|of|that))?/i,
      /i\s+(?:want|need|would like)\s+(?:a|an|to)\s+(.+)/i,
      /can\s+you\s+(?:create|make|build|design|help me with)\s+(?:a|an)?\s*(.+)/i,
      /let'?s?\s+(?:create|build|design|make)\s+(?:a|an)?\s*(.+)/i,
    ],
    analyze: [
      /(?:analyze|analyse|check|verify|calculate|compute|run|solve)\s+(?:the)?\s*(.+)/i,
      /what\s+(?:is|are)\s+the\s+(.+?)\s+(?:of|for|in)/i,
      /find\s+(?:the)?\s*(.+)/i,
      /determine\s+(?:the)?\s*(.+)/i,
    ],
    explain: [
      /(?:explain|describe|what is|what are|tell me about|how does|why)\s+(.+)/i,
      /i\s+don'?t\s+understand\s+(.+)/i,
      /can\s+you\s+explain\s+(.+)/i,
    ],
    optimize: [
      /(?:optimize|improve|minimize|maximize|reduce|increase)\s+(?:the)?\s*(.+)/i,
      /make\s+(?:it|the structure|the design)\s+(?:more)?\s*(.+)/i,
    ],
    modify: [
      /(?:change|modify|update|edit|adjust|increase|decrease|add|remove)\s+(?:the)?\s*(.+)/i,
      /make\s+(?:the)?\s*(.+?)\s+(?:larger|smaller|taller|shorter|wider|narrower)/i,
    ],
  },

  // Dimension extraction
  dimensions: {
    span: [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)?\s*(?:span|length|long|wide|width)/i,
      /span\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)?/i,
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)\s+(?:long|wide)/i,
    ],
    height: [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)?\s*(?:height|tall|high)/i,
      /height\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)?/i,
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)\s+(?:tall|high)/i,
    ],
    count: [
      /(\d+)\s*(?:stor(?:y|ies|ey)|floor|level)s?/i,
      /(\d+)\s*(?:bay|span|panel)s?/i,
      /(\d+)\s*(?:column|beam|member)s?/i,
    ],
    area: [
      /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|m²|sqm|square\s*(?:meter|metre))/i,
      /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|ft²|sqft|square\s*feet)/i,
    ],
    load: [
      /(\d+(?:\.\d+)?)\s*(?:kN|kn|KN)(?:\/m²?|per\s*(?:sq\.?\s*)?m(?:eter|etre)?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:kg|KG)(?:\/m²?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:ton(?:ne)?|t)s?/i,
    ],
  },

  // Structure type patterns
  structureTypes: {
    building: [
      /(?:multi[- ]?stor(?:y|ey)|high[- ]?rise|low[- ]?rise)\s*(?:building|structure|frame)?/i,
      /(?:residential|commercial|office|industrial)\s*building/i,
      /(?:\d+)[- ]?stor(?:y|ey)\s*(?:building|structure|frame)?/i,
    ],
    bridge: [
      /(?:truss|arch|cable[- ]?stayed|suspension|girder|box\s*girder)\s*bridge/i,
      /(?:pedestrian|road|railway|highway)\s*bridge/i,
      /bridge\s*(?:over|across|spanning)/i,
    ],
    industrial: [
      /(?:industrial|factory|warehouse|shed|godown)\s*(?:building|structure)?/i,
      /(?:portal|gable)\s*frame/i,
      /pre[- ]?engineered\s*(?:building|structure)/i,
    ],
    foundation: [
      /(?:isolated|combined|strip|raft|mat|pile)\s*foundation/i,
      /(?:shallow|deep)\s*foundation/i,
      /footing/i,
    ],
    tank: [
      /(?:water|overhead|underground|elevated)\s*tank/i,
      /(?:storage|reservoir)\s*(?:tank)?/i,
      /intze\s*tank/i,
    ],
  },

  // Material patterns
  materials: {
    steel: [/steel|structural\s*steel|mild\s*steel|high\s*strength\s*steel/i],
    concrete: [/concrete|rcc|rc|reinforced|prestressed|pcc/i],
    timber: [/timber|wood|wooden|lumber/i],
    masonry: [/masonry|brick|block|stone/i],
    composite: [/composite|steel[- ]?concrete/i],
  },

  // Support condition patterns
  supports: {
    fixed: [/fixed|encastre|built[- ]?in|rigid/i],
    pinned: [/pinned|hinged|pin/i],
    roller: [/roller|sliding|free\s*horizontal/i],
    spring: [/spring|elastic/i],
  },

  // Load patterns
  loads: {
    dead: [/dead\s*load|self[- ]?weight|permanent|DL/i],
    live: [/live\s*load|imposed|occupancy|LL/i],
    wind: [/wind\s*load|WL|lateral\s*wind/i],
    seismic: [/seismic|earthquake|EQ|EL/i],
    snow: [/snow\s*load|SL/i],
    crane: [/crane\s*load|EOT|gantry/i],
  },

  // Analysis type patterns
  analysis: {
    static: [/static|linear|first[- ]?order/i],
    modal: [/modal|eigen|natural\s*frequency|vibration/i],
    dynamic: [/dynamic|time[- ]?history|transient/i],
    pdelta: [/p[- ]?delta|second[- ]?order|geometric/i],
    buckling: [/buckling|stability|critical\s*load/i],
    seismic: [/seismic|earthquake|response\s*spectrum/i],
  },

  // Design code patterns
  codes: {
    IS800: [/is\s*800|indian\s*(?:standard|code).*steel/i],
    IS456: [/is\s*456|indian\s*(?:standard|code).*concrete/i],
    IS1893: [/is\s*1893|indian\s*(?:standard|code).*seismic/i],
    IS875: [/is\s*875|indian\s*(?:standard|code).*load/i],
    AISC: [/aisc|american.*steel/i],
    ACI: [/aci|american.*concrete/i],
    Eurocode: [/eurocode|ec\s*[0-9]|en\s*199[0-9]/i],
  },

  // Common questions/requests
  commonQueries: {
    sectionSelection: [
      /what\s+(?:section|size|member)\s+(?:should|do)\s+i\s+(?:use|need)/i,
      /recommend\s+(?:a|the)?\s*(?:section|size|member)/i,
      /suitable\s+(?:section|size|member)/i,
    ],
    codeCheck: [
      /(?:is|does)\s+(?:it|this|the)\s+(?:safe|adequate|pass|comply)/i,
      /check\s+(?:against|per|as per)\s+(?:code|standard)/i,
      /design\s+check/i,
    ],
    deflection: [
      /(?:what|how much)\s+(?:is|will be)\s+(?:the)?\s*deflection/i,
      /deflection\s+(?:check|limit|ok)/i,
    ],
    stress: [
      /(?:what|how much)\s+(?:is|are)\s+(?:the)?\s*(?:stress|stresses)/i,
      /stress\s+(?:check|ratio|utilization)/i,
    ],
  },

  // Informal/conversational patterns
  conversational: {
    greeting: [/^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening))/i],
    thanks: [/^(?:thanks|thank\s*you|appreciated)/i],
    help: [/^(?:help|can\s*you\s*help|i\s*need\s*help)/i],
    unclear: [/^(?:what|huh|i\s*don'?t\s*understand|sorry\s*what)/i],
    affirmative: [/^(?:yes|yeah|yep|sure|ok|okay|alright|go\s*ahead)/i],
    negative: [/^(?:no|nope|nah|cancel|stop|never\s*mind)/i],
  },
};

// ============================================
// UNIT CONVERSIONS
// ============================================

export const UNIT_CONVERSIONS = {
  length: {
    m_to_ft: 3.28084,
    m_to_in: 39.3701,
    m_to_mm: 1000,
    ft_to_m: 0.3048,
    in_to_m: 0.0254,
    mm_to_m: 0.001,
  },
  area: {
    m2_to_ft2: 10.7639,
    m2_to_in2: 1550.0031,
    ft2_to_m2: 0.092903,
  },
  force: {
    N_to_kN: 0.001,
    N_to_lb: 0.224809,
    kN_to_N: 1000,
    kN_to_kip: 0.224809,
    kip_to_kN: 4.44822,
    lb_to_N: 4.44822,
  },
  stress: {
    Pa_to_MPa: 1e-6,
    MPa_to_Pa: 1e6,
    MPa_to_ksi: 0.145038,
    ksi_to_MPa: 6.89476,
    Pa_to_psi: 0.000145038,
    psi_to_Pa: 6894.76,
  },
  moment: {
    Nm_to_kNm: 0.001,
    kNm_to_Nm: 1000,
    kNm_to_kipft: 0.737562,
    kipft_to_kNm: 1.35582,
  },
};

// ============================================
// FORMULA LIBRARY
// ============================================

export const FORMULA_LIBRARY = {
  structural: {
    bendingStress: { formula: 'σ = My/I', variables: { M: 'Moment', y: 'Distance from NA', I: 'Moment of inertia' } },
    shearStress: { formula: 'τ = VQ/Ib', variables: { V: 'Shear force', Q: 'First moment', I: 'Inertia', b: 'Width' } },
    deflection_SS_UDL: { formula: 'δ = 5wL⁴/384EI', variables: { w: 'Load intensity', L: 'Span', E: 'Modulus', I: 'Inertia' } },
    eulerBuckling: { formula: 'Pcr = π²EI/(KL)²', variables: { E: 'Modulus', I: 'Inertia', K: 'Effective length factor', L: 'Length' } },
  },
  geotechnical: {
    bearingCapacity: { formula: 'qu = cNc + qNq + 0.5γBNγ', variables: { c: 'Cohesion', q: 'Surcharge', γ: 'Unit weight', B: 'Width' } },
    consolidation: { formula: 'Sc = CcH/(1+e₀)·log[(σ₀+Δσ)/σ₀]', variables: { Cc: 'Compression index', H: 'Layer thickness', e0: 'Initial void ratio' } },
  },
  hydraulic: {
    manning: { formula: 'Q = (1/n)AR^(2/3)S^(1/2)', variables: { n: 'Manning coefficient', A: 'Area', R: 'Hydraulic radius', S: 'Slope' } },
    bernoulli: { formula: 'p/ρg + V²/2g + z = constant', variables: { p: 'Pressure', ρ: 'Density', V: 'Velocity', z: 'Elevation' } },
  },
};

// Export combined knowledge base
export const CIVIL_ENGINEERING_KNOWLEDGE = {
  structural: STRUCTURAL_ENGINEERING,
  geotechnical: GEOTECHNICAL_ENGINEERING,
  transportation: TRANSPORTATION_ENGINEERING,
  hydraulic: HYDRAULIC_ENGINEERING,
  environmental: ENVIRONMENTAL_ENGINEERING,
  construction: CONSTRUCTION_MANAGEMENT,
  patterns: NLP_PATTERNS,
  conversions: UNIT_CONVERSIONS,
  formulas: FORMULA_LIBRARY,
};

export default CIVIL_ENGINEERING_KNOWLEDGE;
