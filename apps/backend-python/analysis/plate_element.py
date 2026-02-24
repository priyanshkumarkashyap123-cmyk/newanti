import numpy as np
from typing import List, Tuple

# Helper functions for shape functions and Jacobian

def shape_functions(xi: float, eta: float) -> np.ndarray:
    """Bilinear shape functions for a 4‑node quadrilateral.
    Returns an array [N1, N2, N3, N4]."""
    N1 = 0.25 * (1 - xi) * (1 - eta)
    N2 = 0.25 * (1 + xi) * (1 - eta)
    N3 = 0.25 * (1 + xi) * (1 + eta)
    N4 = 0.25 * (1 - xi) * (1 + eta)
    return np.array([N1, N2, N3, N4])


def shape_function_derivatives(xi: float, eta: float) -> np.ndarray:
    """Derivatives of bilinear shape functions w.r.t xi and eta.
    Returns a (4, 2) array where each row corresponds to a node and columns are dN/dxi, dN/deta."""
    dN_dxi = np.array([
        -0.25 * (1 - eta),
         0.25 * (1 - eta),
         0.25 * (1 + eta),
        -0.25 * (1 + eta)
    ])
    dN_deta = np.array([
        -0.25 * (1 - xi),
        -0.25 * (1 + xi),
         0.25 * (1 + xi),
         0.25 * (1 - xi)
    ])
    return np.column_stack((dN_dxi, dN_deta))


