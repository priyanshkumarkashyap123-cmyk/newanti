"""Parallel processing helpers for analysis workloads."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing
from typing import Any, Callable, Dict, List, Optional


class ParallelProcessor:
    """Parallel processing for multi-core utilization."""

    def __init__(self, max_workers: Optional[int] = None):
        self.max_workers = max_workers or multiprocessing.cpu_count()

    def map_parallel(self, func: Callable, items: List[Any], use_threads: bool = False) -> List[Any]:
        if len(items) == 0:
            return []
        if len(items) < 4:
            return [func(item) for item in items]

        executor_class = ThreadPoolExecutor if use_threads else ProcessPoolExecutor
        with executor_class(max_workers=self.max_workers) as executor:
            results = list(executor.map(func, items))
        return results

    @staticmethod
    def parallel_stress_calculation(member_data_list: List[Dict]) -> List[Dict]:
        from .stress_calculator import StressCalculator

        def calculate_single_member(member_data: Dict) -> Dict:
            calculator = StressCalculator()
            stress_points = calculator.calculate_member_stresses(
                member_id=member_data["member_id"],
                member_forces=member_data["forces"],
                section_properties=member_data["section"],
                member_length=member_data["length"],
                fy=member_data.get("fy", 250.0),
                safety_factor=member_data.get("safety_factor", 1.67),
                num_points=member_data.get("num_points", 20),
            )
            return {
                "member_id": member_data["member_id"],
                "stress_points": [vars(sp) for sp in stress_points],
            }

        processor = ParallelProcessor()
        return processor.map_parallel(calculate_single_member, member_data_list)


__all__ = ["ParallelProcessor"]
