"""Section property calculation methods."""

from __future__ import annotations

from typing import Dict, Tuple

import numpy as np

from .section_designer_types import Point


class CustomSectionCalculations:
    """Mixin for section property calculations."""
    
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


__all__ = ["CustomSectionCalculations"]
