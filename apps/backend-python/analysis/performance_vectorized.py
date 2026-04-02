"""Vectorized numerical operations for performance-sensitive analysis paths."""

from __future__ import annotations

from typing import Tuple

import numpy as np


class VectorizedOperations:
    """Vectorized NumPy operations for performance."""

    @staticmethod
    def vectorized_von_mises(
        sigma_x: np.ndarray,
        sigma_y: np.ndarray,
        sigma_z: np.ndarray,
        tau_xy: np.ndarray,
        tau_yz: np.ndarray,
        tau_zx: np.ndarray,
    ) -> np.ndarray:
        """Vectorized Von Mises stress calculation."""
        diff_xy = sigma_x - sigma_y
        diff_yz = sigma_y - sigma_z
        diff_zx = sigma_z - sigma_x

        sq_diff = diff_xy**2 + diff_yz**2 + diff_zx**2
        sq_shear = tau_xy**2 + tau_yz**2 + tau_zx**2

        return np.sqrt(0.5 * sq_diff + 3.0 * sq_shear)

    @staticmethod
    def vectorized_principal_stresses_2d(
        sigma_x: np.ndarray,
        sigma_y: np.ndarray,
        tau_xy: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Vectorized principal stress calculation (2D plane stress)."""
        sigma_avg = (sigma_x + sigma_y) / 2.0
        radius = np.sqrt(((sigma_x - sigma_y) / 2.0) ** 2 + tau_xy**2)
        sigma_1 = sigma_avg + radius
        sigma_3 = sigma_avg - radius
        return sigma_1, sigma_3

    @staticmethod
    def vectorized_newmark_step(
        u: np.ndarray,
        v: np.ndarray,
        a: np.ndarray,
        K_eff: np.ndarray,
        f_ext: float,
        dt: float,
        sparse_solve,
        beta: float = 0.25,
        gamma: float = 0.5,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Vectorized Newmark-beta time integration step."""
        u_pred = u + dt * v + (0.5 - beta) * dt**2 * a
        v_pred = v + (1.0 - gamma) * dt * a

        f_eff = f_ext
        a_new = sparse_solve(K_eff, f_eff)

        u_new = u_pred + beta * dt**2 * a_new
        v_new = v_pred + gamma * dt * a_new
        return u_new, v_new, a_new


__all__ = ["VectorizedOperations"]
