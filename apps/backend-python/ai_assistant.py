"""
AI Model Assistant - Troubleshooting and Modification
Provides intelligent analysis of structural models and natural language modifications
"""

import re
import json
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
from ai_resilience import LLMResilienceGuard


_ASSISTANT_LLM_GUARD = LLMResilienceGuard(
    key="ai_assistant_llm",
    timeout_seconds=12.0,
    max_retries=2,
    retry_backoff_seconds=0.35,
    circuit_failure_threshold=3,
    circuit_reset_seconds=45.0,
)

# ============================================
# DATA CLASSES
# ============================================

@dataclass
class ModelIssue:
    """Represents a detected issue in the model"""
    issue_type: str
    severity: str  # 'error', 'warning', 'info'
    description: str
    affected_elements: List[str]
    suggested_fix: Optional[str] = None

@dataclass
class ModelDiagnosis:
    """Complete diagnosis of a structural model"""
    is_valid: bool
    issues: List[ModelIssue]
    summary: str
    can_auto_fix: bool

@dataclass
class ModificationResult:
    """Result of a model modification"""
    success: bool
    action: str
    changes: Dict[str, Any]
    message: str

# ============================================
# INDIAN STANDARD SECTIONS DATABASE
# ============================================

IS_SECTIONS = {
    # ISMB - Indian Standard Medium Weight Beams
    "ISMB150": {"area": 1760, "Ix": 726e4, "Iy": 67e4},
    "ISMB200": {"area": 2540, "Ix": 2215e4, "Iy": 137e4},
    "ISMB250": {"area": 4260, "Ix": 5131e4, "Iy": 334e4},
    "ISMB300": {"area": 5690, "Ix": 9822e4, "Iy": 513e4},
    "ISMB350": {"area": 6760, "Ix": 14290e4, "Iy": 630e4},
    "ISMB400": {"area": 7880, "Ix": 20450e4, "Iy": 786e4},
    "ISMB450": {"area": 9050, "Ix": 30390e4, "Iy": 1350e4},
    "ISMB500": {"area": 11100, "Ix": 45220e4, "Iy": 1520e4},
    "ISMB550": {"area": 13200, "Ix": 64900e4, "Iy": 1830e4},
    "ISMB600": {"area": 15600, "Ix": 91800e4, "Iy": 2650e4},
    # ISMC - Indian Standard Medium Weight Channels
    "ISMC75": {"area": 878, "Ix": 76e4, "Iy": 21.3e4},
    "ISMC100": {"area": 1170, "Ix": 187e4, "Iy": 26.1e4},
    "ISMC150": {"area": 2170, "Ix": 779e4, "Iy": 103e4},
    "ISMC200": {"area": 2830, "Ix": 1830e4, "Iy": 141e4},
    "ISMC250": {"area": 3900, "Ix": 3880e4, "Iy": 211e4},
    "ISMC300": {"area": 4640, "Ix": 6362e4, "Iy": 310e4},
    # ISA - Indian Standard Angles (Equal Leg)
    "ISA50x50x6": {"area": 569, "Ix": 11.2e4, "Iy": 11.2e4},
    "ISA75x75x8": {"area": 1140, "Ix": 49.1e4, "Iy": 49.1e4},
    "ISA100x100x10": {"area": 1900, "Ix": 149e4, "Iy": 149e4},
}

# Section aliases for NLP
SECTION_ALIASES = {
    "heavy beam": "ISMB500",
    "large beam": "ISMB450",
    "medium beam": "ISMB300",
    "light beam": "ISMB200",
    "heavy column": "ISMB500",
    "large column": "ISMB450",
    "medium column": "ISMB350",
    "light column": "ISMB250",
    "channel": "ISMC200",
    "angle": "ISA100x100x10",
}

# ============================================
# MODEL DIAGNOSTICS
# ============================================

