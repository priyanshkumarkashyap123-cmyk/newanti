"""
lsd_integration_factoring.py - Load factoring for ultimate design state (ULS)

Implements partial safety factor application per IS 875:1987 and IS 1893:2016.
Converts service loads to ultimate loads for LSD design.
"""

import logging
from typing import Dict, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class LoadFactoring:
    """
    Apply partial safety factors to convert service loads to ultimate loads.
    
    IS 875:1987 and IS 1893:2016 specify:
    - Dead load factor: 1.5
    - Live load factor: 1.5
    - Wind load factor: 1.5 (for ultimate limit state)
    - Earthquake: As per IS 1893 (reduced factors)
    """
    
    # Partial safety factors (γ_f) - IS 875:1987, Clause 3.4
    PARTIAL_SAFETY_FACTORS = {
        'dead': 1.5,        # Permanent/self-weight
        'live': 1.5,        # Imposed/temporary load
        'wind': 1.5,        # Wind load
        'earthquake': 1.0,  # Seismic (combined with reduction factor)
    }
    
    @staticmethod
    def get_shear_moment_from_analysis(
        analysis_results: Dict,
        span_mm: float,
        load_case: str = 'dead+live'
    ) -> Tuple[float, float]:
        """
        Extract maximum moment and shear from analysis results.
        
        Parameters
        ----------
        analysis_results : Dict
            Results from load_solver (contains diagrams, member forces)
        span_mm : float
            Span length (mm) - for relating forces to moments
        load_case : str
            Load case combination type
        
        Returns
        -------
        (Mu, Vu) : Tuple
            Ultimate moment (kN·m), Ultimate shear (kN)
        
        Unit handling policy:
        - Prefer explicit unit-tagged keys from load_solver:
          * moment_y_knm: kN·m
          * shear_y_kn: kN
        - Backward compatibility for legacy keys:
          * moment_y: N·mm
          * shear_y: N
        """
        if 'diagrams' in analysis_results:
            # Find max bending moment
            max_moment = 0
            for member_id, diag in analysis_results['diagrams'].items():
                if 'moment_y_knm' in diag:
                    max_moment = max(max_moment, max(np.abs(diag['moment_y_knm'])))
                elif 'moment_y' in diag:
                    # Legacy fallback: N·mm → kN·m
                    max_moment = max(max_moment, max(np.abs(diag['moment_y'])) / 1e6)

            Mu = max_moment
        else:
            Mu = 0
        
        # Extract max shear
        if 'diagrams' in analysis_results:
            max_shear = 0
            for member_id, diag in analysis_results['diagrams'].items():
                if 'shear_y_kn' in diag:
                    max_shear = max(max_shear, max(np.abs(diag['shear_y_kn'])))
                elif 'shear_y' in diag:
                    # Legacy fallback: N → kN
                    max_shear = max(max_shear, max(np.abs(diag['shear_y'])) / 1e3)

            Vu = max_shear
        else:
            Vu = 0
        
        return Mu, Vu
    
    @staticmethod
    def factor_loads(
        Md: float,
        Vd: float,
        load_factor: float = 1.5
    ) -> Tuple[float, float]:
        """
        Apply load factor to service loads to get ultimate loads.
        
        Parameters
        ----------
        Md : float
            Service moment (kN·m)
        Vd : float
            Service shear (kN)
        load_factor : float
            Partial safety factor (typically 1.5 per IS 875:1987)
        
        Returns
        -------
        (Mu, Vu) : Tuple
            Ultimate moment, shear
        
        Reference
        ---------
        IS 875:1987 - Code of Practice for Design Loads (Other than Earthquake)
        Clause 3.4: Partial safety factors generally taken as 1.5 for ULS.
        """
        Mu = load_factor * Md
        Vu = load_factor * Vd
        
        logger.info(
            f"Load factoring: Md={Md:.2f} → Mu={Mu:.2f} (γ={load_factor}), "
            f"Vd={Vd:.2f} → Vu={Vu:.2f}"
        )
        
        return Mu, Vu


__all__ = [
    "LoadFactoring",
]
