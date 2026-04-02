"""
rc_limit_state_design.py - Limit State Design (LSD) for Reinforced Concrete Beams

Implements IS 456:2000 Limit State Design methodology for:
1. Bending Design (Moment Resistance)
   - Singly Reinforced Sections (Mu < Mu,lim)
   - Doubly Reinforced Sections (Mu > Mu,lim)
2. Shear Design
   - Nominal Shear Stress (τv)
   - Design Shear Strength of Concrete (τc)
   - Vertical Shear Stirrup Spacing

Output: Exact rebar configurations
  e.g., "3-16φ bottom, 2-12φ top, 8φ stirrups @ 150 c/c"

Author: BeamLab Ultimate Development Team
Code Standard: IS 456:2000
Date: March 2026
"""

import logging

from .rc_lsd.materials import (
    ConcreteGrade,
    RebarGrade,
    LIMIT_STATE_DESIGN_CONSTANTS,
)
from .rc_lsd.models import (
    BeamSection,
    ConcreteProperties,
    RebarProperties,
    LimitingMomentResult,
    BendingDesignResult,
    ShearDesignResult,
    LSDDesignResult,
)
from .rc_lsd.bending import LimitingMomentCalculator, BendingDesigner
from .rc_lsd.shear import ShearDesigner

logger = logging.getLogger(__name__)


# (Data classes moved to rc_lsd.models)


# ============================================================================
# LIMITING MOMENT CALCULATION (IS 456:2000, Clause 38.1)
# ============================================================================

# (LimitingMomentCalculator moved to rc_lsd.bending)


# ============================================================================
# SINGLY REINFORCED SECTION DESIGN (Mu < Mu_lim)
# ============================================================================

# (Singly reinforced design moved to rc_lsd.bending)


# ============================================================================
# DOUBLY REINFORCED SECTION DESIGN (Mu > Mu_lim)
# ============================================================================

# (Doubly reinforced design moved to rc_lsd.bending)


# ============================================================================
# SHEAR DESIGN (IS 456:2000, Clause 40)
# ============================================================================

# (Shear design moved to rc_lsd.shear)


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# (Rebar/stirrup selection moved to rc_lsd.selectors)


# ============================================================================
# MASTER LSD ALGORITHM
# ============================================================================

class LimitStateDesignBeam:
    """
    Compatibility shim delegating to rc_lsd modules.
    """

    def __init__(self, Mu: float, Vu: float, beam: BeamSection, concrete: ConcreteProperties, rebar: RebarProperties):
        self.Mu = Mu
        self.Vu = Vu
        self.beam = beam
        self.concrete = concrete
        self.rebar = rebar
        self.messages = []

    def design(self) -> LSDDesignResult:
        logger.info("=" * 70)
        logger.info("LIMIT STATE DESIGN - REINFORCED CONCRETE BEAM")
        logger.info("IS 456:2000")
        logger.info("=" * 70)
        logger.info(
            f"Section: {self.beam.b}×{self.beam.d} mm, "
            f"Concrete: {self.concrete.grade.name}, "
            f"Steel: {self.rebar.grade.name}"
        )
        logger.info(
            f"Applied: Mu = {self.Mu:.2f} kN·m, "
            f"Vu = {self.Vu:.2f} kN"
        )
        logger.info("-" * 70)

        limiting_moment = LimitingMomentCalculator.calculate(self.beam, self.concrete, self.rebar)
        self.messages.append(f"Limiting moment: {limiting_moment.Mu_lim:.2f} kN·m")

        if self.Mu <= limiting_moment.Mu_lim:
            bending_result = BendingDesigner.design_singly_reinforced(self.beam, self.concrete, self.rebar, self.Mu, limiting_moment)
            self.messages.append("Design Type: Singly Reinforced")
        else:
            bending_result = BendingDesigner.design_doubly_reinforced(self.beam, self.concrete, self.rebar, self.Mu, limiting_moment)
            self.messages.append("Design Type: Doubly Reinforced")

        shear_result = ShearDesigner.design(self.beam, self.concrete, self.rebar, self.Vu, self.Mu, bending_result.pt)

        rebar_summary = self._format_rebar_summary(bending_result, shear_result)

        tau_c_max = LIMIT_STATE_DESIGN_CONSTANTS["tau_c_max_lookup"](self.concrete.fck)
        shear_ratio = shear_result.tau_v / tau_c_max if tau_c_max > 0 else 0.0
        bending_ratio = abs(bending_result.mu_ratio)
        design_ratio = max(bending_ratio, shear_ratio)
        design_status = "✓ PASS" if design_ratio <= 1.0 else "✗ FAIL"

        if design_status.startswith("✗"):
            self.messages.append(f"WARNING: Design ratio = {design_ratio:.2f} > 1.0")

        return LSDDesignResult(
            beam_section=self.beam,
            concrete=self.concrete,
            rebar=self.rebar,
            Mu=self.Mu,
            Vu=self.Vu,
            limiting_moment=limiting_moment,
            bending=bending_result,
            shear=shear_result,
            rebar_summary=rebar_summary,
            design_status=design_status,
            design_ratio=design_ratio,
            messages=self.messages,
        )
    
    @staticmethod
    def _format_rebar_summary(
        bending: BendingDesignResult,
        shear: ShearDesignResult
    ) -> str:
        """Format rebar specification as engineering string."""
        specs = []
        
        # Main tension
        specs.append(f"Bottom: {bending.main_rebar_desc}")
        
        # Compression (if present)
        if bending.comp_rebar_count > 0:
            specs.append(f"Top: {bending.comp_rebar_desc}")
        else:
            specs.append("Top: 2-10φ (minimum distribution)")
        
        # Shear
        specs.append(f"Shear: {shear.stirrup_desc}")
        
        return " | ".join(specs)


# ============================================================================
# MAIN - EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)-8s | %(message)s'
    )
    
    # Example: Design a beam
    print("\n" + "="*70)
    print("EXAMPLE: Reinforced Concrete Beam LSD Design")
    print("="*70 + "\n")
    
    # Section: 300×600 mm, M30 concrete, Fe500 steel
    beam = BeamSection(b=300, d=600, d_prime=80)
    concrete = ConcreteProperties(
        grade=ConcreteGrade.M30,
        fck=30.0
    )
    rebar = RebarProperties(
        grade=RebarGrade.Fe500,
        fy=500.0
    )
    
    # Applied loads
    Mu = 350.0  # Ultimate moment (kN·m)
    Vu = 200.0  # Ultimate shear (kN)
    
    # Execute design
    designer = LimitStateDesignBeam(Mu, Vu, beam, concrete, rebar)
    result = designer.design()
    
    # Print final summary
    print("\n" + "="*70)
    print("FINAL REBAR SPECIFICATION (IS 456:2000)")
    print("="*70)
    print(f"\n{result.rebar_summary}")
    print(f"\nDesign Status: {result.design_status}")
    print(f"Design Ratio: {result.design_ratio:.3f}")
    
    # Messages
    if result.messages:
        print("\nNotes:")
        for msg in result.messages:
            print(f"  • {msg}")
