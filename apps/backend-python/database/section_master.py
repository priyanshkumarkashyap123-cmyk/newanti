"""
section_master.py - Comprehensive Section Property Database & Calculator

Features:
1. Standard section libraries (AISC, IS800, Eurocode, British)
2. Dynamic calculators (Tapered, Polygon, Composite)
3. Cold-formed and parametric sections
"""

import math
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


# ============================================
# TYPES & ENUMS
# ============================================

class SectionCode(Enum):
    AISC = "AISC"
    IS800 = "IS800"
    EUROCODE = "EN"
    BRITISH = "BS"


class SectionType(Enum):
    I_BEAM = "I"
    CHANNEL = "C"
    ANGLE = "L"
    TEE = "T"
    HSS_RECT = "HSS_RECT"
    HSS_ROUND = "HSS_ROUND"
    PIPE = "PIPE"
    COLD_FORMED_C = "CFC"
    COLD_FORMED_Z = "CFZ"


@dataclass
class SectionProperties:
    """Standard section properties"""
    name: str
    code: SectionCode
    type: SectionType
    # Dimensions (mm)
    depth: float
    width: float
    tw: float  # Web thickness
    tf: float  # Flange thickness
    r: float = 0  # Fillet radius
    # Properties
    area: float = 0  # mm²
    Iz: float = 0  # mm⁴ (Major axis)
    Iy: float = 0  # mm⁴ (Minor axis)
    Ix: float = 0  # mm⁴ (Torsion constant)
    Sz: float = 0  # mm³ (Major plastic modulus)
    Sy: float = 0  # mm³ (Minor plastic modulus)
    rz: float = 0  # mm (Radius of gyration major)
    ry: float = 0  # mm (Radius of gyration minor)
    # Weight
    weight: float = 0  # kg/m


# ============================================
# SECTION DATABASE
# ============================================

# IS 800 Sections (Indian Standard)
IS800_SECTIONS: Dict[str, SectionProperties] = {
    "ISMB150": SectionProperties("ISMB150", SectionCode.IS800, SectionType.I_BEAM,
        150, 80, 4.8, 7.6, 8, 1660, 726e4, 52.6e4, 4.5e4, 96.9e3, 13.2e3, 66.2, 5.63, 13.0),
    "ISMB200": SectionProperties("ISMB200", SectionCode.IS800, SectionType.I_BEAM,
        200, 100, 5.7, 10.8, 11, 2850, 2235e4, 150e4, 12.0e4, 224e3, 30.0e3, 88.6, 7.26, 22.4),
    "ISMB250": SectionProperties("ISMB250", SectionCode.IS800, SectionType.I_BEAM,
        250, 125, 6.9, 12.5, 12, 4280, 5130e4, 334e4, 26.5e4, 410e3, 53.5e3, 110, 8.83, 33.6),
    "ISMB300": SectionProperties("ISMB300", SectionCode.IS800, SectionType.I_BEAM,
        300, 140, 7.5, 12.4, 14, 4890, 8590e4, 454e4, 35.1e4, 573e3, 64.8e3, 133, 9.63, 38.4),
    "ISMB350": SectionProperties("ISMB350", SectionCode.IS800, SectionType.I_BEAM,
        350, 145, 8.1, 14.2, 14, 5990, 13630e4, 538e4, 47.9e4, 779e3, 74.2e3, 151, 9.48, 47.0),
    "ISMB400": SectionProperties("ISMB400", SectionCode.IS800, SectionType.I_BEAM,
        400, 150, 8.6, 16.0, 14, 7840, 20460e4, 622e4, 65.8e4, 1023e3, 82.9e3, 162, 8.91, 61.5),
    "ISMB450": SectionProperties("ISMB450", SectionCode.IS800, SectionType.I_BEAM,
        450, 150, 9.4, 17.4, 14, 9270, 30390e4, 834e4, 85.5e4, 1350e3, 111e3, 181, 9.49, 72.8),
    "ISMB500": SectionProperties("ISMB500", SectionCode.IS800, SectionType.I_BEAM,
        500, 180, 10.2, 17.2, 17, 10970, 45220e4, 1370e4, 100e4, 1810e3, 152e3, 203, 11.2, 86.1),
    "ISMB550": SectionProperties("ISMB550", SectionCode.IS800, SectionType.I_BEAM,
        550, 190, 11.2, 19.3, 18, 13230, 64900e4, 1830e4, 140e4, 2360e3, 193e3, 222, 11.8, 104),
    "ISMB600": SectionProperties("ISMB600", SectionCode.IS800, SectionType.I_BEAM,
        600, 210, 12.0, 20.8, 20, 15600, 91800e4, 2650e4, 180e4, 3060e3, 253e3, 243, 13.0, 122),
    # Channels
    "ISMC100": SectionProperties("ISMC100", SectionCode.IS800, SectionType.CHANNEL,
        100, 50, 5.0, 7.5, 8, 1170, 192e4, 26.0e4, 2.20e4, 38.4e3, 10.4e3, 40.5, 4.71, 9.19),
    "ISMC150": SectionProperties("ISMC150", SectionCode.IS800, SectionType.CHANNEL,
        150, 75, 5.7, 9.0, 10, 2170, 779e4, 103e4, 7.40e4, 104e3, 27.4e3, 59.9, 6.89, 17.0),
    "ISMC200": SectionProperties("ISMC200", SectionCode.IS800, SectionType.CHANNEL,
        200, 75, 6.2, 11.4, 11, 2850, 1830e4, 141e4, 14.0e4, 183e3, 37.5e3, 80.1, 7.03, 22.4),
    "ISMC300": SectionProperties("ISMC300", SectionCode.IS800, SectionType.CHANNEL,
        300, 90, 7.8, 13.6, 13, 4560, 6420e4, 313e4, 35.0e4, 428e3, 69.4e3, 119, 8.28, 35.8),
    # Angles
    "ISA50x50x5": SectionProperties("ISA50x50x5", SectionCode.IS800, SectionType.ANGLE,
        50, 50, 5.0, 5.0, 7, 480, 11.0e4, 11.0e4, 0.40e4, 4.40e3, 4.40e3, 15.1, 15.1, 3.77),
    "ISA75x75x6": SectionProperties("ISA75x75x6", SectionCode.IS800, SectionType.ANGLE,
        75, 75, 6.0, 6.0, 8, 866, 38.0e4, 38.0e4, 1.20e4, 10.1e3, 10.1e3, 20.9, 20.9, 6.80),
    "ISA100x100x8": SectionProperties("ISA100x100x8", SectionCode.IS800, SectionType.ANGLE,
        100, 100, 8.0, 8.0, 10, 1540, 117e4, 117e4, 4.10e4, 23.5e3, 23.5e3, 27.6, 27.6, 12.1),
    "ISA150x150x12": SectionProperties("ISA150x150x12", SectionCode.IS800, SectionType.ANGLE,
        150, 150, 12.0, 12.0, 12, 3450, 566e4, 566e4, 21.0e4, 75.5e3, 75.5e3, 40.5, 40.5, 27.1),
}

