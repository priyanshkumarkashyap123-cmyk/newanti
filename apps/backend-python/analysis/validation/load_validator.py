"""
Load Validator
Checks if loads are properly defined and reasonable
"""

import numpy as np
from typing import Dict, List, Any
from . import BaseValidator


class LoadValidator(BaseValidator):
    """Validates load application and magnitude"""
    
    def __init__(self, nodes: Dict[str, Any], members: Dict[str, Any], node_loads: List[Dict[str, Any]], distributed_loads: List[Dict[str, Any]] = None):
        super().__init__()
        self.nodes = nodes
        self.members = members
        self.raw_node_loads = node_loads
        self.raw_distributed_loads = distributed_loads or []
        
        # Convert list format to internal dict format for validation
        self._process_loads()
    
    def _process_loads(self):
        """Convert raw load lists to internal dictionary format"""
        self.loads = {}
        
        # Process node loads
        for load in self.raw_node_loads:
            node_id = load.get('nodeId') or load.get('node_id')
            if not node_id:
                continue
                
            if node_id not in self.loads:
                self.loads[node_id] = {'forces': [0.0, 0.0, 0.0], 'moments': [0.0, 0.0, 0.0]}
            
            # Add forces
            self.loads[node_id]['forces'][0] += float(load.get('fx', 0))
            self.loads[node_id]['forces'][1] += float(load.get('fy', 0))
            self.loads[node_id]['forces'][2] += float(load.get('fz', 0))
            
            # Add moments
            self.loads[node_id]['moments'][0] += float(load.get('mx', 0))
            self.loads[node_id]['moments'][1] += float(load.get('my', 0))
            self.loads[node_id]['moments'][2] += float(load.get('mz', 0))

    def validate_all(self) -> bool:
        """Run all load validation checks"""
        self.check_has_loads()
        self.check_load_magnitudes()
        self.check_loads_on_existing_nodes()
        self.check_very_large_loads()
        return not self.has_errors()
    
    def check_has_loads(self) -> bool:
        """Check if structure has any loads"""
        if not self.loads or len(self.loads) == 0:
            self.add_warning(
                code='LOAD_001',
                message='No loads defined on structure.',
                suggestion='Add point loads, distributed loads, or moments to analyze structure behavior. Unloaded structures will have zero forces.',
                affected_elements=[]
            )
            return True  # Not an error, just a warning
        
        # Check if any non-zero loads exist
        has_nonzero = False
        for node_id, load_data in self.loads.items():
            forces = load_data.get('forces', [0, 0, 0])
            moments = load_data.get('moments', [0, 0, 0])
            
            if any(abs(f) > 1e-10 for f in forces) or any(abs(m) > 1e-10 for m in moments):
                has_nonzero = True
                break
        
        if not has_nonzero:
            self.add_warning(
                code='LOAD_002',
                message='Loads exist but all are zero magnitude.',
                suggestion='Set non-zero force or moment values. Zero loads will result in zero deflections and forces.',
                affected_elements=list(self.loads.keys())
            )
        
        return True
    
    def check_load_magnitudes(self) -> bool:
        """Check for very small loads that might be numerical noise"""
        small_loads = []
        
        for node_id, load_data in self.loads.items():
            forces = load_data.get('forces', [0, 0, 0])
            moments = load_data.get('moments', [0, 0, 0])
            
            force_mag = np.linalg.norm(forces)
            moment_mag = np.linalg.norm(moments)
            
            # Check for very small but non-zero loads (might be noise)
            if 0 < force_mag < 1e-6:
                small_loads.append((node_id, 'force', force_mag))
            if 0 < moment_mag < 1e-6:
                small_loads.append((node_id, 'moment', moment_mag))
        
        if small_loads:
            affected = [f"{s[0]} ({s[1]})" for s in small_loads[:3]]
            self.add_warning(
                code='LOAD_003',
                message=f'Found {len(small_loads)} very small load(s) (< 1e-6). May be numerical noise.',
                suggestion='Review load magnitudes. Very small loads might be data entry errors or unit conversion issues.',
                affected_elements=affected
            )
        
        return True
    
    def check_loads_on_existing_nodes(self) -> bool:
        """Check if loads are applied to nodes that exist"""
        invalid_nodes = []
        
        for node_id in self.loads.keys():
            if node_id not in self.nodes:
                invalid_nodes.append(node_id)
        
        if invalid_nodes:
            self.add_error(
                code='LOAD_004',
                message=f'Found {len(invalid_nodes)} load(s) on non-existent nodes.',
                suggestion='Remove loads from deleted nodes or create missing nodes. Loads can only be applied to existing nodes.',
                affected_elements=invalid_nodes
            )
            return False
        
        return True
    
    def check_very_large_loads(self) -> bool:
        """Warn about unusually large loads that might indicate unit errors"""
        large_loads = []
        
        for node_id, load_data in self.loads.items():
            forces = load_data.get('forces', [0, 0, 0])
            moments = load_data.get('moments', [0, 0, 0])
            
            force_mag = np.linalg.norm(forces)
            moment_mag = np.linalg.norm(moments)
            
            # Check for very large loads (might be unit conversion error)
            # These thresholds are arbitrary but catch common mistakes
            if force_mag > 1e6:  # > 1,000 kN
                large_loads.append((node_id, 'force', force_mag, 'kN'))
            if moment_mag > 1e7:  # > 10,000 kN⋅m
                large_loads.append((node_id, 'moment', moment_mag, 'kN⋅m'))
        
        if large_loads:
            affected = [f"{l[0]} ({l[2]:.0f} {l[3]})" for l in large_loads[:3]]
            self.add_warning(
                code='LOAD_005',
                message=f'Found {len(large_loads)} very large load(s). Please verify units.',
                suggestion='Check if units are correct (N vs kN, mm vs m). Large loads may cause numerical issues or indicate data entry errors.',
                affected_elements=affected
            )
        
        return True
    
    def get_load_summary(self) -> Dict[str, Any]:
        """Get summary of applied loads"""
        if not self.loads:
            return {
                'num_loads': 0,
                'total_force': 0.0,
                'total_moment': 0.0,
                'max_force': 0.0,
                'max_moment': 0.0
            }
        
        total_force = np.zeros(3)
        total_moment = np.zeros(3)
        max_force_mag = 0.0
        max_moment_mag = 0.0
        
        for node_id, load_data in self.loads.items():
            forces = np.array(load_data.get('forces', [0, 0, 0]))
            moments = np.array(load_data.get('moments', [0, 0, 0]))
            
            total_force += forces
            total_moment += moments
            
            force_mag = np.linalg.norm(forces)
            moment_mag = np.linalg.norm(moments)
            
            max_force_mag = max(max_force_mag, force_mag)
            max_moment_mag = max(max_moment_mag, moment_mag)
        
        return {
            'num_loads': len(self.loads),
            'total_force_magnitude': float(np.linalg.norm(total_force)),
            'total_moment_magnitude': float(np.linalg.norm(total_moment)),
            'max_force_magnitude': float(max_force_mag),
            'max_moment_magnitude': float(max_moment_mag),
            'total_force_vector': total_force.tolist(),
            'total_moment_vector': total_moment.tolist()
        }
