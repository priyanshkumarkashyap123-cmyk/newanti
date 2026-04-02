"""
Diagrams section builder (lightweight placeholder for now).
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.platypus import Paragraph, Spacer


def build_diagrams(diagrams: Dict[str, Any], styles) -> List:
    story = []

    # Placeholder: original implementation draws matplotlib diagrams; preserved as a simple note for now.
    if diagrams:
        story.append(Paragraph("4. DIAGRAMS", styles['CustomHeading1']))
        story.append(Spacer(1, 12))
        story.append(Paragraph("Diagrams are not rendered in this refactor placeholder.", styles['CustomBody']))
        story.append(Spacer(1, 12))

    return story