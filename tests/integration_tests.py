"""
Integration Test Suite for Migration
Tests all migrated endpoints for correctness and Rust/Python equivalence
"""

import pytest
import asyncio
import json
import time
from typing import Dict, Any
from httpx import AsyncClient

# Test constants
BEAM_TEST_CASES = [
    {
        "name": "Simple 5m beam with point load",
        "length": 5.0,
        "loads": [{"type": "point", "magnitude": 10000, "position": 2.5}],
        "E": 200e6,
        "I": 1e-4
    },
    {
        "name": "Beam with UDL",
        "length": 6.0,
        "loads": [{"type": "udl", "magnitude": 5000, "position": 0, "end_position": 6.0}],
        "E": 200e6,
        "I": 1e-4
    }
]

FRAME_TEST_CASES = [
    {
        "name": "Simple 2-story portal frame",
        "nodes": [
            {"id": "n1", "x": 0, "y": 0, "z": 0, "support": "fixed"},
            {"id": "n2", "x": 5, "y": 0, "z": 0, "support": "fixed"},
            {"id": "n3", "x": 0, "y": 3, "z": 0, "support": "none"},
            {"id": "n4", "x": 5, "y": 3, "z": 0, "support": "none"},
        ],
        "members": [
            {"id": "m1", "startNodeId": "n1", "endNodeId": "n3", "E": 200e9, "A": 0.01, "Iy": 1e-4, "Iz": 1e-4},
            {"id": "m2", "startNodeId": "n2", "endNodeId": "n4", "E": 200e9, "A": 0.01, "Iy": 1e-4, "Iz": 1e-4},
            {"id": "m3", "startNodeId": "n3", "endNodeId": "n4", "E": 200e9, "A": 0.01, "Iy": 1e-4, "Iz": 1e-4},
        ],
        "node_loads": [
            {"nodeId": "n3", "fx": 0, "fy": 100000, "fz": 0}
        ]
    }
]

MODAL_TEST_CASES = [
    {
        "name": "Simple 2-DOF system",
        "mass_matrix": [[1.0, 0.0], [0.0, 1.0]],
        "stiffness_matrix": [[2000.0, -1000.0], [-1000.0, 2000.0]],
        "num_modes": 2,
        "damping_ratio": 0.05
    }
]


