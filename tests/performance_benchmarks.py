"""
Performance Benchmark Suite for Migration
Compares Rust and Python solvers across models of varying complexity
"""

import asyncio
import time
import json
import statistics
from typing import Dict, Any, List
from dataclasses import dataclass, asdict
from httpx import AsyncClient

@dataclass
class BenchmarkResult:
    test_name: str
    model_size: int
    backend: str
    solve_time_ms: float
    success: bool
    error: str = ""

class PerformanceBenchmark:
    """Run and compare performance across backends"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: List[BenchmarkResult] = []
    
    async def benchmark_beam_analysis(self):
        """Benchmark beam analysis"""
        test_cases = [
            {
                "name": "5m simple beam",
                "length": 5.0,
                "loads": [{"type": "point", "magnitude": 10000, "position": 2.5}],
            },
            {
                "name": "10m continuous beam",
                "length": 10.0,
                "loads": [
                    {"type": "point", "magnitude": 5000, "position": 2.5},
                    {"type": "point", "magnitude": 5000, "position": 7.5},
                    {"type": "udl", "magnitude": 1000, "position": 0, "end_position": 10.0}
                ],
            }
        ]
        
        async with AsyncClient(base_url=self.base_url) as client:
            for test in test_cases:
                for backend in ["python", "rust"]:
                    payload = {**test, "backend": backend, "debug_compare": False, "E": 200e6, "I": 1e-4}
                    
                    try:
                        start = time.time()
                        response = await client.post("/analyze/beam", json=payload, timeout=30.0)
                        elapsed_ms = (time.time() - start) * 1000
                        
                        if response.status_code == 200:
                            data = response.json()
                            self.results.append(BenchmarkResult(
                                test_name=f"Beam: {test['name']}",
                                model_size=len(test["loads"]),
                                backend=backend,
                                solve_time_ms=elapsed_ms,
                                success=True
                            ))
                    except Exception as e:
                        self.results.append(BenchmarkResult(
                            test_name=f"Beam: {test['name']}",
                            model_size=len(test["loads"]),
                            backend=backend,
                            solve_time_ms=0,
                            success=False,
                            error=str(e)
                        ))
    
    async def benchmark_frame_analysis(self):
        """Benchmark frame analysis with varying sizes"""
        async with AsyncClient(base_url=self.base_url) as client:
            # Small frame (2 stories, 1 bay)
            for n_stories in [2, 3, 5]:
                nodes = []
                members = []
                node_loads = []
                
                # Generate grid of nodes
                for i in range(n_stories + 1):
                    for j in range(2):
                        node_id = f"n_{i}_{j}"
                        nodes.append({
                            "id": node_id,
                            "x": j * 5.0,
                            "y": i * 3.0,
                            "z": 0,
                            "support": "fixed" if i == 0 else "none"
                        })
                
                # Generate members
                for i in range(n_stories):
                    for j in range(2):
                        # Columns
                        members.append({
                            "id": f"col_{i}_{j}",
                            "startNodeId": f"n_{i}_{j}",
                            "endNodeId": f"n_{i+1}_{j}",
                            "E": 200e9, "A": 0.01, "Iy": 1e-4, "Iz": 1e-4
                        })
                    
                    # Beams
                    members.append({
                        "id": f"beam_{i}",
                        "startNodeId": f"n_{i+1}_0",
                        "endNodeId": f"n_{i+1}_1",
                        "E": 200e9, "A": 0.01, "Iy": 1e-4, "Iz": 1e-4
                    })
                
                # Add loads
                node_loads.append({
                    "nodeId": f"n_{n_stories}_0",
                    "fx": 0, "fy": 100000 * n_stories, "fz": 0
                })
                
                test_name = f"Frame: {n_stories} stories, {len(nodes)} nodes, {len(members)} members"
                
                for backend in ["python", "rust"]:
                    payload = {
                        "nodes": nodes,
                        "members": members,
                        "node_loads": node_loads,
                        "backend": backend,
                        "debug_compare": False
                    }
                    
                    try:
                        start = time.time()
                        endpoint = "/analyze/large-frame" if backend == "rust" else "/analyze/frame"
                        response = await client.post(endpoint, json=payload, timeout=30.0)
                        elapsed_ms = (time.time() - start) * 1000
                        
                        if response.status_code == 200:
                            self.results.append(BenchmarkResult(
                                test_name=test_name,
                                model_size=len(nodes),
                                backend=backend,
                                solve_time_ms=elapsed_ms,
                                success=True
                            ))
                    except Exception as e:
                        self.results.append(BenchmarkResult(
                            test_name=test_name,
                            model_size=len(nodes),
                            backend=backend,
                            solve_time_ms=0,
                            success=False,
                            error=str(e)
                        ))
    
    async def benchmark_modal_analysis(self):
        """Benchmark modal analysis"""
        test_cases = [
            {
                "name": "2-DOF system",
                "mass_matrix": [[1.0, 0.0], [0.0, 1.0]],
                "stiffness_matrix": [[2000.0, -1000.0], [-1000.0, 2000.0]],
                "num_modes": 2
            },
            {
                "name": "5-DOF system",
                "mass_matrix": [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]],
                "stiffness_matrix": [
                    [2000, -1000, 0, 0, 0],
                    [-1000, 2000, -1000, 0, 0],
                    [0, -1000, 2000, -1000, 0],
                    [0, 0, -1000, 2000, -1000],
                    [0, 0, 0, -1000, 2000]
                ],
                "num_modes": 3
            }
        ]
        
        async with AsyncClient(base_url=self.base_url) as client:
            for test in test_cases:
                test_name = f"Modal: {test['name']}"
                
                for backend in ["python", "rust"]:
                    payload = {**test, "analysis_type": "modal", "backend": backend}
                    
                    try:
                        start = time.time()
                        response = await client.post("/analysis/time-history", json=payload, timeout=30.0)
                        elapsed_ms = (time.time() - start) * 1000
                        
                        if response.status_code == 200:
                            self.results.append(BenchmarkResult(
                                test_name=test_name,
                                model_size=len(test["mass_matrix"]),
                                backend=backend,
                                solve_time_ms=elapsed_ms,
                                success=True
                            ))
                    except Exception as e:
                        self.results.append(BenchmarkResult(
                            test_name=test_name,
                            model_size=len(test["mass_matrix"]),
                            backend=backend,
                            solve_time_ms=0,
                            success=False,
                            error=str(e)
                        ))
    
    def generate_report(self) -> str:
        """Generate benchmark report"""
        report = []
        report.append("=" * 80)
        report.append("PERFORMANCE BENCHMARK REPORT")
        report.append("=" * 80)
        report.append("")
        
        # Group by test
        by_test = {}
        for result in self.results:
            if result.test_name not in by_test:
                by_test[result.test_name] = []
            by_test[result.test_name].append(result)
        
        # Analyze each test
        total_speedup = []
        for test_name, results in by_test.items():
            report.append(f"\n{test_name}")
            report.append("-" * 80)
            
            python_times = [r.solve_time_ms for r in results if r.backend == "python" and r.success]
            rust_times = [r.solve_time_ms for r in results if r.backend == "rust" and r.success]
            
            if python_times and rust_times:
                py_avg = statistics.mean(python_times)
                rust_avg = statistics.mean(rust_times)
                speedup = py_avg / rust_avg if rust_avg > 0 else 0
                
                report.append(f"  Python (avg):  {py_avg:8.2f} ms")
                report.append(f"  Rust   (avg):  {rust_avg:8.2f} ms")
                report.append(f"  Speedup:       {speedup:8.2f}x")
                
                total_speedup.append(speedup)
            
            # Show all results
            report.append("\n  Detailed Results:")
            for result in results:
                status = "✓" if result.success else "✗"
                report.append(f"    {status} {result.backend:8s}: {result.solve_time_ms:8.2f} ms")
        
        # Summary
        report.append("\n" + "=" * 80)
        report.append("SUMMARY")
        report.append("=" * 80)
        
        if total_speedup:
            avg_speedup = statistics.mean(total_speedup)
            min_speedup = min(total_speedup)
            max_speedup = max(total_speedup)
            report.append(f"Average Speedup (Rust vs Python): {avg_speedup:.2f}x")
            report.append(f"Range: {min_speedup:.2f}x - {max_speedup:.2f}x")
        
        success_count = sum(1 for r in self.results if r.success)
        report.append(f"Tests Run: {len(self.results)}")
        report.append(f"Successful: {success_count} ({100*success_count/len(self.results):.1f}%)")
        
        return "\n".join(report)
    
    async def run_all(self):
        """Run all benchmarks"""
        await self.benchmark_beam_analysis()
        await self.benchmark_frame_analysis()
        await self.benchmark_modal_analysis()


async def main():
    benchmark = PerformanceBenchmark()
    await benchmark.run_all()
    report = benchmark.generate_report()
    print(report)
    
    # Save report
    with open("/Users/rakshittiwari/Desktop/newanti/MIGRATION_PERFORMANCE_REPORT.md", "w") as f:
        f.write(report)


if __name__ == "__main__":
    asyncio.run(main())
