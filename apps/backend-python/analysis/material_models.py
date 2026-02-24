import numpy as np
from typing import Tuple

class MaterialModel:
    """Base class for material constitutive models.
    Sub‑classes must implement ``stress(strain)`` returning a tuple of (stress, tangent_modulus).
    """
    def __init__(self, E: float, density: float = 7850.0):
        self.E = E
        self.density = density

    def stress(self, strain: float) -> Tuple[float, float]:
        raise NotImplementedError("stress method must be implemented by subclass")

class ElasticPlasticSteel(MaterialModel):
    """Bilinear elastic‑plastic steel model.
    Parameters:
        fy: Yield stress (MPa)
        E: Young's modulus (MPa)
        plastic_modulus: Slope of the plastic branch (MPa)
    """
    def __init__(self, fy: float, E: float = 200_000.0, plastic_modulus: float = 2000.0, density: float = 7850.0):
        super().__init__(E, density)
        self.fy = fy
        self.plastic_modulus = plastic_modulus
        self.elastic_limit_strain = fy / E

    def stress(self, strain: float) -> Tuple[float, float]:
        """Return stress and tangent modulus for a given strain.
        Handles both tension and compression (symmetric).
        """
        # Tension
        if strain >= 0:
            if strain <= self.elastic_limit_strain:
                # Elastic region
                stress = self.E * strain
                tangent = self.E
            else:
                # Plastic region (bilinear)
                plastic_strain = strain - self.elastic_limit_strain
                stress = self.fy + self.plastic_modulus * plastic_strain
                tangent = self.plastic_modulus
        else:
            # Compression – symmetric behavior for simplicity
            # Use same yield stress magnitude
            if abs(strain) <= self.elastic_limit_strain:
                stress = self.E * strain
                tangent = self.E
            else:
                plastic_strain = abs(strain) - self.elastic_limit_strain
                stress = -self.fy - self.plastic_modulus * plastic_strain
                tangent = self.plastic_modulus
        return stress, tangent

class ConcreteCompression(MaterialModel):
    """Parabolic‑rectangular concrete compression model (simplified).
    Parameters:
        fck: Characteristic compressive strength (MPa)
        E: Modulus of elasticity (MPa) – often 4700*sqrt(fck)
    """
    def __init__(self, fck: float, E: float = None, density: float = 2400.0):
        # Approximate modulus if not provided
        if E is None:
            E = 4700 * np.sqrt(fck)
        super().__init__(E, density)
        self.fck = fck
        # Strain at peak stress (≈0.002 for concrete)
        self.epsilon_0 = 0.002
        # Strain at crushing (≈0.0035)
        self.epsilon_u = 0.0035

    def stress(self, strain: float) -> Tuple[float, float]:
        """Return compressive stress and tangent modulus for a given strain.
        Assumes strain is compressive (negative). Tension is ignored (returns zero).
        """
        if strain >= 0:
            # Concrete has negligible tensile strength in this simple model
            return 0.0, 0.0
        eps = -strain  # Convert to positive compression strain
        if eps <= self.epsilon_0:
            # Parabolic ascending branch: sigma = fck * (2*eps/epsilon0 - (eps/epsilon0)^2)
            ratio = eps / self.epsilon_0
            stress = self.fck * (2 * ratio - ratio ** 2)
            # Tangent modulus derivative of the parabola
            tangent = self.fck * (2 / self.epsilon_0 - 2 * ratio / self.epsilon_0)
        elif eps <= self.epsilon_u:
            # Linear descending branch to zero at epsilon_u
            stress = self.fck * (1 - (eps - self.epsilon_0) / (self.epsilon_u - self.epsilon_0))
            tangent = -self.fck / (self.epsilon_u - self.epsilon_0)
        else:
            # Beyond crushing – stress = 0
            stress = 0.0
            tangent = 0.0
        # Return compressive stress as negative value
        return -stress, tangent

# Utility function to create material from a dict (used by API)
def create_material_from_dict(data: dict):
    """Factory function to instantiate a material model from a JSON‑like dict.
    Expected keys:
        type: "steel" or "concrete"
        For steel: fy, E (optional), plastic_modulus (optional)
        For concrete: fck, E (optional)
    """
    mtype = data.get("type")
    if mtype == "steel":
        return ElasticPlasticSteel(
            fy=data["fy"],
            E=data.get("E", 200_000.0),
            plastic_modulus=data.get("plastic_modulus", 2000.0),
            density=data.get("density", 7850.0)
        )
    elif mtype == "concrete":
        return ConcreteCompression(
            fck=data["fck"],
            E=data.get("E"),
            density=data.get("density", 2400.0)
        )
    else:
        raise ValueError(f"Unsupported material type: {mtype}")
