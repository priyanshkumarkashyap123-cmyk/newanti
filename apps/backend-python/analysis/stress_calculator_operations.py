"""
Stress calculation operations: derived stresses and validation.
"""

import math
from typing import Any, Dict, List

from .stress_calculator_types import StressPoint


class StressOperations:
    """Calculate derived stresses and validate against limits"""
    
    @staticmethod
    def calculate_derived_stresses(point: StressPoint):
        """Calculate von Mises and principal stresses"""
        
        # Extract stress components
        sx = point.sigma_x
        sy = point.sigma_y
        sz = point.sigma_z
        txy = point.tau_xy
        tyz = point.tau_yz
        tzx = point.tau_zx
        
        # Von Mises stress (for 3D stress state)
        # σ_vm = sqrt(0.5 * [(σx-σy)² + (σy-σz)² + (σz-σx)² + 6(τxy² + τyz² + τzx²)])
        point.von_mises = math.sqrt(
            0.5 * (
                (sx - sy)**2 + 
                (sy - sz)**2 + 
                (sz - sx)**2 + 
                6 * (txy**2 + tyz**2 + tzx**2)
            )
        )
        
        # Principal stresses (simplified for 2D plane stress)
        # For plane stress (σz = 0, τyz = τzx = 0):
        sigma_avg = (sx + sy) / 2
        radius = math.sqrt(((sx - sy) / 2)**2 + txy**2)
        
        point.principal_1 = sigma_avg + radius  # Maximum
        point.principal_3 = sigma_avg - radius  # Minimum
        point.principal_2 = 0.0  # For plane stress
        
        # Maximum shear stress
        point.max_shear = abs(radius)
    
    @staticmethod
    def check_stress_limits(
        stress_points: List[StressPoint],
        fy: float = 250.0,  # Yield strength (MPa)
        safety_factor: float = 1.5
    ) -> Dict[str, Any]:
        """
        Check if stresses exceed allowable limits
        
        Args:
            stress_points: List of stress points
            fy: Yield strength (MPa)
            safety_factor: Safety factor
        
        Returns:
            Dictionary with pass/fail status and critical locations
        """
        allowable_stress = fy / safety_factor
        
        critical_points = []
        max_utilization = 0.0
        
        for point in stress_points:
            utilization = point.von_mises / allowable_stress
            
            if utilization > 1.0:
                critical_points.append({
                    'x': point.x,
                    'y': point.y,
                    'von_mises': point.von_mises,
                    'utilization': utilization,
                    'status': 'FAIL'
                })
            
            max_utilization = max(max_utilization, utilization)
        
        return {
            'passes': len(critical_points) == 0,
            'max_utilization': max_utilization,
            'allowable_stress': allowable_stress,
            'critical_points': critical_points,
            'summary': f"{'PASS' if len(critical_points) == 0 else 'FAIL'} - Max utilization: {max_utilization*100:.1f}%"
        }


__all__ = ["StressOperations"]
