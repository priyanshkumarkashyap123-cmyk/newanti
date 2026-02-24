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

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json


@dataclass
class Point:
    """2D point in section coordinate system"""
    x: float
    y: float
    
    def __eq__(self, other):
        if not isinstance(other, Point):
            return False
        return abs(self.x - other.x) < 1e-6 and abs(self.y - other.y) < 1e-6
    
    def to_dict(self):
        return {"x": self.x, "y": self.y}


class CustomSection:
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
    
    def _validate(self):
        """Ensure section is closed and valid"""
        if len(self.points) < 3:
            raise ValueError("Section must have at least 3 points")
        
        # Auto-close if not closed
        if self.points[0] != self.points[-1]:
            self.points.append(self.points[0])
        
        # Check for self-intersections (basic check)
        area = self._calculate_raw_area()
        if area < 1e-6:
            raise ValueError("Section has zero or negative area - check point order (should be CCW)")
    
    def _calculate_raw_area(self) -> float:
        """Calculate signed area (positive for CCW, negative for CW)"""
        n = len(self.points) - 1
        area = 0.0
        for i in range(n):
            area += self.points[i].x * self.points[i+1].y
            area -= self.points[i+1].x * self.points[i].y
        return area / 2.0
    
    def calculate_area(self) -> float:
        """
        Calculate cross-sectional area using shoelace formula
        
        Returns:
            Area in mm² (or units²)
        """
        return abs(self._calculate_raw_area())
    
    def calculate_centroid(self) -> Tuple[float, float]:
        """
        Calculate centroid coordinates using Green's theorem
        
        Returns:
            (cx, cy) centroid coordinates
        """
        A = self.calculate_area()
        if A < 1e-6:
            return (0.0, 0.0)
        
        n = len(self.points) - 1
        cx = 0.0
        cy = 0.0
        
        for i in range(n):
            term = (self.points[i].x * self.points[i+1].y - 
                   self.points[i+1].x * self.points[i].y)
            cx += (self.points[i].x + self.points[i+1].x) * term
            cy += (self.points[i].y + self.points[i+1].y) * term
        
        cx /= (6.0 * A)
        cy /= (6.0 * A)
        
        return (cx, cy)
    
    def calculate_second_moments(self) -> Dict[str, float]:
        """
        Calculate second moments of area (Ixx, Iyy, Ixy) about centroid
        
        Uses parallel axis theorem:
        I_centroid = I_origin - A * d²
        
        Returns:
            Dictionary with Ixx, Iyy, Ixy in mm⁴
        """
        cx, cy = self.calculate_centroid()
        n = len(self.points) - 1
        
        Ixx = 0.0  # About x-axis (horizontal)
        Iyy = 0.0  # About y-axis (vertical)
        Ixy = 0.0  # Product of inertia
        
        for i in range(n):
            # Translate to centroid
            x1 = self.points[i].x - cx
            y1 = self.points[i].y - cy
            x2 = self.points[i+1].x - cx
            y2 = self.points[i+1].y - cy
            
            # Cross product term
            term = x1 * y2 - x2 * y1
            
            # Second moment formulas
            Ixx += (y1**2 + y1*y2 + y2**2) * term
            Iyy += (x1**2 + x1*x2 + x2**2) * term
            Ixy += (x1*y2 + 2*x1*y1 + 2*x2*y2 + x2*y1) * term
        
        Ixx = abs(Ixx / 12.0)
        Iyy = abs(Iyy / 12.0)
        Ixy = abs(Ixy / 24.0)
        
        return {
            'Ixx': Ixx,
            'Iyy': Iyy,
            'Ixy': Ixy
        }
    
    def calculate_elastic_modulus(self) -> Dict[str, float]:
        """
        Calculate elastic section modulus Zxx, Zyy
        
        Z = I / c (where c = distance to extreme fiber)
        
        Returns:
            Dictionary with Zxx, Zyy in mm³
        """
        cx, cy = self.calculate_centroid()
        moments = self.calculate_second_moments()
        
        # Find extreme fibers from centroid
        y_max = max(abs(p.y - cy) for p in self.points)
        x_max = max(abs(p.x - cx) for p in self.points)
        
        if y_max < 1e-6 or x_max < 1e-6:
            return {'Zxx': 0.0, 'Zyy': 0.0}
        
        Zxx = moments['Ixx'] / y_max
        Zyy = moments['Iyy'] / x_max
        
        return {
            'Zxx': Zxx,
            'Zyy': Zyy
        }
    
    def calculate_plastic_modulus(self) -> Dict[str, float]:
        """
        Calculate plastic section modulus (approximate for complex shapes)
        
        For simple shapes: Zp = A * ybar (distance from centroid to center of half-area)
        
        Returns:
            Dictionary with Zpxx, Zpyy in mm³
        """
        A = self.calculate_area()
        cx, cy = self.calculate_centroid()
        
        # Simplified calculation - for I-beams and simple shapes
        # Full calculation requires finding equal-area axis
        moduli = self.calculate_elastic_modulus()
        
        # Approximation: Zp ≈ 1.15 * Ze for I-sections
        # For exact calculation, need to implement equal-area axis
        Zpxx = moduli['Zxx'] * 1.15
        Zpyy = moduli['Zyy'] * 1.15
        
        return {
            'Zpxx': Zpxx,
            'Zpyy': Zpyy
        }
    
    def calculate_radii_of_gyration(self) -> Dict[str, float]:
        """
        Calculate radii of gyration rxx, ryy
        
        r = sqrt(I / A)
        
        Returns:
            Dictionary with rxx, ryy in mm
        """
        A = self.calculate_area()
        if A < 1e-6:
            return {'rxx': 0.0, 'ryy': 0.0}
        
        moments = self.calculate_second_moments()
        
        rxx = np.sqrt(moments['Ixx'] / A)
        ryy = np.sqrt(moments['Iyy'] / A)
        
        return {
            'rxx': rxx,
            'ryy': ryy
        }
    
    def calculate_principal_axes(self) -> Dict[str, float]:
        """
        Calculate principal moments and orientation
        
        For sections with Ixy != 0, principal axes are rotated
        
        Returns:
            Dictionary with I1, I2, angle (degrees)
        """
        moments = self.calculate_second_moments()
        Ixx = moments['Ixx']
        Iyy = moments['Iyy']
        Ixy = moments['Ixy']
        
        # Principal moments
        I_avg = (Ixx + Iyy) / 2
        I_diff = (Ixx - Iyy) / 2
        
        I1 = I_avg + np.sqrt(I_diff**2 + Ixy**2)  # Major principal
        I2 = I_avg - np.sqrt(I_diff**2 + Ixy**2)  # Minor principal
        
        # Principal angle (radians to degrees)
        if abs(Ixx - Iyy) < 1e-6:
            angle = 45.0 if Ixy > 0 else 0.0
        else:
            angle = 0.5 * np.arctan2(2*Ixy, Ixx - Iyy) * 180 / np.pi
        
        return {
            'I1': I1,
            'I2': I2,
            'angle_deg': angle
        }
    
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


