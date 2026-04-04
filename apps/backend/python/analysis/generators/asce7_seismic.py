"""
asce7_seismic.py - ASCE 7 Seismic Load Generator

Implements the Equivalent Lateral Force (ELF) Procedure per ASCE 7-22 Chapter 12.

Reference: ASCE/SEI 7-22 "Minimum Design Loads and Associated Criteria for Buildings"

Formulas Implemented:
- Site coefficients (Fa, Fv) - Tables 11.4-1, 11.4-2
- Design spectral accelerations (SDS, SD1) - Eq. 11.4-3, 11.4-4
- Seismic response coefficient (Cs) - Eq. 12.8-2, 12.8-3, 12.8-4
- Base shear (V) - Eq. 12.8-1
- Vertical distribution (Fx) - Eq. 12.8-11, 12.8-12
- Approximate period (Ta) - Eq. 12.8-7
"""

from typing import Dict, Optional, Tuple

from .asce7_seismic_calculations import ASCE7SeismicCalculations
from .asce7_seismic_types import (
    ASCE7SeismicParams,
    ASCE7SeismicResult,
    RiskCategory,
    SiteClass,
    StructuralSystem,
    SeismicDesignCategory,
)
from .asce7_seismic_coefficients import (
    get_fa,
    get_fv,
    get_importance_factor,
)


# ============================================
# ASCE 7 SEISMIC LOAD GENERATOR
# ============================================


