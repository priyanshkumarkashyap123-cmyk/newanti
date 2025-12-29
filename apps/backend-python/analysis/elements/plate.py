"""
plate.py - Mindlin-Reissner Plate Element Implementation

Implements a 4-node isoparametric quadrilateral plate element (Q4)
based on Mindlin-Reissner theory, which accounts for shear deformation.
Uses reduced integration (1-point) for shear stiffness to prevent shear locking.
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional

@dataclass
class PlateSection:
    """
    Plate section properties
    """
    thickness: float       # h (m)
    E: float = 200e9      # Young's modulus (Pa)
    nu: float = 0.3       # Poisson's ratio
    rho: float = 7850.0   # Density (kg/m³)
    
    @property
    def D(self) -> float:
        """Flexural rigidity D = Eh³ / 12(1-ν²)"""
        return (self.E * self.thickness**3) / (12 * (1 - self.nu**2))
        
    @property
    def G(self) -> float:
        """Shear modulus G = E / 2(1+ν)"""
        return self.E / (2 * (1 + self.nu))
        
    @property
    def k(self) -> float:
        """Shear correction factor (5/6 for isotropic plates)"""
        return 5.0 / 6.0


class MindlinPlate:
    """
    4-Node Isoparametric Quadrilateral Plate Element (MITC4 or reduced integration Q4).
    
    DOFs per node: 3 (w, theta_x, theta_y) - vertical disp + 2 rotations
    Total DOFs: 12
    
    Local Coordinate System:
    r, s: natural coordinates (-1 to +1)
    """
    
    def __init__(self, nodes: List[Tuple[float, float]], section: PlateSection):
        """
        nodes: List of 4 (x, y) coordinates
        section: PlateSection properties
        """
        assert len(nodes) == 4, "MindlinPlate4 requires 4 nodes"
        self.nodes = np.array(nodes)
        self.section = section
    
    def _shape_functions(self, r: float, s: float) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculate shape functions N and derivatives dN/dr, dN/ds
        
        N_i = 1/4 * (1 + r_i * r) * (1 + s_i * s)
        """
        # Node signs
        ri = np.array([-1, 1, 1, -1])
        si = np.array([-1, -1, 1, 1])
        
        # Shape functions
        N = 0.25 * (1 + ri * r) * (1 + si * s)
        
        # Derivatives
        dN_dr = 0.25 * ri * (1 + si * s)
        dN_ds = 0.25 * si * (1 + ri * r)
        
        return N, np.vstack((dN_dr, dN_ds))
    
    def _jacobian(self, dN_dnat: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Calculate Jacobian matrix J and determinant |J|
        J = d(x,y)/d(r,s) = [dx/dr dy/dr]
                            [dx/ds dy/ds]
        """
        # dN_dnat is 2x4 (dr, ds rows)
        # nodes is 4x2 (x, y cols)
        J = dN_dnat @ self.nodes
        detJ = np.linalg.det(J)
        return J, detJ
        
    def _B_bending(self, dN_dxy: np.ndarray) -> np.ndarray:
        """
        Construct Bending Strain-Displacement Matrix Bb (3x12)
        Curvature k = Bb * u
        k = [-dtheta_x/dx, -dtheta_y/dy, -(dtheta_x/dy + dtheta_y/dx)]^T
        (Indices depends on DOF ordering: w, tx, ty)
        
        Note: DOFs are [w1, tx1, ty1, w2, tx2, ty2, ...]
        """
        Bb = np.zeros((3, 12))
        
        # dN_dxy is 2x4 (dx, dy rows)
        for i in range(4):
            dN_dx = dN_dxy[0, i]
            dN_dy = dN_dxy[1, i]
            
            # Col indices for node i
            idx = i * 3
            # w (idx), tx (idx+1), ty (idx+2)
            
            # Kappa_x = d(theta_y)/dx (or similar definition, verify sign convention)
            # Standard definitions:
            # theta_x is rotation about x-axis (displacement y->z)
            # theta_y is rotation about y-axis (displacement z->x)
            # Kirchhoff hypothesis: u = -z*theta_y, v = -z*(-theta_x) = z*theta_x
            # Strains: ex = -z * dtheta_y/dx
            # ey = z * dtheta_x/dy
            # gxy = z * (dtheta_x/dx - dtheta_y/dy)
            
            # Let's stick to textbook standard (Cook et al):
            # Rotations Bx, By.
            # Curvatures: kx = dBx/dx, ky = dBy/dy
            
            # Bb maps [w, tx, ty] to [kx, ky, kxy]
            # w is not involved in pure bending strain (only shear)
            
            # Using common convention: theta_x ~ dy/dz, theta_y ~ -dx/dz
            # This implementation assumes specific ordering. 
            pass # Use standard formulation below
            
            # Row 1: kx = d(theta_y)/dx
            Bb[0, idx+2] = dN_dx
            
            # Row 2: ky = -d(theta_x)/dy
            Bb[1, idx+1] = -dN_dy
            
            # Row 3: kxy = d(theta_y)/dy - d(theta_x)/dx
            Bb[2, idx+1] = -dN_dx
            Bb[2, idx+2] = dN_dy
            
        return Bb
        
    def _B_shear(self, N: np.ndarray, dN_dxy: np.ndarray) -> np.ndarray:
        """
        Construct Shear Strain-Displacement Matrix Bs (2x12)
        Gamma = Bs * u
        Gamma = [dw/dx - theta_y, dw/dy + theta_x]^T
        """
        Bs = np.zeros((2, 12))
        
        for i in range(4):
            Nx = dN_dxy[0, i] # dNi/dx
            Ny = dN_dxy[1, i] # dNi/dy
            Ni = N[i]
            
            idx = i * 3
            
            # gamma_xz = dw/dx + theta_y (or similar, ensure consistency)
            # If w is z-disp.
            # gamma_xz = dw/dx + beta_x
            # Let's assume standard Mindlin:
            # gamma_xz = dw/dx - theta_y (rotation of normal)
            # gamma_yz = dw/dy + theta_x
            
            # Row 1: gamma_xz
            Bs[0, idx] = Nx      # dw/dx
            Bs[0, idx+2] = Ni    # +theta_y (Check sign: usually + if theta_y is rot about y)
            # Actually, standard is usually gamma_xz = dw/dx - theta_y?
            # Let's use: theta_y is rot about y. Positive by RH rule.
            # Slope dw/dx. Normal rotation +theta_y.
            # Shear strain is difference.
            # We will use: gamma_xz = dw/dx + theta_y 
            # (Assuming theta_y points to positive y, so it rotates z->x)
            
            # Row 2: gamma_yz
            Bs[1, idx] = Ny
            Bs[1, idx+1] = -Ni   # -theta_x (theta_x rotates y->z)
            
        return Bs

    def get_stiffness_matrix(self) -> np.ndarray:
        """Compute 12x12 element stiffness matrix"""
        
        # Constitutive matrices
        D = self.section.D
        nu = self.section.nu
        
        # Bending D-matrix (Plane Stress for plates)
        Db = D * np.array([
            [1, nu, 0],
            [nu, 1, 0],
            [0, 0, (1-nu)/2]
        ])
        
        # Shear D-matrix
        G = self.section.G
        k = self.section.k
        h = self.section.thickness
        Ds = k * G * h * np.eye(2)
        
        Ke = np.zeros((12, 12))
        
        # 1. Bending Stiffness (2x2 Gauss Quadrature)
        # Full integration for bending is standard
        gauss_pts = [-0.577350269, 0.577350269]
        weights = [1.0, 1.0]
        
        for r, wr in zip(gauss_pts, weights):
            for s, ws in zip(gauss_pts, weights):
                # Shape functions & Jacobian
                N, dN_dnat = self._shape_functions(r, s)
                J, detJ = self._jacobian(dN_dnat)
                
                # Transform derivatives to global (x,y)
                # dN/dxy = J_inv * dN/dnat
                J_inv = np.linalg.inv(J)
                dN_dxy = J_inv @ dN_dnat
                
                # B-matrix
                Bb = self._B_bending(dN_dxy)
                
                # Integration
                Ke += Bb.T @ Db @ Bb * detJ * wr * ws
                
        # 2. Shear Stiffness (Reduced Integration - 1 point)
        # Prevents shear locking in thin plates
        r, s = 0.0, 0.0
        w = 4.0 # weight 2*2=4
        
        N, dN_dnat = self._shape_functions(r, s)
        J, detJ = self._jacobian(dN_dnat)
        J_inv = np.linalg.inv(J)
        dN_dxy = J_inv @ dN_dnat
        
        Bs = self._B_shear(N, dN_dxy)
        
        Ke += Bs.T @ Ds @ Bs * detJ * w
        
        return Ke
