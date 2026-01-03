"""
Support Validator
Checks if structure has proper support conditions
"""

import numpy as np
from typing import Dict, List, Any
from . import BaseValidator


class SupportValidator(BaseValidator):
    """Validates support configuration for structural stability"""
    
    def __init__(self, nodes: List[Dict[str, Any]], members: List[Dict[str, Any]]):
        super().__init__()
        self.raw_nodes = nodes
        self.raw_members = members
        
        # Process elements and extract supports
        self._process_data()
        
    def _process_data(self):
        """Convert lists to dicts and extract supports"""
        self.nodes = {n.get('id', str(i)): n for i, n in enumerate(self.raw_nodes)}
        self.members = {m.get('id', str(i)): m for i, m in enumerate(self.raw_members)}
        self.supports = {}
        
        # Extract supports from nodes
        for node_id, node in self.nodes.items():
            if self._is_supported(node):
                # Standardize support format
                self.supports[node_id] = self._get_support_details(node)
    
    def _is_supported(self, node: Dict[str, Any]) -> bool:
        """Check if node has valid support definition"""
        support_type = str(node.get('support', '')).lower()
        if support_type in ['fixed', 'pinned', 'roller', 'pin', 'roller_x', 'roller_z']:
            return True
        
        restraints = node.get('restraints', {})
        return any(restraints.get(r, False) for r in ['fx', 'fy', 'fz', 'mx', 'my', 'mz'])

    def _get_support_details(self, node: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize support details"""
        support_type = str(node.get('support', '')).lower()
        restraints = [False] * 6 # tx, ty, tz, rx, ry, rz
        
        if support_type == 'fixed':
            restraints = [True] * 6
        elif support_type in ['pinned', 'pin']:
            restraints = [True, True, True, False, False, False]
        elif support_type == 'roller':
            restraints = [False, True, False, False, False, False] # Ty constrained
        elif support_type == 'roller_x':
            restraints = [True, False, False, False, False, False]
        elif support_type == 'roller_z':
            restraints = [False, False, True, False, False, False]
        else:
            # Custom restraints
            r = node.get('restraints', {})
            restraints = [
                bool(r.get('fx') or r.get('dx') or r.get('tx')),
                bool(r.get('fy') or r.get('dy') or r.get('ty')),
                bool(r.get('fz') or r.get('dz') or r.get('tz')),
                bool(r.get('mx') or r.get('rx')),
                bool(r.get('my') or r.get('ry')),
                bool(r.get('mz') or r.get('rz'))
            ]
            
        return {'restraints': restraints, 'type': support_type}
    
    def validate_all(self) -> bool:
        """Run all support validation checks"""
        self.check_has_supports()
        self.check_support_dof_count()
        self.check_unsupported_structure()
        self.check_cantilever_ends()
        return not self.has_errors()
    
    def check_has_supports(self) -> bool:
        """Check if structure has any supports at all"""
        if not self.supports or len(self.supports) == 0:
            self.add_error(
                code='SUP_001',
                message='No supports defined. Structure is completely free and unstable.',
                suggestion='Add at least one support with restrained degrees of freedom. Use fixed, pinned, or roller supports.',
                affected_elements=[]
            )
            return False
        
        # Check if any DOF is actually restrained
        any_restrained = False
        for node_id, support_data in self.supports.items():
            restraints = support_data.get('restraints', [False] * 6)
            if any(restraints):
                any_restrained = True
                break
        
        if not any_restrained:
            self.add_error(
                code='SUP_002',
                message='Supports exist but no degrees of freedom are restrained.',
                suggestion='Enable restraints (Tx, Ty, Tz, Rx, Ry, Rz) on at least one support.',
                affected_elements=list(self.supports.keys())
            )
            return False
        
        return True
    
    def check_support_dof_count(self) -> bool:
        """Verify structure has minimum required support DOF"""
        # Count restrained DOF across all supports
        restrained_dof = {
            'tx': 0, 'ty': 0, 'tz': 0,
            'rx': 0, 'ry': 0, 'rz': 0
        }
        
        for node_id, support_data in self.supports.items():
            restraints = support_data.get('restraints', [False] * 6)
            dof_names = ['tx', 'ty', 'tz', 'rx', 'ry', 'rz']
            
            for i, is_restrained in enumerate(restraints):
                if is_restrained and i < len(dof_names):
                    restrained_dof[dof_names[i]] += 1
        
        # For 3D structure, need minimum restraints
        # At least 3 translational DOF should be restrained somewhere
        translation_count = sum(1 for dof in ['tx', 'ty', 'tz'] if restrained_dof[dof] > 0)
        
        if translation_count < 3:
            missing = [dof.upper() for dof in ['tx', 'ty', 'tz'] if restrained_dof[dof] == 0]
            self.add_error(
                code='SUP_003',
                message=f'Insufficient support conditions. Only {translation_count}/3 translation DOF restrained. Missing: {", ".join(missing)}',
                suggestion='Add supports to restrain all 3 translational directions (X, Y, Z). Minimum: 3 DOF for 2D, 6 DOF for 3D structures.',
                affected_elements=list(self.supports.keys())
            )
            return False
        
        # Check for potential instability (too few total restraints)
        total_restrained = sum(1 for count in restrained_dof.values() if count > 0)
        
        if total_restrained < 3:
            self.add_warning(
                code='SUP_004',
                message=f'Very few DOF restrained ({total_restrained}). Structure may be unstable for certain load cases.',
                suggestion='Consider adding more support restraints or checking if supports are correctly defined.',
                affected_elements=list(self.supports.keys())
            )
        
        return True
    
    def check_unsupported_structure(self) -> bool:
        """Check if structure can move rigidly (mechanism)"""
        # This is a simplified check - full rigid body mode analysis is complex
        # We check if there are enough restraints to prevent rigid body motion
        
        support_nodes = set(self.supports.keys())
        
        if len(support_nodes) == 1:
            # Single support point - need to be fully fixed
            node_id = list(support_nodes)[0]
            support_data = self.supports[node_id]
            restraints = support_data.get('restraints', [False] * 6)
            
            if sum(restraints) < 6:
                self.add_warning(
                    code='SUP_005',
                    message='Only one support point. Should be fully fixed (all 6 DOF) to prevent rotation.',
                    suggestion='For single support, enable all restraints (Tx, Ty, Tz, Rx, Ry, Rz) or add additional supports.',
                    affected_elements=[node_id]
                )
        
        return True
    
    def check_cantilever_ends(self) -> bool:
        """Warn about cantilever ends (single-member connection points)"""
        # Build connectivity map
        node_connections = {node_id: [] for node_id in self.nodes.keys()}
        
        for member_id, member_data in self.members.items():
            start_id = member_data.get('startNode')
            end_id = member_data.get('endNode')
            
            if start_id and start_id in node_connections:
                node_connections[start_id].append(member_id)
            if end_id and end_id in node_connections:
                node_connections[end_id].append(member_id)
        
        # Find nodes with only 1 connection and no support
        cantilever_ends = []
        for node_id, connected_members in node_connections.items():
            if len(connected_members) == 1 and node_id not in self.supports:
                cantilever_ends.append(node_id)
        
        if cantilever_ends:
            self.add_info(
                code='SUP_006',
                message=f'Found {len(cantilever_ends)} unsupported cantilever end(s).',
                suggestion='Cantilever ends are acceptable if intentional. Verify loads at these points are correct.',
                affected_elements=cantilever_ends[:5]  # Show first 5
            )
        
        return True
    
    def get_support_summary(self) -> Dict[str, Any]:
        """Get summary of support conditions"""
        if not self.supports:
            return {'num_supports': 0, 'total_restraints': 0}
        
        total_restraints = 0
        support_types = {'fixed': 0, 'pinned': 0, 'roller': 0, 'custom': 0}
        
        for node_id, support_data in self.supports.items():
            restraints = support_data.get('restraints', [False] * 6)
            num_restrained = sum(restraints)
            total_restraints += num_restrained
            
            # Classify support type
            if num_restrained == 6:
                support_types['fixed'] += 1
            elif num_restrained == 3 and restraints[0] and restraints[1] and restraints[2]:
                support_types['pinned'] += 1
            elif num_restrained == 1:
                support_types['roller'] += 1
            else:
                support_types['custom'] += 1
        
        return {
            'num_supports': len(self.supports),
            'total_restraints': total_restraints,
            'support_types': support_types
        }