class ASCE7SeismicGenerator(ASCE7SeismicCalculations):
    """
    ASCE 7-22 Equivalent Lateral Force Procedure

    Implements Chapter 12 seismic design requirements.
    """

    def __init__(self, params: ASCE7SeismicParams):
        self.params = params
        self.result = ASCE7SeismicResult()

    # ----------------------------------------
    # Site Coefficients (Tables 11.4-1, 11.4-2)
    # ----------------------------------------

    def get_Fa(self) -> float:
        """
        Short-period site coefficient Fa (Table 11.4-1)

        Interpolation for intermediate Ss values.
        """
        return get_fa(self.params.site_class.value, self.params.Ss)

    def get_Fv(self) -> float:
        """
        Long-period site coefficient Fv (Table 11.4-2)
        """
        return get_fv(self.params.site_class.value, self.params.S1)

    # ----------------------------------------
    # Design Spectral Accelerations
    # ----------------------------------------

    def calculate_design_accelerations(self) -> Tuple[float, float]:
        """
        Calculate SDS and SD1 (Eq. 11.4-3, 11.4-4)

        SMS = Fa × Ss
        SM1 = Fv × S1
        SDS = (2/3) × SMS
        SD1 = (2/3) × SM1
        """
        Fa = self.get_Fa()
        Fv = self.get_Fv()

        SMS = Fa * self.params.Ss
        SM1 = Fv * self.params.S1

        SDS = (2 / 3) * SMS
        SD1 = (2 / 3) * SM1

        self.result.Fa = Fa
        self.result.Fv = Fv
        self.result.SDS = SDS
        self.result.SD1 = SD1

        return SDS, SD1

    # ----------------------------------------
    # Importance Factor (Table 1.5-2)
    # ----------------------------------------

    def get_importance_factor(self) -> float:
        """
        Get seismic importance factor Ie per Table 1.5-2
        """
        Ie = get_importance_factor(self.params.risk_category.value)
        self.result.Ie = Ie
        return Ie

    # ----------------------------------------
    # Seismic Design Category
    # ----------------------------------------

    def determine_SDC(self) -> str:
        """
        Determine Seismic Design Category per Table 12.2-1
        """
        SDS = self.result.SDS
        SD1 = self.result.SD1

        # Table 12.2-1 logic
        if SDS < 0.167:
            sdc_ds = "A"
        elif SDS < 0.33:
            sdc_ds = "B"
        elif SDS < 0.50:
            sdc_ds = "C"
        elif SDS < 0.75:
            sdc_ds = "D"
        elif SDS < 1.00:
            sdc_ds = "E"
        else:
            sdc_ds = "F"

        if SD1 < 0.067:
            sdc_d1 = "A"
        elif SD1 < 0.133:
            sdc_d1 = "B"
        elif SD1 < 0.20:
            sdc_d1 = "C"
        elif SD1 < 0.30:
            sdc_d1 = "D"
        elif SD1 < 0.40:
            sdc_d1 = "E"
        else:
            sdc_d1 = "F"

        sdc_order = "ABCDEF"
        sdc_idx = max(sdc_order.index(sdc_ds), sdc_order.index(sdc_d1))
        SDC = sdc_order[sdc_idx]

        self.result.SDC = SDC
        return SDC

    # ----------------------------------------
    # Main Analysis
    # ----------------------------------------

    def analyze(
        self,
        nodes: Dict[str, Dict],
        dead_loads: Dict[str, float],
        live_loads: Optional[Dict[str, float]] = None,
    ) -> ASCE7SeismicResult:
        """
        Perform complete ASCE 7 seismic analysis.

        Args:
            nodes: Node dictionary with coordinates
            dead_loads: Dead loads at nodes (kN)
            live_loads: Live loads at nodes (kN), optional

        Returns:
            ASCE7SeismicResult with all calculated values
        """
        try:
            # Step 1: Calculate design accelerations
            self.calculate_design_accelerations()

            # Step 2: Get importance factor
            self.get_importance_factor()

            # Step 3: Determine SDC
            self.determine_SDC()

            # Step 4: Calculate period
            self.calculate_period()

            # Step 5: Calculate Cs
            self.calculate_Cs()

            # Step 6: Compute story masses
            live_loads = live_loads or {}
            self.compute_story_masses(nodes, dead_loads, live_loads)

            # Step 7: Calculate base shear
            self.calculate_base_shear()

            # Step 8: Distribute forces
            self.distribute_lateral_forces()

            # Step 9: Generate nodal loads
            self.generate_nodal_loads()

            self.result.success = True

        except Exception as e:
            self.result.success = False
            self.result.error_message = str(e)

        return self.result

    def get_summary(self) -> Dict:
        """Get analysis summary for display"""
        return {
            "code": "ASCE 7-22",
            "method": "Equivalent Lateral Force",
            "Ss": self.params.Ss,
            "S1": self.params.S1,
            "Site_Class": self.params.site_class.value,
            "Fa": round(self.result.Fa, 3),
            "Fv": round(self.result.Fv, 3),
            "SDS": round(self.result.SDS, 3),
            "SD1": round(self.result.SD1, 3),
            "SDC": self.result.SDC,
            "T": round(self.result.T, 3),
            "R": self.result.R,
            "Ie": self.result.Ie,
            "Cs": round(self.result.Cs, 4),
            "W": round(self.result.W, 2),
            "V": round(self.result.V, 2),
            "V_percent_W": round(self.result.Cs * 100, 2),
        }


# ============================================
# HELPER FUNCTIONS
# ============================================


def create_asce7_seismic_generator(
    Ss: float,
    S1: float,
    site_class: str = "D",
    risk_category: int = 2,
    structural_system: str = "SMF_S",
    height: float = 30.0,
    direction: str = "X",
) -> ASCE7SeismicGenerator:
    """
    Factory function to create ASCE 7 seismic generator with simple inputs.
    """
    params = ASCE7SeismicParams(
        Ss=Ss,
        S1=S1,
        site_class=SiteClass(site_class),
        risk_category=RiskCategory(risk_category),
        structural_system=StructuralSystem(structural_system),
        height=height,
        direction=direction,
    )
    return ASCE7SeismicGenerator(params)


__all__ = [
    "ASCE7SeismicGenerator",
    "create_asce7_seismic_generator",
]