class ModelDiagnostics:
    """Diagnose structural model issues"""
    
    @staticmethod
    def diagnose(model_data: Dict[str, Any]) -> ModelDiagnosis:
        """
        Analyze a model for common issues.
        
        Args:
            model_data: Dict with 'nodes', 'members', 'loads' keys
        """
        issues: List[ModelIssue] = []
        nodes = model_data.get('nodes', [])
        members = model_data.get('members', [])
        loads = model_data.get('loads', [])
        
        # Convert to lookup dicts
        node_dict = {n['id']: n for n in nodes}
        
        # --- CHECK 1: Model has enough elements ---
        if len(nodes) < 2:
            issues.append(ModelIssue(
                issue_type="insufficient_nodes",
                severity="error",
                description="Model needs at least 2 nodes",
                affected_elements=[],
                suggested_fix="Add more nodes to define the structure"
            ))
        
        if len(members) < 1:
            issues.append(ModelIssue(
                issue_type="no_members",
                severity="error",
                description="Model has no members/elements",
                affected_elements=[],
                suggested_fix="Add members to connect the nodes"
            ))
        
        # --- CHECK 2: Supports exist ---
        supported_nodes = []
        for node in nodes:
            restraints = node.get('restraints', {})
            has_support = any([
                restraints.get('fx', False),
                restraints.get('fy', False),
                restraints.get('fz', False)
            ])
            if has_support:
                supported_nodes.append(node['id'])
        
        if len(supported_nodes) == 0:
            issues.append(ModelIssue(
                issue_type="no_supports",
                severity="error",
                description="Model has no supports - will be unstable",
                affected_elements=list(node_dict.keys()),
                suggested_fix="Add pinned or fixed supports at base nodes"
            ))
        elif len(supported_nodes) == 1 and len(nodes) > 2:
            issues.append(ModelIssue(
                issue_type="single_support",
                severity="warning",
                description="Only one support found - may be unstable",
                affected_elements=supported_nodes,
                suggested_fix="Add at least one more support"
            ))
        
        # --- CHECK 3: Disconnected nodes ---
        connected_nodes = set()
        for member in members:
            start = member.get('startNodeId') or member.get('start_node')
            end = member.get('endNodeId') or member.get('end_node')
            if start: connected_nodes.add(start)
            if end: connected_nodes.add(end)
        
        disconnected = set(node_dict.keys()) - connected_nodes
        if disconnected:
            issues.append(ModelIssue(
                issue_type="disconnected_nodes",
                severity="warning",
                description=f"{len(disconnected)} nodes are not connected to any member",
                affected_elements=list(disconnected),
                suggested_fix="Connect these nodes to members or remove them"
            ))
        
        # --- CHECK 4: Invalid member references ---
        for member in members:
            start = member.get('startNodeId') or member.get('start_node')
            end = member.get('endNodeId') or member.get('end_node')
            if start not in node_dict:
                issues.append(ModelIssue(
                    issue_type="invalid_member_start",
                    severity="error",
                    description=f"Member {member.get('id')} references non-existent start node {start}",
                    affected_elements=[member.get('id')],
                    suggested_fix="Fix the member's start node reference"
                ))
            if end not in node_dict:
                issues.append(ModelIssue(
                    issue_type="invalid_member_end",
                    severity="error",
                    description=f"Member {member.get('id')} references non-existent end node {end}",
                    affected_elements=[member.get('id')],
                    suggested_fix="Fix the member's end node reference"
                ))
        
        # --- CHECK 5: Zero-length members ---
        for member in members:
            start = member.get('startNodeId') or member.get('start_node')
            end = member.get('endNodeId') or member.get('end_node')
            if start in node_dict and end in node_dict:
                n1, n2 = node_dict[start], node_dict[end]
                dx = n2.get('x', 0) - n1.get('x', 0)
                dy = n2.get('y', 0) - n1.get('y', 0)
                dz = n2.get('z', 0) - n1.get('z', 0)
                length = (dx**2 + dy**2 + dz**2) ** 0.5
                if length < 0.001:
                    issues.append(ModelIssue(
                        issue_type="zero_length_member",
                        severity="error",
                        description=f"Member {member.get('id')} has zero or near-zero length",
                        affected_elements=[member.get('id')],
                        suggested_fix="Remove duplicate nodes or adjust coordinates"
                    ))
        
        # --- CHECK 6: No loads ---
        if len(loads) == 0 and 'memberLoads' not in model_data:
            issues.append(ModelIssue(
                issue_type="no_loads",
                severity="info",
                description="No loads applied - analysis will show zero results",
                affected_elements=[],
                suggested_fix="Apply point loads or distributed loads"
            ))
        
        # Build summary
        error_count = sum(1 for i in issues if i.severity == 'error')
        warning_count = sum(1 for i in issues if i.severity == 'warning')
        
        if error_count > 0:
            summary = f"Found {error_count} critical issues that must be fixed"
            is_valid = False
            can_auto_fix = error_count <= 3  # Can auto-fix simple cases
        elif warning_count > 0:
            summary = f"Model is valid but has {warning_count} warnings"
            is_valid = True
            can_auto_fix = True
        else:
            summary = "Model looks good - ready for analysis"
            is_valid = True
            can_auto_fix = False
        
        return ModelDiagnosis(
            is_valid=is_valid,
            issues=issues,
            summary=summary,
            can_auto_fix=can_auto_fix
        )

