"""Utilities to serialize LSDDesignResult for reporting."""

from typing import Any, Dict

from .models import LSDDesignResult


def lsd_result_to_dict(result: LSDDesignResult) -> Dict[str, Any]:
    """Convert LSDDesignResult to a dict shape expected by report generator."""
    return {
        "beam_section": {
            "b": result.beam_section.b,
            "d": result.beam_section.d,
            "d_prime": result.beam_section.d_prime,
        },
        "concrete": {
            "grade": result.concrete.grade.name,
            "fck": result.concrete.fck,
            "fcd": result.concrete.fcd,
            "Ec": result.concrete.Ec,
        },
        "rebar": {
            "grade": result.rebar.grade.name,
            "fy": result.rebar.fy,
            "fyd": result.rebar.fyd,
            "Es": result.rebar.Es,
        },
        "limiting_moment": {
            "Mu_lim": result.limiting_moment.Mu_lim,
            "xu_lim": result.limiting_moment.xu_lim,
            "z_lim": result.limiting_moment.z_lim,
            "r_lim": result.limiting_moment.r_lim,
        },
        "bending": {
            "design_type": result.bending.design_type,
            "Ast_required": result.bending.Ast_required,
            "Asc_required": result.bending.Asc_required,
            "xu": result.bending.xu,
            "z": result.bending.z,
            "Mu_provided": result.bending.Mu_provided,
            "pt": result.bending.pt,
            "main_rebar_size": result.bending.main_rebar_size,
            "main_rebar_count": result.bending.main_rebar_count,
            "main_rebar_desc": result.bending.main_rebar_desc,
            "comp_rebar_size": result.bending.comp_rebar_size,
            "comp_rebar_count": result.bending.comp_rebar_count,
            "comp_rebar_desc": result.bending.comp_rebar_desc,
            "pt_balance": result.bending.pt_balance,
            "mu_ratio": result.bending.mu_ratio,
        },
        "shear": {
            "status": result.shear.status,
            "tau_v": result.shear.tau_v,
            "tau_c": result.shear.tau_c,
            "tau_cmax": result.shear.tau_cmax,
            "stirrup_size": result.shear.stirrup_size,
            "stirrup_spacing": result.shear.stirrup_spacing,
            "stirrup_desc": result.shear.stirrup_desc,
            "Vus": result.shear.Vus,
            "Vu_c": result.shear.Vu_c,
        },
        "rebar_summary": result.rebar_summary,
        "design_status": result.design_status,
        "design_ratio": result.design_ratio,
        "messages": result.messages,
    }
