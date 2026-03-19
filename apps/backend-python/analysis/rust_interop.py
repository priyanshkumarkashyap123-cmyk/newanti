"""
Rust Backend Interop Client

High-performance bridge between Python API and Rust solver engine.
Delegates compute-intensive structural analysis to the Rust backend
for 10-100x speedup on large models (>1000 nodes).

Architecture:
    Python (FastAPI) -> HTTP -> Rust (Axum) -> Result
    
    - Small models (<500 nodes): solved locally in Python
    - Large models (>500 nodes): delegated to Rust backend
    - Fallback: if Rust backend is unavailable, solve locally
"""

import asyncio
import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx
import numpy as np

# ============================================
# Configuration
# ============================================

RUST_API_URL = os.getenv("RUST_API_URL", "http://localhost:3002")
RUST_API_TIMEOUT = int(os.getenv("RUST_API_TIMEOUT", "120"))
NODE_THRESHOLD_FOR_RUST = int(os.getenv("RUST_NODE_THRESHOLD", "500"))
ENABLE_RUST_BACKEND = os.getenv("ENABLE_RUST_BACKEND", "true").lower() == "true"


class SolverBackend(str, Enum):
    """Which backend to use for solving"""
    PYTHON = "python"
    RUST = "rust"
    AUTO = "auto"  # Auto-select based on model size


