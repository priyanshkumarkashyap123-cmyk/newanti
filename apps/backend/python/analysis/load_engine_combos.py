"""Default load combination helpers for LoadEngine."""

from .load_case import LoadCombination


def init_default_combinations(add_combination):
    """Initialize standard load combinations per IS 456 / ASCE 7."""
    # IS 456 combinations
    add_combination(LoadCombination(
        name="1.5DL+1.5LL",
        description="IS 456 - Dead + Live",
        factors={"DEAD": 1.5, "LIVE": 1.5},
    ))
    add_combination(LoadCombination(
        name="1.2DL+1.2LL+1.2WL",
        description="IS 456 - Dead + Live + Wind",
        factors={"DEAD": 1.2, "LIVE": 1.2, "WIND": 1.2},
    ))
    add_combination(LoadCombination(
        name="0.9DL+1.5WL",
        description="IS 456 - Overturning check",
        factors={"DEAD": 0.9, "WIND": 1.5},
    ))
    add_combination(LoadCombination(
        name="1.5DL+1.5EQ",
        description="IS 456 - Dead + Seismic",
        factors={"DEAD": 1.5, "SEISMIC": 1.5},
    ))

    # Serviceability (unfactored)
    add_combination(LoadCombination(
        name="DL+LL",
        description="Serviceability - Deflection check",
        factors={"DEAD": 1.0, "LIVE": 1.0},
    ))


__all__ = ["init_default_combinations"]