# ============================================
# MODEL FIXER
# ============================================

class ModelFixer:
    """Auto-fix common model issues"""
    
    @staticmethod
    def fix_model(model_data: Dict[str, Any], diagnosis: ModelDiagnosis) -> Tuple[Dict[str, Any], List[str]]:
        """
        Apply automatic fixes to the model.
        
        Returns:
            Tuple of (fixed_model, list_of_changes)
        """
        fixed = {
            'nodes': list(model_data.get('nodes', [])),
            'members': list(model_data.get('members', [])),
            'loads': list(model_data.get('loads', [])),
        }
        changes: List[str] = []
        
        for issue in diagnosis.issues:
            if issue.issue_type == "no_supports":
                # Add supports to lowest Y nodes
                changes.extend(ModelFixer._add_supports(fixed))
            
            elif issue.issue_type == "single_support" and len(fixed['nodes']) > 2:
                # Add another support
                changes.extend(ModelFixer._add_second_support(fixed))
            
            elif issue.issue_type == "disconnected_nodes":
                # Either remove or connect them
                changes.extend(ModelFixer._handle_disconnected(fixed, issue.affected_elements))
        
        return fixed, changes
    
    @staticmethod
    def _add_supports(model: Dict[str, Any]) -> List[str]:
        """Add supports to the model at appropriate locations"""
        changes = []
        nodes = model['nodes']
        
        if not nodes:
            return changes
        
        # Find Y extremes
        min_y = min(n.get('y', 0) for n in nodes)
        
        # Find nodes at minimum Y (ground level)
        ground_nodes = [n for n in nodes if abs(n.get('y', 0) - min_y) < 0.1]
        
        if len(ground_nodes) == 0:
            ground_nodes = nodes[:2]  # Fallback: first two nodes
        
        # Get X extremes for determining support types
        if len(ground_nodes) >= 2:
            x_values = [n.get('x', 0) for n in ground_nodes]
            min_x_node = min(ground_nodes, key=lambda n: n.get('x', 0))
            max_x_node = max(ground_nodes, key=lambda n: n.get('x', 0))
            
            # Pinned at left, roller at right
            for node in nodes:
                if node['id'] == min_x_node['id']:
                    node['restraints'] = {'fx': True, 'fy': True, 'fz': True, 'mx': False, 'my': False, 'mz': False}
                    changes.append(f"Added pinned support at {node['id']}")
                elif node['id'] == max_x_node['id']:
                    node['restraints'] = {'fx': False, 'fy': True, 'fz': True, 'mx': False, 'my': False, 'mz': False}
                    changes.append(f"Added roller support at {node['id']}")
        else:
            # Single ground node - make it fixed
            for node in nodes:
                if node['id'] == ground_nodes[0]['id']:
                    node['restraints'] = {'fx': True, 'fy': True, 'fz': True, 'mx': True, 'my': True, 'mz': True}
                    changes.append(f"Added fixed support at {node['id']}")
        
        return changes
    
    @staticmethod
    def _add_second_support(model: Dict[str, Any]) -> List[str]:
        """Add a second support when only one exists"""
        changes = []
        nodes = model['nodes']
        
        # Find node without support that's furthest from supported node
        supported = None
        unsupported = []
        
        for node in nodes:
            restraints = node.get('restraints', {})
            if any(restraints.get(k, False) for k in ['fx', 'fy', 'fz']):
                supported = node
            else:
                unsupported.append(node)
        
        if supported and unsupported:
            # Find furthest unsupported node at similar Y level
            ground_unsupported = [n for n in unsupported if abs(n.get('y', 0) - supported.get('y', 0)) < 0.5]
            if ground_unsupported:
                target = max(ground_unsupported, 
                           key=lambda n: abs(n.get('x', 0) - supported.get('x', 0)))
                target['restraints'] = {'fx': False, 'fy': True, 'fz': True, 'mx': False, 'my': False, 'mz': False}
                changes.append(f"Added roller support at {target['id']}")
        
        return changes
    
    @staticmethod
    def _handle_disconnected(model: Dict[str, Any], disconnected_ids: List[str]) -> List[str]:
        """Handle disconnected nodes by removing them"""
        changes = []
        model['nodes'] = [n for n in model['nodes'] if n['id'] not in disconnected_ids]
        if disconnected_ids:
            changes.append(f"Removed {len(disconnected_ids)} disconnected nodes: {', '.join(disconnected_ids)}")
        return changes