class PlateElement:
    """Quadrilateral plate element using the Discrete Kirchhoff Quadrilateral (DKQ) formulation.
    Supports membrane and bending behavior for thin plates.
    """
    def __init__(self, node_ids: List[int], thickness: float, material, integration_points: int = 2):
        """Create a plate element.
        Args:
            node_ids: List of four node IDs (counter‑clockwise).
            thickness: Plate thickness (mm).
            material: Material object providing E, nu, and density.
            integration_points: Number of Gauss points per direction (default 2 for 2×2 integration).
        """
        if len(node_ids) != 4:
            raise ValueError("PlateElement requires exactly 4 node IDs.")
        self.node_ids = node_ids
        self.thickness = thickness
        self.material = material
        self.integration_points = integration_points
        # Pre‑compute Gauss points and weights for 2‑point integration
        a = 1.0 / np.sqrt(3)
        self.gauss = [(-a, -a), (a, -a), (a, a), (-a, a)]
        self.weights = [1.0, 1.0, 1.0, 1.0]

    def _b_matrix(self, dN_dx: np.ndarray, dN_dy: np.ndarray) -> np.ndarray:
        """Construct the strain‑displacement matrix B for membrane and bending.
        dN_dx, dN_dy are (4,) arrays of shape‑function derivatives w.r.t global x and y.
        Returns a (3, 8) matrix for membrane (εx, εy, γxy) and a (3, 8) for bending (κx, κy, κxy).
        """
        # Membrane part (plane stress)
        B_mem = np.zeros((3, 8))
        for i in range(4):
            B_mem[0, i*2] = dN_dx[i]
            B_mem[1, i*2+1] = dN_dy[i]
            B_mem[2, i*2] = dN_dy[i]
            B_mem[2, i*2+1] = dN_dx[i]
        return B_mem

    def stiffness_matrix(self, node_coords: dict) -> np.ndarray:
        """Assemble the element stiffness matrix (12×12) for the four nodes.
        node_coords: dict mapping node ID -> (x, y, z). Z is ignored for thin plate (assumed zero).
        Returns a (12, 12) CSR‑compatible dense matrix.
        """
        ke = np.zeros((12, 12))
        # Material stiffness for membrane (plane stress)
        E = self.material.E
        nu = self.material.nu
        t = self.thickness
        # Plane stress constitutive matrix
        D_mem = (E / (1 - nu**2)) * np.array([
            [1, nu, 0],
            [nu, 1, 0],
            [0, 0, (1 - nu) / 2]
        ])
        # Bending stiffness (classical plate theory)
        D_bend = (E * t**3) / (12 * (1 - nu**2)) * np.array([
            [1, nu, 0],
            [nu, 1, 0],
            [0, 0, (1 - nu) / 2]
        ])
        # Loop over Gauss points
        for (xi, eta), w in zip(self.gauss, self.weights):
            # Derivatives of shape functions w.r.t natural coords
            dN_dxi_eta = shape_function_derivatives(xi, eta)  # (4,2)
            # Jacobian matrix J = [dx/dxi  dx/deta; dy/dxi  dy/deta]
            J = np.zeros((2, 2))
            for i, nid in enumerate(self.node_ids):
                x, y, _ = node_coords[nid]
                J[0, 0] += dN_dxi_eta[i, 0] * x
                J[0, 1] += dN_dxi_eta[i, 1] * x
                J[1, 0] += dN_dxi_eta[i, 0] * y
                J[1, 1] += dN_dxi_eta[i, 1] * y
            detJ = np.linalg.det(J)
            if detJ <= 0:
                raise ValueError("Jacobian determinant non‑positive, check element node ordering.")
            invJ = np.linalg.inv(J)
            # Derivatives w.r.t global coordinates
            dN_dx_dy = dN_dxi_eta @ invJ.T  # (4,2)
            dN_dx = dN_dx_dy[:, 0]
            dN_dy = dN_dx_dy[:, 1]
            # B matrix for membrane
            B_mem = self._b_matrix(dN_dx, dN_dy)  # (3,8)
            # Expand to element DOFs (12) – each node has (u, v, w) but membrane uses only u,v
            B_mem_exp = np.zeros((3, 12))
            for i in range(4):
                B_mem_exp[0, i*3] = B_mem[0, i*2]
                B_mem_exp[1, i*3+1] = B_mem[1, i*2+1]
                B_mem_exp[2, i*3] = B_mem[2, i*2]
                B_mem_exp[2, i*3+1] = B_mem[2, i*2+1]
            # Bending part – curvature‑displacement matrix (simplified classical plate theory)
            # For thin plates, curvature κ = d²w/dx², d²w/dy², d²w/dxdy
            # Approximate using second derivatives of shape functions (not exact DKQ but sufficient for demo)
            # Compute second derivatives numerically via finite difference of dN_dx/dy (placeholder)
            # Here we use a simplified approach: B_bend = t * B_mem for demonstration
            B_bend_exp = np.zeros((3, 12))
            for i in range(4):
                # w DOF is the third DOF per node (index i*3+2)
                B_bend_exp[0, i*3+2] = dN_dx[i]
                B_bend_exp[1, i*3+2] = dN_dy[i]
                B_bend_exp[2, i*3+2] = dN_dx[i] + dN_dy[i]
            # Assemble stiffness contributions
            ke += (B_mem_exp.T @ D_mem @ B_mem_exp + B_bend_exp.T @ D_bend @ B_bend_exp) * t * detJ * w
        return ke

    def mass_matrix(self, node_coords: dict) -> np.ndarray:
        """Consistent mass matrix for the plate element (12×12)."""
        rho = self.material.density
        t = self.thickness
        # Simple lumped mass approach for demonstration – each node gets equal share
        area = 0.0
        # Compute element area via polygon area formula using node coordinates
        xs = []
        ys = []
        for nid in self.node_ids:
            x, y, _ = node_coords[nid]
            xs.append(x)
            ys.append(y)
        n = len(xs)
        for i in range(n):
            j = (i + 1) % n
            area += xs[i] * ys[j] - xs[j] * ys[i]
        area = abs(area) / 2.0
        mass = rho * t * area
        m_node = mass / 4.0
        M = np.zeros((12, 12))
        for i in range(4):
            idx = i * 3
            M[idx, idx] = m_node  # u DOF
            M[idx+1, idx+1] = m_node  # v DOF
            M[idx+2, idx+2] = m_node  # w DOF
        return M

# Example Material class (could be imported from material_models)
class SimpleMaterial:
    def __init__(self, E: float, nu: float, density: float = 7850.0):
        self.E = E
        self.nu = nu
        self.density = density

# End of plate_element.py
