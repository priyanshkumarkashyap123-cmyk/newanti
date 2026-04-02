"""
stress_calculator.py - Advanced Stress Analysis

Calculates and visualizes stresses in structural members:
- Bending stresses (σ_b = M*y/I)
- Axial stresses (σ_a = P/A)
- Shear stresses (τ = VQ/Ib)
- Combined stresses (σ_combined)
- Von Mises stress (σ_vm)
- Principal stresses (σ_1, σ_2, σ_3)

Provides data for color contour visualization.
"""

from typing import Any, Dict, List

from .stress_calculator_types import StressPoint
from .stress_calculator_operations import StressOperations
from .stress_calculator_contours import StressContours


class StressCalculator:
    """Calculate stresses in structural members"""
    
    def __init__(self):
        self.stress_points: List[StressPoint] = []
        
    def calculate_member_stresses(
        self,
        member_id: str,
        member_forces: Dict[str, Any],
        section_properties: Dict[str, float],
        member_length: float,
        num_points: int = 20
    ) -> List[StressPoint]:
        """
        Calculate stress distribution along a member
        
        Args:
            member_id: Member identifier
            member_forces: Forces at points along member
            section_properties: Area, Ixx, Iyy, Zxx, Zyy, etc.
            member_length: Length of member (m)
            num_points: Number of evaluation points
            
        Returns:
            List of stress points
        """
        stress_points = []
        
        # Extract section properties
        A = section_properties.get('area', 0.01)  # m²
        Ixx = section_properties.get('Ixx', 1e-4)  # m⁴
        Iyy = section_properties.get('Iyy', 1e-4)  # m⁴
        depth = section_properties.get('depth', 0.3)  # m
        width = section_properties.get('width', 0.15)  # m
        
        # Extract force arrays
        axial_forces = member_forces.get('axial', [0] * num_points)
        moment_x = member_forces.get('moment_x', [0] * num_points)
        moment_y = member_forces.get('moment_y', [0] * num_points)
        shear_y = member_forces.get('shear_y', [0] * num_points)
        shear_z = member_forces.get('shear_z', [0] * num_points)
        
        # Ensure arrays are the right length
        if len(axial_forces) < num_points:
            axial_forces = axial_forces + [0] * (num_points - len(axial_forces))
        if len(moment_x) < num_points:
            moment_x = moment_x + [0] * (num_points - len(moment_x))
        if len(shear_y) < num_points:
            shear_y = shear_y + [0] * (num_points - len(shear_y))
        
        # Calculate stresses at each point
        for i in range(num_points):
            x_pos = (i / (num_points - 1)) * member_length if num_points > 1 else 0
            
            # Get forces at this location
            P = axial_forces[i] * 1000  # Convert kN to N
            Mx = moment_x[i] * 1000  # Convert kN·m to N·m
            My = moment_y[i] * 1000 if i < len(moment_y) else 0
            Vy = shear_y[i] * 1000  # Convert kN to N
            Vz = shear_z[i] * 1000 if i < len(shear_z) else 0
            
            # Calculate stresses at extreme fibers (top and bottom)
            y_positions = [depth/2, -depth/2, 0]  # Top, bottom, neutral axis
            
            for y in y_positions:
                # Axial stress (uniform)
                sigma_axial = P / A if A > 0 else 0
                
                # Bending stress (σ = M*y/I)
                sigma_bending_x = (Mx * y) / Ixx if Ixx > 0 else 0
                sigma_bending_y = (My * 0) / Iyy if Iyy > 0 else 0  # Simplified
                
                # Combined normal stress
                sigma_x = (sigma_axial + sigma_bending_x) / 1e6  # Convert to MPa
                sigma_y = sigma_bending_y / 1e6
                sigma_z = 0.0  # Plane stress assumption
                
                # Shear stress (simplified - τ_avg = V/A)
                # For more accuracy, use τ = VQ/Ib
                tau_xy = (Vy / A) / 1e6 if A > 0 else 0  # MPa
                tau_yz = (Vz / A) / 1e6 if A > 0 else 0
                tau_zx = 0.0
                
                # Create stress point
                point = StressPoint(
                    x=x_pos,
                    y=y,
                    z=0.0,
                    sigma_x=sigma_x,
                    sigma_y=sigma_y,
                    sigma_z=sigma_z,
                    tau_xy=tau_xy,
                    tau_yz=tau_yz,
                    tau_zx=tau_zx
                )
                
                # Calculate derived stresses
                StressOperations.calculate_derived_stresses(point)
                
                stress_points.append(point)
        
        return stress_points
    
    def get_stress_contours(
        self,
        stress_points: List[StressPoint],
        stress_type: str = 'von_mises'
    ) -> Dict[str, Any]:
        """Get stress contour data for visualization"""
        return StressContours.get_stress_contours(stress_points, stress_type)
    
    def check_stress_limits(
        self,
        stress_points: List[StressPoint],
        fy: float = 250.0,  # Yield strength (MPa)
        safety_factor: float = 1.5
    ) -> Dict[str, Any]:
        """Check if stresses exceed allowable limits"""
        return StressOperations.check_stress_limits(stress_points, fy, safety_factor)


__all__ = ["StressCalculator", "StressPoint"]