# AISC Sections (American)
AISC_SECTIONS: Dict[str, SectionProperties] = {
    "W10x12": SectionProperties("W10x12", SectionCode.AISC, SectionType.I_BEAM,
        251, 101.6, 4.8, 5.3, 5, 2260, 873e4, 35.2e4, 1.79e4, 69.6e3, 6.92e3, 62.2, 3.95, 17.8),
    "W12x26": SectionProperties("W12x26", SectionCode.AISC, SectionType.I_BEAM,
        310, 165.1, 5.8, 9.7, 10, 4950, 4540e4, 369e4, 23.5e4, 293e3, 44.7e3, 95.8, 8.64, 38.7),
    "W14x30": SectionProperties("W14x30", SectionCode.AISC, SectionType.I_BEAM,
        352, 171.5, 6.9, 9.8, 10, 5710, 6690e4, 483e4, 31.5e4, 380e3, 56.4e3, 108, 9.20, 44.6),
    "W16x40": SectionProperties("W16x40", SectionCode.AISC, SectionType.I_BEAM,
        406, 177.8, 7.7, 12.8, 11, 7610, 12900e4, 699e4, 60.7e4, 635e3, 78.6e3, 130, 9.58, 59.5),
    "W18x50": SectionProperties("W18x50", SectionCode.AISC, SectionType.I_BEAM,
        457, 190.5, 9.0, 14.5, 12, 9480, 19900e4, 1010e4, 95.5e4, 870e3, 106e3, 145, 10.3, 74.4),
    "W21x62": SectionProperties("W21x62", SectionCode.AISC, SectionType.I_BEAM,
        533, 209.6, 10.2, 15.6, 13, 11800, 32200e4, 1540e4, 150e4, 1210e3, 147e3, 165, 11.4, 92.4),
    # HSS (Hollow Structural Sections)
    "HSS6x4x1/4": SectionProperties("HSS6x4x1/4", SectionCode.AISC, SectionType.HSS_RECT,
        152, 102, 6.4, 6.4, 6, 2970, 1160e4, 633e4, 0, 153e3, 124e3, 62.5, 46.2, 23.3),
    "HSS8x6x3/8": SectionProperties("HSS8x6x3/8", SectionCode.AISC, SectionType.HSS_RECT,
        203, 152, 9.5, 9.5, 10, 6260, 4340e4, 2750e4, 0, 427e3, 362e3, 83.3, 66.3, 49.1),
}

