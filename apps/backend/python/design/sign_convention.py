"""
sign_convention.py - Design Code Sign Convention Handler

Manages sign conventions for different design codes:
- IS 456:2000 (Concrete, India)
- ACI 318-19 (Concrete, USA)
- Eurocode 2 EN 1992-1-1 (Concrete, Europe)
- IS 800:2007 (Steel, India)
- AISC 360-22 (Steel, USA)

Key Principle:
- Input moments come from FEA with consistent sign convention
- Each design code interprets these moments differently
- This module handles code-specific transformations
"""

from enum import Enum
from typing import Tuple, NamedTuple
from dataclasses import dataclass


class DesignCodeType(Enum):
    """Supported design codes"""
    IS456_2000 = "IS456"           # Reinforced Concrete (India)
    ACI318_19 = "ACI318-19"        # Reinforced Concrete (USA)
    EUROCODE2 = "EC2"              # Reinforced Concrete (Europe)
    IS800_2007 = "IS800"           # Structural Steel (India)
    AISC360_22 = "AISC360-22"      # Structural Steel (USA)


class MaterialType(Enum):
    """Material classification"""
    CONCRETE = "concrete"
    STEEL = "steel"
    TIMBER = "timber"


class MomentConvention(Enum):
    """Sign convention for bending moments"""
    
    # Concrete codes: Positive = Sagging (tension at bottom)
    TENSION_BOTTOM_POSITIVE = "tension_bottom_positive"  # IS456, ACI318, EC2
    
    # Steel codes: Positive = Compression at top
    COMPRESSION_TOP_POSITIVE = "compression_top_positive"  # IS800, AISC


@dataclass
class CodeConventionRules:
    """Rules for a design code's sign convention"""
    code_name: str
    code_type: DesignCodeType
    material: MaterialType
    moment_convention: MomentConvention
    requires_signed_moments: bool  # True = signs matter; False = use absolute
    requires_biaxial_check: bool
    requires_moment_gradient: bool  # For lateral torsional buckling
    

