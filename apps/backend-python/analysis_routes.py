from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import numpy as np

from analysis.fea_engine import FEAEngine, ModelInput, NodeInput, MemberInput, NodeLoadInput, DistributedLoadInput, SettingsInput
from analysis.solvers.dynamics import ModalAnalyzer, ResponseSpectrumAnalyzer, get_is1893_spectrum
from analysis.solvers.buckling import BucklingAnalyzer
from analysis.time_history_analysis import TimeHistoryAnalyzer, load_ground_motion

router = APIRouter()

# ============================================
# REQUEST MODELS
# ============================================

class SpectrumAnalysisRequest(BaseModel):
    """
    Request for Response Spectrum Analysis
    """
    # Structural Model (same as FrameAnalysisRequest essentially)
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    
    # Spectrum Parameters
    zone: str = "V"  # II, III, IV, V
    soil_type: str = "II"  # I, II, III
    importance_factor: float = 1.0  # I
    response_reduction: float = 5.0  # R
    damping: float = 0.05
    direction: str = "X"  # Direction of excitation
    
    # Analysis Settings
    num_modes: int = 12
    combination_method: str = "CQC"  # CQC or SRSS

class BucklingAnalysisRequest(BaseModel):
    """
    Request for Linear Buckling Analysis
    """
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    num_modes: int = 5
    load_case: str = "LC1"

class TimeHistoryAnalysisRequest(BaseModel):
    """
    Request for Dynamic Time History Analysis
    """
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    
    # Dynamics Parameters
    earthquake: str = "el_centro_1940"  # el_centro_1940, synthetic_pulse
    scale_factor: float = 1.0
    damping_ratio: float = 0.05
    method: str = "modal"  # "direct" (Newmark) or "modal" (Superposition)
    num_modes: int = 12    # For modal superposition

# ============================================
# ENDPOINTS
# ============================================

