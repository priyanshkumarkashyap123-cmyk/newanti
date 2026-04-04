"""
Shear design utilities for RC beams (IS 456:2000).
"""

from .materials import LIMIT_STATE_DESIGN_CONSTANTS
from .models import BeamSection, ConcreteProperties, RebarProperties, ShearDesignResult
from .selectors import select_stirrups


class ShearDesigner:
    @staticmethod
    def design(beam: BeamSection, concrete: ConcreteProperties, rebar: RebarProperties, Vu: float, Mu: float, bending_pt: float) -> ShearDesignResult:
        d = beam.d
        b = beam.b
        fyv = rebar.fyv
        fck = concrete.fck

        # Nominal shear stress tau_v
        tau_v = (Vu * 1e3) / (b * d)

        # Design shear strength of concrete (simplified lookup)
        tau_c = LIMIT_STATE_DESIGN_CONSTANTS["tau_c_lookup"](fck, bending_pt)

        # Max shear stress per code
        tau_cmax = LIMIT_STATE_DESIGN_CONSTANTS["tau_c_max_lookup"](fck)

        if tau_v > tau_cmax:
            status = "FAIL_tau_cmax"
            stirrup_size = 0
            stirrup_spacing = 0.0
            stirrup_desc = "Shear exceeds tau_cmax"
        elif tau_v <= tau_c:
            # Minimum shear reinforcement
            stirrup_size, stirrup_spacing, stirrup_desc = select_stirrups(b, d, fyv, tau_v, tau_c, minimum=True)
            status = "OK_minimum"
        else:
            stirrup_size, stirrup_spacing, stirrup_desc = select_stirrups(b, d, fyv, tau_v, tau_c, minimum=False)
            status = "OK_shear_provided"

        Vus = (0.87 * fyv * stirrup_size * stirrup_size * 2 / stirrup_spacing) * d / 1000 if stirrup_spacing else 0.0
        Vu_c = tau_c * b * d / 1000

        return ShearDesignResult(
            status=status,
            tau_v=tau_v,
            tau_c=tau_c,
            tau_cmax=tau_cmax,
            stirrup_size=stirrup_size,
            stirrup_spacing=stirrup_spacing,
            stirrup_desc=stirrup_desc,
            Vus=Vus,
            Vu_c=Vu_c,
        )