@dataclass
class RustSolverResult:
    """Result from Rust backend solver"""
    success: bool
    backend_used: str
    solve_time_ms: float
    displacements: Optional[Dict[str, List[float]]] = None
    reactions: Optional[Dict[str, List[float]]] = None
    member_forces: Optional[List[Dict]] = None
    modes: Optional[List[Dict]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class RustInteropClient:
    """
    HTTP client for Rust structural analysis backend.
    
    Provides automatic failover: if Rust backend is unavailable,
    falls back to Python solver transparently.
    
    Usage:
        client = RustInteropClient()
        result = await client.analyze(model_data, analysis_type="static")
    """
    
    def __init__(
        self,
        base_url: str = RUST_API_URL,
        timeout: int = RUST_API_TIMEOUT,
        enable_rust: bool = ENABLE_RUST_BACKEND,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.enable_rust = enable_rust
        self._client: Optional[httpx.AsyncClient] = None
        self._rust_available: Optional[bool] = None
        self._last_health_check = 0.0
        self._health_check_interval = 30.0  # seconds
        
    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy-init HTTP client with connection pooling"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(
                    connect=5.0,
                    read=self.timeout,
                    write=30.0,
                    pool=10.0,
                ),
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=10,
                ),
                headers={"Content-Type": "application/json"},
            )
        return self._client
    
    async def check_health(self) -> bool:
        """Check if Rust backend is alive and responding"""
        now = time.time()
        if (
            self._rust_available is not None 
            and now - self._last_health_check < self._health_check_interval
        ):
            return self._rust_available
        
        try:
            client = await self._get_client()
            resp = await client.get("/api/health", timeout=3.0)
            self._rust_available = resp.status_code == 200
        except Exception:
            self._rust_available = False
        
        self._last_health_check = now
        return self._rust_available
    
    def should_use_rust(self, model: Dict, backend: SolverBackend = SolverBackend.AUTO) -> bool:
        """Decide whether to use Rust backend based on model size"""
        if backend == SolverBackend.PYTHON:
            return False
        if backend == SolverBackend.RUST:
            return True
        
        # AUTO mode: use Rust for large models
        n_nodes = len(model.get("nodes", []))
        n_members = len(model.get("members", []))
        n_dof = n_nodes * 6  # 6 DOF per node
        
        # Use Rust if model has >500 nodes or >1000 DOFs
        return n_nodes >= NODE_THRESHOLD_FOR_RUST or n_dof > 3000
    
    async def analyze(
        self,
        model: Dict,
        analysis_type: str = "static",
        backend: SolverBackend = SolverBackend.AUTO,
        options: Optional[Dict] = None,
    ) -> RustSolverResult:
        """
        Run structural analysis, auto-selecting backend.
        
        Args:
            model: Full structural model dict with nodes, members, supports, loads
            analysis_type: "static", "modal", "pdelta", "buckling", "spectrum"
            backend: Force specific backend or auto-select
            options: Additional solver options
            
        Returns:
            RustSolverResult with displacements, reactions, member forces
        """
        use_rust = self.enable_rust and self.should_use_rust(model, backend)
        
        if use_rust:
            is_available = await self.check_health()
            if is_available:
                try:
                    return await self._solve_via_rust(model, analysis_type, options)
                except Exception as e:
                    print(f"[RUST_INTEROP] Rust backend failed, falling back to Python: {e}")
                    # Fall through to Python solver
        
        # Python fallback
        return await self._solve_via_python(model, analysis_type, options)
    
    async def _solve_via_rust(
        self,
        model: Dict,
        analysis_type: str,
        options: Optional[Dict] = None,
    ) -> RustSolverResult:
        """Send analysis request to Rust backend"""
        client = await self._get_client()
        start = time.time()
        
        # Map analysis type to Rust endpoint
        endpoints = {
            "static": "/api/analyze",
            "modal": "/api/analyze/modal",
            "pdelta": "/api/analyze/pdelta",
            "buckling": "/api/analyze/buckling",
            "spectrum": "/api/analyze/spectrum",
        }
        
        endpoint = endpoints.get(analysis_type, "/api/analyze")
        
        payload = {
            "nodes": model.get("nodes", []),
            "members": model.get("members", []),
            "supports": model.get("supports", []),
            "loads": model.get("loads", []),
            "material": model.get("material", {
                "e": 200e9,
                "g": 77e9,
                "density": 7850.0,
                "poisson": 0.3,
            }),
            "sections": model.get("sections", {}),
        }
        
        if options:
            payload["options"] = options
        
        resp = await client.post(endpoint, json=payload)
        elapsed = (time.time() - start) * 1000
        
        if resp.status_code != 200:
            return RustSolverResult(
                success=False,
                backend_used="rust",
                solve_time_ms=elapsed,
                error=f"Rust backend returned {resp.status_code}: {resp.text[:500]}",
            )
        
        data = resp.json()
        
        return RustSolverResult(
            success=True,
            backend_used="rust",
            solve_time_ms=elapsed,
            displacements=data.get("displacements"),
            reactions=data.get("reactions"),
            member_forces=data.get("member_forces"),
            modes=data.get("modes"),
            metadata={
                "rust_solve_time_ms": data.get("solve_time_ms"),
                "n_dof": data.get("n_dof"),
                "condition_number": data.get("condition_number"),
            },
        )
    
    async def _solve_via_python(
        self,
        model: Dict,
        analysis_type: str,
        options: Optional[Dict] = None,
    ) -> RustSolverResult:
        """Fallback: solve using Python sparse solver"""
        start = time.time()
        
        try:
            # Use the high-level Python analysis helper from sparse_solver
            from analysis.sparse_solver import analyze_large_frame

            # Map model to expected arguments: nodes, members, loads
            nodes = model.get("nodes", [])
            members = model.get("members", [])
            loads = model.get("loads", [])
            fixed_dofs = model.get("fixed_dofs") or model.get("fixedDofs") or []

            result = await asyncio.to_thread(
                analyze_large_frame, nodes, members, loads, fixed_dofs, (options or {}).get('method', 'auto')
            )

            elapsed = (time.time() - start) * 1000

            return RustSolverResult(
                success=result.get('success', False),
                backend_used="python",
                solve_time_ms=elapsed,
                displacements=result.get("displacements"),
                reactions=result.get("reactions"),
                member_forces=result.get("member_forces"),
                modes=result.get("modes"),
                error=result.get('error')
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            return RustSolverResult(
                success=False,
                backend_used="python",
                solve_time_ms=elapsed,
                error=str(e),
            )
    
    # ============================================
    # Specialized Analysis Methods
    # ============================================
    
    async def run_pdelta(
        self,
        model: Dict,
        max_iterations: int = 10,
        tolerance: float = 1e-4,
    ) -> RustSolverResult:
        """P-Delta analysis with geometric nonlinearity"""
        return await self.analyze(
            model,
            analysis_type="pdelta",
            options={
                "max_iterations": max_iterations,
                "tolerance": tolerance,
            },
        )
    
    async def run_modal(
        self,
        model: Dict,
        n_modes: int = 12,
    ) -> RustSolverResult:
        """Modal (eigenvalue) analysis"""
        return await self.analyze(
            model,
            analysis_type="modal",
            options={"n_modes": n_modes},
        )
    
    async def run_response_spectrum(
        self,
        model: Dict,
        spectrum_data: List[Dict],
        zone_factor: float = 0.16,
        importance_factor: float = 1.0,
        response_reduction: float = 5.0,
        soil_type: str = "medium",
        combination_method: str = "CQC",
    ) -> RustSolverResult:
        """Response spectrum analysis per IS 1893 / ASCE 7"""
        return await self.analyze(
            model,
            analysis_type="spectrum",
            options={
                "spectrum": spectrum_data,
                "zone_factor": zone_factor,
                "importance_factor": importance_factor,
                "response_reduction": response_reduction,
                "soil_type": soil_type,
                "combination_method": combination_method,
            },
        )
    
    async def get_rust_sections(self, standard: str = "IS") -> Optional[List[Dict]]:
        """Fetch steel section database from Rust backend"""
        try:
            client = await self._get_client()
            resp = await client.get(f"/api/sections/{standard.lower()}")
            if resp.status_code == 200:
                return resp.json().get("sections", [])
        except Exception:
            pass
        return None
    
    async def submit_batch_job(
        self,
        models: List[Dict],
        analysis_type: str = "static",
    ) -> Optional[str]:
        """Submit batch analysis job to Rust job queue"""
        try:
            client = await self._get_client()
            resp = await client.post("/api/jobs", json={
                "job_type": f"batch_{analysis_type}",
                "priority": "normal",
                "input": {"models": models, "analysis_type": analysis_type},
            })
            if resp.status_code == 200:
                return resp.json().get("job_id")
        except Exception:
            pass
        return None
    
    async def get_job_status(self, job_id: str) -> Optional[Dict]:
        """Check job status from Rust backend"""
        try:
            client = await self._get_client()
            resp = await client.get(f"/api/jobs/{job_id}")
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    # ============================================
    # Design Code Delegation (math in Rust)
    # ============================================

    async def design_rc_beam_lsd(
        self,
        b: float,
        d: float,
        d_prime: float,
        fck: float,
        fy: float,
        mu_knm: float,
        vu_kn: float,
    ) -> Optional[Dict]:
        """
        Delegate IS 456 LSD beam design to Rust backend.

        Rust implements: limiting moment, singly/doubly reinforced bending,
        shear design, rebar selection, stirrup spacing — all per IS 456:2000.

        Falls back to Python LSD solver if Rust is unavailable.
        """
        # Try Rust first
        if self.enable_rust and await self.check_health():
            try:
                client = await self._get_client()
                payload = {
                    "b": b, "d": d, "d_prime": d_prime,
                    "fck": fck, "fy": fy,
                    "mu_knm": mu_knm, "vu_kn": vu_kn,
                }
                resp = await client.post("/api/design/rc-beam-lsd", json=payload)
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                print(f"[RUST_INTEROP] RC beam LSD via Rust failed: {e}")

        # Python fallback
        try:
            from analysis.solvers.lsd_integration import design_rc_beam
            result = design_rc_beam(
                b_mm=b, d_mm=d, d_prime_mm=d_prime,
                fck_mpa=fck, fy_mpa=fy,
                Mu_knm=mu_knm, Vu_kn=vu_kn,
            )
            return result
        except Exception as e:
            return {"error": str(e), "backend": "python_fallback"}

    async def calculate_section_properties(
        self,
        points: List[Dict],
        name: str = "Custom Section",
        material_density: float = 7850.0,
    ) -> Optional[Dict]:
        """
        Delegate custom section property calculation to Rust backend.

        Rust implements: shoelace area, Green's theorem centroid,
        polygon vertex integration for Ixx/Iyy/Ixy, elastic & plastic moduli,
        principal axes, radii of gyration — all for arbitrary polygons.

        Falls back to Python section_designer if Rust is unavailable.
        """
        if self.enable_rust and await self.check_health():
            try:
                client = await self._get_client()
                payload = {
                    "points": points,
                    "name": name,
                    "material_density": material_density,
                }
                resp = await client.post("/api/design/section-properties", json=payload)
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                print(f"[RUST_INTEROP] Section properties via Rust failed: {e}")

        # Python fallback
        try:
            from analysis.section_designer import CustomSection, Point
            pts = [Point(p["x"], p["y"]) for p in points]
            section = CustomSection(pts, name)
            return section.get_all_properties(material_density)
        except Exception as e:
            return {"error": str(e), "backend": "python_fallback"}

    async def calculate_fixed_end_actions(
        self,
        load_type: str,
        length: float,
        **load_params,
    ) -> Optional[Dict]:
        """
        Delegate fixed-end action calculation to Rust backend.

        Supports: uniform, trapezoidal, point_load, moment load types.
        Falls back to Python load_engine if Rust is unavailable.
        """
        if self.enable_rust and await self.check_health():
            try:
                client = await self._get_client()
                payload = {"load_type": load_type, "length": length, **load_params}
                resp = await client.post("/api/loads/fixed-end-actions", json=payload)
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                print(f"[RUST_INTEROP] FEA calc via Rust failed: {e}")

        # Python fallback
        try:
            from analysis.load_engine import (
                UniformLoad, TrapezoidalLoad, PointLoadOnMember, MomentOnMember
            )
            if load_type == "uniform":
                load = UniformLoad(
                    id="interop", member_id="M0", w=load_params.get("w", 0),
                    start_pos=load_params.get("start_pos", 0),
                    end_pos=load_params.get("end_pos", 1),
                )
                return load.get_fixed_end_actions(length)
            elif load_type == "trapezoidal":
                load = TrapezoidalLoad(
                    id="interop", member_id="M0",
                    w1=load_params.get("w1", 0), w2=load_params.get("w2", 0),
                    start_pos=load_params.get("start_pos", 0),
                    end_pos=load_params.get("end_pos", 1),
                )
                return load.get_fixed_end_actions(length)
            elif load_type == "point_load":
                load = PointLoadOnMember(
                    id="interop", member_id="M0",
                    P=load_params.get("P", 0), a=load_params.get("a", 0.5),
                )
                return load.get_fixed_end_actions(length)
            elif load_type == "moment":
                load = MomentOnMember(
                    id="interop", member_id="M0",
                    M=load_params.get("M", 0), a=load_params.get("a", 0.5),
                )
                return load.get_fixed_end_actions(length)
        except Exception as e:
            return {"error": str(e), "backend": "python_fallback"}
        return None
    
    async def close(self):
        """Cleanup HTTP client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Global singleton
_client: Optional[RustInteropClient] = None


def get_rust_client() -> RustInteropClient:
    """Get or create the global Rust interop client"""
    global _client
    if _client is None:
        _client = RustInteropClient()
    return _client


# ============================================
# Convenience functions
# ============================================

async def analyze_with_best_backend(
    model: Dict,
    analysis_type: str = "static",
    force_backend: Optional[str] = None,
    **kwargs,
) -> RustSolverResult:
    """
    One-call analysis with automatic backend selection.
    
    Small models -> Python (avoid HTTP overhead)
    Large models -> Rust (10-100x faster for >1000 nodes)
    Rust unavailable -> Python fallback
    """
    client = get_rust_client()
    backend = SolverBackend.AUTO
    if force_backend:
        backend = SolverBackend(force_backend)
    return await client.analyze(model, analysis_type, backend, kwargs or None)


def compute_model_hash(model: Dict) -> str:
    """Deterministic hash of a structural model for caching"""
    canonical = json.dumps(model, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]