# Eurocode Sections (IPE, HEA, HEB)
EUROCODE_SECTIONS: Dict[str, SectionProperties] = {
    "IPE200": SectionProperties("IPE200", SectionCode.EUROCODE, SectionType.I_BEAM,
        200, 100, 5.6, 8.5, 12, 2850, 1943e4, 142e4, 6.98e4, 194e3, 28.5e3, 82.6, 7.06, 22.4),
    "IPE270": SectionProperties("IPE270", SectionCode.EUROCODE, SectionType.I_BEAM,
        270, 135, 6.6, 10.2, 15, 4590, 5790e4, 420e4, 15.9e4, 429e3, 62.2e3, 112, 9.56, 36.1),
    "IPE330": SectionProperties("IPE330", SectionCode.EUROCODE, SectionType.I_BEAM,
        330, 160, 7.5, 11.5, 18, 6260, 11770e4, 788e4, 28.1e4, 713e3, 98.5e3, 137, 11.2, 49.1),
    "IPE400": SectionProperties("IPE400", SectionCode.EUROCODE, SectionType.I_BEAM,
        400, 180, 8.6, 13.5, 21, 8450, 23130e4, 1318e4, 51.1e4, 1156e3, 146e3, 165, 12.5, 66.3),
    "HEA200": SectionProperties("HEA200", SectionCode.EUROCODE, SectionType.I_BEAM,
        190, 200, 6.5, 10.0, 18, 5380, 3692e4, 1336e4, 21.0e4, 389e3, 134e3, 82.8, 49.8, 42.3),
    "HEA300": SectionProperties("HEA300", SectionCode.EUROCODE, SectionType.I_BEAM,
        290, 300, 8.5, 14.0, 27, 11250, 18260e4, 6310e4, 85.0e4, 1260e3, 421e3, 127, 74.9, 88.3),
    "HEB200": SectionProperties("HEB200", SectionCode.EUROCODE, SectionType.I_BEAM,
        200, 200, 9.0, 15.0, 18, 7810, 5696e4, 2003e4, 59.3e4, 570e3, 200e3, 85.4, 50.7, 61.3),
    "HEB300": SectionProperties("HEB300", SectionCode.EUROCODE, SectionType.I_BEAM,
        300, 300, 11.0, 19.0, 27, 14910, 25170e4, 8563e4, 185e4, 1678e3, 571e3, 130, 75.8, 117),
}

# British Sections (UB, UC, PFC)
BRITISH_SECTIONS: Dict[str, SectionProperties] = {
    "UB305x102x25": SectionProperties("UB305x102x25", SectionCode.BRITISH, SectionType.I_BEAM,
        305, 102, 5.8, 7.0, 8, 3190, 4455e4, 123e4, 6.38e4, 292e3, 24.2e3, 118, 6.21, 25.0),
    "UB356x127x33": SectionProperties("UB356x127x33", SectionCode.BRITISH, SectionType.I_BEAM,
        349, 125, 6.0, 8.5, 10, 4210, 8249e4, 280e4, 13.2e4, 473e3, 44.8e3, 140, 8.15, 33.0),
    "UB457x152x52": SectionProperties("UB457x152x52", SectionCode.BRITISH, SectionType.I_BEAM,
        449, 152, 7.6, 10.9, 10, 6640, 21370e4, 645e4, 36.4e4, 952e3, 84.9e3, 180, 9.86, 52.0),
    "UC152x152x23": SectionProperties("UC152x152x23", SectionCode.BRITISH, SectionType.I_BEAM,
        152, 152, 5.8, 6.8, 8, 2930, 1263e4, 403e4, 4.24e4, 166e3, 53.0e3, 65.7, 37.1, 23.0),
    "UC254x254x73": SectionProperties("UC254x254x73", SectionCode.BRITISH, SectionType.I_BEAM,
        254, 254, 8.6, 14.2, 13, 9310, 11410e4, 3873e4, 62.5e4, 898e3, 305e3, 111, 64.5, 73.0),
}