class SignConventionHandler:
    """
    Manages sign conventions across design codes.
    
    Key methods:
    - get_design_demands(): Get moment & shear with proper sign handling
    - interpret_moment(): Interpret moment for reinforcement placement
    - get_capacity_demand(): Get absolute moment for capacity check
    """
    
    # Define rules for each code
    CODE_RULES = {
        DesignCodeType.IS456_2000: CodeConventionRules(
            code_name="IS 456:2000",
            code_type=DesignCodeType.IS456_2000,
            material=MaterialType.CONCRETE,
            moment_convention=MomentConvention.TENSION_BOTTOM_POSITIVE,
            requires_signed_moments=True,  # Need signs for rebar placement
            requires_biaxial_check=False,
            requires_moment_gradient=False,
        ),
        DesignCodeType.ACI318_19: CodeConventionRules(
            code_name="ACI 318-19",
            code_type=DesignCodeType.ACI318_19,
            material=MaterialType.CONCRETE,
            moment_convention=MomentConvention.TENSION_BOTTOM_POSITIVE,
            requires_signed_moments=True,
            requires_biaxial_check=False,
            requires_moment_gradient=False,
        ),
        DesignCodeType.EUROCODE2: CodeConventionRules(
            code_name="EN 1992-1-1 Eurocode 2",
            code_type=DesignCodeType.EUROCODE2,
            material=MaterialType.CONCRETE,
            moment_convention=MomentConvention.TENSION_BOTTOM_POSITIVE,
            requires_signed_moments=True,
            requires_biaxial_check=False,
            requires_moment_gradient=False,
        ),
        DesignCodeType.IS800_2007: CodeConventionRules(
            code_name="IS 800:2007",
            code_type=DesignCodeType.IS800_2007,
            material=MaterialType.STEEL,
            moment_convention=MomentConvention.COMPRESSION_TOP_POSITIVE,
            requires_signed_moments=True,  # Signs matter for gradient factors
            requires_biaxial_check=True,
            requires_moment_gradient=True,
        ),
        DesignCodeType.AISC360_22: CodeConventionRules(
            code_name="AISC 360-22",
            code_type=DesignCodeType.AISC360_22,
            material=MaterialType.STEEL,
            moment_convention=MomentConvention.COMPRESSION_TOP_POSITIVE,
            requires_signed_moments=True,
            requires_biaxial_check=True,
            requires_moment_gradient=True,
        ),
    }
    
    def __init__(self, design_code: DesignCodeType):
        """Initialize handler for specific design code"""
        if design_code not in self.CODE_RULES:
            raise ValueError(f"Design code {design_code.value} not supported")
        
        self.code = design_code
        self.rules = self.CODE_RULES[design_code]
    
    def is_concrete_code(self) -> bool:
        """Check if code is for concrete design"""
        return self.rules.material == MaterialType.CONCRETE
    
    def is_steel_code(self) -> bool:
        """Check if code is for steel design"""
        return self.rules.material == MaterialType.STEEL
    
    def get_design_demands(
        self,
        moment_y: float,      # kNm - Moment about Y-axis
        moment_z: float,      # kNm - Moment about Z-axis
        shear_y: float,       # kN - Shear along Y
        shear_z: float        # kN - Shear along Z
    ) -> Tuple[float, float, float, float]:
        """
        Get design demands with proper sign handling.
        
        Returns:
            (design_moment_y, design_moment_z, design_shear_y, design_shear_z)
        
        For concrete codes:
        - Returns signed moments (needed to determine rebar placement)
        - Returns absolute shears (only magnitude matters)
        
        For steel codes:
        - Returns all signed values (signs affect capacity calculations)
        """
        
        if self.is_concrete_code():
            # For concrete: preserve moment signs, use absolute shear
            return (
                moment_y,                    # Keep sign (sagging vs hogging)
                moment_z,                    # Keep sign
                abs(shear_y),               # Only magnitude matters
                abs(shear_z)                # Only magnitude matters
            )
        else:
            # For steel: preserve all signs
            return (moment_y, moment_z, shear_y, shear_z)
    
    def get_governing_moment(
        self,
        moment_y: float,
        moment_z: float,
        combined: bool = False
    ) -> float:
        """
        Get governing moment for capacity check.
        
        For uniaxial bending: Return absolute value of max(|My|, |Mz|)
        For biaxial: Return √(My² + Mz²) if code requires it
        """
        
        if combined and self.rules.requires_biaxial_check:
            # Steel codes often use combined moment
            return (moment_y ** 2 + moment_z ** 2) ** 0.5
        else:
            # Concrete & simple steel: use max absolute value
            return max(abs(moment_y), abs(moment_z))
    
    def interpret_moment_type(self, moment: float) -> str:
        """
        Interpret what type of moment this is based on code convention.
        
        Returns:
            "sagging" if tension at bottom
            "hogging" if tension at top
            "neutral" if zero
        """
        
        if abs(moment) < 1e-6:
            return "neutral"
        
        if self.rules.moment_convention == MomentConvention.TENSION_BOTTOM_POSITIVE:
            # Concrete codes: positive = sagging
            return "sagging" if moment > 0 else "hogging"
        else:
            # Steel codes: positive = compression at top
            return "compression_at_top" if moment > 0 else "compression_at_bottom"
    
    def get_rebar_placement(
        self,
        moment_x: float,    # Along beam length
        moment_y: float,    # About Y-axis
        moment_z: float     # About Z-axis
    ) -> dict:
        """
        Determine where rebars should be placed based on moments.
        
        For concrete:
        - Positive My → Bottom tension (bottom_main)
        - Negative My → Top tension (top_main)
        - Similar for Mz
        
        Returns:
            {
                'bottom_main': float (area mm²),
                'top_main': float (area mm²),
                'left_side': float (area mm²),
                'right_side': float (area mm²),
                'notes': str (explanation)
            }
        """
        
        if not self.is_concrete_code():
            raise ValueError("Rebar placement only applicable to concrete codes")
        
        result = {
            'bottom_main': 0.0,
            'top_main': 0.0,
            'left_side': 0.0,
            'right_side': 0.0,
            'notes': ''
        }
        
        # Bending about Y (Mz causes bending in vertical plane)
        if abs(moment_z) > 1e-6:
            if moment_z > 0:
                result['bottom_main'] += abs(moment_z)
                result['notes'] += f"Sagging Mz ({moment_z:+.2f} kNm) → bottom tension, "
            else:
                result['top_main'] += abs(moment_z)
                result['notes'] += f"Hogging Mz ({moment_z:+.2f} kNm) → top tension, "
        
        # Bending about Z (My causes bending in lateral plane)
        if abs(moment_y) > 1e-6:
            if moment_y > 0:
                result['left_side'] += abs(moment_y)
                result['notes'] += f"Positive My ({moment_y:+.2f} kNm) → left side tension"
            else:
                result['right_side'] += abs(moment_y)
                result['notes'] += f"Negative My ({moment_y:+.2f} kNm) → right side tension"
        
        if not result['notes']:
            result['notes'] = "No significant bending moments"
        
        return result
    
    def get_moment_gradient_factor(
        self,
        moment_left: float,
        moment_center: float,
        moment_right: float
    ) -> float:
        """
        Calculate moment gradient factor Cb for lateral torsional buckling.
        
        Only applicable to steel codes (AISC, IS800).
        
        Cb = 12.5*Mmax / (2.5*Mmax + 3*Ma + 4*Mb + 3*Mc)
        Where M magnitudes matter but gradient direction affects factor.
        """
        
        if not self.is_steel_code():
            return 1.0  # No gradient effect for concrete
        
        # Determine moment pattern
        moments = [abs(moment_left), abs(moment_center), abs(moment_right)]
        m_max = max(moments)
        
        if m_max < 1e-6:
            return 1.0
        
        # Check if double-curvature (moments have opposite signs)
        is_double_curvature = (moment_left * moment_right) < 0
        
        if is_double_curvature:
            # Reduce Cb for double curvature
            return 0.75
        else:
            # Single curvature or uniform moment
            return 1.0
    
    @staticmethod
    def parse_code_string(code_str: str) -> DesignCodeType:
        """Parse design code from string"""
        code_str = code_str.upper().strip()
        
        mapping = {
            "IS456": DesignCodeType.IS456_2000,
            "IS 456": DesignCodeType.IS456_2000,
            "IS 456:2000": DesignCodeType.IS456_2000,
            "ACI318": DesignCodeType.ACI318_19,
            "ACI 318": DesignCodeType.ACI318_19,
            "ACI 318-19": DesignCodeType.ACI318_19,
            "EC2": DesignCodeType.EUROCODE2,
            "EUROCODE2": DesignCodeType.EUROCODE2,
            "EN 1992": DesignCodeType.EUROCODE2,
            "IS800": DesignCodeType.IS800_2007,
            "IS 800": DesignCodeType.IS800_2007,
            "IS 800:2007": DesignCodeType.IS800_2007,
            "AISC": DesignCodeType.AISC360_22,
            "AISC360": DesignCodeType.AISC360_22,
            "AISC 360": DesignCodeType.AISC360_22,
            "AISC 360-22": DesignCodeType.AISC360_22,
        }
        
        if code_str in mapping:
            return mapping[code_str]
        
        raise ValueError(f"Unknown design code: {code_str}")


