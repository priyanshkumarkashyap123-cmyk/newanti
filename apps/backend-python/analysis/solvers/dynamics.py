"""
Modal & Response Spectrum Analysis module

Lightweight façade re-exporting extracted analysis components:
- Mass matrix generation (lumped/consistent) → dynamics_mass
- Modal extraction via eigenvalue problem → dynamics_modal
- Response Spectrum Analysis (SRSS, CQC per IS 1893 Cl. 6.4.2) → dynamics_spectrum_analyzer
- Spectrum curves (IS 1893:2016) → dynamics_spectra
- Data structures → dynamics_models

Unit conventions:
    Stiffness matrix K: consistent units (kN/m, kN·m/rad)
    Mass: kg
    Frequencies: Hz (ω in rad/s)
    Periods: seconds
    Accelerations in Sa/g: g units
"""
import logging

logger = logging.getLogger(__name__)

# Re-export all public classes and functions
from .dynamics_models import (
    SpectrumCurve,
    ModeShape,
    ModalResult,
    ResponseSpectrumResult,
)

from .dynamics_spectra import (
    get_is1893_spectrum,
)

from .dynamics_mass import (
    MassMatrixBuilder,
)

from .dynamics_modal import (
    ModalAnalyzer,
)

from .dynamics_spectrum_analyzer import (
    ResponseSpectrumAnalyzer,
)


__all__ = [
    # Data models
    "SpectrumCurve",
    "ModeShape",
    "ModalResult",
    "ResponseSpectrumResult",
    # Spectrum generation
    "get_is1893_spectrum",
    # Mass matrix builder
    "MassMatrixBuilder",
    # Modal analysis
    "ModalAnalyzer",
    # Response spectrum analysis
    "ResponseSpectrumAnalyzer",
]
