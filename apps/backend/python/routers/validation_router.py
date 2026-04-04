"""Validation router extracted from the FastAPI entry point."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["Validation"])


@router.post("/validate")
async def validate_model_endpoint(model: "StructuralModel"):
    """Validate a structural model for common issues."""
    issues = []
    node_ids = {n.id for n in model.nodes}
    for member in model.members:
        if member.start_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid start node {member.start_node}")
        if member.end_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid end node {member.end_node}")
    supports = [n for n in model.nodes if n.support and n.support.value != "NONE"]
    if len(supports) == 0:
        issues.append("No supports defined - structure is unstable")
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "node_count": len(model.nodes),
        "member_count": len(model.members),
        "support_count": len(supports),
    }
