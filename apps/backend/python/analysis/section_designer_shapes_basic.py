"""Standard structural section shapes - basic geometric forms."""

from __future__ import annotations

import numpy as np
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .section_designer import CustomSection, Point


class StandardShapesBasic:
    """Factory class for standard geometric shapes."""
    
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
        from .section_designer import CustomSection, Point
        
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
        from .section_designer import CustomSection, Point
        
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
        from .section_designer import CustomSection, Point
        
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
        from .section_designer import CustomSection, Point
        
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
        from .section_designer import CustomSection, Point
        
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
        from .section_designer import CustomSection, Point
        
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


__all__ = ["StandardShapesBasic"]
