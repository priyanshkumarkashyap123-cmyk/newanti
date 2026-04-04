"""
Geometry Validator
Checks structural geometry for common issues that cause analysis failures
"""

import numpy as np
from typing import Dict, List, Tuple, Any
from . import BaseValidator


class GeometryValidator(BaseValidator):
    """Validates structural geometry before analysis"""
    
    def __init__(self, nodes: List[Dict[str, Any]], members: List[Dict[str, Any]], tolerance: float = 1e-6):
        super().__init__()
        self.raw_nodes = nodes
        self.raw_members = members
        self.tolerance = tolerance
        
        # Convert to dicts for validation
        self._process_elements()

    def _process_elements(self):
        """Convert raw lists to internal dictionary format"""
        self.nodes = {n.get('id', str(i)): n for i, n in enumerate(self.raw_nodes)}
        self.members = {m.get('id', str(i)): m for i, m in enumerate(self.raw_members)}
    
    def validate_all(self) -> bool:
        """Run all geometry validation checks"""
        self.check_duplicate_nodes()
        self.check_zero_length_members()
        self.check_very_small_members()
        self.check_collinear_nodes()
        return not self.has_errors()
    
    def check_duplicate_nodes(self) -> bool:
        """Detect nodes at same location"""
        node_coords = {}
        duplicates = []
        
        for node_id, node_data in self.nodes.items():
            # Use x/y/z fields directly instead of 'position' array
            coords = (
                float(node_data.get('x', 0)),
                float(node_data.get('y', 0)),
                float(node_data.get('z', 0))
            )
            
            # Check against existing coords
            for existing_id, existing_coords in node_coords.items():
                if np.allclose(coords, existing_coords, atol=self.tolerance):
                    duplicates.append((node_id, existing_id, coords))
                    break
            else:
                node_coords[node_id] = coords
        
        if duplicates:
            affected = [f"{d[0]}, {d[1]}" for d in duplicates[:3]]  # Show first 3
            self.add_warning(
                code='GEO_001',
                message=f'Found {len(duplicates)} duplicate node(s) at same location',
                suggestion='Merge duplicate nodes or increase coordinate tolerance. This may cause numerical instability.',
                affected_elements=affected
            )
            return False
        return True
    
    def check_zero_length_members(self) -> bool:
        """Detect members with zero or near-zero length"""
        zero_length = []
        
        for member_id, member_data in self.members.items():
            # Support both naming conventions: camelCase frontend format and snake_case
            start_id = member_data.get('startNodeId') or member_data.get('startNode') or member_data.get('start_node_id')
            end_id = member_data.get('endNodeId') or member_data.get('endNode') or member_data.get('end_node_id')
            
            if not start_id or not end_id:
                continue
            
            start_node = self.nodes.get(start_id, {})
            end_node = self.nodes.get(end_id, {})
            
            start_pos = np.array([
                float(start_node.get('x', 0)),
                float(start_node.get('y', 0)),
                float(start_node.get('z', 0))
            ])
            end_pos = np.array([
                float(end_node.get('x', 0)),
                float(end_node.get('y', 0)),
                float(end_node.get('z', 0))
            ])
            
            length = np.linalg.norm(end_pos - start_pos)
            
            if length < self.tolerance:
                zero_length.append((member_id, length))
        
        if zero_length:
            affected = [z[0] for z in zero_length]
            self.add_error(
                code='GEO_002',
                message=f'Found {len(zero_length)} zero-length member(s). Analysis will fail.',
                suggestion='Delete zero-length members or move nodes to different locations. Members must have length > 0.',
                affected_elements=affected
            )
            return False
        return True
    
    def check_very_small_members(self) -> bool:
        """Detect members much smaller than others (may cause numerical issues)"""
        lengths = []
        
        for member_id, member_data in self.members.items():
            start_id = member_data.get('startNodeId') or member_data.get('startNode') or member_data.get('start_node_id')
            end_id = member_data.get('endNodeId') or member_data.get('endNode') or member_data.get('end_node_id')
            
            if not start_id or not end_id:
                continue
            
            start_node = self.nodes.get(start_id, {})
            end_node = self.nodes.get(end_id, {})
            
            start_pos = np.array([
                float(start_node.get('x', 0)),
                float(start_node.get('y', 0)),
                float(start_node.get('z', 0))
            ])
            end_pos = np.array([
                float(end_node.get('x', 0)),
                float(end_node.get('y', 0)),
                float(end_node.get('z', 0))
            ])
            
            length = np.linalg.norm(end_pos - start_pos)
            if length > self.tolerance:
                lengths.append((member_id, length))
        
        if not lengths:
            return True
        
        avg_length = np.mean([l[1] for l in lengths])
        max_length = np.max([l[1] for l in lengths])
        
        small_members = [(mid, l) for mid, l in lengths if l < 0.01 * avg_length and avg_length > 0]
        
        if small_members and avg_length > 0:
            affected = [f"{s[0]} ({s[1]:.4f}m)" for s in small_members[:3]]
            self.add_warning(
                code='GEO_003',
                message=f'Found {len(small_members)} very small member(s) compared to average ({avg_length:.2f}m)',
                suggestion=f'Members smaller than 1% of average may cause numerical instability. Consider increasing member size or using consistent units.',
                affected_elements=affected
            )
        
        return True
    
    def check_collinear_nodes(self) -> bool:
        """Check for three or more collinear nodes (may indicate modeling issue)"""
        # This is more advanced - skip for now as it's computationally expensive
        # and less critical than other checks
        return True
    
    def get_model_statistics(self) -> Dict[str, Any]:
        """Get statistics about the model"""
        if not self.members:
            return {}
        
        lengths = []
        for member_id, member_data in self.members.items():
            start_id = member_data.get('startNodeId') or member_data.get('startNode') or member_data.get('start_node_id')
            end_id = member_data.get('endNodeId') or member_data.get('endNode') or member_data.get('end_node_id')
            
            if not start_id or not end_id:
                continue
            
            start_node = self.nodes.get(start_id, {})
            end_node = self.nodes.get(end_id, {})
            
            start_pos = np.array([
                float(start_node.get('x', 0)),
                float(start_node.get('y', 0)),
                float(start_node.get('z', 0))
            ])
            end_pos = np.array([
                float(end_node.get('x', 0)),
                float(end_node.get('y', 0)),
                float(end_node.get('z', 0))
            ])
            
            length = np.linalg.norm(end_pos - start_pos)
            if length > self.tolerance:
                lengths.append(length)
        
        if not lengths:
            return {}
        
        return {
            'num_nodes': len(self.nodes),
            'num_members': len(self.members),
            'avg_member_length': float(np.mean(lengths)),
            'min_member_length': float(np.min(lengths)),
            'max_member_length': float(np.max(lengths)),
            'total_length': float(np.sum(lengths))
        }
