"""
Mass Matrix Construction

Builds lumped and consistent mass matrices from structural models.

Unit conventions:
    Mass: kg
    Cross-section area: m²
    Density: kg/m³
    Length: m
"""
import math
from typing import Dict, List
import numpy as np


class MassMatrixBuilder:
    """
    Builds lumped and consistent mass matrices
    """
    
    @staticmethod
    def build_lumped_mass_matrix(
        nodes: Dict[str, dict],
        nodal_masses: Dict[str, float],
        dof_per_node: int = 6
    ) -> np.ndarray:
        """
        Build lumped mass matrix from nodal masses
        
        Args:
            nodes: Node dictionary with DOF indices
            nodal_masses: Mass at each node (node_id -> mass in kg)
            dof_per_node: DOFs per node (default 6)
        
        Returns:
            Lumped mass matrix (n_dof x n_dof)
        """
        n_dof = len(nodes) * dof_per_node
        M = np.zeros((n_dof, n_dof))
        
        for node_id, node in nodes.items():
            mass = nodal_masses.get(node_id, 0)
            dof_indices = node.get('dof_indices', [])
            
            if len(dof_indices) >= 3:
                # Translational mass
                M[dof_indices[0], dof_indices[0]] = mass
                M[dof_indices[1], dof_indices[1]] = mass
                M[dof_indices[2], dof_indices[2]] = mass
                
            if len(dof_indices) >= 6:
                # Rotational inertia (approximate as small fraction of mass)
                rot_inertia = mass * 0.01  # Approximate
                M[dof_indices[3], dof_indices[3]] = rot_inertia
                M[dof_indices[4], dof_indices[4]] = rot_inertia
                M[dof_indices[5], dof_indices[5]] = rot_inertia
        
        return M
    
    @staticmethod
    def build_consistent_mass_matrix(
        members: List[dict],
        nodes: Dict[str, dict],
        density: float = 7850  # Steel kg/m³
    ) -> np.ndarray:
        """
        Build consistent mass matrix from member properties
        
        Args:
            members: List of member dictionaries
            nodes: Node dictionary
            density: Material density (kg/m³)
        
        Returns:
            Consistent mass matrix (n_dof x n_dof)
        """
        n_nodes = len(nodes)
        n_dof = n_nodes * 6
        M = np.zeros((n_dof, n_dof))
        
        for member in members:
            start = nodes[member['start_node_id']]
            end = nodes[member['end_node_id']]
            
            # Calculate length
            dx = end['x'] - start['x']
            dy = end['y'] - start['y']
            dz = end['z'] - start['z']
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            
            A = member.get('A', 0.01)
            m_total = density * A * L  # Total member mass
            m = m_total / 2  # Mass per node (simplified)
            
            # Add to diagonal (lumped approach for simplicity)
            for node_data in [start, end]:
                dof = node_data.get('dof_indices', [])
                if len(dof) >= 3:
                    M[dof[0], dof[0]] += m
                    M[dof[1], dof[1]] += m
                    M[dof[2], dof[2]] += m
        
        return M
    
    @staticmethod
    def add_mass_source(
        M: np.ndarray,
        load_factor: float,
        loads: List[dict],
        nodes: Dict[str, dict],
        g: float = 9.81
    ) -> np.ndarray:
        """
        Add mass from loads (dead + live load percentage)
        
        Args:
            M: Existing mass matrix
            load_factor: Factor to apply (1.0 for DL, 0.25-0.5 for LL)
            loads: List of nodal loads
            nodes: Node dictionary
            g: Gravity acceleration (m/s²)
        
        Returns:
            Updated mass matrix
        """
        for load in loads:
            node_id = load.get('node_id')
            fy = abs(load.get('fy', 0))  # Vertical load
            
            if node_id in nodes and fy > 0:
                mass = (fy * load_factor) / g
                dof = nodes[node_id].get('dof_indices', [])
                
                if len(dof) >= 3:
                    M[dof[0], dof[0]] += mass
                    M[dof[1], dof[1]] += mass
                    M[dof[2], dof[2]] += mass
        
        return M


__all__ = [
    "MassMatrixBuilder",
]