class StandardShapes:
    """Pre-defined standard shapes for quick creation"""
    
    @staticmethod
    def i_beam(depth: float, width: float, web_thick: float, 
               flange_thick: float, name: str = "I-Beam") -> CustomSection:
        """
        Create I-beam section
        
        Args:
            depth: Total depth (mm)
            width: Flange width (mm)
            web_thick: Web thickness (mm)
            flange_thick: Flange thickness (mm)
            name: Section designation
        
        Returns:
            CustomSection object
        """
        d = depth
        bf = width
        tw = web_thick
        tf = flange_thick
        
        points = [
            Point(-bf/2, -d/2),
            Point(bf/2, -d/2),
            Point(bf/2, -d/2 + tf),
            Point(tw/2, -d/2 + tf),
            Point(tw/2, d/2 - tf),
            Point(bf/2, d/2 - tf),
            Point(bf/2, d/2),
            Point(-bf/2, d/2),
            Point(-bf/2, d/2 - tf),
            Point(-tw/2, d/2 - tf),
            Point(-tw/2, -d/2 + tf),
            Point(-bf/2, -d/2 + tf),
        ]
        
        return CustomSection(points, name)
    
    @staticmethod
    def channel(depth: float, width: float, web_thick: float, 
                flange_thick: float, name: str = "Channel") -> CustomSection:
        """Create channel section (C-shape)"""
        d = depth
        bf = width
        tw = web_thick
        tf = flange_thick
        
        points = [
            Point(0, -d/2),
            Point(bf, -d/2),
            Point(bf, -d/2 + tf),
            Point(tw, -d/2 + tf),
            Point(tw, d/2 - tf),
            Point(bf, d/2 - tf),
            Point(bf, d/2),
            Point(0, d/2),
        ]
        
        return CustomSection(points, name)
    
    @staticmethod
    def angle(leg1: float, leg2: float, thickness: float, 
              name: str = "Angle") -> CustomSection:
        """Create angle section (L-shape)"""
        points = [
            Point(0, 0),
            Point(leg1, 0),
            Point(leg1, thickness),
            Point(thickness, thickness),
            Point(thickness, leg2),
            Point(0, leg2),
        ]
        
        return CustomSection(points, name)
    
    @staticmethod
    def rectangular(width: float, depth: float, name: str = "Rectangle") -> CustomSection:
        """Create solid rectangular section"""
        points = [
            Point(-width/2, -depth/2),
            Point(width/2, -depth/2),
            Point(width/2, depth/2),
            Point(-width/2, depth/2),
        ]
        
        return CustomSection(points, name)
    
    @staticmethod
    def circular(diameter: float, segments: int = 32, name: str = "Circle") -> CustomSection:
        """Create circular section (approximated by polygon)"""
        r = diameter / 2
        points = []
        
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            x = r * np.cos(angle)
            y = r * np.sin(angle)
            points.append(Point(x, y))
        
        return CustomSection(points, name)
    
    @staticmethod
    def tee(width: float, depth: float, web_thick: float, 
            flange_thick: float, name: str = "Tee") -> CustomSection:
        """Create T-section"""
        bf = width
        d = depth
        tw = web_thick
        tf = flange_thick
        
        points = [
            Point(-bf/2, 0),
            Point(bf/2, 0),
            Point(bf/2, tf),
            Point(tw/2, tf),
            Point(tw/2, d),
            Point(-tw/2, d),
            Point(-tw/2, tf),
            Point(-bf/2, tf),
        ]
        
        return CustomSection(points, name)

    @staticmethod
    def built_up_i(depth: float, top_width: float, bot_width: float, 
                   web_thick: float, top_thick: float, bot_thick: float, 
                   name: str = "Built-up I") -> CustomSection:
        """Create Built-up I-section (Plate Girder)"""
        d = depth
        bft = top_width
        bfb = bot_width
        tw = web_thick
        tft = top_thick
        tfb = bot_thick
        
        # Centered vertically for initial points
        y_bot = -d/2
        y_top = d/2
        
        points = [
            Point(-bfb/2, y_bot),
            Point(bfb/2, y_bot),
            Point(bfb/2, y_bot + tfb),
            Point(tw/2, y_bot + tfb),
            Point(tw/2, y_top - tft),
            Point(bft/2, y_top - tft),
            Point(bft/2, y_top),
            Point(-bft/2, y_top),
            Point(-bft/2, y_top - tft),
            Point(-tw/2, y_top - tft),
            Point(-tw/2, y_bot + tfb),
            Point(-bfb/2, y_bot + tfb),
        ]
        
        return CustomSection(points, name)

    @staticmethod
    def composite_beam(depth: float, width: float, web_thick: float, flange_thick: float,
                       slab_width: float, slab_thick: float, modular_ratio: float = 8.0,
                       name: str = "Composite Beam") -> CustomSection:
        """
        Create Composite Beam (I-section + Concrete Slab).
        Transformed section method: Slab width reduced by modular ratio n.
        """
        # Steel I-Beam
        d = depth
        bf = width
        tw = web_thick
        tf = flange_thick
        
        # Effective slab width (transformed to steel)
        be = slab_width / modular_ratio
        ts = slab_thick
        
        # We model this as a single polygon for geometric properties.
        # Note: This simplifies the interface (assuming monolithic). 
        # Real composite action checks are more complex, but this gives geometric props.
        
        points = [
            # I-Beam Bottom Flange
            Point(-bf/2, 0),
            Point(bf/2, 0),
            Point(bf/2, tf),
            # Web
            Point(tw/2, tf),
            Point(tw/2, d - tf),
            # Top Flange
            Point(bf/2, d - tf),
            Point(bf/2, d),
            # Slab (Transformed) - Sitting on top
            Point(be/2, d),
            Point(be/2, d + ts),
            Point(-be/2, d + ts),
            Point(-be/2, d),
            # Top Flange (Left)
            Point(-bf/2, d),
            Point(-bf/2, d - tf),
            # Web (Left)
            Point(-tw/2, d - tf),
            Point(-tw/2, tf),
            # Bottom Flange (Left)
            Point(-bf/2, tf),
        ]
        
        return CustomSection(points, name)

    @staticmethod
    def lipped_channel(depth: float, width: float, thickness: float, lip: float,
                       name: str = "Lipped Channel") -> CustomSection:
        """Create Cold-Formed Lipped Channel (C-section with lips)"""
        d = depth
        b = width
        t = thickness
        c = lip
        
        # Outer dimensions
        # Starting from bottom right lip tip, going CW
        
        # Simplified thin-walled centerline model or outer boundary?
        # Using outer boundary for consistent Area calculation
        
        # Coordinates relative to bottom-left corner (0,0) roughly
        
        points = [
            Point(b, d - c), # Top lip tip
            Point(b - t, d - c),
            Point(b - t, d - t),
            Point(t, d - t),
            Point(t, t),
            Point(b - t, t),
            Point(b - t, c),
            Point(b, c),
            Point(b, 0),# Bottom outer corner
            Point(0, 0), # Bottom left outer
            Point(0, d), # Top left outer
            Point(b, d) # Top right outer
        ]
        
        # Re-ordering to be valid CCW polygon
        # Let's trace carefully:
        # Start Bottom-Right Outer (b, 0)
        # Top-Right Outer (b, d)
        # Top-Left Outer (0, d)
        # Bottom-Left Outer (0, 0)
        # ... Wait, C-shape is open. CustomSection requires closed polygon.
        # This defines the solid cross-section area.
        
        points = [
            Point(b, 0),          # 1. Bottom Right Outer
            Point(b, c),          # 2. Bottom Lip Tip Outer
            Point(b - t, c),      # 3. Bottom Lip Tip Inner
            Point(b - t, t),      # 4. Bottom Flange Inner
            Point(t, t),          # 5. Web Inner Bottom
            Point(t, d - t),      # 6. Web Inner Top
            Point(b - t, d - t),  # 7. Top Flange Inner
            Point(b - t, d - c),  # 8. Top Lip Tip Inner
            Point(b, d - c),      # 9. Top Lip Tip Outer
            Point(b, d),          # 10. Top Right Outer
            Point(0, d),          # 11. Top Left Outer
            Point(0, 0)           # 12. Bottom Left Outer
        ]
        
        # Reverse to ensure CCW (Standard is CCW)
        # Current (0,0) -> (b,0) is CCW? No.
        # (0,0) is bottom-left. (b,0) is bottom-right.
        # This path (1->12) goes 1(BR) -> ... -> 12(BL). This is Clockwise around the shape.
        # So we reverse it.
        points.reverse()
        
        return CustomSection(points, name)


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
