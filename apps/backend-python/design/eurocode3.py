import math
from .framework import DesignCode, DesignMember, DesignResult

class Eurocode3(DesignCode):
    """
    Eurocode 3: EN 1993-1-1 Design of Steel Structures
    Simplifications:
    - Assumes Class 1 or 2 cross-sections (Plastic design)
    - Doubly symmetric I-sections
    """
    
    def __init__(self):
        self.gamma_m0 = 1.0  # Yielding
        self.gamma_m1 = 1.0  # Instability
        
    @property
    def code_name(self) -> str:
        return "Eurocode 3 (EN 1993-1-1)"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to Eurocode 3")
        
        props = member.section_properties
        mat = member.material
        forces = member.forces
        
        Fy = mat.get('Fy', 250.0)
        E = mat.get('E', 210000.0)
        
        # Partial factors
        GM0 = self.gamma_m0
        GM1 = self.gamma_m1
        
        # Demands
        N_ed = forces.get('P', 0.0)  # Axial (+Tension, -Compression)
        My_ed = abs(forces.get('Mz', 0.0)) # Major axis bending
        Mz_ed = abs(forces.get('My', 0.0)) # Minor axis bending
        
        capacities = {}
        ratios = {}
        
        # 1. Tension
        if N_ed > 1e-3:
            Nt_Rd = (props['area'] * Fy) / GM0
            log.append(f"Tension: Ned={N_ed:.0f}, Nt,Rd={Nt_Rd:.0f}")
            capacities['Nt_Rd'] = Nt_Rd
            ratios['Tension'] = N_ed / Nt_Rd
            
        # 2. Compression
        elif N_ed < -1e-3:
            Nc_ed = abs(N_ed)
            
            # Cross-section resistance
            Nc_Rd = (props['area'] * Fy) / GM0
            
            # Buckling resistance
            # Major axis (y-y in EC3 notation usually, here assume x-x is major)
            L_cr_y = member.effective_length_factor_major * member.unbraced_length_major
            iy = props.get('rxx', 1.0)
            lambda_y = (L_cr_y / iy) * (1 / (math.pi * math.sqrt(E/Fy)))
            
            # Buckling curve 'a' or 'b' - assume 'b' for rolled I-sections h/b < 1.2
            alpha = 0.34 # curve b
            phi_y = 0.5 * (1 + alpha * (lambda_y - 0.2) + lambda_y**2)
            chi_y = 1 / (phi_y + math.sqrt(phi_y**2 - lambda_y**2))
            chi_y = min(1.0, chi_y)
            
            Nb_Rd_y = (chi_y * props['area'] * Fy) / GM1
            
            log.append(f"Compression: lambda_y={lambda_y:.2f}, chi_y={chi_y:.2f}")
            log.append(f"Buckling Capacity: Nb,Rd={Nb_Rd_y:.0f} N")
            
            capacities['Nb_Rd'] = Nb_Rd_y
            ratios['Compression'] = Nc_ed / Nb_Rd_y
            
        else:
            capacities['N_Rd'] = 1e9
            
        # 3. Bending
        # Major Axis
        Wpl_y = props.get('Zpxx', props.get('Zxx', 0) * 1.1)
        Mc_Rd_y = (Wpl_y * Fy) / GM0
        
        # LTB Check
        # Simplified chi_LT
        L_cr_LT = member.unbraced_length_ltb
        iz = props.get('ryy', 1.0)
        # Very rough estimation of non-dimensional slenderness for LTB without C1, C2, etc.
        # lambda_LT = ... 
        # For this prototype, we'll assume fully braced if L_cr_LT is small, else reduce
        lambda_LT = (L_cr_LT / iz) / 80.0 # Heuristic
        if lambda_LT > 0.4:
            chi_LT = 1.0 / (lambda_LT**2) # Simplified
            chi_LT = min(1.0, chi_LT)
            log.append(f"LTB: lambda_LT approx {lambda_LT:.2f}, chi_LT={chi_LT:.2f}")
        else:
            chi_LT = 1.0
            
        Mb_Rd_y = chi_LT * Mc_Rd_y
        
        capacities['Mb_Rd_y'] = Mb_Rd_y
        ratios['Bending_Y'] = My_ed / Mb_Rd_y if Mb_Rd_y > 0 else 0
        
        # Minor Axis
        Wpl_z = props.get('Zpyy', props.get('Zyy', 0) * 1.5)
        Mc_Rd_z = (Wpl_z * Fy) / GM0
        
        capacities['Mc_Rd_z'] = Mc_Rd_z
        ratios['Bending_Z'] = Mz_ed / Mc_Rd_z if Mc_Rd_z > 0 else 0
        
        # 4. Interaction (Simplified linear conservative)
        if abs(N_ed) > 1e-3:
            n = abs(N_ed) / capacities.get('Nb_Rd', capacities.get('Nt_Rd', 1e9))
            my = My_ed / Mb_Rd_y
            mz = Mz_ed / Mc_Rd_z
            interaction = n + my + mz
            log.append(f"Interaction: {n:.2f} + {my:.2f} + {mz:.2f} = {interaction:.2f}")
            ratios['Interaction'] = interaction
        else:
            ratios['Interaction'] = ratios['Bending_Y'] + ratios['Bending_Z']
            
        # Results
        max_ratio = max(ratios.values()) if ratios else 0.0
        governing = max(ratios, key=ratios.get) if ratios else "None"
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{governing} (EC3)",
            calculation_log=log,
            capacity=capacities,
            demand={'Ned': N_ed, 'My_ed': My_ed, 'Mz_ed': Mz_ed}
        )
