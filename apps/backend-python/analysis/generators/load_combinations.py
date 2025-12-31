"""
load_combinations.py - Load Combinations Generator

Implements load combinations per various design codes:
- ASCE 7-22 (LRFD and ASD)
- IS 456 / IS 1893 (Limit State Method)
- ACI 318-19
- User-defined combinations

Supports both predefined code-based combinations and custom user combinations.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
import json


# ============================================
# ENUMERATIONS
# ============================================

class DesignCode(Enum):
    """Supported design codes"""
    ASCE7_LRFD = "ASCE7_LRFD"
    ASCE7_ASD = "ASCE7_ASD"
    IS456_LSM = "IS456_LSM"
    IS456_WSM = "IS456_WSM"
    ACI318 = "ACI318"
    AISC360_LRFD = "AISC360_LRFD"
    AISC360_ASD = "AISC360_ASD"
    USER_DEFINED = "USER"


class LoadType(Enum):
    """Standard load types"""
    D = "D"      # Dead load
    L = "L"      # Live load
    Lr = "Lr"    # Roof live load
    S = "S"      # Snow load
    R = "R"      # Rain load
    W = "W"      # Wind load
    E = "E"      # Earthquake load
    Wx = "Wx"    # Wind +X
    Wy = "Wy"    # Wind +Y
    Ex = "Ex"    # Earthquake +X
    Ey = "Ey"    # Earthquake +Y
    T = "T"      # Temperature
    H = "H"      # Lateral earth pressure
    F = "F"      # Fluid pressure
    
    # User can define additional load types
    UDL1 = "UDL1"
    UDL2 = "UDL2"
    UDL3 = "UDL3"


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class LoadFactor:
    """Load factor for a specific load type"""
    load_type: str  # Load type name (D, L, E, etc.)
    factor: float   # Load factor value


@dataclass
class LoadCombination:
    """A single load combination"""
    id: str                         # Unique identifier
    name: str                       # Display name
    code: str                       # Design code reference
    factors: List[LoadFactor]       # Load factors
    description: str = ""           # Optional description
    is_active: bool = True          # Include in analysis
    is_user_defined: bool = False   # User-created combination
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "factors": [{"type": f.load_type, "factor": f.factor} for f in self.factors],
            "description": self.description,
            "is_active": self.is_active,
            "is_user_defined": self.is_user_defined
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'LoadCombination':
        """Create from dictionary"""
        factors = [LoadFactor(f["type"], f["factor"]) for f in data.get("factors", [])]
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            code=data.get("code", "USER"),
            factors=factors,
            description=data.get("description", ""),
            is_active=data.get("is_active", True),
            is_user_defined=data.get("is_user_defined", False)
        )
    
    def get_factor(self, load_type: str) -> float:
        """Get factor for a specific load type"""
        for f in self.factors:
            if f.load_type == load_type:
                return f.factor
        return 0.0
    
    def format_expression(self) -> str:
        """Get human-readable expression"""
        terms = []
        for f in self.factors:
            if f.factor == 0:
                continue
            elif f.factor == 1.0:
                terms.append(f.load_type)
            elif f.factor == -1.0:
                terms.append(f"-{f.load_type}")
            else:
                terms.append(f"{f.factor}{f.load_type}")
        return " + ".join(terms) if terms else "0"


@dataclass
class CombinationResult:
    """Result of combining loads"""
    combination_id: str
    combination_name: str
    nodal_loads: Dict[str, Dict[str, float]]  # node_id -> {fx, fy, fz, mx, my, mz}
    member_loads: Dict[str, Dict]             # member_id -> distributed loads
    total_reactions: Dict[str, float]         # Support reactions


# ============================================
# PREDEFINED COMBINATIONS
# ============================================

def get_asce7_lrfd_combinations() -> List[LoadCombination]:
    """
    ASCE 7-22 LRFD Load Combinations (Section 2.3.1)
    
    1. 1.4D
    2. 1.2D + 1.6L + 0.5(Lr or S or R)
    3. 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
    4. 1.2D + 1.0W + L + 0.5(Lr or S or R)
    5. 1.2D + 1.0E + L + 0.2S
    6. 0.9D + 1.0W
    7. 0.9D + 1.0E
    """
    combinations = [
        LoadCombination(
            id="ASCE7_LRFD_1",
            name="1.4D",
            code="ASCE7_LRFD",
            factors=[LoadFactor("D", 1.4)],
            description="Dead load only"
        ),
        LoadCombination(
            id="ASCE7_LRFD_2",
            name="1.2D + 1.6L + 0.5Lr",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.6),
                LoadFactor("Lr", 0.5)
            ],
            description="Dead + Live + Roof Live"
        ),
        LoadCombination(
            id="ASCE7_LRFD_2S",
            name="1.2D + 1.6L + 0.5S",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.6),
                LoadFactor("S", 0.5)
            ],
            description="Dead + Live + Snow"
        ),
        LoadCombination(
            id="ASCE7_LRFD_3a",
            name="1.2D + 1.6Lr + L",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("Lr", 1.6),
                LoadFactor("L", 1.0)
            ]
        ),
        LoadCombination(
            id="ASCE7_LRFD_3b",
            name="1.2D + 1.6S + L",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("S", 1.6),
                LoadFactor("L", 1.0)
            ]
        ),
        LoadCombination(
            id="ASCE7_LRFD_3c",
            name="1.2D + 1.6Lr + 0.5W",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("Lr", 1.6),
                LoadFactor("W", 0.5)
            ]
        ),
        LoadCombination(
            id="ASCE7_LRFD_4",
            name="1.2D + 1.0W + L + 0.5Lr",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("W", 1.0),
                LoadFactor("L", 1.0),
                LoadFactor("Lr", 0.5)
            ],
            description="Dead + Wind + Live + Roof Live"
        ),
        LoadCombination(
            id="ASCE7_LRFD_4S",
            name="1.2D + 1.0W + L + 0.5S",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("W", 1.0),
                LoadFactor("L", 1.0),
                LoadFactor("S", 0.5)
            ]
        ),
        LoadCombination(
            id="ASCE7_LRFD_5",
            name="1.2D + 1.0E + L + 0.2S",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("E", 1.0),
                LoadFactor("L", 1.0),
                LoadFactor("S", 0.2)
            ],
            description="Dead + Earthquake + Live + Snow"
        ),
        LoadCombination(
            id="ASCE7_LRFD_6",
            name="0.9D + 1.0W",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("W", 1.0)
            ],
            description="Minimum dead + Wind (uplift)"
        ),
        LoadCombination(
            id="ASCE7_LRFD_7",
            name="0.9D + 1.0E",
            code="ASCE7_LRFD",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("E", 1.0)
            ],
            description="Minimum dead + Earthquake"
        ),
    ]
    
    return combinations


def get_asce7_asd_combinations() -> List[LoadCombination]:
    """
    ASCE 7-22 ASD Load Combinations (Section 2.4.1)
    """
    combinations = [
        LoadCombination(
            id="ASCE7_ASD_1",
            name="D",
            code="ASCE7_ASD",
            factors=[LoadFactor("D", 1.0)]
        ),
        LoadCombination(
            id="ASCE7_ASD_2",
            name="D + L",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("L", 1.0)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_3",
            name="D + Lr (or S or R)",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("Lr", 1.0)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_4",
            name="D + 0.75L + 0.75Lr",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("L", 0.75),
                LoadFactor("Lr", 0.75)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_5",
            name="D + 0.6W",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("W", 0.6)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_6",
            name="D + 0.75L + 0.75(0.6W) + 0.75Lr",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("L", 0.75),
                LoadFactor("W", 0.45),  # 0.75 × 0.6
                LoadFactor("Lr", 0.75)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_7",
            name="0.6D + 0.6W",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 0.6),
                LoadFactor("W", 0.6)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_8",
            name="D + 0.7E",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("E", 0.7)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_9",
            name="D + 0.75L + 0.75(0.7E) + 0.75S",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 1.0),
                LoadFactor("L", 0.75),
                LoadFactor("E", 0.525),  # 0.75 × 0.7
                LoadFactor("S", 0.75)
            ]
        ),
        LoadCombination(
            id="ASCE7_ASD_10",
            name="0.6D + 0.7E",
            code="ASCE7_ASD",
            factors=[
                LoadFactor("D", 0.6),
                LoadFactor("E", 0.7)
            ]
        ),
    ]
    
    return combinations


def get_is456_lsm_combinations() -> List[LoadCombination]:
    """
    IS 456:2000 / IS 1893:2016 Limit State Method Combinations
    
    Per IS 456 Table 18 and IS 1893 Clause 6.3.2.2
    """
    combinations = [
        LoadCombination(
            id="IS456_1",
            name="1.5(DL + LL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.5),
                LoadFactor("L", 1.5)
            ],
            description="Gravity loads only"
        ),
        LoadCombination(
            id="IS456_2a",
            name="1.2(DL + LL + EL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.2),
                LoadFactor("E", 1.2)
            ],
            description="Gravity + Earthquake (additive)"
        ),
        LoadCombination(
            id="IS456_2b",
            name="1.2(DL + LL - EL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.2),
                LoadFactor("E", -1.2)
            ],
            description="Gravity + Earthquake (subtractive)"
        ),
        LoadCombination(
            id="IS456_3a",
            name="1.5(DL + EL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.5),
                LoadFactor("E", 1.5)
            ],
            description="Dead + Earthquake (additive)"
        ),
        LoadCombination(
            id="IS456_3b",
            name="1.5(DL - EL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.5),
                LoadFactor("E", -1.5)
            ],
            description="Dead + Earthquake (subtractive)"
        ),
        LoadCombination(
            id="IS456_4a",
            name="0.9DL + 1.5EL",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("E", 1.5)
            ],
            description="Minimum dead + Earthquake (uplift check)"
        ),
        LoadCombination(
            id="IS456_4b",
            name="0.9DL - 1.5EL",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("E", -1.5)
            ],
            description="Minimum dead - Earthquake"
        ),
        # Wind combinations
        LoadCombination(
            id="IS456_5a",
            name="1.2(DL + LL + WL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.2),
                LoadFactor("W", 1.2)
            ],
            description="Gravity + Wind"
        ),
        LoadCombination(
            id="IS456_5b",
            name="1.2(DL + LL - WL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.2),
                LoadFactor("L", 1.2),
                LoadFactor("W", -1.2)
            ]
        ),
        LoadCombination(
            id="IS456_6a",
            name="1.5(DL + WL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.5),
                LoadFactor("W", 1.5)
            ]
        ),
        LoadCombination(
            id="IS456_6b",
            name="1.5(DL - WL)",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 1.5),
                LoadFactor("W", -1.5)
            ]
        ),
        LoadCombination(
            id="IS456_7a",
            name="0.9DL + 1.5WL",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("W", 1.5)
            ]
        ),
        LoadCombination(
            id="IS456_7b",
            name="0.9DL - 1.5WL",
            code="IS456_LSM",
            factors=[
                LoadFactor("D", 0.9),
                LoadFactor("W", -1.5)
            ]
        ),
    ]
    
    return combinations


def get_aci318_combinations() -> List[LoadCombination]:
    """
    ACI 318-19 Load Combinations (Section 5.3)
    Similar to ASCE 7 LRFD
    """
    # ACI 318 references ASCE 7 for load combinations
    combinations = get_asce7_lrfd_combinations()
    
    # Update code reference
    for combo in combinations:
        combo.code = "ACI318"
        combo.id = combo.id.replace("ASCE7_LRFD", "ACI318")
    
    return combinations


# ============================================
# LOAD COMBINATIONS MANAGER
# ============================================

class LoadCombinationsManager:
    """
    Manages load combinations including predefined and user-defined.
    """
    
    def __init__(self):
        self.combinations: List[LoadCombination] = []
        self.load_cases: Dict[str, Dict] = {}  # load_type -> {loads}
    
    # ----------------------------------------
    # Load Predefined Combinations
    # ----------------------------------------
    
    def load_predefined(self, code: DesignCode) -> List[LoadCombination]:
        """Load predefined combinations for a design code"""
        
        if code == DesignCode.ASCE7_LRFD:
            combos = get_asce7_lrfd_combinations()
        elif code == DesignCode.ASCE7_ASD:
            combos = get_asce7_asd_combinations()
        elif code == DesignCode.IS456_LSM:
            combos = get_is456_lsm_combinations()
        elif code == DesignCode.ACI318:
            combos = get_aci318_combinations()
        else:
            combos = []
        
        self.combinations.extend(combos)
        return combos
    
    # ----------------------------------------
    # User-Defined Combinations
    # ----------------------------------------
    
    def add_user_combination(
        self,
        name: str,
        factors: Dict[str, float],
        description: str = ""
    ) -> LoadCombination:
        """
        Add a user-defined load combination.
        
        Args:
            name: Combination name (e.g., "My Custom Combo")
            factors: Dictionary of load type to factor (e.g., {"D": 1.2, "L": 1.6})
            description: Optional description
        
        Returns:
            Created LoadCombination
        """
        combo_id = f"USER_{len([c for c in self.combinations if c.is_user_defined]) + 1}"
        
        load_factors = [LoadFactor(lt, f) for lt, f in factors.items() if f != 0]
        
        combo = LoadCombination(
            id=combo_id,
            name=name,
            code="USER",
            factors=load_factors,
            description=description,
            is_user_defined=True
        )
        
        self.combinations.append(combo)
        return combo
    
    def remove_combination(self, combo_id: str) -> bool:
        """Remove a combination by ID"""
        for i, combo in enumerate(self.combinations):
            if combo.id == combo_id:
                del self.combinations[i]
                return True
        return False
    
    def update_combination(self, combo_id: str, **kwargs) -> Optional[LoadCombination]:
        """Update a combination"""
        for combo in self.combinations:
            if combo.id == combo_id:
                if "name" in kwargs:
                    combo.name = kwargs["name"]
                if "factors" in kwargs:
                    combo.factors = [LoadFactor(lt, f) for lt, f in kwargs["factors"].items()]
                if "description" in kwargs:
                    combo.description = kwargs["description"]
                if "is_active" in kwargs:
                    combo.is_active = kwargs["is_active"]
                return combo
        return None
    
    def set_combination_active(self, combo_id: str, is_active: bool) -> bool:
        """Enable/disable a combination"""
        for combo in self.combinations:
            if combo.id == combo_id:
                combo.is_active = is_active
                return True
        return False
    
    # ----------------------------------------
    # Load Cases
    # ----------------------------------------
    
    def set_load_case(self, load_type: str, loads: Dict) -> None:
        """
        Set loads for a load case.
        
        Args:
            load_type: Load type (D, L, E, W, etc.)
            loads: Dictionary of loads (can include nodal_loads, member_loads, etc.)
        """
        self.load_cases[load_type] = loads
    
    def get_load_case(self, load_type: str) -> Optional[Dict]:
        """Get loads for a specific load case"""
        return self.load_cases.get(load_type)
    
    # ----------------------------------------
    # Combine Loads
    # ----------------------------------------
    
    def combine_nodal_loads(
        self,
        combination: LoadCombination,
        nodal_loads: Dict[str, Dict[str, Dict]]  # load_type -> node_id -> {fx, fy, fz}
    ) -> Dict[str, Dict[str, float]]:
        """
        Combine nodal loads according to a combination.
        
        Args:
            combination: Load combination to apply
            nodal_loads: Nodal loads organized by load type
        
        Returns:
            Combined nodal loads: node_id -> {fx, fy, fz, mx, my, mz}
        """
        combined: Dict[str, Dict[str, float]] = {}
        
        for factor in combination.factors:
            load_type = factor.load_type
            f = factor.factor
            
            if load_type not in nodal_loads:
                continue
            
            for node_id, loads in nodal_loads[load_type].items():
                if node_id not in combined:
                    combined[node_id] = {
                        "fx": 0, "fy": 0, "fz": 0,
                        "mx": 0, "my": 0, "mz": 0
                    }
                
                for key in ["fx", "fy", "fz", "mx", "my", "mz"]:
                    if key in loads:
                        combined[node_id][key] += f * loads[key]
        
        return combined
    
    def apply_all_combinations(
        self,
        nodal_loads: Dict[str, Dict[str, Dict]]
    ) -> Dict[str, Dict[str, Dict[str, float]]]:
        """
        Apply all active combinations to nodal loads.
        
        Returns:
            combo_id -> node_id -> {fx, fy, fz, ...}
        """
        results = {}
        
        for combo in self.combinations:
            if not combo.is_active:
                continue
            
            results[combo.id] = self.combine_nodal_loads(combo, nodal_loads)
        
        return results
    
    # ----------------------------------------
    # Export/Import
    # ----------------------------------------
    
    def to_json(self) -> str:
        """Export all combinations to JSON"""
        data = {
            "combinations": [c.to_dict() for c in self.combinations]
        }
        return json.dumps(data, indent=2)
    
    def from_json(self, json_str: str) -> None:
        """Import combinations from JSON"""
        data = json.loads(json_str)
        for combo_data in data.get("combinations", []):
            combo = LoadCombination.from_dict(combo_data)
            self.combinations.append(combo)
    
    # ----------------------------------------
    # Summary
    # ----------------------------------------
    
    def get_summary(self) -> Dict:
        """Get summary of loaded combinations"""
        return {
            "total_combinations": len(self.combinations),
            "active_combinations": len([c for c in self.combinations if c.is_active]),
            "user_defined": len([c for c in self.combinations if c.is_user_defined]),
            "codes": list(set(c.code for c in self.combinations)),
            "combinations": [
                {
                    "id": c.id,
                    "name": c.name,
                    "expression": c.format_expression(),
                    "is_active": c.is_active
                }
                for c in self.combinations
            ]
        }
    
    def get_active_combinations(self) -> List[LoadCombination]:
        """Get all active combinations"""
        return [c for c in self.combinations if c.is_active]


# ============================================
# FACTORY FUNCTIONS
# ============================================

def create_combinations_manager(
    codes: List[str],
    include_user_defined: bool = True
) -> LoadCombinationsManager:
    """
    Create a LoadCombinationsManager with predefined combinations.
    
    Args:
        codes: List of code names (e.g., ["ASCE7_LRFD", "IS456_LSM"])
        include_user_defined: Whether to allow user-defined combinations
    """
    manager = LoadCombinationsManager()
    
    code_map = {
        "ASCE7_LRFD": DesignCode.ASCE7_LRFD,
        "ASCE7_ASD": DesignCode.ASCE7_ASD,
        "IS456_LSM": DesignCode.IS456_LSM,
        "IS456": DesignCode.IS456_LSM,
        "ACI318": DesignCode.ACI318,
    }
    
    for code_name in codes:
        code = code_map.get(code_name.upper())
        if code:
            manager.load_predefined(code)
    
    return manager


def get_all_available_combinations() -> Dict[str, List[LoadCombination]]:
    """Get all available predefined combinations organized by code"""
    return {
        "ASCE7_LRFD": get_asce7_lrfd_combinations(),
        "ASCE7_ASD": get_asce7_asd_combinations(),
        "IS456_LSM": get_is456_lsm_combinations(),
        "ACI318": get_aci318_combinations(),
    }