class SectionDatabase:
    """Unified section database with search and filtering"""
    
    def __init__(self):
        self.sections: Dict[str, SectionProperties] = {}
        self._load_all()
    
    def _load_all(self):
        self.sections.update(IS800_SECTIONS)
        self.sections.update(AISC_SECTIONS)
        self.sections.update(EUROCODE_SECTIONS)
        self.sections.update(BRITISH_SECTIONS)
    
    def get(self, name: str) -> Optional[SectionProperties]:
        return self.sections.get(name)
    
    def search(self, query: str) -> List[SectionProperties]:
        query = query.upper()
        return [s for s in self.sections.values() if query in s.name.upper()]
    
    def filter_by_code(self, code: SectionCode) -> List[SectionProperties]:
        return [s for s in self.sections.values() if s.code == code]
    
    def filter_by_type(self, section_type: SectionType) -> List[SectionProperties]:
        return [s for s in self.sections.values() if s.type == section_type]
    
    def to_dict(self) -> Dict:
        return {name: {
            "depth": s.depth, "width": s.width, "tw": s.tw, "tf": s.tf,
            "area": s.area, "Iz": s.Iz, "Iy": s.Iy, "Ix": s.Ix,
            "Sz": s.Sz, "Sy": s.Sy, "weight": s.weight
        } for name, s in self.sections.items()}


# ============================================
# DYNAMIC CALCULATORS
# ============================================

class TaperedSectionCalculator:
    """Calculate properties for tapered I-sections at integration points"""
    
    @staticmethod
    def calc_tapered(
        start_depth: float,
        end_depth: float,
        width: float,
        tw: float,
        tf: float,
        length: float,
        n_points: int = 10
    ) -> List[Dict]:
        """
        Calculate section properties at n_points along a tapered I-beam.
        
        Returns list of dicts with x, depth, area, Iz, Iy for each point.
        """
        results = []
        
        for i in range(n_points + 1):
            x = i * length / n_points
            ratio = i / n_points
            
            # Linear interpolation of depth
            d = start_depth + ratio * (end_depth - start_depth)
            
            # Calculate properties for I-section at this depth
            hw = d - 2 * tf  # Web height
            
            # Area = 2 flanges + web
            area = 2 * width * tf + hw * tw
            
            # Iz (major axis) = flanges + web contribution
            flange_Iz = 2 * (width * tf**3 / 12 + width * tf * ((d - tf) / 2)**2)
            web_Iz = tw * hw**3 / 12
            Iz = flange_Iz + web_Iz
            
            # Iy (minor axis)
            Iy = 2 * (tf * width**3 / 12) + hw * tw**3 / 12
            
            # Section modulus
            Sz = Iz / (d / 2)
            Sy = Iy / (width / 2)
            
            results.append({
                "x": x,
                "depth": d,
                "area": area,
                "Iz": Iz,
                "Iy": Iy,
                "Sz": Sz,
                "Sy": Sy
            })
        
        return results


class PolygonPropertyCalculator:
    """Calculate section properties for arbitrary polygon using Green's Theorem"""
    
    @staticmethod
    def calculate(vertices: List[Tuple[float, float]]) -> Dict:
        """
        Calculate Area and Moments of Inertia for arbitrary polygon.
        
        Vertices should be ordered (CW or CCW), will be closed automatically.
        Uses Green's Theorem for integration.
        """
        n = len(vertices)
        if n < 3:
            raise ValueError("Need at least 3 vertices")
        
        # Ensure closed polygon
        if vertices[0] != vertices[-1]:
            vertices = list(vertices) + [vertices[0]]
            n += 1
        
        # Area using Shoelace formula
        area = 0
        for i in range(n - 1):
            x1, y1 = vertices[i]
            x2, y2 = vertices[i + 1]
            area += x1 * y2 - x2 * y1
        area = abs(area) / 2
        
        # Centroid
        cx, cy = 0, 0
        for i in range(n - 1):
            x1, y1 = vertices[i]
            x2, y2 = vertices[i + 1]
            cross = x1 * y2 - x2 * y1
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        cx /= (6 * area)
        cy /= (6 * area)
        
        # Moments of inertia about centroid (using parallel axis theorem)
        Ixx, Iyy, Ixy = 0, 0, 0
        for i in range(n - 1):
            x1, y1 = vertices[i][0] - cx, vertices[i][1] - cy
            x2, y2 = vertices[i + 1][0] - cx, vertices[i + 1][1] - cy
            
            cross = x1 * y2 - x2 * y1
            Ixx += (y1**2 + y1*y2 + y2**2) * cross
            Iyy += (x1**2 + x1*x2 + x2**2) * cross
            Ixy += (x1*y2 + 2*x1*y1 + 2*x2*y2 + x2*y1) * cross
        
        Ixx = abs(Ixx) / 12
        Iyy = abs(Iyy) / 12
        Ixy = Ixy / 24
        
        return {
            "area": area,
            "centroid_x": cx,
            "centroid_y": cy,
            "Ixx": Ixx,
            "Iyy": Iyy,
            "Ixy": Ixy,
            "rx": math.sqrt(Ixx / area) if area > 0 else 0,
            "ry": math.sqrt(Iyy / area) if area > 0 else 0
        }


