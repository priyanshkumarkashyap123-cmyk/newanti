"""
steel_joints.py - Steel Connection Design

Implements connection design per IS 800:2007:
- Bolted connections (Clause 10.3, 10.4)
- Welded connections (Clause 10.5)
- Base plate design (Clause 11)
- Beam-column connections

Reference: IS 800:2007 General Construction in Steel
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
from enum import Enum
import math


# ============================================
# BOLT PROPERTIES
# ============================================

class BoltGrade(Enum):
    """Bolt grades per IS 1367"""
    GRADE_4_6 = (400, 240)    # (fub, fyb) in MPa
    GRADE_4_8 = (400, 320)
    GRADE_5_6 = (500, 300)
    GRADE_5_8 = (500, 400)
    GRADE_6_8 = (600, 480)
    GRADE_8_8 = (800, 640)
    GRADE_10_9 = (1000, 900)
    GRADE_12_9 = (1200, 1080)
    
    @property
    def fub(self) -> float:
        return self.value[0]
    
    @property
    def fyb(self) -> float:
        return self.value[1]


# Standard bolt sizes (mm)
STANDARD_BOLT_DIAMETERS = [12, 16, 20, 22, 24, 27, 30, 36]

# Bolt hole clearances (mm)
HOLE_CLEARANCE = {
    12: 1, 14: 1, 16: 2, 18: 2, 20: 2,
    22: 2, 24: 2, 27: 3, 30: 3, 36: 3
}


class WeldType(Enum):
    """Weld types"""
    FILLET = 'fillet'
    BUTT = 'butt'
    PLUG = 'plug'
    SLOT = 'slot'


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class BoltedConnection:
    """Bolted connection configuration"""
    bolt_diameter: float        # mm
    bolt_grade: BoltGrade
    num_bolts: int
    rows: int
    columns: int
    pitch: float               # mm (vertical spacing)
    gauge: float               # mm (horizontal spacing)
    edge_distance: float       # mm
    end_distance: float        # mm
    plate_thickness: float     # mm
    plate_fy: float = 250      # MPa


@dataclass
class WeldedConnection:
    """Welded connection configuration"""
    weld_type: WeldType
    weld_size: float          # mm (leg length for fillet)
    weld_length: float        # mm
    fu_weld: float = 410      # MPa (weld metal strength)


@dataclass
class BasePlate:
    """Column base plate"""
    width: float              # mm (B)
    length: float             # mm (L)
    thickness: float          # mm (tp)
    fy_plate: float           # MPa
    concrete_fck: float       # MPa
    pedestal_width: float     # mm
    pedestal_length: float    # mm


@dataclass
class ConnectionResult:
    """Connection design result"""
    capacity: float           # kN or kNm
    demand: float
    ratio: float
    status: str
    checks: List[str]


# ============================================
# CONNECTION DESIGNER
# ============================================

class ConnectionDesigner:
    """
    Steel connection design per IS 800:2007
    """
    
    # Partial safety factors
    GAMMA_MB = 1.25   # Bolts in bearing
    GAMMA_MF = 1.25   # Bolts in friction  
    GAMMA_MW = 1.25   # Welds
    GAMMA_M0 = 1.10   # Yielding
    
    def __init__(self, fu: float = 410, fy: float = 250):
        """
        Args:
            fu: Ultimate strength of connected parts (MPa)
            fy: Yield strength of connected parts (MPa)
        """
        self.fu = fu
        self.fy = fy
    
    # ============================================
    # BOLTED CONNECTIONS
    # ============================================
    
    def design_bolt_shear(
        self,
        conn: BoltedConnection,
        Vu: float              # Design shear force (kN)
    ) -> ConnectionResult:
        """
        Design bolted connection in shear per IS 800 Clause 10.3
        """
        checks = []
        
        d = conn.bolt_diameter
        n = conn.num_bolts
        
        # Bolt shank area
        A = math.pi * d**2 / 4
        
        # Net tensile area (approximate)
        Anb = 0.78 * A
        
        # Shear capacity per bolt (single shear)
        fub = conn.bolt_grade.fub
        
        # Nominal shear capacity
        Vnsb = fub * (A if False else Anb) / (math.sqrt(3) * 1000)  # kN
        
        # Design shear capacity per bolt
        Vdsb = Vnsb / self.GAMMA_MB
        
        checks.append(f"Bolt shear capacity = {Vdsb:.1f} kN/bolt")
        
        # Bearing capacity per bolt
        kb = self._get_kb(conn)
        Vnpb = 2.5 * kb * d * min(conn.plate_thickness, 100) * self.fu / 1000
        Vdpb = Vnpb / self.GAMMA_MB
        
        checks.append(f"Bearing capacity = {Vdpb:.1f} kN/bolt")
        
        # Governing capacity per bolt
        Vdb = min(Vdsb, Vdpb)
        
        # Total capacity
        Vd_total = n * Vdb
        
        checks.append(f"Total connection capacity = {Vd_total:.1f} kN")
        
        ratio = Vu / Vd_total if Vd_total > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=Vd_total,
            demand=Vu,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    def design_bolt_tension(
        self,
        conn: BoltedConnection,
        Tu: float              # Design tension force (kN)
    ) -> ConnectionResult:
        """
        Design bolted connection in tension per IS 800 Clause 10.3.5
        """
        checks = []
        
        d = conn.bolt_diameter
        n = conn.num_bolts
        
        # Net tensile area
        A = math.pi * d**2 / 4
        Anb = 0.78 * A
        
        fub = conn.bolt_grade.fub
        fyb = conn.bolt_grade.fyb
        
        # Tension capacity per bolt
        Tnb = min(0.9 * fub * Anb, fyb * A * (self.GAMMA_MB / self.GAMMA_M0)) / 1000
        Tdb = Tnb / self.GAMMA_MB
        
        checks.append(f"Bolt tension capacity = {Tdb:.1f} kN/bolt")
        
        # Total capacity
        Td_total = n * Tdb
        checks.append(f"Total connection capacity = {Td_total:.1f} kN")
        
        ratio = Tu / Td_total if Td_total > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=Td_total,
            demand=Tu,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    def design_bolt_combined(
        self,
        conn: BoltedConnection,
        Vu: float,             # Design shear (kN)
        Tu: float              # Design tension (kN)
    ) -> ConnectionResult:
        """
        Combined shear and tension per IS 800 Clause 10.3.6
        
        (Vsb/Vdb)² + (Tb/Tdb)² ≤ 1.0
        """
        shear_result = self.design_bolt_shear(conn, Vu)
        tension_result = self.design_bolt_tension(conn, Tu)
        
        ratio_V = Vu / shear_result.capacity if shear_result.capacity > 0 else 0
        ratio_T = Tu / tension_result.capacity if tension_result.capacity > 0 else 0
        
        combined_ratio = math.sqrt(ratio_V**2 + ratio_T**2)
        
        checks = [
            f"Shear ratio = {ratio_V:.3f}",
            f"Tension ratio = {ratio_T:.3f}",
            f"Combined: √(V²+T²) = {combined_ratio:.3f}"
        ]
        
        status = 'PASS' if combined_ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=1.0,
            demand=combined_ratio,
            ratio=combined_ratio,
            status=status,
            checks=checks
        )
    
    def _get_kb(self, conn: BoltedConnection) -> float:
        """
        Get kb factor for bearing per IS 800 Clause 10.3.4
        """
        d = conn.bolt_diameter
        d0 = d + HOLE_CLEARANCE.get(d, 2)
        
        e = conn.end_distance
        p = conn.pitch
        
        kb = min(
            e / (3 * d0),
            p / (3 * d0) - 0.25,
            conn.bolt_grade.fub / self.fu,
            1.0
        )
        
        return max(kb, 0.25)
    
    # ============================================
    # FRICTION-GRIP (HSFG) BOLTS
    # ============================================
    
    def design_hsfg_bolt(
        self,
        conn: BoltedConnection,
        Vu: float,
        mu: float = 0.48,     # Slip factor
        n_e: int = 1          # Number of effective interfaces
    ) -> ConnectionResult:
        """
        Design HSFG bolts in friction per IS 800 Clause 10.4
        """
        checks = []
        
        d = conn.bolt_diameter
        n = conn.num_bolts
        
        # Proof load
        A = math.pi * d**2 / 4
        Anb = 0.78 * A
        
        fub = conn.bolt_grade.fub
        F0 = 0.7 * fub * Anb / 1000  # kN
        
        # Slip resistance per bolt
        Vnsf = mu * n_e * F0
        Vdsf = Vnsf / self.GAMMA_MF
        
        checks.append(f"Slip resistance = {Vdsf:.1f} kN/bolt")
        
        # Total capacity
        Vd_total = n * Vdsf
        checks.append(f"Total friction capacity = {Vd_total:.1f} kN")
        
        ratio = Vu / Vd_total if Vd_total > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=Vd_total,
            demand=Vu,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # WELDED CONNECTIONS
    # ============================================
    
    def design_fillet_weld(
        self,
        weld: WeldedConnection,
        force: float,          # kN
        angle: float = 90      # Angle of force to weld axis (degrees)
    ) -> ConnectionResult:
        """
        Design fillet weld per IS 800 Clause 10.5.7
        """
        checks = []
        
        s = weld.weld_size
        Lw = weld.weld_length
        fu = weld.fu_weld
        
        # Effective throat
        t = 0.7 * s
        
        # Effective length (deduct 2*s for end returns)
        Lwe = Lw - 2 * s
        
        # Weld capacity
        fwd = fu / (math.sqrt(3) * self.GAMMA_MW)
        
        Rw = fwd * t * Lwe / 1000  # kN
        
        checks.append(f"Weld size = {s} mm")
        checks.append(f"Effective throat = {t:.1f} mm")
        checks.append(f"Weld capacity = {Rw:.1f} kN")
        
        ratio = force / Rw if Rw > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=Rw,
            demand=force,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    def design_butt_weld(
        self,
        thickness: float,      # Plate thickness (mm)
        length: float,         # Weld length (mm)
        force: float,          # kN
        fu_weld: float = 410
    ) -> ConnectionResult:
        """
        Design full penetration butt weld
        """
        checks = []
        
        # Full penetration: capacity = base metal capacity
        t = thickness
        Lw = length
        
        fwd = fu_weld / (math.sqrt(3) * self.GAMMA_MW)
        Rw = fwd * t * Lw / 1000
        
        checks.append(f"Butt weld throat = {t} mm (full penetration)")
        checks.append(f"Weld capacity = {Rw:.1f} kN")
        
        ratio = force / Rw if Rw > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=Rw,
            demand=force,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # BASE PLATE DESIGN
    # ============================================
    
    def design_base_plate(
        self,
        plate: BasePlate,
        Pu: float,             # Axial load (kN)
        Mu: float = 0,         # Moment (kNm)
        Vu: float = 0          # Shear (kN)
    ) -> ConnectionResult:
        """
        Design column base plate per IS 800 Clause 11.3
        """
        checks = []
        
        B = plate.width
        L = plate.length
        tp = plate.thickness
        fy = plate.fy_plate
        fck = plate.concrete_fck
        
        # Bearing area
        A1 = B * L
        
        # Pedestal area
        A2 = plate.pedestal_width * plate.pedestal_length
        
        # Bearing strength
        fb = 0.45 * fck * min(math.sqrt(A2 / A1), 2)
        
        checks.append(f"Bearing strength fb = {fb:.2f} MPa")
        
        # Pressure under plate
        if Mu == 0:
            # Axial only
            w = Pu * 1000 / A1  # MPa
            checks.append(f"Bearing pressure = {w:.2f} MPa")
            
            if w > fb:
                checks.append("FAIL: Bearing pressure exceeds capacity")
                return ConnectionResult(
                    capacity=fb * A1 / 1000,
                    demand=Pu,
                    ratio=w / fb,
                    status='FAIL',
                    checks=checks
                )
        else:
            # With moment - check eccentricity
            e = Mu * 1000 / Pu  # mm
            e_limit = L / 6
            
            if e <= e_limit:
                # Within kern - full compression
                w_max = Pu * 1000 / A1 * (1 + 6 * e / L)
            else:
                # Outside kern - partial compression
                y = 3 * (L / 2 - e)  # Compression zone length
                w_max = 2 * Pu * 1000 / (B * y)
            
            checks.append(f"Maximum bearing pressure = {w_max:.2f} MPa")
            
            if w_max > fb:
                return ConnectionResult(
                    capacity=fb,
                    demand=w_max,
                    ratio=w_max / fb,
                    status='FAIL',
                    checks=checks
                )
        
        # Plate thickness check
        # Cantilever projection
        a = (B - 100) / 2  # Assumed column width 100mm placeholder
        b = (L - 100) / 2
        
        c = max(a, b)
        w = Pu * 1000 / A1
        
        # Required thickness
        tp_req = c * math.sqrt(2.5 * w / fy)
        
        checks.append(f"Required plate thickness = {tp_req:.1f} mm")
        checks.append(f"Provided plate thickness = {tp:.1f} mm")
        
        ratio = tp_req / tp if tp > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ConnectionResult(
            capacity=tp,
            demand=tp_req,
            ratio=ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # BEAM-COLUMN CONNECTIONS
    # ============================================
    
    def design_simple_shear_connection(
        self,
        Vu: float,             # Design shear (kN)
        beam_depth: float,     # mm
        bolt_diameter: float = 20,
        bolt_grade: BoltGrade = BoltGrade.GRADE_8_8
    ) -> Tuple[BoltedConnection, ConnectionResult]:
        """
        Design simple shear connection (flexible end plate or web angles)
        """
        # Determine number of bolts
        d = bolt_diameter
        A = math.pi * d**2 / 4
        Anb = 0.78 * A
        
        Vdb = bolt_grade.fub * Anb / (math.sqrt(3) * self.GAMMA_MB * 1000)
        
        # Account for bearing
        Vdb = min(Vdb, 2.5 * 0.5 * d * 10 * self.fu / (self.GAMMA_MB * 1000))
        
        n_req = math.ceil(Vu / Vdb)
        n = max(n_req, 2)  # Minimum 2 bolts
        
        # Arrange in rows
        rows = min(n, int((beam_depth - 100) / 60))  # 60mm pitch
        cols = math.ceil(n / rows) if rows > 0 else 1
        n = rows * cols
        
        conn = BoltedConnection(
            bolt_diameter=d,
            bolt_grade=bolt_grade,
            num_bolts=n,
            rows=rows,
            columns=cols,
            pitch=60,
            gauge=80,
            edge_distance=40,
            end_distance=40,
            plate_thickness=10
        )
        
        result = self.design_bolt_shear(conn, Vu)
        
        return conn, result
    
    def design_moment_end_plate(
        self,
        Mu: float,             # Design moment (kNm)
        Vu: float,             # Design shear (kN)
        beam_depth: float,     # mm
        bolt_diameter: float = 24,
        bolt_grade: BoltGrade = BoltGrade.GRADE_10_9
    ) -> Tuple[BoltedConnection, ConnectionResult]:
        """
        Design extended end plate moment connection
        """
        checks = []
        
        d = bolt_diameter
        
        # Bolt tension capacity
        A = math.pi * d**2 / 4
        Anb = 0.78 * A
        fub = bolt_grade.fub
        
        Tdb = 0.9 * fub * Anb / (self.GAMMA_MB * 1000)
        
        # Lever arm (approximate)
        z = beam_depth - 50  # mm
        
        # Required bolt tension from moment
        Tu_req = Mu * 1e6 / z  # N -> kN
        
        # Number of bolt rows in tension zone
        n_rows_tension = math.ceil(Tu_req / (2 * Tdb))  # 2 bolts per row
        n_rows_total = n_rows_tension + 2  # Add compression zone bolts
        
        # Check shear
        n_shear = math.ceil(Vu / Tdb)
        n_rows_total = max(n_rows_total, math.ceil(n_shear / 2))
        
        conn = BoltedConnection(
            bolt_diameter=d,
            bolt_grade=bolt_grade,
            num_bolts=n_rows_total * 2,
            rows=n_rows_total,
            columns=2,
            pitch=80,
            gauge=100,
            edge_distance=50,
            end_distance=50,
            plate_thickness=20
        )
        
        # Moment capacity
        M_cap = 2 * n_rows_tension * Tdb * z / 1e3  # kNm
        
        checks.append(f"Bolt rows in tension = {n_rows_tension}")
        checks.append(f"Bolt tension capacity = {Tdb:.1f} kN")
        checks.append(f"Moment capacity = {M_cap:.1f} kNm")
        
        ratio = Mu / M_cap if M_cap > 0 else float('inf')
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        result = ConnectionResult(
            capacity=M_cap,
            demand=Mu,
            ratio=ratio,
            status=status,
            checks=checks
        )
        
        return conn, result
    
    # ============================================
    # UTILITY FUNCTIONS
    # ============================================
    
    def get_min_edge_distance(self, bolt_dia: float) -> float:
        """
        Minimum edge distance per IS 800 Table 22
        """
        return 1.7 * (bolt_dia + HOLE_CLEARANCE.get(bolt_dia, 2))
    
    def get_min_pitch(self, bolt_dia: float) -> float:
        """
        Minimum pitch per IS 800 Clause 10.2.2
        """
        return 2.5 * bolt_dia
    
    def get_max_pitch(self, plate_thickness: float) -> float:
        """
        Maximum pitch per IS 800 Clause 10.2.3
        """
        return min(32 * plate_thickness, 300)
    
    def get_min_weld_size(self, plate_thickness: float) -> float:
        """
        Minimum weld size per IS 800 Table 21
        """
        if plate_thickness <= 10:
            return 3
        elif plate_thickness <= 20:
            return 5
        elif plate_thickness <= 32:
            return 6
        else:
            return 8
    
    def get_max_weld_size(self, plate_thickness: float) -> float:
        """
        Maximum weld size per IS 800 Clause 10.5.8.1
        """
        return plate_thickness - 1.5