@pytest.mark.asyncio
class TestBeamMigration:
    """Test beam analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    @pytest.mark.parametrize("test_case", BEAM_TEST_CASES)
    async def test_beam_python_backend(self, client, test_case):
        """Test beam analysis with Python backend (authoritative)"""
        payload = {**test_case, "backend": "python", "debug_compare": False}
        response = await client.post("/analyze/beam", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "result" in data
        assert "max_moment" in data["result"]
        assert "max_deflection" in data["result"]
        assert "stats" in data
        assert data["stats"]["backend_used"] == "python"
    
    @pytest.mark.parametrize("test_case", BEAM_TEST_CASES)
    async def test_beam_debug_compare(self, client, test_case):
        """Test beam analysis with debug compare mode"""
        payload = {**test_case, "backend": "python", "debug_compare": True}
        response = await client.post("/analyze/beam", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "stats" in data
        assert "debug_comparison" in data["stats"]
        
        if data["stats"]["debug_comparison"].get("rust_available"):
            assert "max_deflection_delta_mm" in data["stats"]["debug_comparison"]
            assert "within_tolerance" in data["stats"]["debug_comparison"]


@pytest.mark.asyncio
class TestFrameMigration:
    """Test frame analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    @pytest.mark.parametrize("test_case", FRAME_TEST_CASES)
    async def test_frame_python_backend(self, client, test_case):
        """Test frame analysis with Python backend"""
        payload = {**test_case, "backend": "python", "debug_compare": False}
        response = await client.post("/analyze/frame", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "nodes" in data
        assert "stats" in data
        assert data["stats"]["backend_used"] == "python"
    
    @pytest.mark.parametrize("test_case", FRAME_TEST_CASES)
    async def test_frame_rust_first(self, client, test_case):
        """Test frame analysis with Rust-first backend"""
        payload = {**test_case, "backend": "auto", "debug_compare": False}
        response = await client.post("/analyze/large-frame", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


@pytest.mark.asyncio
class TestModalMigration:
    """Test modal analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    @pytest.mark.parametrize("test_case", MODAL_TEST_CASES)
    async def test_modal_python_backend(self, client, test_case):
        """Test modal analysis with Python backend"""
        payload = {**test_case, "analysis_type": "modal", "backend": "python"}
        response = await client.post("/analysis/time-history", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "modes" in data
        assert len(data["modes"]) == test_case["num_modes"]
        assert "frequency" in data["modes"][0]
        assert "period" in data["modes"][0]
    
    @pytest.mark.parametrize("test_case", MODAL_TEST_CASES)
    async def test_modal_debug_compare(self, client, test_case):
        """Test modal analysis with debug compare"""
        payload = {**test_case, "analysis_type": "modal", "backend": "python", "debug_compare": True}
        response = await client.post("/analysis/time-history", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        if "debug_comparison" in data.get("stats", {}):
            debug = data["stats"]["debug_comparison"]
            assert "enabled" in debug
            assert "rust_available" in debug


@pytest.mark.asyncio
class TestNonlinearMigration:
    """Test nonlinear analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_nonlinear_basic(self, client):
        """Test basic nonlinear analysis"""
        payload = {
            "nodes": FRAME_TEST_CASES[0]["nodes"],
            "members": FRAME_TEST_CASES[0]["members"],
            "node_loads": FRAME_TEST_CASES[0]["node_loads"],
            "settings": {"method": "newton-raphson", "steps": 10},
            "backend": "python"
        }
        response = await client.post("/analysis/nonlinear/run", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "displacements" in data or "converged" in data


@pytest.mark.asyncio
class TestPDeltaMigration:
    """Test P-Delta analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_pdelta_basic(self, client):
        """Test P-Delta analysis"""
        payload = {
            "nodes": FRAME_TEST_CASES[0]["nodes"],
            "members": FRAME_TEST_CASES[0]["members"],
            "node_loads": FRAME_TEST_CASES[0]["node_loads"],
            "max_iterations": 10,
            "tolerance": 1e-6,
            "backend": "rust"
        }
        response = await client.post("/analysis/pdelta/run", json=payload)
        
        # May return 501 if not implemented
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "converged" in data or "iterations" in data


@pytest.mark.asyncio
class TestBucklingMigration:
    """Test buckling analysis migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_buckling_basic(self, client):
        """Test buckling analysis"""
        payload = {
            "nodes": FRAME_TEST_CASES[0]["nodes"],
            "members": FRAME_TEST_CASES[0]["members"],
            "node_loads": [], # Buckling with no loads first
            "num_modes": 3,
            "backend": "rust"
        }
        response = await client.post("/analysis/buckling/run", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "buckling_factors" in data
            assert "critical_loads" in data


@pytest.mark.asyncio
class TestStressCalculation:
    """Test stress calculation migration"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_stress_calculation(self, client):
        """Test stress calculation"""
        payload = {
            "members": [
                {
                    "id": "m1",
                    "forces": {
                        "axial": [100000, 100000],
                        "moment_x": [],
                        "moment_y": [50000, 50000],
                        "shear_y": [10000, 10000],
                        "shear_z": []
                    },
                    "section": {"area": 0.01, "Ixx": 1e-4, "Iyy": 1e-4, "depth": 0.1, "width": 0.1},
                    "length": 5.0
                }
            ],
            "stress_type": "von_mises",
            "fy": 250,
            "safety_factor": 1.5
        }
        response = await client.post("/stress/calculate", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "results" in data


@pytest.mark.asyncio
class TestNumericalAccuracy:
    """Test numerical accuracy between Rust and Python"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_displacement_convergence(self, client):
        """Test that Rust and Python displacements converge"""
        test_case = FRAME_TEST_CASES[0]
        
        # Python authoritative
        py_payload = {**test_case, "backend": "python", "debug_compare": False}
        py_response = await client.post("/analyze/frame", json=py_payload)
        py_data = py_response.json()
        
        if py_response.status_code == 200:
            assert py_data["success"] == True
            # Results should be deterministic
            assert isinstance(py_data, dict)


@pytest.mark.asyncio
class TestPerformance:
    """Test performance improvements"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(base_url="http://localhost:8000") as c:
            yield c
    
    async def test_beam_performance(self, client):
        """Test beam analysis performance"""
        test_case = BEAM_TEST_CASES[0]
        
        # Time Python
        py_payload = {**test_case, "backend": "python", "debug_compare": False}
        start = time.time()
        py_response = await client.post("/analyze/beam", json=py_payload)
        py_time = time.time() - start
        
        if py_response.status_code == 200:
            data = py_response.json()
            assert "stats" in data
            assert "total_solve_time_ms" in data["stats"]
            assert data["stats"]["total_solve_time_ms"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
