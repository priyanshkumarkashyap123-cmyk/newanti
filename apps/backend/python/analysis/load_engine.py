"""
load_engine.py - Comprehensive Static Loading Engine

Features:
- Trapezoidal/Triangular distributed loads
- Floor/Area load with automatic panel detection
- Temperature loads
- Prestress loads with cable profiles
- Fixed End Actions conversion for solver

Based on standard beam theory and structural mechanics.
"""

from typing import List, Dict

# Import all load types and enums from extracted modules
from .load_types import LoadDirection, DistributionType
from .load_models import (
    NodalLoad,
    UniformLoad,
    TrapezoidalLoad,
    PointLoadOnMember,
    MomentOnMember,
    TemperatureLoad,
    PrestressLoad,
    FloorLoad,
)
from .load_case import LoadCase, LoadCombination
from .load_engine_floor import process_floor_loads as process_floor_loads_helper
from .load_engine_exporter import export_for_solver as export_for_solver_helper
from .load_engine_fixed_end import aggregate_fixed_end_actions
from .load_engine_combos import init_default_combinations
from .load_utils import create_self_weight_loads


# ============================================
# LOAD ENGINE (Main Class)
# ============================================

class LoadEngine:
    """
    Main class for managing structural loads.
    
    Handles:
    - Load case management
    - Floor load panel detection and distribution
    - Conversion to fixed-end actions for solver
    - Load combination generation
    """
    
    def __init__(self):
        self.load_cases: Dict[str, LoadCase] = {}
        self.combinations: Dict[str, LoadCombination] = {}
        init_default_combinations(self.add_combination)
    
    def add_load_case(self, load_case: LoadCase) -> None:
        """Add a load case"""
        self.load_cases[load_case.name] = load_case
    
    def add_combination(self, combo: LoadCombination) -> None:
        """Add a load combination"""
        self.combinations[combo.name] = combo
    
    def process_floor_loads(
        self,
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> Dict[str, List[TrapezoidalLoad]]:
        """
        Process all floor loads and distribute to beams.
        
        Returns dict of load_case_name -> list of member loads
        """
        return process_floor_loads_helper(self.load_cases, beams, nodes)
    
    def get_fixed_end_actions_for_member(
        self,
        member_id: str,
        length: float,
        load_case: str = None
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate total fixed end actions for a member from all loads.
        
        Returns dict of direction -> {Fy_start, Fy_end, Mz_start, Mz_end}
        """
        cases = [self.load_cases[load_case]] if load_case else self.load_cases.values()
        member_loads = (load for case in cases for load in case.member_loads)
        return aggregate_fixed_end_actions(member_id, length, member_loads)
    
    def export_for_solver(
        self,
        combination_name: str,
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> Dict:
        """
        Export all loads for a combination in solver-ready format.
        
        Returns dict with nodal_loads, member_distributed_loads, etc.
        """
        floor_member_loads = self.process_floor_loads(beams, nodes)
        return export_for_solver_helper(self.combinations, self.load_cases, combination_name, floor_member_loads)


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Create load engine
    engine = LoadEngine()
    
    # Create a load case
    dead_load = LoadCase(
        name="DEAD",
        description="Dead load including self-weight",
        load_type="DEAD"
    )
    
    # Add a trapezoidal load
    dead_load.member_loads.append(TrapezoidalLoad(
        id="trap1",
        member_id="M1",
        w1=10.0,  # 10 kN/m at start
        w2=20.0,  # 20 kN/m at end
        direction=LoadDirection.GLOBAL_Y
    ))
    
    # Add floor load
    dead_load.floor_loads.append(FloorLoad(
        id="floor1",
        pressure=5.0,  # 5 kN/m²
        y_level=3.0    # At Y = 3m
    ))
    
    engine.add_load_case(dead_load)
    
    # Live load case
    live_load = LoadCase(
        name="LIVE",
        description="Imposed load",
        load_type="LIVE"
    )
    
    live_load.floor_loads.append(FloorLoad(
        id="live_floor1",
        pressure=3.0,  # 3 kN/m²
        y_level=3.0
    ))
    
    engine.add_load_case(live_load)
    
    # Test fixed end actions
    trap = TrapezoidalLoad(
        id="test",
        member_id="M1",
        w1=10.0,
        w2=10.0,  # Uniform
        direction=LoadDirection.GLOBAL_Y
    )
    
    fea = trap.get_fixed_end_actions(length=6.0)
    print(f"Fixed End Actions for UDL 10 kN/m on 6m span:")
    print(f"  Fy_start: {fea['Fy_start']:.2f} kN")
    print(f"  Fy_end: {fea['Fy_end']:.2f} kN")
    print(f"  Mz_start: {fea['Mz_start']:.2f} kN·m")
    print(f"  Mz_end: {fea['Mz_end']:.2f} kN·m")