class CompositeSectionCalculator:
    """Calculate transformed section properties for Steel + Concrete composite"""
    
    @staticmethod
    def calc_composite(
        steel_section: SectionProperties,
        slab_width: float,
        slab_thickness: float,
        E_steel: float = 200000,  # MPa
        E_concrete: float = 25000  # MPa (M25 concrete)
    ) -> Dict:
        """
        Calculate transformed section properties for composite I-beam + slab.
        
        Uses modular ratio n = E_s / E_c
        """
        n = E_steel / E_concrete
        
        # Steel properties
        As = steel_section.area
        Is = steel_section.Iz
        d_steel = steel_section.depth
        
        # Concrete slab (transformed to equivalent steel)
        Ac_transformed = (slab_width * slab_thickness) / n
        Ic_transformed = (slab_width * slab_thickness**3 / 12) / n
        
        # Total transformed area
        A_total = As + Ac_transformed
        
        # Neutral axis from bottom of steel
        y_steel = d_steel / 2  # Steel centroid from bottom
        y_concrete = d_steel + slab_thickness / 2  # Concrete centroid from bottom
        
        y_na = (As * y_steel + Ac_transformed * y_concrete) / A_total
        
        # Transformed moment of inertia using parallel axis theorem
        d_steel_shift = y_na - y_steel
        d_concrete_shift = y_concrete - y_na
        
        I_transformed = (
            Is + As * d_steel_shift**2 +
            Ic_transformed + Ac_transformed * d_concrete_shift**2
        )
        
        # Section modulus (positive = bottom fiber, negative = top fiber in concrete)
        S_bottom = I_transformed / y_na
        S_top = I_transformed / (d_steel + slab_thickness - y_na)
        
        return {
            "modular_ratio": n,
            "A_transformed": A_total,
            "I_transformed": I_transformed,
            "y_neutral_axis": y_na,
            "S_bottom": S_bottom,
            "S_top_steel": S_top,
            "S_top_concrete": S_top * n,  # Convert back to concrete
            "steel_section": steel_section.name,
            "slab_width": slab_width,
            "slab_thickness": slab_thickness
        }


# ============================================
# COLD FORMED & PARAMETRIC SECTIONS
# ============================================

class ColdFormedCalculator:
    """Calculate properties for cold-formed sections (Z-purlins, C-channels)"""
    
    @staticmethod
    def calc_z_purlin(
        depth: float,
        flange_width: float,
        lip_height: float,
        thickness: float
    ) -> Dict:
        """Calculate Z-purlin section properties"""
        t = thickness
        
        # Centerline dimensions
        h = depth - t
        b = flange_width - t/2
        c = lip_height - t/2
        
        # Area (thin-walled approximation)
        area = t * (h + 2*b + 2*c)
        
        # Centroid (symmetric about web center for Z)
        y_cg = depth / 2
        x_cg = 0  # Symmetric
        
        # Moment of inertia (simplified)
        Iz = t * h**3 / 12 + 2 * (t * b * (h/2)**2) + 2 * (t * c**3 / 12 + t * c * (h/2 - c/2)**2)
        Iy = 2 * (t * b**3 / 12 + t * b * (b/2)**2) + t * h**3 / 12 * 0.01  # Web contributes little
        
        return {
            "type": "Z-Purlin",
            "depth": depth,
            "flange_width": flange_width,
            "lip_height": lip_height,
            "thickness": thickness,
            "area": area,
            "Iz": Iz,
            "Iy": Iy,
            "y_centroid": y_cg,
            "x_centroid": x_cg,
            "weight": area * 7850 / 1e6  # kg/m (steel)
        }
    
    @staticmethod
    def calc_c_channel(
        depth: float,
        flange_width: float,
        lip_height: float,
        thickness: float
    ) -> Dict:
        """Calculate cold-formed C-channel section properties"""
        t = thickness
        
        h = depth - t
        b = flange_width - t/2
        c = lip_height - t/2
        
        area = t * (h + 2*b + 2*c)
        
        # Shear center offset for C-section
        e = 3 * b**2 / (h + 6*b) if (h + 6*b) > 0 else 0
        
        Iz = t * h**3 / 12 + 2 * t * b * (h/2)**2 + 2 * (t * c**3 / 12)
        Iy = 2 * t * b**3 / 3 + 2 * t * c * (b - c/2)**2
        
        return {
            "type": "C-Channel (Cold Formed)",
            "depth": depth,
            "flange_width": flange_width,
            "lip_height": lip_height,
            "thickness": thickness,
            "area": area,
            "Iz": Iz,
            "Iy": Iy,
            "shear_center_offset": e,
            "weight": area * 7850 / 1e6
        }


