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

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
import math


@dataclass
class StressPoint:
    """Stress state at a specific point"""
    x: float  # Location along member (m)
    y: float  # Distance from neutral axis (m)
    z: float  # Out-of-plane distance (m)
    
    # Normal stresses
    sigma_x: float  # Axial + bending stress (MPa)
    sigma_y: float  # Transverse normal stress (MPa)
    sigma_z: float  # Out-of-plane normal stress (MPa)
    
    # Shear stresses
    tau_xy: float  # In-plane shear (MPa)
    tau_yz: float  # Transverse shear (MPa)
    tau_zx: float  # Out-of-plane shear (MPa)
    
    # Derived stresses
    von_mises: float = 0.0  # Von Mises equivalent stress (MPa)
    principal_1: float = 0.0  # Maximum principal stress (MPa)
    principal_2: float = 0.0  # Intermediate principal stress (MPa)
    principal_3: float = 0.0  # Minimum principal stress (MPa)
    max_shear: float = 0.0  # Maximum shear stress (MPa)


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
                self._calculate_derived_stresses(point)
                
                stress_points.append(point)
        
        return stress_points
    
    def _calculate_derived_stresses(self, point: StressPoint):
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
    
    def get_stress_contours(
        self,
        stress_points: List[StressPoint],
        stress_type: str = 'von_mises'
    ) -> Dict[str, Any]:
        """
        Get stress contour data for visualization
        
        Args:
            stress_points: List of stress points
            stress_type: Type of stress to visualize
                - 'von_mises': Von Mises equivalent stress
                - 'principal_1': Max principal stress
                - 'principal_3': Min principal stress
                - 'sigma_x': Axial/bending stress
                - 'max_shear': Maximum shear stress
        
        Returns:
            Contour data with min, max, levels, and colors
        """
        # Extract stress values
        if stress_type == 'von_mises':
            values = [p.von_mises for p in stress_points]
        elif stress_type == 'principal_1':
            values = [p.principal_1 for p in stress_points]
        elif stress_type == 'principal_3':
            values = [p.principal_3 for p in stress_points]
        elif stress_type == 'sigma_x':
            values = [p.sigma_x for p in stress_points]
        elif stress_type == 'max_shear':
            values = [p.max_shear for p in stress_points]
        else:
            values = [p.von_mises for p in stress_points]
        
        if not values:
            return {
                'min': 0,
                'max': 0,
                'levels': [],
                'colors': []
            }
        
        min_stress = min(values)
        max_stress = max(values)
        
        # Create contour levels (10 levels)
        num_levels = 10
        levels = np.linspace(min_stress, max_stress, num_levels)
        
        # Create color map (blue -> green -> yellow -> red)
        colors = self._generate_color_map(num_levels)
        
        return {
            'min': float(min_stress),
            'max': float(max_stress),
            'levels': levels.tolist(),
            'colors': colors,
            'values': values,
            'points': [
                {
                    'x': p.x,
                    'y': p.y,
                    'z': p.z,
                    'value': values[i]
                }
                for i, p in enumerate(stress_points)
            ]
        }
    
    def _generate_color_map(self, num_levels: int) -> List[str]:
        """Generate color gradient from blue to red"""
        colors = []
        for i in range(num_levels):
            # Normalized position (0 to 1)
            t = i / (num_levels - 1)
            
            # Blue (low) -> Cyan -> Green -> Yellow -> Red (high)
            if t < 0.25:
                # Blue to Cyan
                r = 0
                g = int(255 * (t / 0.25))
                b = 255
            elif t < 0.5:
                # Cyan to Green
                r = 0
                g = 255
                b = int(255 * (1 - (t - 0.25) / 0.25))
            elif t < 0.75:
                # Green to Yellow
                r = int(255 * ((t - 0.5) / 0.25))
                g = 255
                b = 0
            else:
                # Yellow to Red
                r = 255
                g = int(255 * (1 - (t - 0.75) / 0.25))
                b = 0
            
            # Convert to hex
            color = f"#{r:02x}{g:02x}{b:02x}"
            colors.append(color)
        
        return colors
    
    def check_stress_limits(
        self,
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


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    # Example: Calculate stresses for a beam
    calculator = StressCalculator()
    
    # Member forces (simplified)
    forces = {
        'axial': [50, 50, 50, 50, 50],  # kN
        'moment_x': [0, 25, 50, 25, 0],  # kN·m
        'shear_y': [25, 12.5, 0, -12.5, -25]  # kN
    }
    
    # Section properties (ISMB 300)
    section = {
        'area': 5470e-6,  # m² (5470 mm²)
        'Ixx': 9251e-8,   # m⁴ (9251 cm⁴)
        'Iyy': 804e-8,    # m⁴
        'depth': 0.300,   # m
        'width': 0.140    # m
    }
    
    # Calculate stresses
    stress_points = calculator.calculate_member_stresses(
        member_id="M1",
        member_forces=forces,
        section_properties=section,
        member_length=5.0,
        num_points=5
    )
    
    # Get contours
    contours = calculator.get_stress_contours(stress_points, 'von_mises')
    
    print(f"Von Mises Stress Range: {contours['min']:.2f} - {contours['max']:.2f} MPa")
    print(f"Number of points: {len(stress_points)}")
    
    # Check limits
    check = calculator.check_stress_limits(stress_points, fy=250.0)
    print(f"\nStress Check: {check['summary']}")