# Example usage and tests
if __name__ == "__main__":
    # Test IS 456 handler
    is456_handler = SignConventionHandler(DesignCodeType.IS456_2000)
    print("IS 456:2000 Handler")
    print(f"Material: {is456_handler.rules.material.value}")
    print(f"Moment Convention: {is456_handler.rules.moment_convention.value}")
    
    # Test moment interpretation
    sagging_moment = 150.0  # kNm (positive)
    hogging_moment = -80.0  # kNm (negative)
    
    print(f"\nMoment {sagging_moment} kNm is: {is456_handler.interpret_moment_type(sagging_moment)}")
    print(f"Moment {hogging_moment} kNm is: {is456_handler.interpret_moment_type(hogging_moment)}")
    
    # Test design demands
    design_demands = is456_handler.get_design_demands(
        moment_y=100.0,
        moment_z=-80.0,
        shear_y=50.0,
        shear_z=-30.0
    )
    print(f"\nDesign demands (My, Mz, Vy, Vz): {design_demands}")
    
    # Test governing moment
    gov_moment = is456_handler.get_governing_moment(100.0, -80.0)
    print(f"Governing moment: {gov_moment:.2f} kNm")
    
    # Test rebar placement
    placement = is456_handler.get_rebar_placement(
        moment_x=0,
        moment_y=100.0,
        moment_z=-80.0
    )
    print(f"\nRebar placement: {placement}")

