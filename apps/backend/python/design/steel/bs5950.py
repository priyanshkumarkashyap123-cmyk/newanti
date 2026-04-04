from ..framework import DesignCode, DesignMember, DesignResult

class BS5950(DesignCode):
    """
    BS 5950-1:2000 Structural use of steelwork in building
    Simplified skeleton implementation.
    """
    
    @property
    def code_name(self) -> str:
        return "BS 5950-1:2000"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to BS 5950")
        
        # Determine classification
        # Placeholder
        log.append("Classification: Plastic (Class 1) - Assumed")
        py = member.material.get('Fy', 275.0)
        
        # Demands
        F_t = abs(member.forces.get('P', 0.0)) if member.forces.get('P', 0.0) > 0 else 0
        F_c = abs(member.forces.get('P', 0.0)) if member.forces.get('P', 0.0) < 0 else 0
        M_x = abs(member.forces.get('Mz', 0.0))
        
        # Capacities
        # Pt = Py * Ag
        P_t = member.section_properties.get('area', 1000) * py / 1000.0 # kN
        
        # Mc = Py * S (Plastic)
        M_cx = member.section_properties.get('Zpxx', 500e3) * py / 1e6 # kNm
        
        capacities = {
            'Pt': P_t,
            'Mcx': M_cx
        }
        
        ratios = {
             'Tension': F_t / P_t if P_t > 0 else 0,
             'Bending': M_x / M_cx if M_cx > 0 else 0
        }
        
        max_ratio = max(ratios.values())
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{max(ratios, key=ratios.get)} (BS 5950)",
            calculation_log=log,
            capacity=capacities,
            demand=member.forces
        )
