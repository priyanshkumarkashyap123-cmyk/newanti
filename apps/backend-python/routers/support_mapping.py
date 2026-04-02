"""Support mapping helpers for structural analysis routers."""

from typing import Any, Dict, List

SUPPORT_NONE = "none"
SUPPORT_FIXED = "fixed"
SUPPORT_PINNED = "pinned"
SUPPORT_PIN = "pin"
SUPPORT_ROLLER = "roller"
SUPPORT_ROLLER_X = "roller_x"
SUPPORT_ROLLER_Z = "roller_z"


def _normalize_support_value(support: Any) -> str:
    if support is None:
        return SUPPORT_NONE
    return str(support).strip().lower()


def build_rust_supports(nodes: List[Any]) -> List[Dict[str, Any]]:
    """Build Rust support objects from request nodes."""
    supports_for_rust: List[Dict[str, Any]] = []

    for node in nodes:
        support = _normalize_support_value(getattr(node, "support", None))
        if support == SUPPORT_NONE:
            continue

        support_obj = {
            "nodeId": getattr(node, "id"),
            "fx": False,
            "fy": False,
            "fz": False,
            "mx": False,
            "my": False,
            "mz": False,
        }

        if support == SUPPORT_FIXED:
            support_obj.update({"fx": True, "fy": True, "fz": True, "mx": True, "my": True, "mz": True})
        elif support in (SUPPORT_PINNED, SUPPORT_PIN):
            support_obj.update({"fx": True, "fy": True, "fz": True})
        elif support == SUPPORT_ROLLER:
            support_obj.update({"fy": True})

        supports_for_rust.append(support_obj)

    return supports_for_rust


def build_fixed_dofs(nodes: List[Any]) -> List[int]:
    """Build fixed DOF list for sparse solvers from support assignments."""
    fixed_dofs: List[int] = []
    node_map = {getattr(node, "id"): idx for idx, node in enumerate(nodes)}

    for node in nodes:
        support = _normalize_support_value(getattr(node, "support", None))
        if support == SUPPORT_NONE:
            continue

        base_dof = node_map[getattr(node, "id")] * 6
        if support == SUPPORT_FIXED:
            fixed_dofs.extend(range(base_dof, base_dof + 6))
        elif support in (SUPPORT_PINNED, SUPPORT_PIN):
            fixed_dofs.extend([base_dof, base_dof + 1, base_dof + 2])
        elif support == SUPPORT_ROLLER:
            fixed_dofs.append(base_dof + 1)

    return fixed_dofs


def build_advanced_supports_dict(nodes: List[Any]) -> Dict[str, List[int]]:
    """Build supports dictionary (node_id -> restrained dofs) for advanced solver."""
    supports_dict: Dict[str, List[int]] = {}

    for node in nodes:
        support = _normalize_support_value(getattr(node, "support", None))
        if support == SUPPORT_NONE:
            continue

        dofs: List[int] = []
        if support == SUPPORT_FIXED:
            dofs = [0, 1, 2, 3, 4, 5]
        elif support in (SUPPORT_PINNED, SUPPORT_PIN):
            dofs = [0, 1, 2]
        elif support == SUPPORT_ROLLER:
            dofs = [1]
        elif support == SUPPORT_ROLLER_X:
            dofs = [0]
        elif support == SUPPORT_ROLLER_Z:
            dofs = [2]

        if dofs:
            supports_dict[getattr(node, "id")] = dofs

    return supports_dict
