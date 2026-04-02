"""Performance monitoring utilities and singleton access."""

from __future__ import annotations

from typing import Dict


class PerformanceMonitor:
    """Monitor and report performance metrics."""

    def __init__(self):
        self.metrics: Dict[str, float] = {}

    def record_operation(self, operation: str, duration: float, size: int = None):
        """Record operation performance."""
        key = f"{operation}_{size}" if size else operation
        self.metrics[key] = duration

    def get_metrics(self) -> Dict[str, float]:
        """Get all recorded metrics."""
        return self.metrics.copy()

    def print_report(self):
        """Print performance report."""
        print("\n" + "=" * 60)
        print("PERFORMANCE REPORT")
        print("=" * 60)

        for operation, duration in sorted(self.metrics.items()):
            print(f"{operation:40s}: {duration:8.4f} s")

        print("=" * 60 + "\n")


_performance_monitor = PerformanceMonitor()


def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance."""
    return _performance_monitor


__all__ = ["PerformanceMonitor", "get_performance_monitor"]
