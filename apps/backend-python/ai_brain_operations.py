"""Operational helpers for EnhancedAIBrain.

This module contains the remaining mutation handlers so the main brain class
can stay small and readable.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ai_brain_types import ParsedCommand


def handle_add_element(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities

    start_node = entities.get("start")
    end_node = entities.get("end")

    if start_node and end_node:
        return add_member(model, start_node.upper(), end_node.upper())

    if "x" in entities and "y" in entities:
        x = float(entities["x"])
        y = float(entities["y"])
        z = float(entities.get("z", 0))
        return add_node(model, x, y, z)

    if "story" in parsed.raw_text.lower() or "floor" in parsed.raw_text.lower():
        return add_story(model)

    if "bay" in parsed.raw_text.lower():
        direction = entities.get("direction", "right")
        return add_bay(model, direction)

    return {
        "success": False,
        "model": model,
        "message": "Please specify what to add. Examples: 'Add member from N1 to N5' or 'Add node at 5, 3, 0'",
        "changes": []
    }


def add_member(model: Dict[str, Any], start: str, end: str) -> Dict[str, Any]:
    nodes = model.get("nodes", [])
    members = model.get("members", [])

    node_ids = {n.get("id", "").upper() for n in nodes}
    if start not in node_ids:
        return {"success": False, "model": model, "message": f"Start node {start} not found", "changes": []}
    if end not in node_ids:
        return {"success": False, "model": model, "message": f"End node {end} not found", "changes": []}

    existing_nums = [int(m.get("id", "M0")[1:]) for m in members if m.get("id", "").startswith("M")]
    new_num = max(existing_nums, default=0) + 1
    new_id = f"M{new_num}"

    members.append({
        "id": new_id,
        "startNodeId": start,
        "endNodeId": end,
        "sectionId": "ISMB300",
        "type": "brace"
    })

    return {
        "success": True,
        "model": model,
        "message": f"✓ Added member {new_id} from {start} to {end}",
        "changes": [f"Added: {new_id} ({start} → {end})"]
    }


def add_node(model: Dict[str, Any], x: float, y: float, z: float) -> Dict[str, Any]:
    nodes = model.get("nodes", [])

    existing_nums = [int(n.get("id", "N0")[1:]) for n in nodes if n.get("id", "").startswith("N")]
    new_num = max(existing_nums, default=0) + 1
    new_id = f"N{new_num}"

    nodes.append({"id": new_id, "x": x, "y": y, "z": z})

    return {
        "success": True,
        "model": model,
        "message": f"✓ Added node {new_id} at ({x}, {y}, {z})",
        "changes": [f"Added: {new_id} at ({x}, {y}, {z})"]
    }


def add_story(model: Dict[str, Any]) -> Dict[str, Any]:
    nodes = model.get("nodes", [])
    members = model.get("members", [])

    if not nodes:
        return {"success": False, "model": model, "message": "No existing structure to extend", "changes": []}

    max_y = max(n.get("y", 0) for n in nodes)
    top_nodes = [n for n in nodes if abs(n.get("y", 0) - max_y) < 0.1]
    if len(top_nodes) < 2:
        return {"success": False, "model": model, "message": "Need at least 2 top nodes to add story", "changes": []}

    y_values = sorted(set(n.get("y", 0) for n in nodes), reverse=True)
    story_height = y_values[0] - y_values[1] if len(y_values) > 1 else 3.0

    node_map: Dict[str, str] = {}
    new_nodes: List[Dict[str, Any]] = []
    changes: List[str] = []

    existing_nums = [int(n.get("id", "N0")[1:]) for n in nodes if n.get("id", "").startswith("N")]
    next_num = max(existing_nums, default=0) + 1

    for old_node in top_nodes:
        new_id = f"N{next_num}"
        new_nodes.append({
            "id": new_id,
            "x": old_node.get("x", 0),
            "y": old_node.get("y", 0) + story_height,
            "z": old_node.get("z", 0)
        })
        node_map[old_node["id"]] = new_id
        changes.append(f"Node: {new_id}")
        next_num += 1

    nodes.extend(new_nodes)

    member_nums = [int(m.get("id", "M0")[1:]) for m in members if m.get("id", "").startswith("M")]
    next_member = max(member_nums, default=0) + 1

    for old_id, new_id in node_map.items():
        member_id = f"M{next_member}"
        members.append({
            "id": member_id,
            "startNodeId": old_id,
            "endNodeId": new_id,
            "sectionId": "ISMB300",
            "type": "column"
        })
        changes.append(f"Member: {member_id} (Column)")
        next_member += 1

    for i in range(len(new_nodes) - 1):
        member_id = f"M{next_member}"
        members.append({
            "id": member_id,
            "startNodeId": new_nodes[i]["id"],
            "endNodeId": new_nodes[i + 1]["id"],
            "sectionId": "ISMB250",
            "type": "beam"
        })
        changes.append(f"Member: {member_id} (Beam)")
        next_member += 1

    return {
        "success": True,
        "model": model,
        "message": f"✓ Added new story ({story_height}m height)",
        "changes": changes
    }


def add_bay(model: Dict[str, Any], direction: str) -> Dict[str, Any]:
    nodes = model.get("nodes", [])
    members = model.get("members", [])

    if not nodes:
        return {"success": False, "model": model, "message": "No existing structure to extend", "changes": []}

    if direction in ["right", "front"]:
        edge_x = max(n.get("x", 0) for n in nodes)
        edge_nodes = [n for n in nodes if abs(n.get("x", 0) - edge_x) < 0.1]
        offset = 6.0
    else:
        edge_x = min(n.get("x", 0) for n in nodes)
        edge_nodes = [n for n in nodes if abs(n.get("x", 0) - edge_x) < 0.1]
        offset = -6.0

    x_values = sorted(set(n.get("x", 0) for n in nodes))
    if len(x_values) > 1:
        bay_width = x_values[1] - x_values[0]
        offset = bay_width if direction in ["right", "front"] else -bay_width

    node_map: Dict[str, str] = {}
    new_nodes: List[Dict[str, Any]] = []
    changes: List[str] = []

    existing_nums = [int(n.get("id", "N0")[1:]) for n in nodes if n.get("id", "").startswith("N")]
    next_num = max(existing_nums, default=0) + 1

    for old_node in edge_nodes:
        new_id = f"N{next_num}"
        new_node = {
            "id": new_id,
            "x": old_node.get("x", 0) + offset,
            "y": old_node.get("y", 0),
            "z": old_node.get("z", 0)
        }
        if old_node.get("y", 0) < 0.1 and "restraints" in old_node:
            new_node["restraints"] = old_node["restraints"].copy()

        new_nodes.append(new_node)
        node_map[old_node["id"]] = new_id
        changes.append(f"Node: {new_id}")
        next_num += 1

    nodes.extend(new_nodes)

    member_nums = [int(m.get("id", "M0")[1:]) for m in members if m.get("id", "").startswith("M")]
    next_member = max(member_nums, default=0) + 1

    for old_id, new_id in node_map.items():
        member_id = f"M{next_member}"
        members.append({
            "id": member_id,
            "startNodeId": old_id,
            "endNodeId": new_id,
            "sectionId": "ISMB300",
            "type": "beam"
        })
        changes.append(f"Beam: {member_id}")
        next_member += 1

    sorted_new = sorted(new_nodes, key=lambda n: n.get("y", 0))
    for i in range(len(sorted_new) - 1):
        n1, n2 = sorted_new[i], sorted_new[i + 1]
        if abs(n1.get("x", 0) - n2.get("x", 0)) < 0.1:
            member_id = f"M{next_member}"
            members.append({
                "id": member_id,
                "startNodeId": n1["id"],
                "endNodeId": n2["id"],
                "sectionId": "ISMB350",
                "type": "column"
            })
            changes.append(f"Column: {member_id}")
            next_member += 1

    return {
        "success": True,
        "model": model,
        "message": f"✓ Added bay to {direction} ({len(new_nodes)} nodes, {len(changes) - len(new_nodes)} members)",
        "changes": changes
    }


def handle_remove_element(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities

    element_id = entities.get("id") or (entities.get("members", [None])[0]) or (entities.get("nodes", [None])[0])
    if not element_id:
        return {"success": False, "model": model, "message": "Please specify what to remove (e.g., M5 or N3)", "changes": []}

    element_id = element_id.upper()

    if element_id.startswith("M"):
        members = model.get("members", [])
        original_len = len(members)
        model["members"] = [m for m in members if m.get("id", "").upper() != element_id]
        if len(model["members"]) < original_len:
            return {"success": True, "model": model, "message": f"✓ Removed member {element_id}", "changes": [f"Removed: {element_id}"]}

    elif element_id.startswith("N"):
        nodes = model.get("nodes", [])
        members = model.get("members", [])
        original_len = len(nodes)
        model["nodes"] = [n for n in nodes if n.get("id", "").upper() != element_id]
        if len(model["nodes"]) < original_len:
            removed_members: List[str] = []
            new_members: List[Dict[str, Any]] = []
            for m in members:
                start = (m.get("startNodeId") or m.get("start_node", "")).upper()
                end = (m.get("endNodeId") or m.get("end_node", "")).upper()
                if start == element_id or end == element_id:
                    removed_members.append(m.get("id"))
                else:
                    new_members.append(m)
            model["members"] = new_members

            changes = [f"Removed node: {element_id}"]
            if removed_members:
                changes.append(f"Removed connected members: {', '.join(removed_members)}")

            return {
                "success": True,
                "model": model,
                "message": f"✓ Removed {element_id}" + (f" and {len(removed_members)} connected members" if removed_members else ""),
                "changes": changes
            }

    return {"success": False, "model": model, "message": f"Element {element_id} not found", "changes": []}


def handle_transform(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities
    nodes = model.get("nodes", [])

    if not nodes:
        return {"success": False, "model": model, "message": "No nodes to transform", "changes": []}

    changes: List[str] = []

    if "value" in entities and "span" in parsed.raw_text.lower():
        target_span = float(entities["value"])
        x_values = [n.get("x", 0) for n in nodes]
        current_span = max(x_values) - min(x_values)
        if current_span < 0.001:
            return {"success": False, "model": model, "message": "Model has zero span", "changes": []}

        scale = target_span / current_span
        min_x = min(x_values)
        for node in nodes:
            node["x"] = min_x + (node.get("x", 0) - min_x) * scale

        changes.append(f"Span: {current_span:.1f}m → {target_span:.1f}m")
        return {"success": True, "model": model, "message": f"✓ Changed span from {current_span:.1f}m to {target_span:.1f}m", "changes": changes}

    if "value" in entities and "height" in parsed.raw_text.lower():
        target_height = float(entities["value"])
        y_values = [n.get("y", 0) for n in nodes]
        current_height = max(y_values) - min(y_values)
        if current_height < 0.001:
            return {"success": False, "model": model, "message": "Model has zero height", "changes": []}

        scale = target_height / current_height
        min_y = min(y_values)
        for node in nodes:
            node["y"] = min_y + (node.get("y", 0) - min_y) * scale

        changes.append(f"Height: {current_height:.1f}m → {target_height:.1f}m")
        return {"success": True, "model": model, "message": f"✓ Changed height from {current_height:.1f}m to {target_height:.1f}m", "changes": changes}

    if "factor" in entities:
        factor = float(entities["factor"])
        if "%" in parsed.raw_text:
            factor = factor / 100.0

        for node in nodes:
            node["x"] = node.get("x", 0) * factor
            node["y"] = node.get("y", 0) * factor
            node["z"] = node.get("z", 0) * factor

        changes.append(f"Scaled by {factor:.2f}x")
        return {"success": True, "model": model, "message": f"✓ Scaled model by {factor:.2f}x", "changes": changes}

    return {"success": False, "model": model, "message": "Could not determine transformation. Try: 'Set span to 15m' or 'Scale by 1.5'", "changes": []}


def handle_load_change(model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
    entities = parsed.entities
    loads = model.setdefault("loads", [])

    load_value = entities.get("load_value")
    target = entities.get("target")

    if not load_value:
        return {"success": False, "model": model, "message": "Please specify load value (e.g., '10 kN')", "changes": []}
    if not target:
        return {"success": False, "model": model, "message": "Please specify where to apply load (e.g., 'at N3')", "changes": []}

    load_id = f"L{len(loads) + 1}"
    direction = "fy"
    if "horizontal" in parsed.raw_text.lower() or "lateral" in parsed.raw_text.lower():
        direction = "fx"

    loads.append({
        "id": load_id,
        "nodeId": target.upper(),
        direction: -abs(load_value)
    })

    return {
        "success": True,
        "model": model,
        "message": f"✓ Applied {load_value} kN load at {target.upper()}",
        "changes": [f"Load {load_id}: {load_value} kN at {target.upper()}"]
    }
