"""
Bending design utilities for RC beams (IS 456:2000).
"""

from .materials import LIMIT_STATE_DESIGN_CONSTANTS
from .models import BeamSection, ConcreteProperties, RebarProperties, LimitingMomentResult, BendingDesignResult
from .selectors import select_rebar_for_area


class LimitingMomentCalculator:
    @staticmethod
    def calculate(beam: BeamSection, concrete: ConcreteProperties, rebar: RebarProperties) -> LimitingMomentResult:
        xu_lim = LIMIT_STATE_DESIGN_CONSTANTS["xu_max_factor"] * beam.d
        z_lim = LIMIT_STATE_DESIGN_CONSTANTS["lever_arm_factor"] * beam.d
        r_lim = 0.36 * concrete.fcd * LIMIT_STATE_DESIGN_CONSTANTS["xu_max_factor"] * (1 - 0.42 * LIMIT_STATE_DESIGN_CONSTANTS["xu_max_factor"])
        Mu_lim = r_lim * beam.b * beam.d * beam.d / 1e6  # kN·m
        return LimitingMomentResult(
            Mu_lim=Mu_lim,
            xu_lim=xu_lim,
            z_lim=z_lim,
            r_lim=r_lim,
            is_ductile=True,
        )


class BendingDesigner:
    @staticmethod
    def design_singly_reinforced(beam: BeamSection, concrete: ConcreteProperties, rebar: RebarProperties, Mu: float, limiting: LimitingMomentResult) -> BendingDesignResult:
        # Required Ast = Mu / (0.87 fy z)
        z = LIMIT_STATE_DESIGN_CONSTANTS["lever_arm_factor"] * beam.d
        Ast_req = (Mu * 1e6) / (0.87 * rebar.fy * z)

        # Provide bars
        main_size, main_count, main_desc = select_rebar_for_area(Ast_req)

        pt = Ast_req * 100 / (beam.b * beam.d)
        pt_balance = limiting.r_lim * 100 / (0.87 * rebar.fy)
        mu_ratio = Mu / limiting.Mu_lim if limiting.Mu_lim else 0.0

        return BendingDesignResult(
            design_type="singly_reinforced",
            Ast_required=Ast_req,
            Asc_required=0.0,
            xu=limiting.xu_lim,
            z=z,
            Mu_provided=Mu,
            pt=pt,
            main_rebar_size=main_size,
            main_rebar_count=main_count,
            main_rebar_desc=main_desc,
            comp_rebar_size=0,
            comp_rebar_count=0,
            comp_rebar_desc="None",
            pt_balance=pt_balance,
            mu_ratio=mu_ratio,
        )

    @staticmethod
    def design_doubly_reinforced(beam: BeamSection, concrete: ConcreteProperties, rebar: RebarProperties, Mu: float, limiting: LimitingMomentResult) -> BendingDesignResult:
        # Additional moment beyond Mu_lim is carried by compression steel
        z = LIMIT_STATE_DESIGN_CONSTANTS["lever_arm_factor"] * beam.d
        Mu_extra = Mu - limiting.Mu_lim
        Ast_balanced = (limiting.Mu_lim * 1e6) / (0.87 * rebar.fy * z)
        Ast_extra = (Mu_extra * 1e6) / (0.87 * rebar.fy * (beam.d - beam.d_prime))
        Asc_req = Ast_extra * rebar.fy / (0.87 * rebar.fy)
        Ast_req = Ast_balanced + Ast_extra

        main_size, main_count, main_desc = select_rebar_for_area(Ast_req)
        comp_size, comp_count, comp_desc = select_rebar_for_area(Asc_req)

        pt = Ast_req * 100 / (beam.b * beam.d)
        pt_balance = limiting.r_lim * 100 / (0.87 * rebar.fy)
        mu_ratio = Mu / limiting.Mu_lim if limiting.Mu_lim else 0.0

        return BendingDesignResult(
            design_type="doubly_reinforced",
            Ast_required=Ast_req,
            Asc_required=Asc_req,
            xu=limiting.xu_lim,
            z=z,
            Mu_provided=Mu,
            pt=pt,
            main_rebar_size=main_size,
            main_rebar_count=main_count,
            main_rebar_desc=main_desc,
            comp_rebar_size=comp_size,
            comp_rebar_count=comp_count,
            comp_rebar_desc=comp_desc,
            pt_balance=pt_balance,
            mu_ratio=mu_ratio,
        )
