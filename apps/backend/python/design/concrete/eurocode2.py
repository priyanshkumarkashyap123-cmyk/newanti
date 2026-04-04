"""
eurocode2.py - Eurocode 2 (EN 1992-1-1): Design of Concrete Structures

Unit conventions:
    fck, fyk: MPa (N/mm²)
    b, h, d: mm
    Mu: kN·m
    Vu: kN

Clause references:
    Bending: Cl. 3.1.7
    Shear: Cl. 6.2.2
    Axial: Cl. 6.1
"""
import logging
logger = logging.getLogger(__name__)

from ..framework import DesignCode, DesignMember, DesignResult
import math

# Partial safety factors (EN 1992-1-1, Table 2.1N)
GAMMA_C = 1.5   # Concrete
GAMMA_S = 1.15  # Reinforcing steel

class Eurocode2(DesignCode):
    """
    Eurocode 2: Design of Concrete Structures (EN 1992-1-1)
    
    Implements basic ULS checks:
    - Bending resistance (rectangular stress block, Clause 3.1.7)
    - Shear resistance without shear reinforcement (Clause 6.2.2)
    - Axial compression resistance (Clause 6.1)
    
    Required section_properties keys:
      b     — width (mm)
      h     — total depth (mm)
      d     — effective depth (mm), defaults to h - 50
      As    — tension reinforcement area (mm²), defaults to 0
      As_c  — compression reinforcement area (mm²), defaults to 0
      Asw_s — shear reinforcement ratio Asw/s (mm²/mm), defaults to 0
    
    Required material keys:
      fck   — characteristic concrete strength (MPa)
      fyk   — characteristic steel yield strength (MPa), defaults to 500
    """
    
    @property
    def code_name(self) -> str:
        return "Eurocode 2 (EN 1992-1-1)"
        
    def check_member(self, member: DesignMember) -> DesignResult:
        log = []
        log.append(f"Checking Member {member.id} according to Eurocode 2")
        
        # Extract section properties
        sp = member.section_properties
        b = sp.get('b', 300.0)          # mm
        h = sp.get('h', 500.0)          # mm
        d = sp.get('d', h - 50.0)       # mm (effective depth)
        As = sp.get('As', 0.0)          # mm² (tension reinforcement)
        As_c = sp.get('As_c', 0.0)      # mm² (compression reinforcement)
        Asw_s = sp.get('Asw_s', 0.0)    # mm²/mm (shear links Asw/s)
        
        # Material properties
        fck = member.material.get('fck', 30.0)   # MPa
        fyk = member.material.get('fyk', 500.0)  # MPa
        
        # Design strengths
        fcd = 0.85 * fck / GAMMA_C   # Design compressive strength (α_cc = 0.85)
        fyd = fyk / GAMMA_S          # Design yield strength of steel
        
        log.append(f"fck = {fck:.1f} MPa, fcd = {fcd:.2f} MPa")
        log.append(f"fyk = {fyk:.1f} MPa, fyd = {fyd:.2f} MPa")
        log.append(f"Section: b = {b:.0f} mm, h = {h:.0f} mm, d = {d:.0f} mm")
        
        # Determine element type
        N_Ed = abs(member.forces.get('P', 0.0))
        if N_Ed > 0.1 * fcd * b * h / 1000.0:
            type_ = "Column"
        else:
            type_ = "Beam"
        log.append(f"Element identified as {type_}")
        
        # ── Bending resistance M_Rd (rectangular stress block, Clause 3.1.7) ──
        # Limiting x/d for ductility: x/d ≤ 0.45 (Class B/C steel) 
        # Neutral axis depth: x = As * fyd / (0.8 * b * fcd)
        if As > 0 and d > 0:
            x = As * fyd / (0.8 * b * fcd)
            x_d = x / d
            if x_d > 0.45:
                log.append(f"WARNING: x/d = {x_d:.3f} > 0.45 — section is over-reinforced")
                x = 0.45 * d  # Cap at balanced
            
            # Lever arm: z = d - 0.4*x
            z = d - 0.4 * x
            M_Rd = As * fyd * z / 1e6  # N·mm → kN·m
            log.append(f"Bending: x = {x:.1f} mm, z = {z:.1f} mm, M_Rd = {M_Rd:.2f} kN·m")
        else:
            # No reinforcement data — use concrete tension-based lower bound
            # fctm ≈ 0.3 * fck^(2/3) for fck ≤ 50 MPa (Table 3.1)
            fctm = 0.3 * fck ** (2.0/3.0) if fck <= 50 else 2.12 * math.log(1 + fck/10.0)
            # Cracking moment as minimum capacity
            W_el = b * h**2 / 6.0  # mm³
            M_Rd = fctm * W_el / 1e6  # kN·m
            log.append(f"WARNING: No reinforcement specified — using cracking moment M_cr = {M_Rd:.2f} kN·m as capacity")
        
        # ── Shear resistance V_Rd (Clause 6.2.2) ──
        # V_Rd,c = [C_Rd,c · k · (100 · ρ_l · fck)^(1/3) + k1·σ_cp] · b_w · d
        rho_l = min(As / (b * d), 0.02) if (b * d) > 0 else 0.0
        k = min(1.0 + math.sqrt(200.0 / d), 2.0) if d > 0 else 2.0
        C_Rd_c = 0.18 / GAMMA_C
        
        sigma_cp = min(N_Ed * 1000.0 / (b * h), 0.2 * fcd) if (b * h) > 0 else 0.0  # kN → N
        k1 = 0.15
        
        V_Rd_c_calc = (C_Rd_c * k * (100.0 * rho_l * fck) ** (1.0/3.0) + k1 * sigma_cp) * b * d / 1000.0  # N → kN
        
        # Minimum shear resistance
        v_min = 0.035 * k ** 1.5 * fck ** 0.5
        V_Rd_c_min = (v_min + k1 * sigma_cp) * b * d / 1000.0  # kN
        
        V_Rd_c = max(V_Rd_c_calc, V_Rd_c_min)
        
        # If shear reinforcement provided: V_Rd,s = Asw/s · z · fyd · cot(θ)
        z_shear = 0.9 * d
        if Asw_s > 0:
            cot_theta = 2.5  # θ = 21.8° (most economical angle)
            V_Rd_s = Asw_s * z_shear * fyd * cot_theta / 1000.0  # kN
            V_Rd = V_Rd_c + V_Rd_s
            log.append(f"Shear: V_Rd,c = {V_Rd_c:.2f} kN, V_Rd,s = {V_Rd_s:.2f} kN, V_Rd = {V_Rd:.2f} kN")
        else:
            V_Rd = V_Rd_c
            log.append(f"Shear (no links): V_Rd,c = {V_Rd:.2f} kN (k = {k:.2f}, ρ_l = {rho_l:.4f})")
        
        # ── Axial resistance N_Rd (Clause 6.1) ──
        Ac = b * h - (As + As_c)  # Net concrete area
        N_Rd = (Ac * fcd + (As + As_c) * fyd) / 1000.0  # kN
        log.append(f"Axial: N_Rd = {N_Rd:.2f} kN")
        
        capacities = {
            'M_Rd': round(M_Rd, 2),
            'V_Rd': round(V_Rd, 2),
            'N_Rd': round(N_Rd, 2),
        }
        
        # Demands
        M_Ed = abs(member.forces.get('Mz', 0.0))
        V_Ed = abs(member.forces.get('Vy', 0.0))
        
        ratios = {
             'Bending': M_Ed / capacities['M_Rd'] if capacities['M_Rd'] > 0 else 0.0,
             'Shear': V_Ed / capacities['V_Rd'] if capacities['V_Rd'] > 0 else 0.0,
        }
        
        if type_ == "Column":
            ratios['Axial'] = N_Ed / capacities['N_Rd'] if capacities['N_Rd'] > 0 else 0.0
            
        max_ratio = max(ratios.values()) if ratios else 0.0
        status = "PASS" if max_ratio <= 1.0 else "FAIL"
        
        log.append(f"Governing ratio: {max_ratio:.3f} ({max(ratios, key=ratios.get)})")
        
        return DesignResult(
            member_id=member.id,
            ratio=max_ratio,
            status=status,
            governing_check=f"{max(ratios, key=ratios.get)} (EC2)",
            calculation_log=log,
            capacity=capacities,
            demand=member.forces
        )
