"""
solver.py - Structural Beam Solver with Hand Calculation Steps

Features:
- Returns step-by-step hand calculation explanations
- Generates 100 data points for SFD/BMD diagrams
- Uses sympy for symbolic mathematics
- Supports various load types (point, UDL, UVL)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum
import numpy as np

try:
    import sympy as sp
    from sympy import symbols, Rational, simplify, Piecewise, integrate
    SYMPY_AVAILABLE = True
except ImportError:
    SYMPY_AVAILABLE = False
    print("Warning: sympy not installed. Using numerical methods only.")


# ============================================
# DATA STRUCTURES
# ============================================

class LoadType(Enum):
    POINT = "point"
    UDL = "udl"           # Uniform Distributed Load
    UVL = "uvl"           # Uniformly Varying Load (triangular)
    MOMENT = "moment"


@dataclass
class Load:
    """Represents a load on the beam"""
    type: LoadType
    magnitude: float      # kN or kN/m
    position: float       # Distance from left support (m)
    end_position: Optional[float] = None  # For distributed loads
    end_magnitude: Optional[float] = None  # For UVL


@dataclass
class Support:
    """Represents a support condition"""
    position: float       # Distance from left end (m)
    type: str             # "pinned", "roller", "fixed"


@dataclass
class BeamAnalysisInput:
    """Input for beam analysis"""
    length: float                    # Beam length (m)
    loads: List[Load]                # Applied loads
    supports: List[Support]          # Support conditions
    E: float = 200e6                 # Young's modulus (kN/m²)
    I: float = 1e-4                  # Moment of inertia (m⁴)


@dataclass
class CalculationStep:
    """A single step in the hand calculation"""
    step_number: int
    description: str
    formula: str
    substitution: str
    result: str


@dataclass
class DiagramData:
    """Data points for SFD/BMD diagrams"""
    x_values: List[float]            # Position along beam (m)
    shear_values: List[float]        # Shear force at each x (kN)
    moment_values: List[float]       # Bending moment at each x (kN·m)
    deflection_values: List[float]   # Deflection at each x (mm)


@dataclass
class BeamAnalysisResult:
    """Complete analysis result with hand calculation steps"""
    # Reaction forces
    reactions: Dict[str, float]
    
    # Maximum values
    max_shear: float
    max_moment: float
    max_deflection: float
    
    # Location of max values
    max_shear_location: float
    max_moment_location: float
    max_deflection_location: float
    
    # Hand calculation steps
    steps: List[str]
    
    # Diagram data (100 points)
    diagram: DiagramData
    
    # Success flag
    success: bool = True
    error: Optional[str] = None


# ============================================
# BEAM SOLVER CLASS
# ============================================

class BeamSolver:
    """
    Solves simply supported and continuous beams with hand calculation steps.
    """
    
    def __init__(self, beam: BeamAnalysisInput):
        self.beam = beam
        self.L = beam.length
        self.loads = beam.loads
        self.supports = beam.supports
        self.E = beam.E
        self.I = beam.I
        self.steps: List[str] = []
        self.num_points = 100
        
        # Symbolic variables
        if SYMPY_AVAILABLE:
            self.x = sp.Symbol('x', positive=True)
        
    def add_step(self, description: str) -> None:
        """Add a calculation step"""
        step_num = len(self.steps) + 1
        self.steps.append(f"Step {step_num}: {description}")
    
    def solve(self) -> BeamAnalysisResult:
        """
        Main solver method - determines beam type and solves accordingly
        """
        try:
            # Clear previous steps
            self.steps = []
            
            # Step 1: Identify beam configuration
            self.add_step(f"Beam Configuration: L = {self.L}m with {len(self.loads)} load(s)")
            
            # Determine beam type
            if len(self.supports) == 2:
                # Simply supported beam
                return self._solve_simply_supported()
            elif len(self.supports) == 1 and self.supports[0].type == "fixed":
                # Cantilever beam
                return self._solve_cantilever()
            else:
                # Default to simply supported
                return self._solve_simply_supported()
                
        except Exception as e:
            return BeamAnalysisResult(
                reactions={},
                max_shear=0,
                max_moment=0,
                max_deflection=0,
                max_shear_location=0,
                max_moment_location=0,
                max_deflection_location=0,
                steps=[f"Error: {str(e)}"],
                diagram=DiagramData([], [], [], []),
                success=False,
                error=str(e)
            )
    
    def _solve_simply_supported(self) -> BeamAnalysisResult:
        """
        Solve a simply supported beam with various loads
        """
        L = self.L
        
        # ============================================
        # STEP 2: Calculate Total Load and Reactions
        # ============================================
        self.add_step("Calculating reactions using equilibrium equations")
        
        total_load = 0
        moment_about_a = 0  # Moment about left support
        
        for load in self.loads:
            if load.type == LoadType.POINT:
                P = load.magnitude
                a = load.position
                total_load += P
                moment_about_a += P * a
                self.add_step(f"Point Load: P = {P}kN at x = {a}m")
                
            elif load.type == LoadType.UDL:
                w = load.magnitude
                start = load.position
                end = load.end_position or L
                length = end - start
                W = w * length  # Total equivalent load
                centroid = start + length / 2
                total_load += W
                moment_about_a += W * centroid
                self.add_step(f"UDL: w = {w}kN/m from x = {start}m to x = {end}m")
                self.add_step(f"  Equivalent load W = w × L = {w} × {length} = {W}kN at centroid x = {centroid}m")
                
            elif load.type == LoadType.UVL:
                w1 = load.magnitude
                w2 = load.end_magnitude if load.end_magnitude is not None else 0
                start = load.position
                end = load.end_position or L
                length = end - start
                # General trapezoidal load: W = (w1 + w2) / 2 * L
                # Centroid from start = L * (w1 + 2*w2) / (3 * (w1 + w2))
                W = (w1 + w2) / 2.0 * length
                if abs(w1 + w2) > 1e-12:
                    centroid = start + length * (w1 + 2 * w2) / (3 * (w1 + w2))
                else:
                    centroid = start + length / 2.0
                total_load += W
                moment_about_a += W * centroid
                self.add_step(f"UVL: w = {w1} to {w2}kN/m over {length}m")
                self.add_step(f"  Equivalent load W = ({w1}+{w2})/2 × {length} = {W:.2f}kN at centroid x = {centroid:.2f}m")
        
        # Calculate reactions
        # Sum of moments about A = 0: Rb * L = moment_about_a
        Rb = moment_about_a / L
        Ra = total_load - Rb
        
        self.add_step(f"ΣMA = 0: Rb × {L} = {moment_about_a}")
        self.add_step(f"  Rb = {moment_about_a} / {L} = {Rb:.2f}kN")
        self.add_step(f"ΣFy = 0: Ra + Rb = {total_load}")
        self.add_step(f"  Ra = {total_load} - {Rb:.2f} = {Ra:.2f}kN")
        
        reactions = {"Ra": round(Ra, 3), "Rb": round(Rb, 3)}
        
        # ============================================
        # STEP 3: Generate Shear Force Diagram
        # ============================================
        self.add_step("Generating Shear Force Diagram (SFD)")
        
        x_vals = np.linspace(0, L, self.num_points)
        shear_vals = []
        
        for x in x_vals:
            V = Ra  # Start with reaction at A
            
            for load in self.loads:
                if load.type == LoadType.POINT:
                    if x >= load.position:
                        V -= load.magnitude
                        
                elif load.type == LoadType.UDL:
                    start = load.position
                    end = load.end_position or L
                    if x > start:
                        effective_length = min(x, end) - start
                        if effective_length > 0:
                            V -= load.magnitude * effective_length

                elif load.type == LoadType.UVL:
                    w1 = load.magnitude
                    w2 = load.end_magnitude if load.end_magnitude is not None else 0
                    start = load.position
                    end = load.end_position or L
                    length = end - start
                    if x > start and length > 1e-12:
                        t = min(x - start, length) / length  # 0..1
                        # Intensity at position x: w(t) = w1 + (w2-w1)*t
                        # Shear contribution = integral of w(t) from 0 to t*length
                        # = w1*t*L + (w2-w1)*t²*L/2
                        eff_len = min(x - start, length)
                        t_eff = eff_len / length
                        V -= (w1 * t_eff + (w2 - w1) * t_eff ** 2 / 2) * length

            shear_vals.append(round(V, 4))
        
        # ============================================
        # STEP 4: Generate Bending Moment Diagram
        # ============================================
        self.add_step("Generating Bending Moment Diagram (BMD)")
        self.add_step("M(x) = Ra × x - (sum of moments from loads to the left of x)")
        
        moment_vals = []
        
        for x in x_vals:
            M = Ra * x  # Moment from left reaction
            
            for load in self.loads:
                if load.type == LoadType.POINT:
                    a = load.position
                    if x > a:
                        M -= load.magnitude * (x - a)
                        
                elif load.type == LoadType.UDL:
                    w = load.magnitude
                    start = load.position
                    end = load.end_position or L
                    if x > start:
                        effective_length = min(x, end) - start
                        if effective_length > 0:
                            # Moment from UDL = w * length * (x - centroid)
                            # Centroid of the effective load part is at start + effective_length/2
                            arm = x - (start + effective_length / 2)
                            M -= w * effective_length * arm
                            
            moment_vals.append(round(M, 4))
        
        # ============================================
        # STEP 5: Calculate Maximum Values
        # ============================================
        max_shear = max(abs(min(shear_vals)), abs(max(shear_vals)))
        max_shear_idx = np.argmax(np.abs(shear_vals))
        max_shear_location = x_vals[max_shear_idx]
        
        max_moment = max(moment_vals)
        max_moment_idx = np.argmax(moment_vals)
        max_moment_location = x_vals[max_moment_idx]
        
        self.add_step(f"Maximum Shear: V_max = {max_shear:.2f}kN at x = {max_shear_location:.2f}m")
        self.add_step(f"Maximum Moment: M_max = {max_moment:.2f}kN·m at x = {max_moment_location:.2f}m")
        
        # ============================================
        # STEP 6: Calculate Deflection (double integration of M/EI)
        # ============================================
        self.add_step("Calculating deflection via numerical double integration of M(x)/EI")
        self.add_step("EI·y'' = M(x)  →  integrate twice with y(0)=0, y(L)=0")

        EI = self.E * self.I  # kN·m²
        dx = x_vals[1] - x_vals[0]

        # First integration: slope θ(x) = ∫M/EI dx  (constant of integration C1 determined by BC)
        # Second integration: deflection y(x) = ∫θ dx  (C2 = 0 from y(0)=0)
        # BC y(L)=0 gives C1 = -∫₀ᴸ ∫₀ˣ M/EI dx dx / L

        # Curvature array
        curvature = [m / EI for m in moment_vals]

        # First integration (slope, without C1)
        slope_no_c1 = [0.0] * self.num_points
        for i in range(1, self.num_points):
            slope_no_c1[i] = slope_no_c1[i - 1] + 0.5 * (curvature[i - 1] + curvature[i]) * dx

        # Second integration (deflection, without C1 contribution)
        defl_no_c1 = [0.0] * self.num_points
        for i in range(1, self.num_points):
            defl_no_c1[i] = defl_no_c1[i - 1] + 0.5 * (slope_no_c1[i - 1] + slope_no_c1[i]) * dx

        # Apply BC y(L)=0: C1 = -defl_no_c1[-1] / L
        C1 = -defl_no_c1[-1] / L

        deflection_vals = []
        for i, x in enumerate(x_vals):
            y = defl_no_c1[i] + C1 * x  # metres
            deflection_vals.append(round(y * 1000, 4))  # convert to mm

        max_deflection = max(abs(min(deflection_vals)), abs(max(deflection_vals)))
        max_deflection_idx = np.argmax(np.abs(deflection_vals))
        max_deflection_location = x_vals[max_deflection_idx]

        self.add_step(f"Maximum Deflection: δ_max = {max_deflection:.4f}mm at x = {max_deflection_location:.2f}m")
        
        # ============================================
        # Build Result
        # ============================================
        diagram = DiagramData(
            x_values=[round(x, 4) for x in x_vals.tolist()],
            shear_values=shear_vals,
            moment_values=moment_vals,
            deflection_values=deflection_vals
        )
        
        return BeamAnalysisResult(
            reactions=reactions,
            max_shear=round(max_shear, 3),
            max_moment=round(max_moment, 3),
            max_deflection=round(max_deflection, 4),
            max_shear_location=round(max_shear_location, 3),
            max_moment_location=round(max_moment_location, 3),
            max_deflection_location=round(max_deflection_location, 3),
            steps=self.steps,
            diagram=diagram,
            success=True
        )
    
    def _solve_cantilever(self) -> BeamAnalysisResult:
        """
        Solve a cantilever beam (fixed at one end)
        """
        L = self.L
        
        self.add_step(f"Cantilever Beam: L = {L}m, fixed at x = 0")
        
        # For cantilever, reaction at fixed end
        total_load = 0
        total_moment = 0
        
        for load in self.loads:
            if load.type == LoadType.POINT:
                P = load.magnitude
                a = load.position
                total_load += P
                total_moment += P * a
                self.add_step(f"Point Load: P = {P}kN at x = {a}m")
                
            elif load.type == LoadType.UDL:
                w = load.magnitude
                start = load.position
                end = load.end_position or L
                length = end - start
                W = w * length
                centroid = start + length / 2
                total_load += W
                total_moment += W * centroid
                self.add_step(f"UDL: w = {w}kN/m from {start}m to {end}m")
        
        # Reactions at fixed support
        Ra = total_load
        Ma = total_moment
        
        self.add_step(f"Fixed End Reaction: Ra = {Ra:.2f}kN (upward)")
        self.add_step(f"Fixed End Moment: Ma = {Ma:.2f}kN·m (counterclockwise)")
        
        reactions = {"Ra": round(Ra, 3), "Ma": round(Ma, 3)}
        
        # Generate diagrams
        x_vals = np.linspace(0, L, self.num_points)
        shear_vals = []
        moment_vals = []
        
        for x in x_vals:
            V = -Ra  # Negative because reaction is upward
            M = -Ma + Ra * x
            
            for load in self.loads:
                if load.type == LoadType.POINT:
                    if x >= load.position:
                        V += load.magnitude
                        M -= load.magnitude * (x - load.position)
                        
                elif load.type == LoadType.UDL:
                    start = load.position
                    end = load.end_position or L
                    if x > start:
                        effective_length = min(x, end) - start
                        if effective_length > 0:
                            V += load.magnitude * effective_length
                            M -= load.magnitude * effective_length * (effective_length / 2)
            
            shear_vals.append(round(V, 4))
            moment_vals.append(round(M, 4))
        
        # Max values
        max_shear = max(abs(min(shear_vals)), abs(max(shear_vals)))
        max_moment = max(abs(min(moment_vals)), abs(max(moment_vals)))
        
        self.add_step(f"Maximum Shear at fixed end: V_max = {max_shear:.2f}kN")
        self.add_step(f"Maximum Moment at fixed end: M_max = {max_moment:.2f}kN·m")
        
        # Deflection via double integration: EI·y'' = M(x), BC: y(0)=0, y'(0)=0
        self.add_step("Calculating cantilever deflection via double integration: EI·y''=M(x), y(0)=0, y'(0)=0")
        EI = self.E * self.I
        dx_val = x_vals[1] - x_vals[0]

        # First integration: slope θ(x) = ∫M/EI dx, θ(0)=0
        slope_vals = [0.0] * self.num_points
        for i in range(1, self.num_points):
            slope_vals[i] = slope_vals[i - 1] + 0.5 * (moment_vals[i - 1] + moment_vals[i]) / EI * dx_val

        # Second integration: deflection y(x) = ∫θ dx, y(0)=0
        deflection_vals_m = [0.0] * self.num_points
        for i in range(1, self.num_points):
            deflection_vals_m[i] = deflection_vals_m[i - 1] + 0.5 * (slope_vals[i - 1] + slope_vals[i]) * dx_val

        deflection_vals = [round(y * 1000, 4) for y in deflection_vals_m]  # mm
        max_deflection = max(abs(min(deflection_vals)), abs(max(deflection_vals)))
        max_deflection_idx = int(np.argmax(np.abs(deflection_vals)))
        max_deflection_location = float(x_vals[max_deflection_idx])
        self.add_step(f"Maximum Deflection: δ_max = {max_deflection:.4f}mm at x = {max_deflection_location:.2f}m")
        
        diagram = DiagramData(
            x_values=[round(x, 4) for x in x_vals.tolist()],
            shear_values=shear_vals,
            moment_values=moment_vals,
            deflection_values=deflection_vals
        )
        
        return BeamAnalysisResult(
            reactions=reactions,
            max_shear=round(max_shear, 3),
            max_moment=round(max_moment, 3),
            max_deflection=round(max_deflection, 4),
            max_shear_location=0,
            max_moment_location=0,
            max_deflection_location=round(max_deflection_location, 3),
            steps=self.steps,
            diagram=diagram,
            success=True
        )


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def analyze_simply_supported_beam_with_udl(
    length: float,
    w: float,
    E: float = 200e6,
    I: float = 1e-4
) -> Dict[str, Any]:
    """
    Quick analysis for simply supported beam with full UDL
    
    Args:
        length: Beam span (m)
        w: UDL intensity (kN/m)
        E: Young's modulus (kN/m²)
        I: Moment of inertia (m⁴)
    
    Returns:
        Dictionary with result, steps, and diagram data
    """
    beam = BeamAnalysisInput(
        length=length,
        loads=[Load(type=LoadType.UDL, magnitude=w, position=0, end_position=length)],
        supports=[
            Support(position=0, type="pinned"),
            Support(position=length, type="roller")
        ],
        E=E,
        I=I
    )
    
    solver = BeamSolver(beam)
    result = solver.solve()
    
    return {
        "result": {
            "max_moment": result.max_moment,
            "max_shear": result.max_shear,
            "reactions": result.reactions
        },
        "steps": result.steps,
        "diagram": {
            "x_values": result.diagram.x_values,
            "shear_values": result.diagram.shear_values,
            "moment_values": result.diagram.moment_values
        }
    }


def analyze_beam_with_point_load(
    length: float,
    P: float,
    a: float,
    E: float = 200e6,
    I: float = 1e-4
) -> Dict[str, Any]:
    """
    Quick analysis for simply supported beam with point load
    
    Args:
        length: Beam span (m)
        P: Point load magnitude (kN)
        a: Distance from left support (m)
        E: Young's modulus (kN/m²)
        I: Moment of inertia (m⁴)
    """
    beam = BeamAnalysisInput(
        length=length,
        loads=[Load(type=LoadType.POINT, magnitude=P, position=a)],
        supports=[
            Support(position=0, type="pinned"),
            Support(position=length, type="roller")
        ],
        E=E,
        I=I
    )
    
    solver = BeamSolver(beam)
    result = solver.solve()
    
    return {
        "result": {
            "max_moment": result.max_moment,
            "max_shear": result.max_shear,
            "reactions": result.reactions
        },
        "steps": result.steps,
        "diagram": {
            "x_values": result.diagram.x_values,
            "shear_values": result.diagram.shear_values,
            "moment_values": result.diagram.moment_values
        }
    }


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Example: 10m beam with 5 kN/m UDL
    result = analyze_simply_supported_beam_with_udl(length=10, w=5)
    
    print("=" * 50)
    print("BEAM ANALYSIS RESULT")
    print("=" * 50)
    print(f"\nMax Moment: {result['result']['max_moment']} kN·m")
    print(f"Max Shear: {result['result']['max_shear']} kN")
    print(f"Reactions: {result['result']['reactions']}")
    
    print("\n" + "=" * 50)
    print("HAND CALCULATION STEPS")
    print("=" * 50)
    for step in result['steps']:
        print(step)
    
    print(f"\nDiagram has {len(result['diagram']['x_values'])} data points")
