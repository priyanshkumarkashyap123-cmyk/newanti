"""
lsd_integration_designer.py - RC beam design orchestrator using LSD algorithm

Complete design workflow integrating reinforced concrete limit state design
with structural analysis results. Provides comprehensive rebar specification.
"""

import logging
from typing import Dict, List, Optional, Tuple

import numpy as np

from .rc_lsd import (
    BeamSection,
    ConcreteGrade,
    RebarGrade,
    ConcreteProperties,
    RebarProperties,
    LSDDesignResult,
)
from .rc_limit_state_design import LimitStateDesignBeam
from .lsd_integration_types import DesignInput

logger = logging.getLogger(__name__)


class RCBeamDesigner:
    """
    Complete RC beam design workflow integrating LSD algorithm.
    
    Validates design inputs, instantiates material/section objects,
    executes LSD design, and formats comprehensive design output.
    
    Usage:
        design_input = DesignInput(
            Mu=350.0, Vu=200.0,
            beam_width=300, beam_depth=600,
            concrete_grade='M30', steel_grade='Fe500'
        )
        designer = RCBeamDesigner(design_input)
        result = designer.design()
    """
    
    def __init__(self, design_input: DesignInput):
        """
        Initialize designer with input parameters.
        
        Parameters
        ----------
        design_input : DesignInput
            All required design parameters (moment, shear, section, materials, cover)
        """
        self.input = design_input
        self.result: Optional[LSDDesignResult] = None
    
    def validate_input(self) -> Tuple[bool, List[str]]:
        """
        Validate input parameters before design execution.
        
        Checks:
        - Section dimensions (width, depth)
        - Cover (minimum durability, not excessive)
        - Material grades (valid standard grades)
        - Loads (non-negative values)
        
        Returns
        -------
        (is_valid, messages) : Tuple
            Validation status and list of warnings/errors
        """
        issues = []
        
        # Check dimensions
        if self.input.beam_width < 100:
            issues.append(f"Width {self.input.beam_width} mm is too small")
        
        if self.input.beam_depth < 150:
            issues.append(f"Depth {self.input.beam_depth} mm is too small")
        
        if self.input.beam_depth < 2 * self.input.beam_width:
            issues.append("Depth should typically be ≥ 2×width for efficiency")
        
        # Check cover
        if self.input.cover_tension < 25:
            issues.append("Cover < 25 mm (minimum durability requirement)")
        elif self.input.cover_tension > self.input.effective_depth / 3:
            issues.append(
                f"Cover {self.input.cover_tension} mm is large "
                f"(reduces effective depth)"
            )
        
        # Check concrete grade
        valid_grades = ['M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50']
        if self.input.concrete_grade not in valid_grades:
            issues.append(f"Unknown concrete grade: {self.input.concrete_grade}")
        
        # Check steel grade
        valid_steels = ['Fe415', 'Fe500', 'Fe500S']
        if self.input.steel_grade not in valid_steels:
            issues.append(f"Unknown steel grade: {self.input.steel_grade}")
        
        # Check loads
        if self.input.Mu < 0:
            issues.append("Moment cannot be negative")
        
        if self.input.Vu < 0:
            issues.append("Shear cannot be negative")
        
        is_valid = len(issues) == 0
        
        if issues:
            logger.warning(f"Input validation issues: {len(issues)}")
            for issue in issues:
                logger.warning(f"  • {issue}")
        
        return is_valid, issues
    
    def design(self) -> Dict:
        """
        Execute complete RC beam design workflow.
        
        Steps:
        1. Validate input parameters
        2. Create section and material objects
        3. Execute LSD design algorithm
        4. Format and return design response
        
        Returns
        -------
        design_response : Dict
            Complete, JSON-serializable design result with:
            - Bending design (tension/compression steel requirements)
            - Shear design (stirrup specification)
            - Rebar layout summary
            - Design status and ratios
        """
        logger.info("=" * 70)
        logger.info("RC BEAM DESIGN - LSD WORKFLOW")
        logger.info("=" * 70)
        
        # Validate input
        is_valid, validation_issues = self.validate_input()
        if not is_valid:
            return {
                'status': 'error',
                'errors': validation_issues,
                'validation_passed': False
            }
        
        # Create section and material objects
        beam = BeamSection(
            b=self.input.beam_width,
            d=self.input.effective_depth,
            d_prime=self.input.compression_steel_depth
        )
        
        # Parse concrete grade
        concrete_grade_map = {
            'M20': ConcreteGrade.M20,
            'M25': ConcreteGrade.M25,
            'M30': ConcreteGrade.M30,
            'M35': ConcreteGrade.M35,
            'M40': ConcreteGrade.M40,
        }
        grade_enum = concrete_grade_map.get(
            self.input.concrete_grade,
            ConcreteGrade.M30
        )
        fck_map = {'M20': 20, 'M25': 25, 'M30': 30, 'M35': 35, 'M40': 40}
        
        concrete = ConcreteProperties(
            grade=grade_enum,
            fck=float(fck_map[self.input.concrete_grade])
        )
        
        # Parse steel grade
        steel_grade_map = {
            'Fe415': RebarGrade.Fe415,
            'Fe500': RebarGrade.Fe500,
            'Fe500S': RebarGrade.Fe500S,
        }
        fy_map = {'Fe415': 415, 'Fe500': 500, 'Fe500S': 500}
        
        rebar = RebarProperties(
            grade=steel_grade_map[self.input.steel_grade],
            fy=float(fy_map[self.input.steel_grade])
        )
        
        # Execute LSD design
        designer = LimitStateDesignBeam(
            Mu=self.input.Mu,
            Vu=self.input.Vu,
            beam=beam,
            concrete=concrete,
            rebar=rebar
        )
        
        self.result = designer.design()
        
        # Format response
        response = self._format_response(self.result)
        
        return response
    
    @staticmethod
    def _format_response(lsd_result: LSDDesignResult) -> Dict:
        """
        Format LSD result as comprehensive JSON response.
        
        Parameters
        ----------
        lsd_result : LSDDesignResult
            Complete design result from LSD algorithm
        
        Returns
        -------
        response : Dict
            Complete, JSON-serializable design response with:
            - Section and material properties
            - Ultimate loads
            - Limiting moment (ductility check)
            - Bending design (main and compression steel)
            - Shear design (stirrup requirement)
            - Rebar layout summary
            - Design status
        
        Notes
        -----
        All output in SI units:
        - Depths/dimensions: mm
        - Stresses: MPa
        - Areas: mm²
        """
        return {
            'status': 'success',
            'design': {
                'section': {
                    'width_mm': lsd_result.beam_section.b,
                    'depth_mm': lsd_result.beam_section.d,
                    'effective_depth_mm': lsd_result.beam_section.d,
                    'compression_depth_mm': lsd_result.beam_section.d_prime,
                },
                'concrete': {
                    'grade': lsd_result.concrete.grade.name,
                    'fck_mpa': lsd_result.concrete.fck,
                    'fcd_mpa': round(lsd_result.concrete.fcd, 2),
                    'modulus_mpa': round(lsd_result.concrete.Ec, 1),
                },
                'steel': {
                    'grade': lsd_result.rebar.grade.name,
                    'fy_mpa': lsd_result.rebar.fy,
                    'fyd_mpa': round(lsd_result.rebar.fyd, 2),
                    'modulus_mpa': lsd_result.rebar.Es,
                },
            },
            
            'loads': {
                'ultimate_moment_knm': round(lsd_result.Mu, 2),
                'ultimate_shear_kn': round(lsd_result.Vu, 2),
            },
            
            'limiting_moment': {
                'mu_lim_knm': round(lsd_result.limiting_moment.Mu_lim, 3),
                'xu_lim_mm': round(lsd_result.limiting_moment.xu_lim, 2),
                'z_lim_mm': round(lsd_result.limiting_moment.z_lim, 2),
                'ductile': lsd_result.limiting_moment.is_ductile,
            },
            
            'bending_design': {
                'type': lsd_result.bending.design_type,
                'tension_steel': {
                    'required_mm2': round(lsd_result.bending.Ast_required, 2),
                    'provided_mm2': round(
                        lsd_result.bending.main_rebar_count * 
                        (np.pi * (lsd_result.bending.main_rebar_size/2)**2),
                        2
                    ),
                    'bars': lsd_result.bending.main_rebar_desc,
                    'percentage': round(lsd_result.bending.pt, 3),
                },
                'compression_steel': {
                    'required_mm2': round(lsd_result.bending.Asc_required, 2),
                    'bars': lsd_result.bending.comp_rebar_desc if lsd_result.bending.comp_rebar_count > 0 else None,
                    'count': lsd_result.bending.comp_rebar_count,
                } if lsd_result.bending.Asc_required > 0 else None,
                'neutral_axis': {
                    'depth_mm': round(lsd_result.bending.xu, 2),
                    'ratio': round(lsd_result.bending.xu / lsd_result.beam_section.d, 3),
                },
                'lever_arm': {
                    'z_mm': round(lsd_result.bending.z, 2),
                    'ratio': round(lsd_result.bending.z / lsd_result.beam_section.d, 3),
                },
                'moment_capacity_knm': round(lsd_result.bending.Mu_provided, 3),
                'demand_capacity_ratio': round(lsd_result.bending.mu_ratio, 3),
            },
            
            'shear_design': {
                'nominal_stress_nmm2': round(lsd_result.shear.tau_v, 3),
                'design_strength_nmm2': round(lsd_result.shear.tau_c, 3),
                'requires_stirrups': lsd_result.shear.requires_stirrups,
                'stirrups': {
                    'diameter_mm': lsd_result.shear.stirrup_dia,
                    'spacing_mm': round(lsd_result.shear.stirrup_spacing, 0),
                    'specification': lsd_result.shear.stirrup_desc,
                },
                'demand_capacity_ratio': round(
                    lsd_result.shear.tau_v / lsd_result.shear.tau_c
                    if lsd_result.shear.tau_c > 0 else 999,
                    3
                ),
            },
            
            'rebar_layout': {
                'summary': lsd_result.rebar_summary,
                'bottom': lsd_result.bending.main_rebar_desc,
                'top': (lsd_result.bending.comp_rebar_desc 
                        if lsd_result.bending.comp_rebar_count > 0
                        else '2-10φ (minimum)'),
                'shear': lsd_result.shear.stirrup_desc,
            },
            
            'design_status': {
                'status': lsd_result.design_status,
                'design_ratio': round(lsd_result.design_ratio, 3),
                'passes': lsd_result.design_status == '✓ PASS',
                'notes': lsd_result.messages,
            },
        }


__all__ = [
    "RCBeamDesigner",
]
