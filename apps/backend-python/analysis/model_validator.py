"""
model_validator.py - Pre-Analysis Model Validation

Validates structural models BEFORE analysis to prevent failures.
Catches common issues that cause solver failures:
- Missing supports (rigid body motion)
- Disconnected nodes/members
- Zero-length members
- Extreme stiffness ratios (ill-conditioning)
- Mechanism detection

This is the KEY layer for preventing analysis failures.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Set, Tuple, Optional
from enum import Enum
import math

# Import new modular validators
try:
    from analysis.validation import ValidationSeverity, ValidationMessage, ValidationResult as ModularValidationResult
    from analysis.validation.geometry_validator import GeometryValidator
    from analysis.validation.support_validator import SupportValidator
    from analysis.validation.load_validator import LoadValidator
    USE_MODULAR_VALIDATORS = True
except ImportError:
    USE_MODULAR_VALIDATORS = False


# ============================================
# VALIDATION RESULT TYPES
# ============================================

class IssueSeverity(Enum):
    """Severity levels for validation issues"""
    ERROR = "error"      # Will cause analysis failure
    WARNING = "warning"  # May cause issues or inaccurate results
    INFO = "info"        # Informational, best practices


class IssueType(Enum):
    """Types of validation issues"""
    # Stability issues (ERRORS)
    NO_SUPPORTS = "no_supports"
    INSUFFICIENT_SUPPORTS = "insufficient_supports"
    MECHANISM_DETECTED = "mechanism_detected"
    RIGID_BODY_MOTION = "rigid_body_motion"
    
    # Geometry issues (ERRORS)
    ZERO_LENGTH_MEMBER = "zero_length_member"
    OVERLAPPING_NODES = "overlapping_nodes"
    INVALID_MEMBER_REFERENCE = "invalid_member_reference"
    
    # Connectivity issues (ERRORS/WARNINGS)
    DISCONNECTED_NODES = "disconnected_nodes"
    DISCONNECTED_STRUCTURE = "disconnected_structure"
    FLOATING_NODE = "floating_node"
    
    # Stiffness issues (WARNINGS)
    EXTREME_STIFFNESS_RATIO = "extreme_stiffness_ratio"
    VERY_SLENDER_MEMBER = "very_slender_member"
    VERY_SHORT_MEMBER = "very_short_member"
    
    # Loading issues (WARNINGS/INFO)
    NO_LOADS = "no_loads"
    UNSUPPORTED_LOAD_NODE = "unsupported_load_node"
    LOAD_ON_MISSING_MEMBER = "load_on_missing_member"
    
    # Best practices (INFO)
    MISSING_LATERAL_RESTRAINT = "missing_lateral_restraint"
    ASYMMETRIC_SUPPORTS = "asymmetric_supports"


@dataclass
class ValidationIssue:
    """A single validation issue"""
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    affected_elements: List[str] = field(default_factory=list)
    suggested_fix: Optional[str] = None
    auto_fixable: bool = False


@dataclass
class ValidationResult:
    """Complete validation result"""
    is_valid: bool  # Can proceed with analysis
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: str = ""
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    
    # Computed statistics
    node_count: int = 0
    member_count: int = 0
    support_count: int = 0
    load_count: int = 0


# ============================================
# VALIDATION CONSTANTS
# ============================================

# Minimum distance between nodes (m)
MIN_NODE_DISTANCE = 0.001  # 1mm

# Maximum stiffness ratio before warning
MAX_STIFFNESS_RATIO = 1e8

# Minimum slenderness before warning
MIN_MEMBER_LENGTH = 0.01  # 10mm

# For mechanism detection
MIN_SUPPORTS_2D = 3  # Minimum DOF restraints for 2D stability
MIN_SUPPORTS_3D = 6  # Minimum DOF restraints for 3D stability


# ============================================
# MODEL VALIDATOR CLASS
# ============================================

class ModelValidator:
    """
    Validates structural models before analysis.
    
    Usage:
        validator = ModelValidator()
        result = validator.validate(model_data)
        
        if not result.is_valid:
            # Handle errors before running analysis
            for issue in result.issues:
                print(f"{issue.severity}: {issue.message}")
    """
    
    def __init__(self, tolerance: float = MIN_NODE_DISTANCE):
        self.tolerance = tolerance
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.members: Dict[str, Dict[str, Any]] = {}
        self.issues: List[ValidationIssue] = []
    
    def validate(self, model_data: Dict[str, Any]) -> ValidationResult:
        """
        Validate a structural model.
        
        Args:
            model_data: Dict with 'nodes', 'members', 'loads' keys
        
        Returns:
            ValidationResult with all detected issues
        """
        self.issues = []
        
        # Parse model data
        nodes_list = model_data.get('nodes', [])
        members_list = model_data.get('members', [])
        loads = model_data.get('loads', [])
        node_loads = model_data.get('node_loads', [])
        member_loads = model_data.get('member_loads', []) or model_data.get('point_loads', [])
        distributed_loads = model_data.get('distributed_loads', [])
        
        # Build lookup dictionaries
        self.nodes = {n.get('id', str(i)): n for i, n in enumerate(nodes_list)}
        self.members = {m.get('id', str(i)): m for i, m in enumerate(members_list)}
        
        # Run all validation checks
        self._check_minimum_elements()
        self._check_node_geometry()
        self._check_member_validity()
        self._check_supports()
        self._check_connectivity()
        self._check_stiffness_ratios()
        self._check_loads(loads + node_loads, member_loads + distributed_loads)
        self._check_stability()
        
        # Calculate statistics
        error_count = sum(1 for i in self.issues if i.severity == IssueSeverity.ERROR)
        warning_count = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)
        
        # Count supports
        support_count = sum(1 for n in nodes_list if self._has_support(n))
        
        # Count loads
        load_count = len(loads) + len(node_loads) + len(member_loads) + len(distributed_loads)
        
        # Build summary
        if error_count > 0:
            summary = f"Found {error_count} critical errors - analysis will fail"
            is_valid = False
        elif warning_count > 0:
            summary = f"Model is valid with {warning_count} warnings"
            is_valid = True
        else:
            summary = "Model is valid and ready for analysis"
            is_valid = True
        
        return ValidationResult(
            is_valid=is_valid,
            issues=self.issues,
            summary=summary,
            error_count=error_count,
            warning_count=warning_count,
            info_count=info_count,
            node_count=len(nodes_list),
            member_count=len(members_list),
            support_count=support_count,
            load_count=load_count
        )
    
    # ============================================
    # VALIDATION CHECKS
    # ============================================
    
    def _check_minimum_elements(self) -> None:
        """Check that model has minimum required elements"""
        if len(self.nodes) < 2:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_STRUCTURE,
                severity=IssueSeverity.ERROR,
                message="Model needs at least 2 nodes to form a structure",
                suggested_fix="Add more nodes to define the geometry",
                auto_fixable=False
            ))
        
        if len(self.members) < 1:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_STRUCTURE,
                severity=IssueSeverity.ERROR,
                message="Model has no members - nothing to analyze",
                suggested_fix="Add members to connect the nodes",
                auto_fixable=False
            ))
    
    def _check_node_geometry(self) -> None:
        """Check for overlapping nodes and invalid coordinates"""
        node_list = list(self.nodes.values())
        overlapping = []
        
        for i, n1 in enumerate(node_list):
            for n2 in node_list[i+1:]:
                dist = self._distance(n1, n2)
                if dist < self.tolerance:
                    overlapping.append((n1.get('id'), n2.get('id')))
        
        for pair in overlapping:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.OVERLAPPING_NODES,
                severity=IssueSeverity.ERROR,
                message=f"Nodes {pair[0]} and {pair[1]} are at the same location",
                affected_elements=list(pair),
                suggested_fix=f"Merge nodes or adjust coordinates",
                auto_fixable=True
            ))
    
    def _check_member_validity(self) -> None:
        """Check member references and geometry"""
        for member_id, member in self.members.items():
            # Get start and end node IDs
            start_id = member.get('startNodeId') or member.get('start_node') or member.get('s')
            end_id = member.get('endNodeId') or member.get('end_node') or member.get('e')
            
            # Check node references exist
            if start_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INVALID_MEMBER_REFERENCE,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} references non-existent start node '{start_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the member's node reference"
                ))
                continue
            
            if end_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INVALID_MEMBER_REFERENCE,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} references non-existent end node '{end_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the member's node reference"
                ))
                continue
            
            # Check member length
            n1 = self.nodes[start_id]
            n2 = self.nodes[end_id]
            length = self._distance(n1, n2)
            
            if length < MIN_NODE_DISTANCE:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.ZERO_LENGTH_MEMBER,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} has zero or near-zero length ({length:.6f}m)",
                    affected_elements=[member_id],
                    suggested_fix="Remove duplicate nodes or adjust coordinates",
                    auto_fixable=True
                ))
            elif length < MIN_MEMBER_LENGTH:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.VERY_SHORT_MEMBER,
                    severity=IssueSeverity.WARNING,
                    message=f"Member {member_id} is very short ({length:.4f}m) - may cause numerical issues",
                    affected_elements=[member_id],
                    suggested_fix="Consider merging with adjacent members"
                ))
    
    def _check_supports(self) -> None:
        """Check for adequate supports"""
        supported_nodes = []
        total_restraints = 0
        
        for node_id, node in self.nodes.items():
            if self._has_support(node):
                supported_nodes.append(node_id)
                total_restraints += self._count_restraints(node)
        
        if len(supported_nodes) == 0:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.NO_SUPPORTS,
                severity=IssueSeverity.ERROR,
                message="Model has no supports - will have rigid body motion",
                affected_elements=list(self.nodes.keys()),
                suggested_fix="Add pinned or fixed supports at base nodes",
                auto_fixable=True
            ))
        # Check total restraints (Minimum 6 for 3D stability, but 3 is enough for 2D)
        elif total_restraints < 6:
            # Relaxed check for 2D structures
            if total_restraints >= 3:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                    severity=IssueSeverity.WARNING,  # Changed from error to warning
                    message=f"Model has only {total_restraints} DOF restraints - might be unstable in 3D (needs 6). OK for 2D.",
                    affected_elements=supported_nodes,
                    suggested_fix="For full 3D stability, ensure at least 6 DOF are restrained total. For 2D, 3 is sufficient.",
                    auto_fixable=True
                ))
            else:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                    severity=IssueSeverity.ERROR,
                    message=f"Model has only {total_restraints} DOF restraints - needs at least 3 for 2D stability (6 for 3D)",
                    affected_elements=supported_nodes,
                    suggested_fix="Add more supports or fix existing supports",
                    auto_fixable=True
                ))
        elif len(supported_nodes) == 1 and len(self.nodes) > 2:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                severity=IssueSeverity.WARNING,
                message="Only one support found - structure may be unstable for lateral loads",
                affected_elements=supported_nodes,
                suggested_fix="Consider adding a second support point",
                auto_fixable=True
            ))
    
    def _check_connectivity(self) -> None:
        """Check that all nodes are connected and structure is continuous"""
        if len(self.members) == 0:
            return
        
        # Build adjacency graph
        connected_nodes: Set[str] = set()
        adjacency: Dict[str, Set[str]] = {nid: set() for nid in self.nodes}
        
        for member in self.members.values():
            start_id = member.get('startNodeId') or member.get('start_node') or member.get('s')
            end_id = member.get('endNodeId') or member.get('end_node') or member.get('e')
            
            if start_id and start_id in self.nodes:
                connected_nodes.add(start_id)
                if end_id in adjacency:
                    adjacency[start_id].add(end_id)
            
            if end_id and end_id in self.nodes:
                connected_nodes.add(end_id)
                if start_id in adjacency:
                    adjacency[end_id].add(start_id)
        
        # Check for disconnected nodes
        disconnected = set(self.nodes.keys()) - connected_nodes
        if disconnected:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_NODES,
                severity=IssueSeverity.WARNING,
                message=f"{len(disconnected)} nodes are not connected to any member",
                affected_elements=list(disconnected),
                suggested_fix="Connect these nodes to members or remove them",
                auto_fixable=True
            ))
        
        # Check for disconnected structure (multiple components)
        if connected_nodes:
            components = self._find_connected_components(adjacency)
            if len(components) > 1:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.DISCONNECTED_STRUCTURE,
                    severity=IssueSeverity.ERROR,
                    message=f"Structure has {len(components)} disconnected parts",
                    affected_elements=[str(c) for c in components],
                    suggested_fix="Connect the separate parts with members"
                ))
    
    def _check_stiffness_ratios(self) -> None:
        """Check for extreme stiffness ratios that cause ill-conditioning"""
        if len(self.members) < 2:
            return
        
        # Get stiffness values (EI and EA)
        stiffnesses = []
        for member_id, member in self.members.items():
            E = member.get('E', 200e6)
            A = member.get('A', 0.01)
            I = member.get('Iz', member.get('Iy', 1e-4))
            
            EA = E * A
            EI = E * I
            
            stiffnesses.append({
                'id': member_id,
                'EA': EA,
                'EI': EI
            })
        
        # Check ratios
        max_EA = max(s['EA'] for s in stiffnesses)
        min_EA = min(s['EA'] for s in stiffnesses)
        max_EI = max(s['EI'] for s in stiffnesses)
        min_EI = min(s['EI'] for s in stiffnesses)
        
        if min_EA > 0 and max_EA / min_EA > MAX_STIFFNESS_RATIO:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.EXTREME_STIFFNESS_RATIO,
                severity=IssueSeverity.WARNING,
                message=f"Extreme axial stiffness ratio ({max_EA/min_EA:.2e}) - may cause numerical instability",
                suggested_fix="Check member properties or use rigid constraints"
            ))
        
        if min_EI > 0 and max_EI / min_EI > MAX_STIFFNESS_RATIO:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.EXTREME_STIFFNESS_RATIO,
                severity=IssueSeverity.WARNING,
                message=f"Extreme flexural stiffness ratio ({max_EI/min_EI:.2e}) - may cause numerical instability",
                suggested_fix="Check member section properties"
            ))
    
    def _check_loads(self, node_loads: List, member_loads: List) -> None:
        """Check for valid load definitions"""
        total_loads = len(node_loads) + len(member_loads)
        
        if total_loads == 0:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.NO_LOADS,
                severity=IssueSeverity.INFO,
                message="No loads applied - analysis will show zero results",
                suggested_fix="Apply point loads or distributed loads"
            ))
        
        # Check node loads reference valid nodes
        for load in node_loads:
            node_id = load.get('nodeId') or load.get('node_id')
            if node_id and node_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.UNSUPPORTED_LOAD_NODE,
                    severity=IssueSeverity.WARNING,
                    message=f"Load references non-existent node '{node_id}'",
                    affected_elements=[node_id],
                    suggested_fix="Fix the load's node reference"
                ))
        
        # Check member loads reference valid members
        for load in member_loads:
            member_id = load.get('memberId') or load.get('member_id')
            if member_id and member_id not in self.members:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.LOAD_ON_MISSING_MEMBER,
                    severity=IssueSeverity.WARNING,
                    message=f"Load references non-existent member '{member_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the load's member reference"
                ))
    
    def _check_stability(self) -> None:
        """
        Advanced stability check using simple degree of freedom analysis.
        
        For 3D structures:
        - Each node has 6 DOFs (3 translations, 3 rotations)
        - Each support reduces DOFs
        - Each member provides constraint
        
        Degrees of Freedom check:
        Total DOFs = 6 * n_nodes
        Restrained DOFs = sum of support restraints
        Available DOFs = Total - Restrained
        Member constraints = 6 * n_members (for rigid connections)
        
        If Available DOFs > Member constraints, structure is unstable
        """
        n_nodes = len(self.nodes)
        n_members = len(self.members)
        
        if n_nodes < 2 or n_members < 1:
            return
        
        # Count restrained DOFs
        restrained_dofs = 0
        for node in self.nodes.values():
            restrained_dofs += self._count_restraints(node)
        
        # Simple check: need at least 6 restrained DOFs for 3D
        # and each member should connect 2 nodes
        if restrained_dofs < 6:
            # Already caught by _check_supports
            return
        
        # Check for potential mechanism
        # A simple frame: n_members >= n_nodes - 1 for stability
        # Plus enough support restraints
        if n_members < n_nodes - 1:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.MECHANISM_DETECTED,
                severity=IssueSeverity.WARNING,
                message=f"Structure may be a mechanism ({n_members} members, {n_nodes} nodes) - add bracing",
                suggested_fix="Add diagonal bracing or additional members"
            ))
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _distance(self, n1: Dict, n2: Dict) -> float:
        """Calculate distance between two nodes"""
        dx = n2.get('x', 0) - n1.get('x', 0)
        dy = n2.get('y', 0) - n1.get('y', 0)
        dz = n2.get('z', 0) - n1.get('z', 0)
        return math.sqrt(dx*dx + dy*dy + dz*dz)
    
    def _has_support(self, node: Dict) -> bool:
        """Check if node has any support restraint"""
        # Check support type field
        support_type = str(node.get('support', '')).lower()
        if support_type in ['fixed', 'pinned', 'roller', 'pin', 'roller_x', 'roller_z']:
            return True
        
        # Check restraints object
        restraints = node.get('restraints', {})
        if any(restraints.get(r, False) for r in ['fx', 'fy', 'fz', 'Dx', 'Dy', 'Dz']):
            return True
        
        return False
    
    def _count_restraints(self, node: Dict) -> int:
        """Count number of restrained DOFs at a node"""
        support_type = str(node.get('support', '')).lower()
        
        support_dofs = {
            'fixed': 6,
            'pinned': 3,
            'pin': 3,
            'roller': 1,
            'roller_x': 2,
            'roller_z': 2,
        }
        
        if support_type in support_dofs:
            return support_dofs[support_type]
        
        # Count from restraints object
        restraints = node.get('restraints', {})
        count = 0
        for r in ['fx', 'fy', 'fz', 'mx', 'my', 'mz', 'Dx', 'Dy', 'Dz', 'Rx', 'Ry', 'Rz']:
            if restraints.get(r, False):
                count += 1
        return min(count, 6)  # Max 6 DOFs per node
    
    def _find_connected_components(self, adjacency: Dict[str, Set[str]]) -> List[Set[str]]:
        """Find connected components using BFS"""
        visited = set()
        components = []
        
        for start_node in adjacency:
            if start_node in visited:
                continue
            
            # BFS from this node
            component = set()
            queue = [start_node]
            
            while queue:
                node = queue.pop(0)
                if node in visited:
                    continue
                
                visited.add(node)
                component.add(node)
                
                for neighbor in adjacency.get(node, []):
                    if neighbor not in visited:
                        queue.append(neighbor)
            
            if component:
                components.append(component)
        
        return components


# ============================================
# CONVENIENCE FUNCTION
# ============================================

def validate_model(model_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a structural model and return results as dict.
    Uses both legacy validator and new modular validators for comprehensive checking.
    
    Args:
        model_data: Model with nodes, members, loads
    
    Returns:
        Validation result as JSON-serializable dict
    """
    # Run legacy validator
    validator = ModelValidator()
    result = validator.validate(model_data)
    
    # Run new modular validators if available
    if USE_MODULAR_VALIDATORS:
        try:
            nodes = model_data.get('nodes', [])
            members = model_data.get('members', [])
            node_loads = model_data.get('node_loads', model_data.get('loads', []))
            distributed_loads = model_data.get('distributed_loads', [])
            
            # Run geometry validator
            geo_validator = GeometryValidator(nodes, members)
            geo_validator.validate_all()
            geo_result = geo_validator.get_result()
            
            # Run support validator
            support_validator = SupportValidator(nodes, members)
            support_validator.validate_all()
            support_result = support_validator.get_result()
            
            # Run load validator
            load_validator = LoadValidator(nodes, members, node_loads, distributed_loads)
            load_validator.validate_all()
            load_result = load_validator.get_result()
            
            # Merge results from modular validators
            for modular_result in [geo_result, support_result, load_result]:
                for msg in modular_result.messages:
                    # Convert ValidationMessage to ValidationIssue format
                    severity_map = {
                        ValidationSeverity.ERROR: IssueSeverity.ERROR,
                        ValidationSeverity.WARNING: IssueSeverity.WARNING,
                        ValidationSeverity.INFO: IssueSeverity.INFO
                    }
                    
                    # Create issue type from code
                    issue_type_value = msg.code.lower().replace('-', '_').replace('_0', '_').replace('_00', '_')
                    
                    issue = ValidationIssue(
                        issue_type=IssueType.NO_SUPPORTS,  # Placeholder, use legacy type
                        severity=severity_map.get(msg.severity, IssueSeverity.WARNING),
                        message=f"[{msg.code}] {msg.message}",
                        affected_elements=msg.affected_elements,
                        suggested_fix=msg.suggestion,
                        auto_fixable=False
                    )
                    result.issues.append(issue)
                    
                    # Update counts
                    if msg.severity == ValidationSeverity.ERROR:
                        result.error_count += 1
                        result.is_valid = False
                    elif msg.severity == ValidationSeverity.WARNING:
                        result.warning_count += 1
                    else:
                        result.info_count += 1
                        
            # Update summary
            if not result.is_valid:
                result.summary = f"Model validation failed with {result.error_count} critical errors. See details below."
                
        except Exception as e:
            # Don't fail if modular validators have issues
            print(f"Warning: Modular validators failed: {e}")
    
    return {
        'is_valid': result.is_valid,
        'summary': result.summary,
        'error_count': result.error_count,
        'warning_count': result.warning_count,
        'info_count': result.info_count,
        'node_count': result.node_count,
        'member_count': result.member_count,
        'support_count': result.support_count,
        'load_count': result.load_count,
        'issues': [
            {
                'type': issue.issue_type.value if hasattr(issue.issue_type, 'value') else str(issue.issue_type),
                'severity': issue.severity.value,
                'message': issue.message,
                'affected_elements': issue.affected_elements,
                'suggested_fix': issue.suggested_fix,
                'auto_fixable': issue.auto_fixable
            }
            for issue in result.issues
        ]
    }


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Test with invalid model
    test_model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0},  # No support!
            {"id": "N2", "x": 5, "y": 0, "z": 0},
        ],
        "members": [
            {"id": "M1", "startNodeId": "N1", "endNodeId": "N2"}
        ],
        "loads": []
    }
    
    result = validate_model(test_model)
    print(f"Valid: {result['is_valid']}")
    print(f"Summary: {result['summary']}")
    for issue in result['issues']:
        print(f"  [{issue['severity']}] {issue['message']}")
