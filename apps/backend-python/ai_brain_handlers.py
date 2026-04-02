"""Behavior helpers for EnhancedAIBrain.

This module keeps enhanced_ai_brain.py focused on orchestration instead of
large command-handler implementations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ai_brain_catalog import ENGINEERING_KNOWLEDGE, ISMB_PROGRESSION
from ai_brain_types import ParsedCommand


def handle_section_change(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities
    members = model.get("members", [])
    changes: List[str] = []

    target = None
    section = None

    groups = entities.get("groups", ())
    if len(groups) >= 2:
        target = groups[0].lower() if groups[0] else None
        section = groups[1].upper() if groups[1] else None

    target = target or entities.get("target", "all")
    section = section or entities.get("section")

    if not section:
        if "heavier" in parsed.raw_text.lower() or "stronger" in parsed.raw_text.lower():
            section = get_heavier_section(members, target)
        elif "lighter" in parsed.raw_text.lower():
            section = get_lighter_section(members, target)

    if not section:
        return {
            "success": False,
            "model": model,
            "message": "Could not determine target section. Please specify like 'ISMB400'",
            "changes": [],
            "suggestions": ["Try: 'Change columns to ISMB400'"]
        }

    changed_count = 0
    for member in members:
        member_type = member.get("type", member.get("member_type", "")).lower()
        member_id = member.get("id", "").lower()

        should_change = False
        if target in ["column", "columns"] and "column" in member_type:
            should_change = True
        elif target in ["beam", "beams"] and "beam" in member_type:
            should_change = True
        elif target in ["rafter", "rafters"] and "rafter" in member_type:
            should_change = True
        elif target in ["chord", "chords"] and "chord" in member_type:
            should_change = True
        elif target in ["diagonal", "diagonals", "web"] and ("diagonal" in member_type or "web" in member_type):
            should_change = True
        elif target in ["all", "member", "members"]:
            should_change = True
        elif member_id in target:
            should_change = True

        if should_change:
            old_section = member.get("sectionId") or member.get("section_profile") or member.get("section")
            if "sectionId" in member:
                member["sectionId"] = section
            elif "section_profile" in member:
                member["section_profile"] = section
            else:
                member["section"] = section

            changes.append(f"{member.get('id')}: {old_section} → {section}")
            changed_count += 1

    if changed_count > 0:
        return {
            "success": True,
            "model": model,
            "message": f"✓ Changed {changed_count} member(s) to {section}",
            "changes": changes
        }

    return {
        "success": False,
        "model": model,
        "message": f"No members matching '{target}' found",
        "changes": [],
        "suggestions": ["Check member types in your model"]
    }


def get_heavier_section(members: List[Dict[str, Any]], target: str) -> Optional[str]:
    for member in members:
        current = member.get("sectionId") or member.get("section_profile") or member.get("section", "")
        if current in ISMB_PROGRESSION:
            idx = ISMB_PROGRESSION.index(current)
            if idx < len(ISMB_PROGRESSION) - 1:
                return ISMB_PROGRESSION[idx + 1]
    return "ISMB400"


def get_lighter_section(members: List[Dict[str, Any]], target: str) -> Optional[str]:
    for member in members:
        current = member.get("sectionId") or member.get("section_profile") or member.get("section", "")
        if current in ISMB_PROGRESSION:
            idx = ISMB_PROGRESSION.index(current)
            if idx > 0:
                return ISMB_PROGRESSION[idx - 1]
    return "ISMB250"


def handle_support_change(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities
    nodes = model.get("nodes", [])

    node_id = entities.get("node") or (entities.get("nodes", [None])[0])
    support_type = entities.get("type") or entities.get("support_type", "pinned")

    if not node_id:
        return {"success": False, "model": model, "message": "Please specify a node (e.g., N1, N2)", "changes": []}

    node_id = node_id.upper()
    support_config = ENGINEERING_KNOWLEDGE["supports"].get(support_type, ENGINEERING_KNOWLEDGE["supports"]["pinned"])

    for node in nodes:
        if node.get("id", "").upper() == node_id:
            node["restraints"] = support_config.copy()
            return {
                "success": True,
                "model": model,
                "message": f"✓ Added {support_type} support at {node_id}",
                "changes": [f"{node_id}: {support_type} support"]
            }

    return {"success": False, "model": model, "message": f"Node {node_id} not found", "changes": []}
