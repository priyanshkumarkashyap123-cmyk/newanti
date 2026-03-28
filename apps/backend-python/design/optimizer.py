import logging
logger = logging.getLogger(__name__)

from typing import List, Dict, Optional
from .sections_db import get_all_sections_by_type
from .framework import DesignFactory, DesignMember

class SectionOptimizer:
    @staticmethod
    def find_optimal_section(
        code_name: str,
        shape_type: str,
        member_params: Dict,
        forces: Dict,
        max_iterations: int = 1000
    ) -> Optional[Dict]:
        """
        Find the lightest section that passes design checks.
        Args:
            code_name: identifier for design code (e.g., 'IS456')
            shape_type: section type (e.g., 'I', 'C')
            member_params: geometric and material params
            forces: demand forces/moments
            max_iterations: safety cap on candidate checks
        """
        # Validate inputs
        if not code_name or not shape_type:
            logger.error("Invalid code_name or shape_type: %s, %s", code_name, shape_type)
            return None

        # Get all candidate sections
        candidates = get_all_sections_by_type(shape_type)
        if not candidates:
            logger.error("No sections available for type %s", shape_type)
            return None

        # Sort by weight ascending
        try:
            candidates.sort(key=lambda x: x.get("weight", float("inf")))
        except Exception as e:
            logger.error("Error sorting candidates by weight: %s", e)
            return None

        designer = DesignFactory.get_designer(code_name)
        if not designer:
            logger.error("Designer not found for code: %s", code_name)
            return None

        # Iterate candidates up to cap
        for idx, section in enumerate(candidates):
            if idx >= max_iterations:
                logger.error("Reached max_iterations (%d) without finding valid section", max_iterations)
                break
            try:
                # Map section dict to DesignMember properties
                props = {
                    "A": section.get("area", 0),
                    "Iz": section.get("Iz", 0),
                    "Iy": section.get("Iy", 0),
                    "J": section.get("J", 0),
                    "E": member_params.get("E", 210000),
                    "G": member_params.get("G", member_params.get("E", 210000)/(2*(1+0.3)))
                }
                if "depth" in section: props["depth"] = section["depth"]
                if "width" in section: props["width"] = section["width"]

                member = DesignMember(
                    id=f"opt_{idx}",
                    length=member_params.get("length", 0),
                    properties=props,
                    forces=forces
                )

                result = designer.check_member(member)
            except Exception as err:
                logger.warning("Error checking member for section %s: %s", section.get("name"), err)
                continue

            if getattr(result, 'ratio', 1) <= 1.0:
                logger.info("Optimal section found: %s (weight=%s, ratio=%.3f)", section.get("name"), section.get("weight"), result.ratio)
                return {
                    "section": section,
                    "ratio": result.ratio,
                    "status": "PASS",
                    "weight": section.get("weight")
                }

        logger.error("No valid section found for %s under code %s", shape_type, code_name)
        return None
