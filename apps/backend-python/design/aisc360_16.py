import math
from .framework import DesignCode, DesignMember, DesignResult

class AISC360_16(DesignCode):
    """
    AISC 360-16 Specification for Structural Steel Buildings
    Implementation of Chapters D, E, F, H for I-shapes (Doubly Symmetric).
    Method: LRFD (Load and Resistance Factor Design)
    """
    
    def __init__(self):
        self.phi_t = 0.90  # Tension
        self.phi_c = 0.90  # Compression
        self.phi_b = 0.90  # Bending
        self.phi_v = 0.90  # Shear
    
    @property
    def code_name(self) -> str:
        return "AISC 360-16 (LRFD)"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to AISC 360-16 LRFD")
        
        # Unpack properties
        props = member.section_properties
        mat = member.material
        forces = member.forces
        
        Fy = mat.get('Fy', 250.0) # MPa
        E = mat.get('E', 200000.0) # MPa
        
        # Demands (Convert to compatible units if needed - assuming input is N, mm)
        # Assuming forces are in N and N-mm for calculation consistency
        Pu = forces.get('P', 0.0)  # Axial (+Tension, -Compression)
        Muz = abs(forces.get('Mz', 0.0)) # Major Moment
        Muy = abs(forces.get('My', 0.0)) # Minor Moment
        
        # Capacities
        capacities = {}
        ratios = {}
        
        # 1. Tension (Chapter D)
        if Pu > 1e-3: # Tension
            # D2. Yielding
            Pn_yield = Fy * props['area']
            phi_Pn_yield = self.phi_t * Pn_yield
            log.append(f"Tension Yielding: Pu={Pu:.0f} N, phiPn={phi_Pn_yield:.0f} N")
            
            # Assume Net Area = Gross Area for now (no bolt holes info)
            capacities['phiPn'] = phi_Pn_yield
            ratios['Tension'] = Pu / phi_Pn_yield
            
        # 2. Compression (Chapter E)
        elif Pu < -1e-3: # Compression
            Pu_c = abs(Pu)
            
            # E3. Flexural Buckling
            # Major axis (x-x)
            Lc_x = member.effective_length_factor_major * member.unbraced_length_major
            r_x = props.get('rxx', 1.0)
            slenderness_x = Lc_x / r_x
            
            # Minor axis (y-y)
            Lc_y = member.effective_length_factor_minor * member.unbraced_length_minor
            r_y = props.get('ryy', 1.0)
            slenderness_y = Lc_y / r_y
            
            # Governing slenderness
            Lc_r = max(slenderness_x, slenderness_y)
            Fe = (math.pi**2 * E) / (Lc_r**2)
            
            if Lc_r <= 4.71 * math.sqrt(E/Fy):
                Fcr = (0.658**(Fy/Fe)) * Fy
            else:
                Fcr = 0.877 * Fe
                
            Pn_comp = Fcr * props['area']
            phi_Pn_comp = self.phi_c * Pn_comp
            
            log.append(f"Compression: Lc/r={Lc_r:.1f}, Fe={Fe:.1f}, Fcr={Fcr:.1f}")
            log.append(f"Axial Capacity: phiPn={phi_Pn_comp:.0f} N")
            
            capacities['phiPn'] = phi_Pn_comp
            ratios['Compression'] = Pu_c / phi_Pn_comp
            
        else:
            capacities['phiPn'] = 1e9 # Infinite capacity if no force
            
        # 3. Flexure (Chapter F) - Major Axis (I-shape assumption)
        # F2. Yielding & LTB for Compact I-shapes
        Sx = props.get('Zxx', props.get('Sxx', 0)) # Elastic Modulus
        Zx = props.get('Zpxx', Sx * 1.1)    # Plastic Modulus (approx if missing)
        
        # Yielding (Plastic Moment)
        Mp = Fy * Zx
        Mn_x = Mp
        
        # Lateral-Torsional Buckling
        Lb = member.unbraced_length_ltb
        ry = props.get('ryy', 1.0)
        
        # Limiting lengths Lp and Lr (simplified for W-shapes)
        Lp = 1.76 * ry * math.sqrt(E/Fy)
        
        # rts approx for I-shapes: rts approx 1.25 ry (very rough approx for generic)
        # Better: calculate if J, Cw available. Assuming defaults or available props.
        # Fallback logic for LTB if J/Cw missing:
        # Assume Lb < Lp implies LTB doesn't govern if we don't have J/Cw.
        
        check_ltb = False
        if Lb > Lp:
            # Need more props: J, Cw. 
            # If missing, simplify or mark warning. Let's assume compact for now or apply reduction.
            # Simplified interaction for LTB:
            Mn_x = Mp * max(0.6, (1.0 - (Lb - Lp)/(100*ry))) # Dummy linear reduction implementation
            log.append("Warning: Simplified LTB calculation due to missing torsional props")
            check_ltb = True
            
        Mn_x = min(Mn_x, Mp)
        phi_Mn_x = self.phi_b * Mn_x
        
        log.append(f"Flexure Major: Mp={Mp/1e6:.2f} kNm, phiMn={phi_Mn_x/1e6:.2f} kNm")
        capacities['phiMnx'] = phi_Mn_x
        ratios['Flexure_X'] = Muz / phi_Mn_x if phi_Mn_x > 0 else 0
        
        # Minor Axis Flexure (F6) - Yielding
        Sy = props.get('Zyy', props.get('Syy', 0))
        Zy = props.get('Zpyy', Sy * 1.5)
        Mny = min(Fy * Zy, 1.6 * Fy * Sy)
        phi_Mn_y = self.phi_b * Mny
        
        capacities['phiMny'] = phi_Mn_y
        ratios['Flexure_Y'] = Muy / phi_Mn_y if phi_Mn_y > 0 else 0
        
        # 4. Interaction (Chapter H) - H1.1 Combined Forces
        Pr = abs(Pu)
        Pc = capacities.get('phiPn', 1e9)
        
        Mrx = Muz
        Mcx = capacities.get('phiMnx', 1e9)
        
        Mry = Muy
        Mcy = capacities.get('phiMny', 1e9)
        
        force_ratio = Pr / Pc
        
        if force_ratio >= 0.2:
            interaction = force_ratio + (8.0/9.0) * (Mrx/Mcx + Mry/Mcy)
            log.append(f"Interaction H1-1a: Pr/Pc={force_ratio:.3f} >= 0.2")
        else:
            interaction = (force_ratio / 2.0) + (Mrx/Mcx + Mry/Mcy)
            log.append(f"Interaction H1-1b: Pr/Pc={force_ratio:.3f} < 0.2")
            
        ratios['Interaction'] = interaction
        
        # Results
        max_ratio = max(ratios.values()) if ratios else 0.0
        governing = max(ratios, key=ratios.get) if ratios else "None"
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{governing} (Ratio: {max_ratio:.3f})",
            calculation_log=log,
            capacity=capacities,
            demand={'Pu': Pu, 'Muz': Muz, 'Muy': Muy}
        )
