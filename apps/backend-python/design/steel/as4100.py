from ..framework import DesignCode, DesignMember, DesignResult

class AS4100(DesignCode):
    """
    AS 4100-1998 Steel Structures
    Simplified skeleton implementation.
    """
    
    @property
    def code_name(self) -> str:
        return "AS 4100-1998"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to AS 4100")
        
        fy = member.material.get('Fy', 250.0)
        phi = 0.9
        
        # Demands
        N_star = abs(member.forces.get('P', 0.0))
        M_x_star = abs(member.forces.get('Mz', 0.0))
        
        # Capacities
        # Nt = Ag * fy
        Nt = member.section_properties.get('area', 1000) * fy / 1000.0 # kN
        phi_Nt = phi * Nt
        
        # Ms = Ze * fy (Elastic) or S * fy (Plastic)
        # Assuming simplified Moment Capacity
        Zx = member.section_properties.get('Zxx', 500e3)
        Ms_x = Zx * fy / 1e6
        phi_Ms_x = phi * Ms_x
        
        capacities = {
            'Phi_Nt': phi_Nt,
            'Phi_Ms_x': phi_Ms_x
        }
        
        ratios = {
             'Tension': N_star / phi_Nt if phi_Nt > 0 else 0,
             'Bending': M_x_star / phi_Ms_x if phi_Ms_x > 0 else 0
        }
        
        max_ratio = max(ratios.values())
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{max(ratios, key=ratios.get)} (AS 4100)",
            calculation_log=log,
            capacity=capacities,
            demand=member.forces
        )
