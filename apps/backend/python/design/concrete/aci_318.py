"""
aci_318.py - ACI 318-19: Building Code Requirements for Structural Concrete

Unit conventions:
    fc: MPa (N/mm²)
    fy: MPa (N/mm²)
    b, h, d: mm
    Mu: kN·m
    Vu: kN

Clause references:
    Flexure: Cl. 22.3
    Shear: Cl. 22.5
"""
import logging
logger = logging.getLogger(__name__)

from ..framework import DesignCode, DesignMember, DesignResult

class ACI318(DesignCode):
    """
    ACI 318-19: Building Code Requirements for Structural Concrete
    Simplified implementation for beam elements.
    """
    
    @property
    def code_name(self) -> str:
        return "ACI 318-19"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to ACI 318-19")
        
        props = member.section_properties
        mat = member.material
        forces = member.forces
        
        # Material
        fc = mat.get('fck', 30.0) # MPa (cylinder strength)
        fy = mat.get('yield_strength', 420.0) # MPa
        
        # Dimensions
        b = props.get('width', 300.0)
        h = props.get('depth', 500.0)
        d = h - 40.0 # Effective depth estimate
        
        # Demands
        Mu = abs(forces.get('Mz', 0.0)) * 1e6 # kNm -> Nmm
        Vu = abs(forces.get('Fy', 0.0)) * 1e3 # kN -> N
        
        capacities = {}
        ratios = {}
        
        # 1. Flexure
        # phi = 0.9 for tension controlled
        beta1 = 0.85 if fc <= 28 else max(0.65, 0.85 - 0.05 * (fc - 28) / 7)
        
        # As_min
        As_min1 = 0.25 * (fc**0.5) / fy * b * d
        As_min2 = 1.4 / fy * b * d
        As_min = max(As_min1, As_min2)
        
        # Assuming provided reinforcement (simplified)
        # In a real checker, this would be input. 
        # Here we check if the section CAN support the moment (Single reinforced)
        rho_max = 0.85 * beta1 * (fc / fy) * (0.003 / (0.003 + 0.005))
        As_max = rho_max * b * d
        
        # Calculate required As
        # Mu = phi * As * fy * (d - a/2)
        # a = As * fy / (0.85 * fc * b)
        # Quadratic for As... simplified check against capacity of max reinforcement
        
        a_max = As_max * fy / (0.85 * fc * b)
        Mn_max = As_max * fy * (d - a_max/2)
        phi_Mn_max = 0.9 * Mn_max
        
        capacities['Phi_Mn_Max'] = phi_Mn_max / 1e6 # kNm
        ratios['Flexure'] = Mu / phi_Mn_max
        log.append(f"Flexure: Mu={Mu/1e6:.1f} kNm, Max Capacity={phi_Mn_max/1e6:.1f} kNm")

        # 2. Shear
        # phi = 0.75
        lambda_c = 1.0 # Normal weight
        Vc = 0.17 * lambda_c * (fc**0.5) * b * d
        phi_Vc = 0.75 * Vc
        
        # Max shear with stirrups (Vs <= 4*Vc)
        phi_Vn_max = 0.75 * (Vc + 4*Vc)
        
        capacities['Phi_Vn_Max'] = phi_Vn_max / 1e3 # kN
        ratios['Shear'] = Vu / phi_Vn_max
        log.append(f"Shear: Vu={Vu/1e3:.1f} kN, Max Section Capacity={phi_Vn_max/1e3:.1f} kN")
        
        # Result
        max_ratio = max(ratios.values())
        governing = max(ratios, key=ratios.get)
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{governing} (ACI 318)",
            calculation_log=log,
            capacity=capacities
        )
