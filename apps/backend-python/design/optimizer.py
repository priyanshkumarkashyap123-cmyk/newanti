from typing import List, Dict, Optional
from .sections_db import get_all_sections_by_type
from .framework import DesignFactory, DesignMember

class SectionOptimizer:
    @staticmethod
    def find_optimal_section(
        code_name: str,
        shape_type: str,
        member_params: Dict,
        forces: Dict
    ) -> Optional[Dict]:
        """
        Find the lightest section that passes design checks.
        """
        # Get all candidate sections
        candidates = get_all_sections_by_type(shape_type)
        if not candidates:
            return None
        
        # Sort by weight (ascending)
        candidates.sort(key=lambda x: x.get("weight", float("inf")))
        
        designer = DesignFactory.get_designer(code_name)
        if not designer:
            print(f"Designer not found for {code_name}")
            return None

        # Iterate and check
        for section in candidates:
            # Create a DesignMember with this section
            # Note: We need to adapt the section dict to what DesignMember expects
            # DesignMember usually expects specific properties like Area, Iz, etc.
            # We assume section dict provides these keys or logic to derive them.
            
            # Construct member properties for the check
            # This mapping might need adjustment based on how check_member is implemented
            props = {
                "A": section.get("area", 0),
                "Iz": section.get("Iz", 0),
                "Iy": section.get("Iy", 0),
                "J": section.get("J", 0) if "J" in section else 0,
                "Cw": 0, # Simplified
                "fy": member_params.get("fy", 250),
                "E": member_params.get("E", 210000),
                "G": member_params.get("E", 210000) / (2.0 * (1.0 + 0.30)),
            }
            
            # Add geometric props needed for specific checks (e.g. depth for buckling)
            if "depth" in section: props["depth"] = section["depth"]
            if "width" in section: props["width"] = section["width"]
            
            member = DesignMember(
                id="opt_temp",
                length=member_params.get("length", 3000),
                properties=props,
                forces=forces
            )
            
            result = designer.check_member(member)
            
            if result.ratio <= 1.0:
                # Found the lightest passing section!
                return {
                    "section": section,
                    "ratio": result.ratio,
                    "status": "PASS",
                    "weight": section["weight"]
                }
                
        return None
