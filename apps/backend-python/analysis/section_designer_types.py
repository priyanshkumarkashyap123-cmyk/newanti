"""Data types for section designer."""

from dataclasses import dataclass


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


__all__ = ["Point"]
