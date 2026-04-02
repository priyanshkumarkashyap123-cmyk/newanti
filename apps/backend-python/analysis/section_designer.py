"""
section_designer.py - Custom Section Designer

Advanced section property calculator for arbitrary 2D polygons.
Calculates: Area, Centroid, Ixx, Iyy, Zxx, Zyy, rxx, ryy, Weight.

Supports:
- Custom polygon sections
- Standard shapes (I-beam, box, channel, angle, tee)
- Composite sections
- Hollow sections

Author: BeamLab Ultimate Development Team
Date: January 2026
"""

from typing import List, Dict
import json

from .section_designer_types import Point
from .section_designer_calculations import CustomSectionCalculations


class CustomSection(CustomSectionCalculations):
    """
    Custom section designer with automatic property calculation.
    
    Uses shoelace formula for area and centroid.
    Uses parallel axis theorem for second moments.
    
    Coordinate system:
    - Origin at section centroid (after calculation)
    - X-axis horizontal (minor axis)
    - Y-axis vertical (major axis)
    """
    
    def __init__(self, points: List[Point], name: str = "Custom Section"):
        """
        Initialize custom section
        
        Args:
            points: List of Point objects defining section boundary (CCW)
            name: Section designation
        """
        self.points = points.copy()
        self.name = name
        self._validate()
    
    def get_all_properties(self, material_density: float = 7850.0) -> Dict:
        """
        Calculate all section properties
        
        Args:
            material_density: Material density in kg/m³ (default: steel 7850)
        
        Returns:
            Complete property dictionary
        """
        A = self.calculate_area()
        cx, cy = self.calculate_centroid()
        moments = self.calculate_second_moments()
        moduli = self.calculate_elastic_modulus()
        plastic = self.calculate_plastic_modulus()
        radii = self.calculate_radii_of_gyration()
        principal = self.calculate_principal_axes()
        
        # Weight per meter (convert mm² to m²)
        weight = A * 1e-6 * material_density  # kg/m
        
        return {
            'designation': self.name,
            'area': round(A, 2),
            'centroid_x': round(cx, 2),
            'centroid_y': round(cy, 2),
            'Ixx': round(moments['Ixx'], 0),
            'Iyy': round(moments['Iyy'], 0),
            'Ixy': round(moments['Ixy'], 0),
            'Zxx': round(moduli['Zxx'], 0),
            'Zyy': round(moduli['Zyy'], 0),
            'Zpxx': round(plastic['Zpxx'], 0),
            'Zpyy': round(plastic['Zpyy'], 0),
            'rxx': round(radii['rxx'], 2),
            'ryy': round(radii['ryy'], 2),
            'I1': round(principal['I1'], 0),
            'I2': round(principal['I2'], 0),
            'principal_angle': round(principal['angle_deg'], 2),
            'weight_per_meter': round(weight, 2)
        }
    
    def to_json(self) -> str:
        """Export section to JSON format"""
        data = {
            'name': self.name,
            'points': [p.to_dict() for p in self.points],
            'properties': self.get_all_properties()
        }
        return json.dumps(data, indent=2)


# ============================================
# IMPORT STANDARD SHAPES (from section_designer_shapes)
# ============================================
from .section_designer_shapes import StandardShapes


# ============================================
# EXPORTS
# ============================================

__all__ = [
    "Point",
    "CustomSection",
    "StandardShapes",
]


# Example usage
if __name__ == "__main__":
    # Test I-beam (ISMB 300)
    ismb300 = StandardShapes.i_beam(
        depth=300,
        width=150,
        web_thick=7.5,
        flange_thick=10.8,
        name="ISMB 300"
    )
    
    print("ISMB 300 Properties:")
    print(json.dumps(ismb300.get_all_properties(), indent=2))
    
    # Test custom section
    custom_points = [
        Point(0, 0),
        Point(100, 0),
        Point(100, 200),
        Point(0, 200)
    ]
    
    custom = CustomSection(custom_points, "Custom 100x200")
    print("\nCustom Section Properties:")
    print(json.dumps(custom.get_all_properties(), indent=2))
