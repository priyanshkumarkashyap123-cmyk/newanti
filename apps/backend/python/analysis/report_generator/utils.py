import math
from typing import Any, Dict, List


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def max_abs_values(numbers: List[float]) -> float:
    if not numbers:
        return 0.0
    return max(abs(min(numbers)), abs(max(numbers)))


def extract_member_force_extremes(member_forces: Dict[str, Any]) -> Dict[str, Any]:
    # Supports formats: list of dicts or dict of arrays
    def max_abs(values):
        return max_abs_values([safe_float(v, 0.0) for v in values]) if values else 0.0

    if isinstance(member_forces, list):
        shear_y = [mf.get('shear_y', 0) for mf in member_forces]
        shear_z = [mf.get('shear_z', 0) for mf in member_forces]
        moment_y = [mf.get('moment_y', 0) for mf in member_forces]
        moment_z = [mf.get('moment_z', 0) for mf in member_forces]
    else:
        shear_y = member_forces.get('shear_y') or member_forces.get('Vy') or []
        shear_z = member_forces.get('shear_z') or member_forces.get('Vz') or []
        moment_y = member_forces.get('moment_y') or member_forces.get('My') or []
        moment_z = member_forces.get('moment_z') or member_forces.get('Mz') or []

    return {
        'shear_y': max_abs(shear_y),
        'shear_z': max_abs(shear_z),
        'moment_y': max_abs(moment_y),
        'moment_z': max_abs(moment_z),
    }