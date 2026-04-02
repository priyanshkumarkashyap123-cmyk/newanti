"""
lsd_integration.py - Integration of LSD Algorithm with Load Solver

Connects the reinforced concrete LSD design module with the structural
analysis load solver to provide end-to-end design workflow.

Workflow:
1. Run structural analysis (load_solver.py) → Get Mu and Vu
2. Apply load factors (partial safety factors for LSD)
3. Run RC beam bending design (IS 456:2000)
4. Return complete rebar specification

Author: BeamLab Ultimate Development Team
Date: March 2026
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import json
import logging

from .rc_lsd import (
    BeamSection,
    ConcreteGrade,
    RebarGrade,
    ConcreteProperties,
    RebarProperties,
    LSDDesignResult,
)
from .rc_limit_state_design import LimitStateDesignBeam
from .lsd_integration_types import DesignInput
from .lsd_integration_factoring import LoadFactoring
from .lsd_integration_designer import RCBeamDesigner

logger = logging.getLogger(__name__)


# ============================================================================
# IMPORTED EXTRACTED CLASSES
# ============================================================================
#
#  Classes LoadFactoring, DesignInput, RCBeamDesigner are imported from:
#    - lsd_integration_factoring.py  (LoadFactoring)
#    - lsd_integration_types.py      (DesignInput)
#    - lsd_integration_designer.py   (RCBeamDesigner)
#
# ============================================================================
# RC BEAM DESIGN WORKFLOW
# ============================================================================


# ============================================================================
# EXAMPLES AND QUICK API
# ============================================================================

def design_rc_beam(
    Mu: float,
    Vu: float,
    width_mm: float,
    depth_mm: float,
    concrete_grade: str = 'M30',
    steel_grade: str = 'Fe500',
    cover_mm: float = 50
) -> Dict:
    """
    Quick API for RC beam design.
    
    Parameters
    ----------
    Mu : float
        Ultimate moment (kN·m)
    Vu : float
        Ultimate shear (kN)
    width_mm : float
        Beam width (mm)
    depth_mm : float
        Beam depth (mm)
    concrete_grade : str
        e.g., 'M30'
    steel_grade : str
        e.g., 'Fe500'
    cover_mm : float
        Cover to tension steel (mm)
    
    Returns
    -------
    design_result : Dict
        Complete design in JSON format
    """
    design_input = DesignInput(
        Mu=Mu,
        Vu=Vu,
        beam_width=width_mm,
        beam_depth=depth_mm,
        cover_tension=cover_mm,
        concrete_grade=concrete_grade,
        steel_grade=steel_grade
    )
    
    designer = RCBeamDesigner(design_input)
    return designer.design()


# ============================================================================
# MAIN - EXAMPLE WORKFLOW
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)-8s | %(message)s'
    )
    
    print("\n" + "="*70)
    print("RC BEAM LSD DESIGN - INTEGRATION EXAMPLE")
    print("="*70 + "\n")
    
    # Example: Design a 300×600 mm beam with M30 and Fe500
    result = design_rc_beam(
        Mu=350.0,           # Ultimate moment (kN·m)
        Vu=200.0,           # Ultimate shear (kN)
        width_mm=300,       # mm
        depth_mm=600,       # mm
        concrete_grade='M30',
        steel_grade='Fe500',
        cover_mm=50         # mm
    )
    
    # Pretty print result
    print("\n" + "="*70)
    print("DESIGN RESULT (JSON)")
    print("="*70 + "\n")
    print(json.dumps(result, indent=2))
    
    # Extract key info
    if result['status'] == 'success':
        layout = result['rebar_layout']
        print("\n" + "="*70)
        print("FINAL REBAR SPECIFICATION (IS 456:2000)")
        print("="*70)
        print(f"\n{layout['summary']}\n")
        
        design_status = result['design_status']
        print(f"Status: {design_status['status']}")
        print(f"Design Ratio: {design_status['design_ratio']}")
