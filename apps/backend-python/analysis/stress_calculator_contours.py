"""
Stress visualization and color mapping for contours.
"""

from typing import Any, Dict, List

import numpy as np

from .stress_calculator_types import StressPoint


class StressContours:
    """Generate stress contour data for visualization"""
    
    @staticmethod
    def get_stress_contours(
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
        colors = StressContours._generate_color_map(num_levels)
        
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
    
    @staticmethod
    def _generate_color_map(num_levels: int) -> List[str]:
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


__all__ = ["StressContours"]
