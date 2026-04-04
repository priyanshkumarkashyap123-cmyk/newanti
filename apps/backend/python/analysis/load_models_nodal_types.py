"""Nodal load dataclasses."""

from dataclasses import dataclass


@dataclass
class NodalLoad:
    """Direct load applied at a node."""

    id: str
    node_id: str
    fx: float = 0.0  # Force X (kN)
    fy: float = 0.0  # Force Y (kN)
    fz: float = 0.0  # Force Z (kN)
    mx: float = 0.0  # Moment X (kN·m)
    my: float = 0.0  # Moment Y (kN·m)
    mz: float = 0.0  # Moment Z (kN·m)
    load_case: str = "DEAD"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "node_id": self.node_id,
            "fx": self.fx,
            "fy": self.fy,
            "fz": self.fz,
            "mx": self.mx,
            "my": self.my,
            "mz": self.mz,
            "load_case": self.load_case,
        }


__all__ = ["NodalLoad"]