class ParametricSectionCalculator:
    """Calculate properties for parametric shapes"""
    
    @staticmethod
    def circle(diameter: float) -> Dict:
        r = diameter / 2
        area = math.pi * r**2
        I = math.pi * r**4 / 4
        return {
            "type": "Circle",
            "diameter": diameter,
            "area": area,
            "Iz": I,
            "Iy": I,
            "Sz": I / r,
            "r": math.sqrt(I / area)
        }
    
    @staticmethod
    def rectangle(width: float, height: float) -> Dict:
        area = width * height
        Iz = width * height**3 / 12
        Iy = height * width**3 / 12
        return {
            "type": "Rectangle",
            "width": width,
            "height": height,
            "area": area,
            "Iz": Iz,
            "Iy": Iy,
            "Sz": Iz / (height / 2),
            "Sy": Iy / (width / 2)
        }
    
    @staticmethod
    def hollow_rectangle(width: float, height: float, thickness: float) -> Dict:
        wo, ho = width, height
        wi, hi = width - 2*thickness, height - 2*thickness
        area = wo * ho - wi * hi
        Iz = (wo * ho**3 - wi * hi**3) / 12
        Iy = (ho * wo**3 - hi * wi**3) / 12
        return {
            "type": "Hollow Rectangle",
            "width": width,
            "height": height,
            "thickness": thickness,
            "area": area,
            "Iz": Iz,
            "Iy": Iy
        }
    
    @staticmethod
    def t_section(flange_width: float, flange_thickness: float, 
                  web_height: float, web_thickness: float) -> Dict:
        # Areas
        Af = flange_width * flange_thickness
        Aw = web_height * web_thickness
        area = Af + Aw
        
        # Centroid from bottom
        yf = web_height + flange_thickness / 2
        yw = web_height / 2
        y_cg = (Af * yf + Aw * yw) / area
        
        # Moment of inertia about centroid
        Iz = (flange_width * flange_thickness**3 / 12 + Af * (yf - y_cg)**2 +
              web_thickness * web_height**3 / 12 + Aw * (yw - y_cg)**2)
        Iy = flange_thickness * flange_width**3 / 12 + web_height * web_thickness**3 / 12
        
        return {
            "type": "T-Section",
            "flange_width": flange_width,
            "flange_thickness": flange_thickness,
            "web_height": web_height,
            "web_thickness": web_thickness,
            "area": area,
            "y_centroid": y_cg,
            "Iz": Iz,
            "Iy": Iy
        }
    
    @staticmethod
    def trapezoid(top_width: float, bottom_width: float, height: float) -> Dict:
        a, b, h = top_width, bottom_width, height
        area = (a + b) * h / 2
        
        # Centroid from bottom
        y_cg = h * (2*a + b) / (3 * (a + b))
        
        # Moment of inertia
        Iz = h**3 * (a**2 + 4*a*b + b**2) / (36 * (a + b))
        
        return {
            "type": "Trapezoid",
            "top_width": top_width,
            "bottom_width": bottom_width,
            "height": height,
            "area": area,
            "y_centroid": y_cg,
            "Iz": Iz
        }


# ============================================
# EXPORTS
# ============================================

# Singleton database instance
section_db = SectionDatabase()

__all__ = [
    'SectionCode',
    'SectionType',
    'SectionProperties',
    'SectionDatabase',
    'section_db',
    'TaperedSectionCalculator',
    'PolygonPropertyCalculator',
    'CompositeSectionCalculator',
    'ColdFormedCalculator',
    'ParametricSectionCalculator'
]
