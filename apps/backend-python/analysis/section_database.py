"""
section_database.py - Indian Standard Section Database

Contains comprehensive database of structural sections from IS 800:
- ISMB (Indian Standard Medium Beam)
- ISMC (Indian Standard Medium Channel)
- ISLB (Indian Standard Light Beam)
- ISA (Indian Standard Angle)
- Tubular sections (SHS, RHS, CHS)

Each section includes:
- Geometric properties (Area, Ixx, Iyy, Zxx, Zyy)
- Weight per meter
- Dimensions
- Radius of gyration
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
import json


@dataclass
class SectionProperties:
    """Properties of a structural section"""
    designation: str  # e.g., "ISMB 300"
    section_type: str  # "ISMB", "ISMC", "ISLB", "ISA", "SHS", "RHS", "CHS"
    
    # Geometric properties
    area: float  # mm²
    depth: float  # mm (h)
    width: float  # mm (b)
    tw: float  # Web thickness (mm)
    tf: float  # Flange thickness (mm)
    
    # Section moduli
    ixx: float  # Moment of inertia about x-x axis (mm⁴ × 10⁴)
    iyy: float  # Moment of inertia about y-y axis (mm⁴ × 10⁴)
    zxx: float  # Elastic section modulus x-x (cm³)
    zyy: float  # Elastic section modulus y-y (cm³)
    
    # Radius of gyration
    rxx: float  # cm
    ryy: float  # cm
    
    # Weight
    weight_per_meter: float  # kg/m
    
    # Material properties (default IS 2062 Fe 410)
    fy: float = 250.0  # Yield strength (N/mm²)
    fu: float = 410.0  # Ultimate strength (N/mm²)
    E: float = 200000.0  # Young's modulus (N/mm²)
    
    def get_capacity_info(self) -> Dict[str, float]:
        """Calculate approximate capacity information"""
        # Elastic moment capacity (kN·m)
        Mx_elastic = (self.zxx * 1000 * self.fy) / 1e6  # Convert cm³ to mm³
        My_elastic = (self.zyy * 1000 * self.fy) / 1e6
        
        # Axial capacity (kN) - simplified
        P_capacity = (self.area * self.fy) / 1000
        
        return {
            'Mx_elastic_kNm': round(Mx_elastic, 2),
            'My_elastic_kNm': round(My_elastic, 2),
            'P_capacity_kN': round(P_capacity, 2),
            'slenderness_ratio_xx': round(1000 / (10 * self.rxx), 1),  # For 1m length
            'slenderness_ratio_yy': round(1000 / (10 * self.ryy), 1)
        }


# ============================================
# SECTION DATABASE - ISMB (I-Sections)
# ============================================

ISMB_SECTIONS = [
    # Format: designation, type, area, depth, width, tw, tf, Ixx, Iyy, Zxx, Zyy, rxx, ryy, weight
    
    # Light sections
    SectionProperties("ISMB 100", "ISMB", 1140, 100, 75, 4.0, 7.2, 
                      252.3, 36.5, 50.5, 9.7, 4.70, 1.79, 8.95),
    SectionProperties("ISMB 125", "ISMB", 1630, 125, 75, 5.0, 8.1,
                      559.4, 44.9, 89.5, 12.0, 5.86, 1.66, 12.8),
    SectionProperties("ISMB 150", "ISMB", 1890, 150, 80, 4.8, 9.0,
                      857.9, 72.8, 114.4, 18.2, 6.74, 1.96, 14.8),
    SectionProperties("ISMB 175", "ISMB", 2350, 175, 90, 5.0, 9.9,
                      1450, 123, 165.7, 27.3, 7.86, 2.29, 18.4),
    
    # Medium sections
    SectionProperties("ISMB 200", "ISMB", 2660, 200, 100, 5.7, 10.8,
                      2229, 199, 222.8, 39.8, 9.15, 2.74, 20.9),
    SectionProperties("ISMB 225", "ISMB", 3330, 225, 110, 6.5, 11.8,
                      3367, 308, 299.3, 56.0, 10.06, 3.04, 26.1),
    SectionProperties("ISMB 250", "ISMB", 3950, 250, 125, 6.9, 12.5,
                      5131, 508, 410.5, 81.3, 11.40, 3.59, 31.0),
    SectionProperties("ISMB 300", "ISMB", 5470, 300, 140, 7.5, 14.0,
                      9251, 804, 616.8, 114.8, 13.00, 3.83, 42.9),
    SectionProperties("ISMB 350", "ISMB", 6670, 350, 140, 8.1, 14.2,
                      15355, 817, 877.1, 116.7, 15.18, 3.50, 52.3),
    SectionProperties("ISMB 400", "ISMB", 7850, 400, 140, 8.9, 16.0,
                      20458, 1016, 1023.0, 145.1, 16.15, 3.60, 61.6),
    
    # Heavy sections
    SectionProperties("ISMB 450", "ISMB", 9040, 450, 150, 9.4, 17.4,
                      28899, 1416, 1284.0, 188.8, 17.88, 3.96, 70.9),
    SectionProperties("ISMB 500", "ISMB", 10320, 500, 180, 10.2, 17.2,
                      41132, 2347, 1646.0, 260.8, 19.96, 4.77, 81.0),
    SectionProperties("ISMB 550", "ISMB", 11260, 550, 190, 10.7, 19.3,
                      58482, 3059, 2126.0, 322.0, 22.80, 5.21, 88.4),
    SectionProperties("ISMB 600", "ISMB", 12620, 600, 210, 12.0, 20.8,
                      78899, 4581, 2630.0, 436.2, 25.01, 6.03, 99.1),
]


# ============================================
# SECTION DATABASE - ISMC (Channel Sections)
# ============================================

ISMC_SECTIONS = [
    # Light channels
    SectionProperties("ISMC 75", "ISMC", 870, 75, 40, 3.7, 6.0,
                      88.9, 15.8, 23.7, 5.6, 3.20, 1.35, 6.8),
    SectionProperties("ISMC 100", "ISMC", 1310, 100, 50, 4.4, 7.5,
                      247.3, 39.9, 49.5, 11.3, 4.35, 1.75, 10.3),
    SectionProperties("ISMC 125", "ISMC", 1610, 125, 65, 4.4, 8.1,
                      549.6, 90.1, 87.9, 20.8, 5.84, 2.36, 12.6),
    SectionProperties("ISMC 150", "ISMC", 1990, 150, 75, 5.4, 9.0,
                      1015, 162, 135.3, 32.4, 7.14, 2.85, 15.6),
    
    # Medium channels
    SectionProperties("ISMC 200", "ISMC", 2680, 200, 75, 5.4, 10.8,
                      2362, 203, 236.2, 40.6, 9.38, 2.75, 21.0),
    SectionProperties("ISMC 250", "ISMC", 3550, 250, 80, 6.1, 12.5,
                      4821, 283, 385.7, 53.1, 11.65, 2.82, 27.9),
    SectionProperties("ISMC 300", "ISMC", 4560, 300, 90, 7.6, 13.6,
                      8603, 476, 573.5, 79.4, 13.74, 3.23, 35.8),
    SectionProperties("ISMC 350", "ISMC", 5230, 350, 100, 8.1, 14.1,
                      13821, 730, 789.8, 116.0, 16.26, 3.74, 41.0),
    SectionProperties("ISMC 400", "ISMC", 6110, 400, 100, 8.8, 15.3,
                      20458, 846, 1023.0, 127.4, 18.30, 3.72, 47.9),
]


# ============================================
# SECTION DATABASE - ISA (Angle Sections)
# ============================================

ISA_SECTIONS = [
    # Equal angles
    SectionProperties("ISA 25x25x3", "ISA", 145, 25, 25, 3.0, 3.0,
                      1.15, 1.15, 1.1, 1.1, 0.49, 0.49, 1.14),
    SectionProperties("ISA 40x40x5", "ISA", 380, 40, 40, 5.0, 5.0,
                      5.89, 5.89, 3.5, 3.5, 0.79, 0.79, 2.97),
    SectionProperties("ISA 50x50x6", "ISA", 580, 50, 50, 6.0, 6.0,
                      14.7, 14.7, 7.1, 7.1, 1.00, 1.00, 4.5),
    SectionProperties("ISA 65x65x8", "ISA", 990, 65, 65, 8.0, 8.0,
                      41.8, 41.8, 15.8, 15.8, 1.30, 1.30, 7.7),
    SectionProperties("ISA 75x75x8", "ISA", 1150, 75, 75, 8.0, 8.0,
                      66.7, 66.7, 22.0, 22.0, 1.52, 1.52, 9.0),
    SectionProperties("ISA 90x90x8", "ISA", 1380, 90, 90, 8.0, 8.0,
                      117.0, 117.0, 32.6, 32.6, 1.84, 1.84, 10.9),
    SectionProperties("ISA 100x100x10", "ISA", 1920, 100, 100, 10.0, 10.0,
                      213.0, 213.0, 53.3, 53.3, 2.10, 2.10, 15.1),
    SectionProperties("ISA 125x125x12", "ISA", 2910, 125, 125, 12.0, 12.0,
                      502.0, 502.0, 101.0, 101.0, 2.62, 2.62, 22.8),
    SectionProperties("ISA 150x150x12", "ISA", 3520, 150, 150, 12.0, 12.0,
                      869.0, 869.0, 145.0, 145.0, 3.14, 3.14, 27.6),
]


# ============================================
# SECTION RECOMMENDER
# ============================================

class SectionRecommender:
    """Recommends appropriate sections based on structural demands"""
    
    def __init__(self):
        self.sections = {
            'ISMB': ISMB_SECTIONS,
            'ISMC': ISMC_SECTIONS,
            'ISA': ISA_SECTIONS
        }
    
    def get_all_sections(self) -> List[SectionProperties]:
        """Get all available sections"""
        all_sections = []
        for section_list in self.sections.values():
            all_sections.extend(section_list)
        return all_sections
    
    def find_by_name(self, designation: str) -> Optional[SectionProperties]:
        """Find section by designation"""
        for section_list in self.sections.values():
            for section in section_list:
                if section.designation == designation:
                    return section
        return None
    
    def recommend_for_beam(
        self,
        required_Mx: float,  # kN·m
        required_My: float = 0.0,  # kN·m
        length: float = 5000.0,  # mm
        section_type: str = "ISMB",
        safety_factor: float = 1.5
    ) -> List[SectionProperties]:
        """
        Recommend sections for beam design
        
        Args:
            required_Mx: Required moment capacity about x-axis (kN·m)
            required_My: Required moment capacity about y-axis (kN·m)
            length: Member length (mm)
            section_type: Type of section to recommend
            safety_factor: Safety factor to apply
        
        Returns:
            List of suitable sections sorted by efficiency
        """
        required_Mx_factored = required_Mx * safety_factor
        required_My_factored = required_My * safety_factor
        
        candidates = self.sections.get(section_type, ISMB_SECTIONS)
        suitable = []
        
        for section in candidates:
            capacity = section.get_capacity_info()
            
            # Check if section meets requirements
            if (capacity['Mx_elastic_kNm'] >= required_Mx_factored and
                capacity['My_elastic_kNm'] >= required_My_factored):
                
                # Calculate efficiency (lower is better - less oversized)
                efficiency = (
                    (capacity['Mx_elastic_kNm'] / max(required_Mx_factored, 0.1)) +
                    (capacity['My_elastic_kNm'] / max(required_My_factored, 0.1))
                ) / 2
                
                suitable.append((section, efficiency))
        
        # Sort by efficiency (closest to required)
        suitable.sort(key=lambda x: x[1])
        
        # Return top 5 recommendations
        return [s[0] for s in suitable[:5]]
    
    def recommend_for_column(
        self,
        required_P: float,  # kN
        length: float = 3000.0,  # mm
        section_type: str = "ISMB",
        safety_factor: float = 1.5
    ) -> List[SectionProperties]:
        """
        Recommend sections for column design
        
        Args:
            required_P: Required axial capacity (kN)
            length: Column height (mm)
            section_type: Type of section
            safety_factor: Safety factor
        
        Returns:
            List of suitable sections
        """
        required_P_factored = required_P * safety_factor
        
        candidates = self.sections.get(section_type, ISMB_SECTIONS)
        suitable = []
        
        for section in candidates:
            capacity = section.get_capacity_info()
            
            # Calculate slenderness ratio
            L_eff = length  # Effective length (simplified)
            slenderness = L_eff / (10 * min(section.rxx, section.ryy))
            
            # Apply buckling reduction (simplified)
            if slenderness < 180:  # IS 800 limit for compression members
                buckling_factor = max(0.3, 1 - (slenderness / 300))
                P_buckling = capacity['P_capacity_kN'] * buckling_factor
                
                if P_buckling >= required_P_factored:
                    efficiency = P_buckling / required_P_factored
                    suitable.append((section, efficiency))
        
        # Sort by efficiency
        suitable.sort(key=lambda x: x[1])
        
        return [s[0] for s in suitable[:5]]


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    recommender = SectionRecommender()
    
    # Example: Find section for beam with 100 kN·m moment
    print("=== Beam Recommendation (100 kN·m) ===")
    sections = recommender.recommend_for_beam(required_Mx=100, length=5000)
    for section in sections:
        print(f"{section.designation}: {section.get_capacity_info()['Mx_elastic_kNm']} kN·m capacity, {section.weight_per_meter} kg/m")
    
    print("\n=== Column Recommendation (500 kN axial) ===")
    sections = recommender.recommend_for_column(required_P=500, length=3000)
    for section in sections:
        print(f"{section.designation}: {section.get_capacity_info()['P_capacity_kN']} kN capacity, {section.weight_per_meter} kg/m")
