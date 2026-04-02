"""
Standard Section Shapes for Section Designer

Provides factory methods to quickly create common structural sections:
- I-beams and built-up girders
- Channels and lipped channels
- Angles and rectangular bins
- T-sections and composite beams
- Circular sections
"""

from .section_designer_shapes_basic import StandardShapesBasic
from .section_designer_shapes_advanced import StandardShapesAdvanced


class StandardShapes(StandardShapesBasic, StandardShapesAdvanced):
    """
    Pre-defined standard shapes factory.
    
    Combines basic geometric shapes and advanced/specialized shapes via mixin inheritance.
    """
    pass


__all__ = [
    "StandardShapes",
    "StandardShapesBasic",
    "StandardShapesAdvanced",
]
