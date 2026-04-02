"""Shared design code constants (generated). Do not edit manually."""
DESIGN_CODES = {
  "is_456": {
    "meta": {
      "id": "is_456",
      "name": "IS 456:2000",
      "edition": "2000",
      "units": "SI",
      "source": "Bureau of Indian Standards",
      "clauses": {
        "partial_safety": "Cl. 36.4.2"
      }
    },
    "partialSafety": {
      "concrete": 1.5,
      "steel": 1.15
    }
  },
  "is_800": {
    "meta": {
      "id": "is_800",
      "name": "IS 800:2007",
      "edition": "2007",
      "units": "SI",
      "source": "Bureau of Indian Standards",
      "clauses": {
        "partial_safety": "Table 5"
      }
    },
    "partialSafety": {
      "gamma_m0": 1.1,
      "gamma_m1": 1.25,
      "gamma_mb": 1.25
    }
  },
  "is_1893": {
    "meta": {
      "id": "is_1893",
      "name": "IS 1893:2016",
      "edition": "2016",
      "units": "SI",
      "source": "Bureau of Indian Standards",
      "clauses": {
        "zone_factors": "Table 3",
        "importance": "Table 8"
      }
    },
    "partialSafety": {},
    "windSeismic": {
      "zone_factors": {
        "II": 0.1,
        "III": 0.16,
        "IV": 0.24,
        "V": 0.36
      },
      "importance_factors": {
        "residential": 1.0,
        "commercial": 1.0,
        "essential": 1.5,
        "hazardous": 1.5
      }
    }
  },
  "is_875": {
    "meta": {
      "id": "is_875",
      "name": "IS 875 (Part 3):2015",
      "edition": "2015",
      "units": "SI",
      "source": "Bureau of Indian Standards",
      "clauses": {
        "importance": "Cl. 6.3"
      }
    },
    "partialSafety": {},
    "windSeismic": {
      "importance_factors": {
        "general": 1.0,
        "cyclonic": 1.15
      }
    }
  },
  "aci_318": {
    "meta": {
      "id": "aci_318",
      "name": "ACI 318-19",
      "edition": "2019",
      "units": "Imperial",
      "source": "ACI",
      "clauses": {
        "phi": "21.2"
      }
    },
    "partialSafety": {
      "phi_flexure": 0.9,
      "phi_shear": 0.75,
      "phi_axial": 0.65
    }
  },
  "aisc_360": {
    "meta": {
      "id": "aisc_360",
      "name": "AISC 360-22",
      "edition": "2022",
      "units": "Imperial",
      "source": "AISC",
      "clauses": {
        "resistance_factors": "Table 1-1"
      }
    },
    "partialSafety": {
      "gamma_m0": 1.1,
      "gamma_m1": 1.25
    }
  },
  "eurocode_2": {
    "meta": {
      "id": "eurocode_2",
      "name": "Eurocode 2 (EN 1992-1-1)",
      "edition": "2004",
      "units": "SI",
      "source": "CEN",
      "clauses": {
        "partial_safety": "Table 2.1N"
      }
    },
    "partialSafety": {
      "concrete": 1.5,
      "steel": 1.15
    }
  },
  "eurocode_3": {
    "meta": {
      "id": "eurocode_3",
      "name": "Eurocode 3 (EN 1993-1-1)",
      "edition": "2005",
      "units": "SI",
      "source": "CEN",
      "clauses": {
        "partial_safety": "Table 2.1"
      }
    },
    "partialSafety": {
      "gamma_m0": 1.0,
      "gamma_m1": 1.1,
      "gamma_mb": 1.25
    }
  }
}