# ============================================
# MODEL MODIFIER
# ============================================

class ModelModifier:
    """Modify model based on natural language commands"""
    
    @staticmethod
    def parse_and_modify(model_data: Dict[str, Any], command: str) -> ModificationResult:
        """
        Parse natural language command and modify model.
        
        Supported commands:
        - "change columns to ISMB500"
        - "change all beams to ISMB400"
        - "change section of M1 to ISMB350"
        - "add support at N5"
        - "remove member M3"
        - "add member from N1 to N5"
        """
        command_lower = command.lower().strip()
        
        # --- CHANGE SECTION COMMANDS ---
        section_change = ModelModifier._parse_section_change(command_lower)
        if section_change:
            return ModelModifier._apply_section_change(model_data, section_change)
        
        # --- ADD SUPPORT COMMANDS ---
        support_add = ModelModifier._parse_support_add(command_lower)
        if support_add:
            return ModelModifier._apply_support_add(model_data, support_add)
        
        # --- REMOVE MEMBER COMMANDS ---
        member_remove = ModelModifier._parse_member_remove(command_lower)
        if member_remove:
            return ModelModifier._apply_member_remove(model_data, member_remove)
        
        # --- ADD MEMBER COMMANDS ---
        member_add = ModelModifier._parse_member_add(command_lower)
        if member_add:
            return ModelModifier._apply_member_add(model_data, member_add)
        
        # --- SCALE COMMANDS ---
        scale_change = ModelModifier._parse_scale(command_lower, model_data)
        if scale_change:
            return scale_change
        
        # Unknown command
        return ModificationResult(
            success=False,
            action="unknown",
            changes={},
            message=f"I didn't understand that command. Try:\n• 'Change columns to ISMB500'\n• 'Add support at N3'\n• 'Remove member M2'\n• 'Add member from N1 to N5'"
        )
    
    @staticmethod
    def _parse_section_change(command: str) -> Optional[Dict[str, Any]]:
        """Parse section change commands"""
        # "change columns to ISMB500"
        # "change all beams to ISMB400"
        # "change M1, M2 to ISMB350"
        # "make columns ISMB500"
        
        patterns = [
            r'(?:change|set|make|update)\s+(?:all\s+)?(?:the\s+)?(columns?|beams?|members?|chords?|diagonals?|verticals?)\s+(?:to\s+|section\s+)?(\w+)',
            r'(?:change|set|make|update)\s+(?:section\s+of\s+)?([MN]\d+(?:\s*,\s*[MN]\d+)*)\s+(?:to\s+)?(\w+)',
            r'(\w+)\s+for\s+(?:all\s+)?(columns?|beams?|members?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    target = groups[0].lower()
                    section = groups[1].upper()
                    
                    # Check if section is valid or use alias
                    if section not in IS_SECTIONS:
                        section = SECTION_ALIASES.get(section.lower(), section)
                    
                    return {
                        'target': target,
                        'section': section
                    }
        
        return None
    
    @staticmethod
    def _apply_section_change(model_data: Dict[str, Any], change: Dict[str, Any]) -> ModificationResult:
        """Apply section change to model"""
        target = change['target']
        section = change['section']
        members = model_data.get('members', [])
        
        changed_count = 0
        changed_ids = []
        
        for member in members:
            should_change = False
            member_type = member.get('type', member.get('member_type', '')).lower()
            member_id = member.get('id', '')
            
            # Check if this member should be changed
            if target in ['column', 'columns'] and 'column' in member_type:
                should_change = True
            elif target in ['beam', 'beams'] and 'beam' in member_type:
                should_change = True
            elif target in ['member', 'members', 'all']:
                should_change = True
            elif target in ['chord', 'chords'] and 'chord' in member_type:
                should_change = True
            elif target in ['diagonal', 'diagonals'] and 'diagonal' in member_type:
                should_change = True
            elif target in ['vertical', 'verticals'] and 'vertical' in member_type:
                should_change = True
            elif member_id.upper() in target.upper():
                should_change = True
            
            if should_change:
                # Update section
                if 'sectionId' in member:
                    member['sectionId'] = section
                elif 'section_profile' in member:
                    member['section_profile'] = section
                else:
                    member['section'] = section
                changed_count += 1
                changed_ids.append(member_id)
        
        if changed_count > 0:
            return ModificationResult(
                success=True,
                action="section_change",
                changes={
                    'members_updated': changed_ids,
                    'new_section': section,
                    'count': changed_count
                },
                message=f"✓ Changed {changed_count} member(s) to {section}"
            )
        else:
            return ModificationResult(
                success=False,
                action="section_change",
                changes={},
                message=f"No matching members found for '{target}'"
            )
    
    @staticmethod
    def _parse_support_add(command: str) -> Optional[Dict[str, Any]]:
        """Parse add support commands"""
        patterns = [
            r'(?:add|create|set)\s+(?:a\s+)?(?:pinned|fixed|roller)?\s*support\s+(?:at|to|on)\s+([Nn]\d+)',
            r'(?:support|fix|pin)\s+(?:node\s+)?([Nn]\d+)',
            r'(?:make)\s+([Nn]\d+)\s+(?:a\s+)?(?:pinned|fixed|roller)?\s*support',
        ]
        
        support_type = 'pinned'  # default
        if 'fixed' in command:
            support_type = 'fixed'
        elif 'roller' in command:
            support_type = 'roller'
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                return {
                    'node_id': match.group(1).upper(),
                    'support_type': support_type
                }
        
        return None
    
    @staticmethod
    def _apply_support_add(model_data: Dict[str, Any], add: Dict[str, Any]) -> ModificationResult:
        """Add support to a node"""
        node_id = add['node_id']
        support_type = add['support_type']
        nodes = model_data.get('nodes', [])
        
        for node in nodes:
            if node.get('id', '').upper() == node_id.upper():
                if support_type == 'fixed':
                    node['restraints'] = {'fx': True, 'fy': True, 'fz': True, 'mx': True, 'my': True, 'mz': True}
                elif support_type == 'roller':
                    node['restraints'] = {'fx': False, 'fy': True, 'fz': True, 'mx': False, 'my': False, 'mz': False}
                else:  # pinned
                    node['restraints'] = {'fx': True, 'fy': True, 'fz': True, 'mx': False, 'my': False, 'mz': False}
                
                return ModificationResult(
                    success=True,
                    action="add_support",
                    changes={'node_id': node_id, 'support_type': support_type},
                    message=f"✓ Added {support_type} support at {node_id}"
                )
        
        return ModificationResult(
            success=False,
            action="add_support",
            changes={},
            message=f"Node {node_id} not found in model"
        )
    
    @staticmethod
    def _parse_member_remove(command: str) -> Optional[str]:
        """Parse remove member commands"""
        patterns = [
            r'(?:remove|delete|drop)\s+(?:member\s+)?([Mm]\d+)',
            r'(?:get rid of|take out)\s+(?:member\s+)?([Mm]\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                return match.group(1).upper()
        
        return None
    
    @staticmethod
    def _apply_member_remove(model_data: Dict[str, Any], member_id: str) -> ModificationResult:
        """Remove a member from the model"""
        members = model_data.get('members', [])
        original_count = len(members)
        
        model_data['members'] = [m for m in members if m.get('id', '').upper() != member_id.upper()]
        
        if len(model_data['members']) < original_count:
            return ModificationResult(
                success=True,
                action="remove_member",
                changes={'removed': member_id},
                message=f"✓ Removed member {member_id}"
            )
        else:
            return ModificationResult(
                success=False,
                action="remove_member",
                changes={},
                message=f"Member {member_id} not found"
            )
    
    @staticmethod
    def _parse_member_add(command: str) -> Optional[Dict[str, Any]]:
        """Parse add member commands"""
        patterns = [
            r'(?:add|create)\s+(?:a\s+)?(?:member|brace|beam|diagonal)\s+(?:from|between)\s+([Nn]\d+)\s+(?:to|and)\s+([Nn]\d+)',
            r'(?:connect)\s+([Nn]\d+)\s+(?:to|and|with)\s+([Nn]\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                return {
                    'start_node': match.group(1).upper(),
                    'end_node': match.group(2).upper()
                }
        
        return None
    
    @staticmethod
    def _apply_member_add(model_data: Dict[str, Any], add: Dict[str, Any]) -> ModificationResult:
        """Add a new member to the model"""
        start_node = add['start_node']
        end_node = add['end_node']
        nodes = model_data.get('nodes', [])
        members = model_data.get('members', [])
        
        # Verify nodes exist
        node_ids = {n.get('id', '').upper() for n in nodes}
        if start_node not in node_ids:
            return ModificationResult(
                success=False,
                action="add_member",
                changes={},
                message=f"Start node {start_node} not found"
            )
        if end_node not in node_ids:
            return ModificationResult(
                success=False,
                action="add_member",
                changes={},
                message=f"End node {end_node} not found"
            )
        
        # Generate new member ID
        existing_nums = []
        for m in members:
            mid = m.get('id', '')
            if mid.startswith('M') and mid[1:].isdigit():
                existing_nums.append(int(mid[1:]))
        new_num = max(existing_nums, default=0) + 1
        new_id = f"M{new_num}"
        
        # Add member
        new_member = {
            'id': new_id,
            'startNodeId': start_node,
            'endNodeId': end_node,
            'sectionId': 'ISMB300',
            'type': 'brace'
        }
        members.append(new_member)
        
        return ModificationResult(
            success=True,
            action="add_member",
            changes={'new_member': new_id, 'start': start_node, 'end': end_node},
            message=f"✓ Added member {new_id} from {start_node} to {end_node}"
        )
    
    @staticmethod
    def _parse_scale(command: str, model_data: Dict[str, Any]) -> Optional[ModificationResult]:
        """Parse and apply scale/dimension change commands"""
        patterns = [
            r'(?:set|change|increase|make)\s+(?:the\s+)?span\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*m?',
            r'(?:scale\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*m\s+span',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                target_span = float(match.group(1))
                nodes = model_data.get('nodes', [])
                
                if not nodes:
                    return ModificationResult(
                        success=False,
                        action="scale",
                        changes={},
                        message="No nodes to scale"
                    )
                
                # Calculate current span
                x_values = [n.get('x', 0) for n in nodes]
                current_span = max(x_values) - min(x_values)
                
                if current_span < 0.001:
                    return ModificationResult(
                        success=False,
                        action="scale",
                        changes={},
                        message="Model has zero span"
                    )
                
                scale_factor = target_span / current_span
                min_x = min(x_values)
                
                # Scale all nodes
                for node in nodes:
                    node['x'] = min_x + (node.get('x', 0) - min_x) * scale_factor
                
                return ModificationResult(
                    success=True,
                    action="scale",
                    changes={'old_span': current_span, 'new_span': target_span, 'scale': scale_factor},
                    message=f"✓ Scaled span from {current_span:.1f}m to {target_span:.1f}m"
                )
        
        return None

# ============================================
# MAIN AI ASSISTANT CLASS
# ============================================

class AIModelAssistant:
    """Main AI assistant for model troubleshooting and modification"""
    
    def __init__(self, api_key: Optional[str] = None, use_gemini: bool = False, gemini_key: Optional[str] = None):
        self.api_key = api_key or gemini_key
        self.use_gemini = use_gemini and bool(self.api_key)
    
    def diagnose(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """Diagnose model issues"""
        diagnosis = ModelDiagnostics.diagnose(model_data)
        
        return {
            'is_valid': diagnosis.is_valid,
            'summary': diagnosis.summary,
            'can_auto_fix': diagnosis.can_auto_fix,
            'issues': [
                {
                    'type': issue.issue_type,
                    'severity': issue.severity,
                    'description': issue.description,
                    'affected_elements': issue.affected_elements,
                    'suggested_fix': issue.suggested_fix
                }
                for issue in diagnosis.issues
            ]
        }
    
    def fix(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-fix model issues"""
        diagnosis = ModelDiagnostics.diagnose(model_data)
        
        if not diagnosis.can_auto_fix:
            return {
                'success': False,
                'message': "Cannot auto-fix this model - issues are too complex",
                'model': model_data,
                'changes': []
            }
        
        fixed_model, changes = ModelFixer.fix_model(model_data, diagnosis)
        
        return {
            'success': True,
            'message': f"Applied {len(changes)} fixes",
            'model': fixed_model,
            'changes': changes
        }
    
    def modify(self, model_data: Dict[str, Any], command: str) -> Dict[str, Any]:
        """Modify model based on natural language command"""
        result = ModelModifier.parse_and_modify(model_data, command)
        
        return {
            'success': result.success,
            'action': result.action,
            'message': result.message,
            'changes': result.changes,
            'model': model_data  # Model is modified in-place
        }
    
    def smart_modify(self, model_data: Dict[str, Any], command: str) -> Dict[str, Any]:
        """
        Smart modify - uses Gemini AI for intelligent command parsing if available.
        Falls back to rule-based modification otherwise.
        """
        print(f"[SMART MODIFY] Processing: '{command}'")
        print(f"[SMART MODIFY] Use Gemini: {self.use_gemini}")
        
        # Try Gemini-powered modification first
        if self.use_gemini:
            try:
                result = self._gemini_modify(model_data, command)
                if result.get('success'):
                    return result
                print("[SMART MODIFY] Gemini failed, falling back to rule-based")
            except Exception as e:
                print(f"[SMART MODIFY] Gemini error: {e}, falling back to rule-based")
        
        # Fall back to rule-based modification
        result = ModelModifier.parse_and_modify(model_data, command)
        
        return {
            'success': result.success,
            'action': result.action,
            'message': result.message,
            'changes': result.changes,
            'model': model_data,
            'suggestions': self._get_suggestions(command) if not result.success else []
        }
    
    def _gemini_modify(self, model_data: Dict[str, Any], command: str) -> Dict[str, Any]:
        """Use Gemini to intelligently parse and execute modification commands"""
        try:
            import google.generativeai as genai
            
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            # Build prompt for Gemini
            nodes_summary = json.dumps(model_data.get('nodes', [])[:10], indent=2)
            members_summary = json.dumps(model_data.get('members', [])[:10], indent=2)
            
            prompt = f"""You are a structural engineering AI assistant. Parse the following command and return a JSON response.

CURRENT MODEL (first 10 elements):
Nodes: {nodes_summary}
Members: {members_summary}
Total: {len(model_data.get('nodes', []))} nodes, {len(model_data.get('members', []))} members

USER COMMAND: "{command}"

Analyze the command and return ONLY valid JSON in this format:
{{
  "action": "one of: change_section, add_support, remove_member, add_member, scale, add_load, other",
  "targets": ["list", "of", "element", "ids", "affected"],
  "parameters": {{
    "section": "ISMB300",  // for change_section
    "support_type": "FIXED",  // for add_support
    "scale_factor": 1.5,  // for scale
    "new_span": 15.0,  // for scaling
    "load_value": -10.0  // for add_load
  }},
  "confidence": 0.95,
  "explanation": "Brief explanation of what will be done"
}}

Only respond with valid JSON, no markdown or explanation outside the JSON."""

            result = _ASSISTANT_LLM_GUARD.execute(
                lambda: model.generate_content(prompt)
            )
            if not result.success or result.value is None:
                return {
                    'success': False,
                    'message': (
                        "Gemini call failed after safeguards "
                        f"(attempts={result.attempts}, timeout={result.timed_out}, "
                        f"circuit_open={result.circuit_open}, error={result.error})"
                    )
                }

            response = result.value
            raw_text = response.text.strip()
            
            # Clean JSON response
            if raw_text.startswith('```'):
                raw_text = re.sub(r'^```\w*\n?', '', raw_text)
                raw_text = re.sub(r'\n?```$', '', raw_text)
            
            parsed = json.loads(raw_text)
            
            # Execute the parsed action
            action = parsed.get('action', 'other')
            targets = parsed.get('targets', [])
            params = parsed.get('parameters', {})
            explanation = parsed.get('explanation', '')
            
            changes = []
            success = False
            message = explanation
            
            if action == 'change_section':
                section = params.get('section', 'ISMB300')
                # Update all matching members
                for member in model_data.get('members', []):
                    if not targets or member.get('id') in targets or 'all' in [t.lower() for t in targets]:
                        old_section = member.get('section_profile', member.get('sectionId', 'unknown'))
                        member['section_profile'] = section
                        member['sectionId'] = section
                        changes.append(f"Changed {member['id']} from {old_section} to {section}")
                success = len(changes) > 0
                message = f"Changed {len(changes)} members to {section}"
                
            elif action == 'add_support':
                support_type = params.get('support_type', 'FIXED')
                for node in model_data.get('nodes', []):
                    if node.get('id') in targets:
                        node['support'] = support_type
                        changes.append(f"Added {support_type} support at {node['id']}")
                success = len(changes) > 0
                message = f"Added {len(changes)} supports"
                
            elif action == 'remove_member':
                members_to_remove = [m for m in model_data.get('members', []) if m.get('id') in targets]
                for m in members_to_remove:
                    model_data['members'].remove(m)
                    changes.append(f"Removed member {m['id']}")
                success = len(changes) > 0
                message = f"Removed {len(changes)} members"
                
            elif action == 'scale':
                scale = params.get('scale_factor', 1.0)
                new_span = params.get('new_span')
                
                if new_span:
                    # Calculate current span and compute scale factor
                    nodes = model_data.get('nodes', [])
                    if nodes:
                        xs = [n.get('x', 0) for n in nodes]
                        current_span = max(xs) - min(xs) if xs else 1
                        if current_span > 0:
                            scale = new_span / current_span
                
                for node in model_data.get('nodes', []):
                    node['x'] = node.get('x', 0) * scale
                    node['y'] = node.get('y', 0) * scale
                    node['z'] = node.get('z', 0) * scale
                    changes.append(f"Scaled node {node['id']}")
                    
                success = len(changes) > 0
                message = f"Scaled model by factor {scale:.2f}"
            
            else:
                # Unknown action - try rule-based fallback
                return {'success': False, 'message': f"Unknown action: {action}"}
            
            return {
                'success': success,
                'action': action,
                'message': message,
                'changes': changes,
                'model': model_data,
                'parsed': parsed
            }
            
        except Exception as e:
            print(f"[GEMINI MODIFY] Error: {e}")
            return {'success': False, 'message': str(e)}
    
    def _get_suggestions(self, command: str) -> List[str]:
        """Generate helpful suggestions based on the command"""
        suggestions = []
        
        cmd_lower = command.lower()
        
        if 'section' in cmd_lower or 'column' in cmd_lower or 'beam' in cmd_lower:
            suggestions.append("Try: 'Change columns to ISMB400'")
            suggestions.append("Try: 'Change all members to ISMB350'")
        
        if 'support' in cmd_lower or 'fix' in cmd_lower:
            suggestions.append("Try: 'Add fixed support at N1'")
            suggestions.append("Try: 'Make N1 and N2 pinned'")
        
        if 'remove' in cmd_lower or 'delete' in cmd_lower:
            suggestions.append("Try: 'Remove member M5'")
        
        if 'span' in cmd_lower or 'length' in cmd_lower or 'scale' in cmd_lower:
            suggestions.append("Try: 'Set span to 15m'")
            suggestions.append("Try: 'Scale model by 1.5'")
        
        if not suggestions:
            suggestions = [
                "Try: 'Change columns to ISMB500'",
                "Try: 'Add support at N1'",
                "Try: 'Remove member M3'"
            ]
        
        return suggestions[:3]

