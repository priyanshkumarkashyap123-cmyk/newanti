"""Shared static catalogs for EnhancedAIBrain.

This module exists to keep enhanced_ai_brain.py focused on behavior
instead of large static dictionaries/pattern registries.
"""

from __future__ import annotations

ENGINEERING_KNOWLEDGE = {
    "structures": {
        "truss": {
            "types": ["pratt", "howe", "warren", "k-truss", "fink", "bowstring"],
            "components": ["top_chord", "bottom_chord", "diagonals", "verticals"],
            "typical_spans": {"min": 6, "max": 60, "optimal": 15},
            "typical_depth_ratio": 0.1,
            "materials": ["steel", "aluminum", "timber"],
            "sections": {
                "chord": ["ISA100x100x10", "ISA150x150x15", "ISMC200"],
                "web": ["ISA75x75x8", "ISA50x50x6", "ISA65x65x6"],
            },
        },
        "beam": {
            "types": ["simple", "cantilever", "continuous", "overhanging"],
            "components": ["main_beam"],
            "typical_spans": {"min": 2, "max": 15, "optimal": 6},
            "materials": ["steel", "concrete", "timber"],
            "sections": ["ISMB200", "ISMB250", "ISMB300", "ISMB350", "ISMB400"],
        },
        "frame": {
            "types": ["portal", "multi-bay", "multi-story", "rigid"],
            "components": ["columns", "beams", "rafters", "bracing"],
            "typical_heights": {"story": 3.5, "industrial": 6},
            "typical_bays": {"min": 4, "max": 9, "optimal": 6},
            "sections": {
                "column": ["ISMB300", "ISMB350", "ISMB400", "ISMB500"],
                "beam": ["ISMB250", "ISMB300", "ISMB350"],
                "rafter": ["ISMB200", "ISMB250"],
            },
        },
        "building": {
            "types": ["residential", "commercial", "industrial", "warehouse"],
            "typical_stories": {"residential": 4, "commercial": 10, "industrial": 2},
            "story_height": {"residential": 3.0, "commercial": 3.5, "industrial": 6.0},
        },
    },
    "sections": {
        "ISMB100": {"depth": 100, "width": 75, "area": 1150, "Ix": 257e4},
        "ISMB150": {"depth": 150, "width": 80, "area": 1760, "Ix": 726e4},
        "ISMB200": {"depth": 200, "width": 100, "area": 2540, "Ix": 2215e4},
        "ISMB250": {"depth": 250, "width": 125, "area": 4260, "Ix": 5131e4},
        "ISMB300": {"depth": 300, "width": 140, "area": 5690, "Ix": 9822e4},
        "ISMB350": {"depth": 350, "width": 140, "area": 6760, "Ix": 14290e4},
        "ISMB400": {"depth": 400, "width": 140, "area": 7880, "Ix": 20450e4},
        "ISMB450": {"depth": 450, "width": 150, "area": 9050, "Ix": 30390e4},
        "ISMB500": {"depth": 500, "width": 180, "area": 11100, "Ix": 45220e4},
        "ISMB550": {"depth": 550, "width": 190, "area": 13200, "Ix": 64900e4},
        "ISMB600": {"depth": 600, "width": 210, "area": 15600, "Ix": 91800e4},
        "ISMC75": {"depth": 75, "width": 40, "area": 878, "Ix": 76e4},
        "ISMC100": {"depth": 100, "width": 50, "area": 1170, "Ix": 187e4},
        "ISMC150": {"depth": 150, "width": 75, "area": 2170, "Ix": 779e4},
        "ISMC200": {"depth": 200, "width": 75, "area": 2830, "Ix": 1830e4},
        "ISMC250": {"depth": 250, "width": 80, "area": 3900, "Ix": 3880e4},
        "ISMC300": {"depth": 300, "width": 90, "area": 4640, "Ix": 6362e4},
        "ISA50x50x6": {"leg": 50, "thickness": 6, "area": 569},
        "ISA65x65x6": {"leg": 65, "thickness": 6, "area": 744},
        "ISA75x75x8": {"leg": 75, "thickness": 8, "area": 1140},
        "ISA100x100x10": {"leg": 100, "thickness": 10, "area": 1900},
        "ISA150x150x15": {"leg": 150, "thickness": 15, "area": 4280},
    },
    "supports": {
        "fixed": {"fx": True, "fy": True, "fz": True, "mx": True, "my": True, "mz": True},
        "pinned": {"fx": True, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller": {"fx": False, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller_x": {"fx": False, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller_z": {"fx": True, "fy": True, "fz": False, "mx": False, "my": False, "mz": False},
    },
    "loads": {
        "residential": {"live": 2.0, "dead": 25.0, "partition": 1.5},
        "office": {"live": 3.0, "dead": 25.0, "partition": 1.5},
        "commercial": {"live": 4.0, "dead": 25.0, "partition": 2.0},
        "industrial": {"live": 5.0, "dead": 25.0, "partition": 0},
        "storage": {"live": 7.5, "dead": 25.0, "partition": 0},
        "roof_accessible": {"live": 1.5, "dead": 2.0, "partition": 0},
        "roof_inaccessible": {"live": 0.75, "dead": 2.0, "partition": 0},
    },
}

COMMAND_PATTERNS = {
    "section_change": [
        r"(?:change|set|make|update|use)\s+(?:all\s+)?(?:the\s+)?(columns?|beams?|members?|chords?|diagonals?|verticals?|rafters?)\s+(?:to\s+|section\s+)?(?:to\s+)?([A-Z]{2,4}\d+(?:[xX]\d+)*)",
        r"(?:change|set|make|update)\s+(?:section\s+of\s+)?([MN]\d+(?:\s*,\s*[MN]\d+)*)\s+(?:to\s+)?([A-Z]{2,4}\d+)",
        r"([A-Z]{2,4}\d+(?:[xX]\d+)*)\s+(?:for\s+)?(?:all\s+)?(columns?|beams?|members?)",
        r"(?:upgrade|strengthen|reinforce)\s+(?:the\s+)?(columns?|beams?)\s+(?:to\s+)?([A-Z]{2,4}\d+)?",
        r"(?:make|use)\s+heavier\s+(columns?|beams?)",
        r"(?:make|use)\s+lighter\s+(columns?|beams?)",
    ],
    "support_change": [
        r"(?:add|create|set|make|place)\s+(?:a\s+)?(?P<type>fixed|pinned|roller|hinged)?\s*support\s+(?:at|to|on)\s+(?P<node>[Nn]\d+)",
        r"(?:support|fix|pin|hinge)\s+(?:node\s+)?(?P<node>[Nn]\d+)",
        r"(?:make|set)\s+(?P<node>[Nn]\d+)\s+(?:a\s+)?(?P<type>fixed|pinned|roller)?\s*support",
        r"(?:remove|delete|release)\s+support\s+(?:from\s+|at\s+)?(?P<node>[Nn]\d+)",
        r"(?:change|convert)\s+support\s+(?:at\s+)?(?P<node>[Nn]\d+)\s+(?:to|from)\s+(?P<type>fixed|pinned|roller)",
    ],
    "add_element": [
        r"(?:add|create|insert)\s+(?:a\s+)?(?:new\s+)?(?P<type>member|beam|column|brace|diagonal|node)\s+(?:from|between)\s+(?P<start>[Nn]\d+)\s+(?:to|and)\s+(?P<end>[Nn]\d+)",
        r"(?:connect|link|join)\s+(?P<start>[Nn]\d+)\s+(?:to|and|with)\s+(?P<end>[Nn]\d+)",
        r"(?:add|create|insert)\s+(?:a\s+)?(?:new\s+)?node\s+(?:at\s+)?(?P<x>[\d.]+)\s*,?\s*(?P<y>[\d.]+)(?:\s*,?\s*(?P<z>[\d.]+))?",
        r"(?:add|insert)\s+(?:a\s+)?(?:new\s+)?story\s+(?:on\s+)?(?:top|above)",
        r"(?:add|extend)\s+(?:a\s+)?(?:new\s+)?bay\s+(?:to\s+)?(?:the\s+)?(?P<direction>left|right|front|back)",
    ],
    "remove_element": [
        r"(?:remove|delete|drop|erase)\s+(?:member\s+)?(?P<id>[MN]\d+)",
        r"(?:get rid of|take out|eliminate)\s+(?P<id>[MN]\d+)",
        r"(?:remove|delete)\s+(?:the\s+)?last\s+(?P<type>member|node|story|bay)",
    ],
    "load_operation": [
        r"(?:add|apply|place)\s+(?:a\s+)?(?P<value>[\d.]+)\s*(?P<unit>kN|N|kN/m|kN/m2)?\s*(?P<type>point|distributed|udl)?\s*load\s+(?:at|on|to)\s+(?P<target>[MN]\d+|\w+)",
        r"(?:apply|add)\s+(?P<value>[\d.]+)\s*(?P<unit>kN|N)?\s+(?:downward|vertical|horizontal)\s+(?:force|load)\s+(?:at\s+)?(?P<target>[Nn]\d+)",
        r"(?:remove|delete|clear)\s+(?:all\s+)?loads?\s+(?:from\s+)?(?P<target>[MN]\d+)?",
        r"(?:set|change)\s+load\s+(?:to\s+)?(?P<value>[\d.]+)\s*(?P<unit>kN|N)?",
    ],
    "transform": [
        r"(?:set|change|make|increase|decrease)\s+(?:the\s+)?span\s+(?:to\s+)?(?P<value>[\d.]+)\s*m?",
        r"(?:scale|resize)\s+(?:the\s+)?(?:model|structure)\s+(?:by\s+|to\s+)?(?P<factor>[\d.]+)(?:\s*[xX%])?",
        r"(?:set|change)\s+(?:the\s+)?height\s+(?:to\s+)?(?P<value>[\d.]+)\s*m?",
        r"(?:rotate|turn)\s+(?:the\s+)?(?:model|structure)\s+(?:by\s+)?(?P<angle>[\d.]+)\s*(?:degrees?|°)?",
        r"(?:mirror|flip)\s+(?:the\s+)?(?:model|structure)\s+(?:about|across|along)\s+(?:the\s+)?(?P<axis>[xyzXYZ])\s*(?:axis)?",
        r"(?:move|translate|shift)\s+(?:the\s+)?(?:model|structure|all)\s+(?:by\s+)?(?P<dx>[\d.-]+)\s*,?\s*(?P<dy>[\d.-]+)(?:\s*,?\s*(?P<dz>[\d.-]+))?",
    ],
    "generate": [
        r"(?:create|generate|make|build|design)\s+(?:a\s+)?(?P<span>[\d.]+)\s*m?\s*(?:span\s+)?(?P<type>truss|beam|frame|portal|bridge|warehouse|building)",
        r"(?:create|generate|make)\s+(?:a\s+)?(?P<stories>\d+)(?:\s*(?:stor(?:ey|y)|floor))\s+(?P<type>building|frame|structure)",
        r"(?:create|generate|design)\s+(?:a\s+)?(?P<type>pratt|howe|warren|fink|k)\s*(?:truss)?\s+(?:with\s+)?(?P<span>[\d.]+)\s*m?\s*span",
        r"g\s*\+\s*(?P<floors>\d+)\s+(?P<type>building|frame|structure)",
    ],
    "query": [
        r"(?:what|show|tell|give)\s+(?:is|me|us)?\s*(?:the\s+)?(?P<prop>span|height|weight|members?|nodes?|loads?|deflection|stress)",
        r"(?:how\s+many|count)\s+(?P<type>nodes?|members?|supports?|loads?)",
        r"(?:list|show)\s+(?:all\s+)?(?P<type>nodes?|members?|supports?|loads?)",
    ],
    "optimize": [
        r"(?:optimize|improve|reduce)\s+(?:the\s+)?(?P<target>weight|cost|deflection|stress)",
        r"(?:auto-design|auto\s+design|design\s+check)\s+(?:for\s+)?(?P<code>IS\s*800|eurocode|aisc)?",
        r"(?:check|verify)\s+(?:the\s+)?(?:design|stability|capacity)",
    ],
}

SUGGESTIONS_MAP = {
    "MODIFY_SECTION": [
        "Try: 'Change columns to ISMB400'",
        "Try: 'Set all beams to ISMB300'",
        "Try: 'Use ISMB500 for columns'",
    ],
    "MODIFY_SUPPORT": [
        "Try: 'Add fixed support at N1'",
        "Try: 'Make N5 a pinned support'",
        "Try: 'Change support at N1 to roller'",
    ],
    "ADD_ELEMENT": [
        "Try: 'Add member from N1 to N5'",
        "Try: 'Create node at 5, 3, 0'",
        "Try: 'Add a diagonal brace from N2 to N6'",
    ],
    "SCALE_MODEL": [
        "Try: 'Set span to 15m'",
        "Try: 'Change height to 6m'",
        "Try: 'Scale model by 1.5'",
    ],
    "GENERATE_STRUCTURE": [
        "Try: 'Create a 12m span Pratt truss'",
        "Try: 'Design a G+3 building frame'",
        "Try: 'Generate 20m warehouse portal'",
    ],
    "UNKNOWN": [
        "You can say things like:",
        "• 'Create a 10m truss'",
        "• 'Change columns to ISMB400'",
        "• 'Add support at N3'",
        "• 'Remove member M5'",
        "• 'Set span to 12m'",
    ],
}

ISMB_PROGRESSION = [
    "ISMB150",
    "ISMB200",
    "ISMB250",
    "ISMB300",
    "ISMB350",
    "ISMB400",
    "ISMB450",
    "ISMB500",
    "ISMB550",
    "ISMB600",
]
