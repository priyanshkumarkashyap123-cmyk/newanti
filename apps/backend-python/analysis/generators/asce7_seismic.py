"""
asce7_seismic.py - ASCE 7 Seismic Load Generator

Implements the Equivalent Lateral Force (ELF) Procedure per ASCE 7-22 Chapter 12.

Reference: ASCE/SEI 7-22 "Minimum Design Loads and Associated Criteria for Buildings"

Formulas Implemented:
- Site coefficients (Fa, Fv) - Tables 11.4-1, 11.4-2
- Design spectral accelerations (SDS, SD1) - Eq. 11.4-3, 11.4-4
- Seismic response coefficient (Cs) - Eq. 12.8-2, 12.8-3, 12.8-4
- Base shear (V) - Eq. 12.8-1
- Vertical distribution (Fx) - Eq. 12.8-11, 12.8-12
- Approximate period (Ta) - Eq. 12.8-7
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import numpy as np


# ============================================
# ENUMERATIONS
# ============================================

class SiteClass(Enum):
    """ASCE 7 Site Classification (Table 20.3-1)"""
    A = "A"  # Hard rock
    B = "B"  # Rock
    C = "C"  # Very dense soil/soft rock
    D = "D"  # Stiff soil (default)
    E = "E"  # Soft clay soil
    F = "F"  # Special study required


class RiskCategory(Enum):
    """ASCE 7 Risk Categories (Table 1.5-1)"""
    I = 1    # Low hazard to human life
    II = 2   # Standard (default)
    III = 3  # Substantial hazard
    IV = 4   # Essential facilities


class SeismicDesignCategory(Enum):
    """ASCE 7 Seismic Design Categories"""
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"


class StructuralSystem(Enum):
    """ASCE 7 Seismic Force-Resisting Systems (Table 12.2-1)"""
    # Special systems
    SPECIAL_MOMENT_FRAME_STEEL = "SMF_S"
    SPECIAL_MOMENT_FRAME_RC = "SMF_RC"
    SPECIAL_CONCENTRIC_BRACED = "SCBF"
    SPECIAL_SHEAR_WALL = "SSW"
    
    # Intermediate systems  
    INTERMEDIATE_MOMENT_FRAME = "IMF"
    INTERMEDIATE_SHEAR_WALL = "ISW"
    
    # Ordinary systems
    ORDINARY_MOMENT_FRAME_STEEL = "OMF_S"
    ORDINARY_MOMENT_FRAME_RC = "OMF_RC"
    ORDINARY_CONCENTRIC_BRACED = "OCBF"
    ORDINARY_SHEAR_WALL = "OSW"
    
    # Other
    DUAL_SYSTEM = "DUAL"
    CANTILEVERED_COLUMN = "CC"
    
    def get_R(self) -> float:
        """Response Modification Factor R (Table 12.2-1)"""
        R_values = {
            "SMF_S": 8.0,
            "SMF_RC": 8.0,
            "SCBF": 6.0,
            "SSW": 6.0,
            "IMF": 5.0,
            "ISW": 5.0,
            "OMF_S": 3.5,
            "OMF_RC": 3.0,
            "OCBF": 3.25,
            "OSW": 5.0,
            "DUAL": 7.0,
            "CC": 2.5,
        }
        return R_values.get(self.value, 5.0)
    
    def get_Cd(self) -> float:
        """Deflection Amplification Factor Cd (Table 12.2-1)"""
        Cd_values = {
            "SMF_S": 5.5,
            "SMF_RC": 5.5,
            "SCBF": 5.0,
            "SSW": 5.0,
            "IMF": 4.5,
            "ISW": 4.5,
            "OMF_S": 3.0,
            "OMF_RC": 2.5,
            "OCBF": 3.25,
            "OSW": 4.5,
            "DUAL": 5.5,
            "CC": 2.5,
        }
        return Cd_values.get(self.value, 4.5)
    
    def get_Omega0(self) -> float:
        """Overstrength Factor Ω₀ (Table 12.2-1)"""
        Omega_values = {
            "SMF_S": 3.0,
            "SMF_RC": 3.0,
            "SCBF": 2.0,
            "SSW": 2.5,
            "IMF": 3.0,
            "ISW": 2.5,
            "OMF_S": 3.0,
            "OMF_RC": 3.0,
            "OCBF": 2.0,
            "OSW": 2.5,
            "DUAL": 2.5,
            "CC": 2.0,
        }
        return Omega_values.get(self.value, 2.5)


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class ASCE7SeismicParams:
    """Input parameters for ASCE 7 seismic analysis"""
    # Location-based parameters (from USGS)
    Ss: float = 1.0       # Short-period spectral acceleration (g)
    S1: float = 0.4       # 1-second spectral acceleration (g)
    TL: float = 8.0       # Long-period transition period (seconds)
    
    # Site and structure
    site_class: SiteClass = SiteClass.D
    risk_category: RiskCategory = RiskCategory.II
    structural_system: StructuralSystem = StructuralSystem.SPECIAL_MOMENT_FRAME_STEEL
    
    # Building geometry
    height: float = 30.0   # Building height in meters
    num_stories: int = 10
    base_dimension_x: float = 20.0  # meters
    base_dimension_y: float = 15.0  # meters
    
    # Period options
    user_period: Optional[float] = None  # User-defined period (if known)
    use_Cu_limit: bool = True  # Apply upper limit Cu×Ta
    
    # Direction
    direction: str = "X"  # "X" or "Y"


@dataclass
class StoryMass:
    """Mass data for a single story"""
    level: int
    height: float         # Height from base (m)
    story_height: float   # Story height (m)
    dead_load: float      # Dead load (kN)
    live_load: float      # Live load (kN)
    seismic_weight: float = 0.0  # W = DL + factor×LL
    lateral_force: float = 0.0   # Fx
    shear: float = 0.0           # Story shear
    moment: float = 0.0          # Overturning moment
    node_ids: List[str] = field(default_factory=list)


@dataclass
class ASCE7SeismicResult:
    """Complete ASCE 7 seismic analysis result"""
    success: bool = True
    
    # Design parameters
    Fa: float = 1.0       # Short-period site coefficient
    Fv: float = 1.0       # Long-period site coefficient
    SDS: float = 0.0      # Design short-period acceleration
    SD1: float = 0.0      # Design 1-second acceleration
    
    # Period
    Ta: float = 0.0       # Approximate period
    T: float = 0.0        # Period used for design
    Cu: float = 1.0       # Upper limit coefficient
    
    # Seismic coefficients
    Cs: float = 0.0       # Seismic response coefficient
    Ie: float = 1.0       # Importance factor
    R: float = 8.0        # Response modification factor
    
    # Forces
    W: float = 0.0        # Total seismic weight
    V: float = 0.0        # Base shear
    
    # Distribution
    story_forces: List[StoryMass] = field(default_factory=list)
    nodal_loads: List[Dict] = field(default_factory=list)
    
    # Seismic design category
    SDC: str = "D"
    
    # Error handling
    error_message: Optional[str] = None


# ============================================
# ASCE 7 SEISMIC LOAD GENERATOR
# ============================================

class ASCE7SeismicGenerator:
    """
    ASCE 7-22 Equivalent Lateral Force Procedure
    
    Implements Chapter 12 seismic design requirements.
    """
    
    def __init__(self, params: ASCE7SeismicParams):
        self.params = params
        self.result = ASCE7SeismicResult()
        
    # ----------------------------------------
    # Site Coefficients (Tables 11.4-1, 11.4-2)
    # ----------------------------------------
    
    def get_Fa(self) -> float:
        """
        Short-period site coefficient Fa (Table 11.4-1)
        
        Interpolation for intermediate Ss values.
        """
        Ss = self.params.Ss
        site = self.params.site_class.value
        
        # Table 11.4-1: Site Coefficient Fa
        Fa_table = {
            # Site: [Ss<=0.25, Ss=0.5, Ss=0.75, Ss=1.0, Ss>=1.25]
            "A": [0.8, 0.8, 0.8, 0.8, 0.8],
            "B": [0.9, 0.9, 0.9, 0.9, 0.9],
            "C": [1.3, 1.3, 1.2, 1.2, 1.2],
            "D": [1.6, 1.4, 1.2, 1.1, 1.0],
            "E": [2.4, 1.7, 1.3, 1.0, 0.9],
            "F": [None, None, None, None, None],  # Site-specific
        }
        
        if site == "F":
            return 1.0  # Requires site-specific study
            
        Ss_values = [0.25, 0.5, 0.75, 1.0, 1.25]
        Fa_values = Fa_table[site]
        
        if Ss <= 0.25:
            return Fa_values[0]
        elif Ss >= 1.25:
            return Fa_values[4]
        else:
            return float(np.interp(Ss, Ss_values, Fa_values))
    
    def get_Fv(self) -> float:
        """
        Long-period site coefficient Fv (Table 11.4-2)
        """
        S1 = self.params.S1
        site = self.params.site_class.value
        
        # Table 11.4-2: Site Coefficient Fv
        Fv_table = {
            # Site: [S1<=0.1, S1=0.2, S1=0.3, S1=0.4, S1>=0.5]
            "A": [0.8, 0.8, 0.8, 0.8, 0.8],
            "B": [0.8, 0.8, 0.8, 0.8, 0.8],
            "C": [1.5, 1.5, 1.5, 1.5, 1.5],
            "D": [2.4, 2.2, 2.0, 1.9, 1.8],
            "E": [4.2, 3.3, 2.8, 2.4, 2.2],
            "F": [None, None, None, None, None],
        }
        
        if site == "F":
            return 1.5
            
        S1_values = [0.1, 0.2, 0.3, 0.4, 0.5]
        Fv_values = Fv_table[site]
        
        if S1 <= 0.1:
            return Fv_values[0]
        elif S1 >= 0.5:
            return Fv_values[4]
        else:
            return float(np.interp(S1, S1_values, Fv_values))
    
    # ----------------------------------------
    # Design Spectral Accelerations
    # ----------------------------------------
    
    def calculate_design_accelerations(self) -> Tuple[float, float]:
        """
        Calculate SDS and SD1 (Eq. 11.4-3, 11.4-4)
        
        SMS = Fa × Ss
        SM1 = Fv × S1
        SDS = (2/3) × SMS
        SD1 = (2/3) × SM1
        """
        Fa = self.get_Fa()
        Fv = self.get_Fv()
        
        SMS = Fa * self.params.Ss
        SM1 = Fv * self.params.S1
        
        SDS = (2/3) * SMS
        SD1 = (2/3) * SM1
        
        self.result.Fa = Fa
        self.result.Fv = Fv
        self.result.SDS = SDS
        self.result.SD1 = SD1
        
        return SDS, SD1
    
    # ----------------------------------------
    # Importance Factor (Table 1.5-2)
    # ----------------------------------------
    
    def get_importance_factor(self) -> float:
        """Seismic Importance Factor Ie"""
        Ie_values = {
            RiskCategory.I: 1.0,
            RiskCategory.II: 1.0,
            RiskCategory.III: 1.25,
            RiskCategory.IV: 1.5,
        }
        Ie = Ie_values.get(self.params.risk_category, 1.0)
        self.result.Ie = Ie
        return Ie
    
    # ----------------------------------------
    # Seismic Design Category (Tables 11.6-1, 11.6-2)
    # ----------------------------------------
    
    def determine_SDC(self) -> str:
        """
        Determine Seismic Design Category
        Based on SDS, SD1, and Risk Category
        """
        SDS = self.result.SDS
        SD1 = self.result.SD1
        risk = self.params.risk_category
        
        # Table 11.6-1 (based on SDS)
        if SDS < 0.167:
            SDC_SDS = "A"
        elif SDS < 0.33:
            SDC_SDS = "B"
        elif SDS < 0.50:
            SDC_SDS = "C"
        else:
            SDC_SDS = "D"
        
        # Table 11.6-2 (based on SD1)
        if SD1 < 0.067:
            SDC_SD1 = "A"
        elif SD1 < 0.133:
            SDC_SD1 = "B"
        elif SD1 < 0.20:
            SDC_SD1 = "C"
        else:
            SDC_SD1 = "D"
        
        # Take more severe
        SDC = max(SDC_SDS, SDC_SD1)
        
        # Risk Category IV with S1 >= 0.75 -> SDC E or F
        if risk == RiskCategory.IV and self.params.S1 >= 0.75:
            SDC = "F" if self.params.site_class == SiteClass.E else "E"
        
        self.result.SDC = SDC
        return SDC
    
    # ----------------------------------------
    # Fundamental Period (Section 12.8.2)
    # ----------------------------------------
    
    def calculate_period(self) -> float:
        """
        Calculate approximate fundamental period Ta (Eq. 12.8-7)
        
        Ta = Ct × hn^x
        
        Ct and x values from Table 12.8-2:
        - Steel moment frames: Ct=0.0724, x=0.8
        - RC moment frames: Ct=0.0466, x=0.9
        - Steel eccentrically braced: Ct=0.0731, x=0.75
        - All other: Ct=0.0488, x=0.75
        """
        hn = self.params.height  # meters (need to convert for imperial formula)
        hn_ft = hn * 3.281  # Convert to feet for ASCE 7 formula
        
        system = self.params.structural_system.value
        
        # Ct and x from Table 12.8-2 (using metric conversion)
        if system in ["SMF_S", "OMF_S"]:
            Ct, x = 0.0724, 0.8
        elif system in ["SMF_RC", "OMF_RC", "IMF"]:
            Ct, x = 0.0466, 0.9
        elif system in ["SCBF"]:
            Ct, x = 0.0731, 0.75
        else:
            Ct, x = 0.0488, 0.75
        
        Ta = Ct * (hn_ft ** x)
        self.result.Ta = Ta
        
        # Upper limit coefficient Cu (Table 12.8-1)
        SD1 = self.result.SD1
        if SD1 >= 0.4:
            Cu = 1.4
        elif SD1 >= 0.3:
            Cu = 1.4
        elif SD1 >= 0.2:
            Cu = 1.5
        elif SD1 >= 0.15:
            Cu = 1.6
        else:
            Cu = 1.7
        
        self.result.Cu = Cu
        
        # Determine period to use
        if self.params.user_period is not None:
            T = self.params.user_period
            if self.params.use_Cu_limit:
                T = min(T, Cu * Ta)
        else:
            T = Ta
        
        self.result.T = T
        return T
    
    # ----------------------------------------
    # Seismic Response Coefficient (Section 12.8.1.1)
    # ----------------------------------------
    
    def calculate_Cs(self) -> float:
        """
        Calculate seismic response coefficient Cs
        
        Eq. 12.8-2: Cs = SDS / (R/Ie)
        Eq. 12.8-3: Cs_max = SD1 / (T × (R/Ie))  for T <= TL
        Eq. 12.8-4: Cs_max = SD1 × TL / (T² × (R/Ie))  for T > TL
        Eq. 12.8-5: Cs_min = 0.044 × SDS × Ie >= 0.01
        Eq. 12.8-6: Cs_min = 0.5 × S1 / (R/Ie)  for S1 >= 0.6g
        """
        SDS = self.result.SDS
        SD1 = self.result.SD1
        Ie = self.result.Ie
        R = self.params.structural_system.get_R()
        T = self.result.T
        TL = self.params.TL
        S1 = self.params.S1
        
        self.result.R = R
        
        # Eq. 12.8-2: Base Cs
        Cs = SDS / (R / Ie)
        
        # Eq. 12.8-3 or 12.8-4: Maximum Cs
        if T <= TL:
            Cs_max = SD1 / (T * (R / Ie))
        else:
            Cs_max = SD1 * TL / (T * T * (R / Ie))
        
        Cs = min(Cs, Cs_max)
        
        # Eq. 12.8-5: Minimum Cs
        Cs_min = max(0.044 * SDS * Ie, 0.01)
        
        # Eq. 12.8-6: Additional minimum for high seismic
        if S1 >= 0.6:
            Cs_min = max(Cs_min, 0.5 * S1 / (R / Ie))
        
        Cs = max(Cs, Cs_min)
        
        self.result.Cs = Cs
        return Cs
    
    # ----------------------------------------
    # Story Weights and Base Shear
    # ----------------------------------------
    
    def compute_story_masses(
        self,
        nodes: Dict[str, Dict],
        dead_loads: Dict[str, float],
        live_loads: Dict[str, float],
        live_load_factor: float = 0.0
    ) -> List[StoryMass]:
        """
        Group loads by story level and calculate seismic weights.
        
        Per ASCE 7 Section 12.7.2:
        W includes total dead load + applicable portion of other loads
        
        Args:
            nodes: Node dictionary {id: {x, y, z, ...}}
            dead_loads: Dead loads at nodes (kN)
            live_loads: Live loads at nodes (kN) 
            live_load_factor: Factor for live load (0.25 for storage, 0 typically)
        """
        # Group nodes by Y-level (height)
        height_tolerance = 0.1  # meters
        levels: Dict[float, List[str]] = {}
        
        for node_id, node in nodes.items():
            y = node.get('y', node.get('z', 0))  # Handle both conventions
            # Find matching level
            matched = False
            for level_y in levels:
                if abs(y - level_y) < height_tolerance:
                    levels[level_y].append(node_id)
                    matched = True
                    break
            if not matched:
                levels[y] = [node_id]
        
        # Sort by height
        sorted_heights = sorted(levels.keys())
        
        story_masses = []
        prev_height = 0.0
        
        for i, y in enumerate(sorted_heights):
            node_ids = levels[y]
            
            # Sum loads
            dl = sum(dead_loads.get(nid, 0) for nid in node_ids)
            ll = sum(live_loads.get(nid, 0) for nid in node_ids)
            
            # Seismic weight
            W = dl + live_load_factor * ll
            
            story = StoryMass(
                level=i + 1,
                height=y,
                story_height=y - prev_height,
                dead_load=dl,
                live_load=ll,
                seismic_weight=W,
                node_ids=list(node_ids)
            )
            story_masses.append(story)
            prev_height = y
        
        self.result.story_forces = story_masses
        return story_masses
    
    def calculate_base_shear(self) -> float:
        """
        Calculate design base shear V (Eq. 12.8-1)
        
        V = Cs × W
        """
        W = sum(story.seismic_weight for story in self.result.story_forces)
        Cs = self.result.Cs
        
        V = Cs * W
        
        self.result.W = W
        self.result.V = V
        return V
    
    # ----------------------------------------
    # Vertical Distribution (Section 12.8.3)
    # ----------------------------------------
    
    def distribute_lateral_forces(self) -> None:
        """
        Distribute base shear over height (Eq. 12.8-11, 12.8-12)
        
        Fx = Cvx × V
        Cvx = (wx × hx^k) / Σ(wi × hi^k)
        
        k = 1 for T <= 0.5s
        k = 2 for T >= 2.5s
        k = interpolated for 0.5 < T < 2.5
        """
        T = self.result.T
        V = self.result.V
        stories = self.result.story_forces
        
        if not stories:
            return
        
        # Determine k
        if T <= 0.5:
            k = 1.0
        elif T >= 2.5:
            k = 2.0
        else:
            k = 1.0 + (T - 0.5) / 2.0  # Linear interpolation
        
        # Calculate denominator
        denominator = sum(s.seismic_weight * (s.height ** k) for s in stories)
        
        if denominator == 0:
            return
        
        # Calculate forces
        cumulative_shear = 0.0
        
        # Process from top to bottom for shear calculation
        for i in range(len(stories) - 1, -1, -1):
            story = stories[i]
            
            # Cvx
            Cvx = (story.seismic_weight * (story.height ** k)) / denominator
            
            # Fx
            Fx = Cvx * V
            story.lateral_force = Fx
            
            # Story shear (sum of forces above)
            cumulative_shear += Fx
            story.shear = cumulative_shear
        
        # Calculate overturning moments
        for story in stories:
            story.moment = sum(
                s.lateral_force * (s.height - story.height)
                for s in stories if s.height >= story.height
            )
    
    # ----------------------------------------
    # Generate Nodal Loads
    # ----------------------------------------
    
    def generate_nodal_loads(self) -> List[Dict]:
        """
        Generate nodal load list for solver.
        
        Returns list of {node_id, fx, fy, fz} dicts.
        """
        nodal_loads = []
        direction = self.params.direction.upper()
        
        for story in self.result.story_forces:
            if not story.node_ids:
                continue
            
            # Distribute story force equally among nodes at that level
            force_per_node = story.lateral_force / len(story.node_ids)
            
            for node_id in story.node_ids:
                load = {
                    "node_id": node_id,
                    "fx": force_per_node if direction == "X" else 0,
                    "fy": 0,  # Vertical
                    "fz": force_per_node if direction == "Z" or direction == "Y" else 0,
                    "source": "ASCE7_ELF",
                    "load_case": f"EQ{direction}"
                }
                nodal_loads.append(load)
        
        self.result.nodal_loads = nodal_loads
        return nodal_loads
    
    # ----------------------------------------
    # Main Analysis
    # ----------------------------------------
    
    def analyze(
        self,
        nodes: Dict[str, Dict],
        dead_loads: Dict[str, float],
        live_loads: Optional[Dict[str, float]] = None
    ) -> ASCE7SeismicResult:
        """
        Perform complete ASCE 7 seismic analysis.
        
        Args:
            nodes: Node dictionary with coordinates
            dead_loads: Dead loads at nodes (kN)
            live_loads: Live loads at nodes (kN), optional
        
        Returns:
            ASCE7SeismicResult with all calculated values
        """
        try:
            # Step 1: Calculate design accelerations
            self.calculate_design_accelerations()
            
            # Step 2: Get importance factor
            self.get_importance_factor()
            
            # Step 3: Determine SDC
            self.determine_SDC()
            
            # Step 4: Calculate period
            self.calculate_period()
            
            # Step 5: Calculate Cs
            self.calculate_Cs()
            
            # Step 6: Compute story masses
            live_loads = live_loads or {}
            self.compute_story_masses(nodes, dead_loads, live_loads)
            
            # Step 7: Calculate base shear
            self.calculate_base_shear()
            
            # Step 8: Distribute forces
            self.distribute_lateral_forces()
            
            # Step 9: Generate nodal loads
            self.generate_nodal_loads()
            
            self.result.success = True
            
        except Exception as e:
            self.result.success = False
            self.result.error_message = str(e)
        
        return self.result
    
    def get_summary(self) -> Dict:
        """Get analysis summary for display"""
        return {
            "code": "ASCE 7-22",
            "method": "Equivalent Lateral Force",
            "Ss": self.params.Ss,
            "S1": self.params.S1,
            "Site_Class": self.params.site_class.value,
            "Fa": round(self.result.Fa, 3),
            "Fv": round(self.result.Fv, 3),
            "SDS": round(self.result.SDS, 3),
            "SD1": round(self.result.SD1, 3),
            "SDC": self.result.SDC,
            "T": round(self.result.T, 3),
            "R": self.result.R,
            "Ie": self.result.Ie,
            "Cs": round(self.result.Cs, 4),
            "W": round(self.result.W, 2),
            "V": round(self.result.V, 2),
            "V_percent_W": round(self.result.Cs * 100, 2),
        }


# ============================================
# HELPER FUNCTIONS
# ============================================

def create_asce7_seismic_generator(
    Ss: float,
    S1: float,
    site_class: str = "D",
    risk_category: int = 2,
    structural_system: str = "SMF_S",
    height: float = 30.0,
    direction: str = "X"
) -> ASCE7SeismicGenerator:
    """
    Factory function to create ASCE 7 seismic generator with simple inputs.
    """
    params = ASCE7SeismicParams(
        Ss=Ss,
        S1=S1,
        site_class=SiteClass(site_class),
        risk_category=RiskCategory(risk_category),
        structural_system=StructuralSystem(structural_system),
        height=height,
        direction=direction
    )
    return ASCE7SeismicGenerator(params)
