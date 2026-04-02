"""Advanced structural section shapes - complex composite and specialized forms."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .section_designer import CustomSection


class StandardShapesAdvanced:
    """Factory class for advanced/specialized section shapes."""

    @staticmethod
    def built_up_i(
        depth: float,
        top_width: float,
        bot_width: float,
        web_thick: float,
        top_thick: float,
        bot_thick: float,
        name: str = "Built-up I",
    ) -> "CustomSection":
        """Create Built-up I-section (plate girder)."""
        from .section_designer import CustomSection, Point

        d = depth
        bft = top_width
        bfb = bot_width
        tw = web_thick
        tft = top_thick
        tfb = bot_thick

        y_bot = -d / 2
        y_top = d / 2

        points = [
            Point(-bfb / 2, y_bot),
            Point(bfb / 2, y_bot),
            Point(bfb / 2, y_bot + tfb),
            Point(tw / 2, y_bot + tfb),
            Point(tw / 2, y_top - tft),
            Point(bft / 2, y_top - tft),
            Point(bft / 2, y_top),
            Point(-bft / 2, y_top),
            Point(-bft / 2, y_top - tft),
            Point(-tw / 2, y_top - tft),
            Point(-tw / 2, y_bot + tfb),
            Point(-bfb / 2, y_bot + tfb),
        ]

        return CustomSection(points, name)

    @staticmethod
    def composite_beam(
        depth: float,
        width: float,
        web_thick: float,
        flange_thick: float,
        slab_width: float,
        slab_thick: float,
        modular_ratio: float = 8.0,
        name: str = "Composite Beam",
    ) -> "CustomSection":
        """Create composite beam (I-section + transformed slab)."""
        from .section_designer import CustomSection, Point

        d = depth
        bf = width
        tw = web_thick
        tf = flange_thick
        be = slab_width / modular_ratio
        ts = slab_thick

        points = [
            Point(-bf / 2, 0),
            Point(bf / 2, 0),
            Point(bf / 2, tf),
            Point(tw / 2, tf),
            Point(tw / 2, d - tf),
            Point(bf / 2, d - tf),
            Point(bf / 2, d),
            Point(be / 2, d),
            Point(be / 2, d + ts),
            Point(-be / 2, d + ts),
            Point(-be / 2, d),
            Point(-bf / 2, d),
            Point(-bf / 2, d - tf),
            Point(-tw / 2, d - tf),
            Point(-tw / 2, tf),
            Point(-bf / 2, tf),
        ]

        return CustomSection(points, name)

    @staticmethod
    def lipped_channel(
        depth: float,
        width: float,
        thickness: float,
        lip: float,
        name: str = "Lipped Channel",
    ) -> "CustomSection":
        """Create cold-formed lipped channel (solid boundary model)."""
        from .section_designer import CustomSection, Point

        d = depth
        b = width
        t = thickness
        c = lip

        points = [
            Point(b, 0),
            Point(b, c),
            Point(b - t, c),
            Point(b - t, t),
            Point(t, t),
            Point(t, d - t),
            Point(b - t, d - t),
            Point(b - t, d - c),
            Point(b, d - c),
            Point(b, d),
            Point(0, d),
            Point(0, 0),
        ]

        points.reverse()
        return CustomSection(points, name)


__all__ = ["StandardShapesAdvanced"]