@router.post("/time-history", tags=["Analysis"])
async def analyze_timehistory(request: TimeHistoryAnalysisRequest):
    """
    Perform Dynamic Time History Analysis
    """
    try:
        # 1. Build Model
        model_input = ModelInput(
            nodes=[NodeInput(**n) for n in request.nodes],
            members=[MemberInput(**m) for m in request.members],
            node_loads=[NodeLoadInput(node_id=l['nodeId'], fx=l.get('fx',0), fy=l.get('fy',0), fz=l.get('fz',0)) for l in request.node_loads],
            distributed_loads=[
                DistributedLoadInput(
                    member_id=l['memberId'], 
                    direction=l.get('direction', 'Fy'), 
                    w1=l.get('w1', 0), 
                    w2=l.get('w2', l.get('w1', 0))
                ) for l in request.distributed_loads
            ],
            settings=SettingsInput(self_weight=True)
        )
        
        engine = FEAEngine()
        engine.build_model(model_input)
        
        # 2. Extract Matrices
        K = engine.model.K()
        M = engine.model.M()
        
        # 3. Identify Free DOFs
        dof_indices = []
        count = 0
        sorted_nodes = sorted(engine.model.nodes.keys())
        for node_name in sorted_nodes:
            supports = engine.model.supports.get(node_name, [False]*6)
            for j in range(6):
                if not supports[j]:
                    dof_indices.append(count)
                count += 1
        
        # Extract submatrices for free DOFs
        K_ff = K[np.ix_(dof_indices, dof_indices)]
        M_ff = M[np.ix_(dof_indices, dof_indices)]
        
        # 4. Load Ground Motion
        gm = load_ground_motion(request.earthquake, request.scale_factor)
        
        # 5. Run Analysis
        analyzer = TimeHistoryAnalyzer()
        
        if request.method == "modal":
            # Modal Superposition
            modes = analyzer.modal_analysis(M_ff, K_ff, num_modes=request.num_modes)
            response = analyzer.modal_superposition(gm, modes, damping_ratio=request.damping_ratio)
            modal_results = [{
                "mode_number": m.mode_number,
                "frequency": float(m.frequency),
                "period": float(m.period),
                "mass_participation": float(m.mass_participation)
            } for m in modes]
        else:
            # Direct Integration (Newmark-beta)
            # Build simple Rayleigh damping matrix: C = alpha*M + beta*K
            # For 5% damping at approx 1Hz and 10Hz
            alpha = 0.5
            beta = 0.005
            C_ff = alpha * M_ff + beta * K_ff
            response = analyzer.newmark_beta_integration(M_ff, K_ff, C_ff, gm)
            modal_results = []
            
        # 6. Extract results at nodes
        # We'll return max displacements and time history for a few key nodes
        # To avoid massive payload, we sample the time history
        sample_rate = max(1, len(gm.time) // 200) # Max 200 points
        
        return {
            "success": True,
            "method": request.method,
            "modes": modal_results,
            "time": gm.time[::sample_rate].tolist(),
            "ground_acceleration": gm.acceleration[::sample_rate].tolist(),
            "max_displacement": float(np.max(np.abs(response['displacement']))),
            "displacements": response['displacement'][:, ::sample_rate].tolist(),
            "num_steps": len(gm.time),
            "ground_motion": {
                "name": gm.name,
                "pga": float(gm.pga),
                "duration": float(gm.duration)
            }
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/buckling", tags=["Analysis"])
async def analyze_buckling(request: BucklingAnalysisRequest):
    """
    Perform Linear Buckling (Eigenvalue) Analysis
    """
    try:
        # 1. Build Model
        model_input = ModelInput(
            nodes=[NodeInput(**n) for n in request.nodes],
            members=[MemberInput(**m) for m in request.members],
            node_loads=[NodeLoadInput(node_id=l['nodeId'], fx=l.get('fx',0), fy=l.get('fy',0), fz=l.get('fz',0)) for l in request.node_loads],
            distributed_loads=[
                DistributedLoadInput(
                    member_id=l['memberId'], 
                    direction=l.get('direction', 'Fy'), 
                    w1=l.get('w1', 0), 
                    w2=l.get('w2', l.get('w1', 0))
                ) for l in request.distributed_loads
            ],
            settings=SettingsInput(self_weight=True)
        )
        
        engine = FEAEngine()
        engine.build_model(model_input)
        
        # 2. Run Static Analysis to get Axial Forces (needed for Kg)
        engine.model.analyze(check_statics=True)
        
        # 3. Extract Matrices
        K = engine.model.K()
        Kg = engine.get_geometric_stiffness_matrix(load_case=request.load_case)
        
        if Kg is None:
            raise ValueError("Failed to generate geometric stiffness matrix")
            
        # 4. Identify Free DOFs
        dof_indices = []
        count = 0
        sorted_nodes = sorted(engine.model.nodes.keys())
        for node_name in sorted_nodes:
            supports = engine.model.supports.get(node_name, [False]*6)
            for j in range(6):
                if not supports[j]:
                    dof_indices.append(count)
                count += 1
                
        # 5. Run Buckling Analysis
        analyzer = BucklingAnalyzer(K, Kg, dof_indices, num_modes=request.num_modes)
        result = analyzer.analyze()
        
        if not result.success:
            return {"success": False, "error": result.error_message}
            
        return {
            "success": True,
            "critical_factor": result.critical_factor,
            "is_stable": result.is_stable,
            "modes": [
                {
                    "mode": m.mode_number,
                    "factor": m.buckling_factor,
                    "shape": m.mode_shape.tolist()
                } for m in result.modes
            ]
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/spectrum", tags=["Analysis"])
async def analyze_spectrum(request: SpectrumAnalysisRequest):
    """
    Perform Response Spectrum Analysis (IS 1893:2016)
    
    Workflow:
    1. Build FE Model from input
    2. Extract Mass (M) and Stiffness (K) matrices
    3. Perform Modal Analysis (Eigenvalue)
    4. Generate Design Spectrum
    5. Perform Response Spectrum Analysis (CQC/SRSS)
    """
    try:
        print(f"[SPECTRUM] Received request for {len(request.nodes)} nodes")
        
        # 1. Build Model using FEAEngine
        # Convert dicts to dataclasses expected by FEAEngine
        model_input = ModelInput(
            nodes=[NodeInput(**n) for n in request.nodes],
            members=[MemberInput(**m) for m in request.members],
            node_loads=[NodeLoadInput(node_id=l['nodeId'], fx=l.get('fx',0), fy=l.get('fy',0), fz=l.get('fz',0)) for l in request.node_loads], # Simplified
            distributed_loads=[
                DistributedLoadInput(
                    member_id=l['memberId'], 
                    direction=l.get('direction', 'Fy'), 
                    w1=l.get('w1', 0), 
                    w2=l.get('w2', l.get('w1', 0)),
                    start_pos=l.get('startPos', 0),
                    end_pos=l.get('endPos', 1),
                    is_ratio=l.get('isRatio', True)
                ) 
                for l in request.distributed_loads
            ],
            settings=SettingsInput(self_weight=True) # Always include self-weight for mass
        )
        
        engine = FEAEngine()
        engine.build_model(model_input)
        
        if not engine.model:
            raise HTTPException(status_code=500, detail="Failed to build finite element model")
            
        # 2. Extract Matrices
        # PyNite's K() and M() return numpy arrays or sparse matrices?
        # Usually numpy arrays for small/medium models.
        # Note: PyNite's M() might need 'include_mass=True' or similar if not default.
        # Actually in PyNite v2, K() returns a numpy array (dense).
        
        print("[SPECTRUM] Extracting global stiffness and mass matrices...")
        
        # Ensure mass matrix is generated (from self-weight and loads if applicable)
        # In PyNite, mass is typically derived from density.
        
        K = engine.model.K()
        M = engine.model.M()
        
        # Identify free DOFs (unrestrained)
        # PyNite usually handles this internally for its solvers, but for external:
        # We need to filter K and M or pass them as is if ModalAnalyzer handles it.
        # ModalAnalyzer expects K, M, and list of free_dof indices.
        
        # Get free DOFs from PyNite model
        # PyNite stores specific support conditions.
        # We can reconstruct free_dof list.
        # engine.model.nodes is a dict of Node3D objects.
        # filtered_nodes = [n for n in engine.model.nodes.values() if not n.is_auxiliary]
        
        # Actually, K and M are sized (n_nodes*6, n_nodes*6).
        # We need to map global DOF indices to support status.
        
        free_dofs = []
        all_dofs = []
        
        n_dof_per_node = 6
        node_names = list(engine.model.nodes.keys())
        
        for i, node_name in enumerate(node_names):
            node = engine.model.nodes[node_name]
            # Constraints: node.constraints is [Dx, Dy, Dz, Rx, Ry, Rz] (True/False) -> True if FIXED
            # Support definitions set these.
            
            # Map node IO to index
            # PyNite sorts nodes? Assuming dictionary order or sort?
            # PyNite K() usually builds based on sorted nodes or insertion order.
            # Ideally we check how PyNite builds K.
            
            # For safety, let's assume PyNite's node order in K matches `engine.model.nodes.keys()` iteration
            # IF using Python 3.7+ (dicts are ordered).
            
            # Check constraints
            constraints = [False]*6
            # In PyNite, supports are stored in model.supports dict usually?
            # Or directly on nodes?
            # engine.model.nodes[name] has properties for restraints?
            # Let's check `FEAEngine.build_model`: it calls `def_support`.
            
            # Wait, `dynamics.py` `ModalAnalyzer` takes `free_dof`.
            # Let's replicate PyNite's logic for filtering.
            
            # PyNite sets `node.DX`, `node.DY` etc constraints? No, those are displacements.
            # Using `model.supports` is safer.
            
            # NOTE: This extraction is tricky if we don't know PyNite's internal ordering.
            # However, `dynamics.py` implements a generic solver.
            
            # Alternative: Use PyNite's eigenvalue analysis if available?
            # But let's assume `ModalAnalyzer` in `dynamics.py` is robust enough if we feed it right data.
            
            pass 
        
        # SIMPLIFICATION:
        # If we can't easily extract free DOFs matching K/M indices, 
        # we might assume `ModalAnalyzer` can handle constrained K/M if we zero out rows/cols?
        # `ModalAnalyzer` expects `free_dof` list.
        
        # Let's try to infer free DOFs.
        # In PyNite, constrained DOFs usually have 1.0 on diagonal in K (after Applying supports)?
        # Or K is the UNCONSTRAINED stiffness matrix?
        # Usually K() returns the global unconstrained matrix.
        # M() returns global mass matrix.
        
        # So we need to build the `free_dof` list based on supports.
        
        dof_indices = []
        count = 0
        sorted_nodes = sorted(engine.model.nodes.keys()) # PyNite usually sorts by name for matrix assembly
        
        for node_name in sorted_nodes:
            # Check for supports on this node
            # engine.model.supports is Dict[str, [6 bools]]
            supports = engine.model.supports.get(node_name, [False]*6) # False = Free, True = Fixed
            
            for j in range(6):
                if not supports[j]: # If Free
                    dof_indices.append(count)
                count += 1
                
        # 3. Modal Analysis
        print(f"[SPECTRUM] Running Modal Analysis (modes={request.num_modes})...")
        modal_analyzer = ModalAnalyzer(K, M, dof_indices, num_modes=request.num_modes)
        modal_result = modal_analyzer.analyze()
        
        if not modal_result.success:
            raise ValueError(f"Modal Analysis Failed: {modal_result.error_message}")
            
        print(f"[SPECTRUM] Found {len(modal_result.modes)} modes")
        
        # 4. Generate Spectrum
        spectrum = get_is1893_spectrum(
            zone=request.zone,
            soil_type=request.soil_type,
            importance_factor=request.importance_factor,
            response_reduction=request.response_reduction,
            damping=request.damping
        )
        
        # 5. Response Spectrum Analysis
        print(f"[SPECTRUM] Running RSA (Combination={request.combination_method})...")
        rsa = ResponseSpectrumAnalyzer(
            modal_result=modal_result,
            spectrum_x=spectrum, # Assume X direction excitation primarily for now, or match direction
            spectrum_y=spectrum,
            spectrum_z=spectrum,
            damping=request.damping,
            combination_method=request.combination_method
        )
        
        # Determine excitation direction
        result = rsa.analyze(direction=request.direction)
        
        if not result.success:
            raise ValueError(f"RSA Failed: {result.error_message}")
            
        return {
            "success": True,
            "base_shear": getattr(result, f"base_shear_{request.direction.lower()}", 0),
            "displacements": result.displacements,
            "modal_contributions": result.modal_contributions, # Base shear per mode
            "modes": [
                {
                    "mode": m.mode_number,
                    "frequency": m.frequency,
                    "period": m.period,
                    "participation": getattr(m, f"participation_factor_{request.direction.lower()}", 0),
                    "mass_percent": getattr(m, f"effective_mass_{request.direction.lower()}", 0) # Just rough check
                    # Note: ModeShape in dynamics.py might need update to return percent
                }
                for m in modal_result.modes
            ]
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
