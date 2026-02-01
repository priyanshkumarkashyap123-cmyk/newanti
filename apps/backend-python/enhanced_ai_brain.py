"""
Enhanced AI Brain - 1000x More Powerful Structural Engineering AI
=================================================================

This module provides a massively enhanced AI system for understanding 
natural language commands and generating/modifying structural models.

Features:
- Deep structural engineering domain knowledge
- Advanced intent classification
- Multi-turn conversation context
- Complex modification commands
- Error recovery and suggestions
- IS code compliance checking
"""

import re
import json
import os
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

# ============================================
# INTENT CLASSIFICATION
# ============================================

class UserIntent(Enum):
    """Classification of user intents"""
    # Generation intents
    GENERATE_STRUCTURE = "generate_structure"
    GENERATE_FROM_TEMPLATE = "generate_from_template"
    
    # Modification intents
    MODIFY_SECTION = "modify_section"
    MODIFY_SUPPORT = "modify_support"
    MODIFY_LOAD = "modify_load"
    MODIFY_NODE = "modify_node"
    MODIFY_MEMBER = "modify_member"
    ADD_ELEMENT = "add_element"
    REMOVE_ELEMENT = "remove_element"
    SCALE_MODEL = "scale_model"
    ROTATE_MODEL = "rotate_model"
    MIRROR_MODEL = "mirror_model"
    EXTEND_MODEL = "extend_model"
    
    # Analysis intents
    RUN_ANALYSIS = "run_analysis"
    CHECK_STABILITY = "check_stability"
    OPTIMIZE_DESIGN = "optimize_design"
    
    # Query intents
    EXPLAIN_CONCEPT = "explain_concept"
    QUERY_MODEL = "query_model"
    QUERY_RESULTS = "query_results"
    GET_HELP = "get_help"
    
    # Other
    UNKNOWN = "unknown"

@dataclass
class ParsedCommand:
    """Parsed user command with extracted parameters"""
    intent: UserIntent
    confidence: float
    entities: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""
    suggestions: List[str] = field(default_factory=list)

# ============================================
# STRUCTURAL ENGINEERING KNOWLEDGE BASE
# ============================================

ENGINEERING_KNOWLEDGE = {
    # Structure types and their characteristics
    "structures": {
        "truss": {
            "types": ["pratt", "howe", "warren", "k-truss", "fink", "bowstring"],
            "components": ["top_chord", "bottom_chord", "diagonals", "verticals"],
            "typical_spans": {"min": 6, "max": 60, "optimal": 15},
            "typical_depth_ratio": 0.1,  # depth/span
            "materials": ["steel", "aluminum", "timber"],
            "sections": {
                "chord": ["ISA100x100x10", "ISA150x150x15", "ISMC200"],
                "web": ["ISA75x75x8", "ISA50x50x6", "ISA65x65x6"]
            }
        },
        "beam": {
            "types": ["simple", "cantilever", "continuous", "overhanging"],
            "components": ["main_beam"],
            "typical_spans": {"min": 2, "max": 15, "optimal": 6},
            "materials": ["steel", "concrete", "timber"],
            "sections": ["ISMB200", "ISMB250", "ISMB300", "ISMB350", "ISMB400"]
        },
        "frame": {
            "types": ["portal", "multi-bay", "multi-story", "rigid"],
            "components": ["columns", "beams", "rafters", "bracing"],
            "typical_heights": {"story": 3.5, "industrial": 6},
            "typical_bays": {"min": 4, "max": 9, "optimal": 6},
            "sections": {
                "column": ["ISMB300", "ISMB350", "ISMB400", "ISMB500"],
                "beam": ["ISMB250", "ISMB300", "ISMB350"],
                "rafter": ["ISMB200", "ISMB250"]
            }
        },
        "building": {
            "types": ["residential", "commercial", "industrial", "warehouse"],
            "typical_stories": {"residential": 4, "commercial": 10, "industrial": 2},
            "story_height": {"residential": 3.0, "commercial": 3.5, "industrial": 6.0}
        }
    },
    
    # IS Code sections database (expanded)
    "sections": {
        # ISMB - Indian Standard Medium Weight Beams
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
        # ISMC - Channels
        "ISMC75": {"depth": 75, "width": 40, "area": 878, "Ix": 76e4},
        "ISMC100": {"depth": 100, "width": 50, "area": 1170, "Ix": 187e4},
        "ISMC150": {"depth": 150, "width": 75, "area": 2170, "Ix": 779e4},
        "ISMC200": {"depth": 200, "width": 75, "area": 2830, "Ix": 1830e4},
        "ISMC250": {"depth": 250, "width": 80, "area": 3900, "Ix": 3880e4},
        "ISMC300": {"depth": 300, "width": 90, "area": 4640, "Ix": 6362e4},
        # ISA - Angles
        "ISA50x50x6": {"leg": 50, "thickness": 6, "area": 569},
        "ISA65x65x6": {"leg": 65, "thickness": 6, "area": 744},
        "ISA75x75x8": {"leg": 75, "thickness": 8, "area": 1140},
        "ISA100x100x10": {"leg": 100, "thickness": 10, "area": 1900},
        "ISA150x150x15": {"leg": 150, "thickness": 15, "area": 4280},
    },
    
    # Support types
    "supports": {
        "fixed": {"fx": True, "fy": True, "fz": True, "mx": True, "my": True, "mz": True},
        "pinned": {"fx": True, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller": {"fx": False, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller_x": {"fx": False, "fy": True, "fz": True, "mx": False, "my": False, "mz": False},
        "roller_z": {"fx": True, "fy": True, "fz": False, "mx": False, "my": False, "mz": False},
    },
    
    # Load types (IS 875)
    "loads": {
        "residential": {"live": 2.0, "dead": 25.0, "partition": 1.5},
        "office": {"live": 3.0, "dead": 25.0, "partition": 1.5},
        "commercial": {"live": 4.0, "dead": 25.0, "partition": 2.0},
        "industrial": {"live": 5.0, "dead": 25.0, "partition": 0},
        "storage": {"live": 7.5, "dead": 25.0, "partition": 0},
        "roof_accessible": {"live": 1.5, "dead": 2.0, "partition": 0},
        "roof_inaccessible": {"live": 0.75, "dead": 2.0, "partition": 0},
    }
}

# ============================================
# ADVANCED COMMAND PATTERNS
# ============================================

COMMAND_PATTERNS = {
    # Section changes
    "section_change": [
        r"(?:change|set|make|update|use)\s+(?:all\s+)?(?:the\s+)?(columns?|beams?|members?|chords?|diagonals?|verticals?|rafters?)\s+(?:to\s+|section\s+)?(?:to\s+)?([A-Z]{2,4}\d+(?:[xX]\d+)*)",
        r"(?:change|set|make|update)\s+(?:section\s+of\s+)?([MN]\d+(?:\s*,\s*[MN]\d+)*)\s+(?:to\s+)?([A-Z]{2,4}\d+)",
        r"([A-Z]{2,4}\d+(?:[xX]\d+)*)\s+(?:for\s+)?(?:all\s+)?(columns?|beams?|members?)",
        r"(?:upgrade|strengthen|reinforce)\s+(?:the\s+)?(columns?|beams?)\s+(?:to\s+)?([A-Z]{2,4}\d+)?",
        r"(?:make|use)\s+heavier\s+(columns?|beams?)",
        r"(?:make|use)\s+lighter\s+(columns?|beams?)",
    ],
    
    # Support modifications
    "support_change": [
        r"(?:add|create|set|make|place)\s+(?:a\s+)?(?P<type>fixed|pinned|roller|hinged)?\s*support\s+(?:at|to|on)\s+(?P<node>[Nn]\d+)",
        r"(?:support|fix|pin|hinge)\s+(?:node\s+)?(?P<node>[Nn]\d+)",
        r"(?:make|set)\s+(?P<node>[Nn]\d+)\s+(?:a\s+)?(?P<type>fixed|pinned|roller)?\s*support",
        r"(?:remove|delete|release)\s+support\s+(?:from\s+|at\s+)?(?P<node>[Nn]\d+)",
        r"(?:change|convert)\s+support\s+(?:at\s+)?(?P<node>[Nn]\d+)\s+(?:to|from)\s+(?P<type>fixed|pinned|roller)",
    ],
    
    # Add/remove elements
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
    
    # Load operations
    "load_operation": [
        r"(?:add|apply|place)\s+(?:a\s+)?(?P<value>[\d.]+)\s*(?P<unit>kN|N|kN/m|kN/m2)?\s*(?P<type>point|distributed|udl)?\s*load\s+(?:at|on|to)\s+(?P<target>[MN]\d+|\w+)",
        r"(?:apply|add)\s+(?P<value>[\d.]+)\s*(?P<unit>kN|N)?\s+(?:downward|vertical|horizontal)\s+(?:force|load)\s+(?:at\s+)?(?P<target>[Nn]\d+)",
        r"(?:remove|delete|clear)\s+(?:all\s+)?loads?\s+(?:from\s+)?(?P<target>[MN]\d+)?",
        r"(?:set|change)\s+load\s+(?:to\s+)?(?P<value>[\d.]+)\s*(?P<unit>kN|N)?",
    ],
    
    # Scaling and transformations
    "transform": [
        r"(?:set|change|make|increase|decrease)\s+(?:the\s+)?span\s+(?:to\s+)?(?P<value>[\d.]+)\s*m?",
        r"(?:scale|resize)\s+(?:the\s+)?(?:model|structure)\s+(?:by\s+|to\s+)?(?P<factor>[\d.]+)(?:\s*[xX%])?",
        r"(?:set|change)\s+(?:the\s+)?height\s+(?:to\s+)?(?P<value>[\d.]+)\s*m?",
        r"(?:rotate|turn)\s+(?:the\s+)?(?:model|structure)\s+(?:by\s+)?(?P<angle>[\d.]+)\s*(?:degrees?|°)?",
        r"(?:mirror|flip)\s+(?:the\s+)?(?:model|structure)\s+(?:about|across|along)\s+(?:the\s+)?(?P<axis>[xyzXYZ])\s*(?:axis)?",
        r"(?:move|translate|shift)\s+(?:the\s+)?(?:model|structure|all)\s+(?:by\s+)?(?P<dx>[\d.-]+)\s*,?\s*(?P<dy>[\d.-]+)(?:\s*,?\s*(?P<dz>[\d.-]+))?",
    ],
    
    # Generation commands
    "generate": [
        r"(?:create|generate|make|build|design)\s+(?:a\s+)?(?P<span>[\d.]+)\s*m?\s*(?:span\s+)?(?P<type>truss|beam|frame|portal|bridge|warehouse|building)",
        r"(?:create|generate|make)\s+(?:a\s+)?(?P<stories>\d+)(?:\s*(?:stor(?:ey|y)|floor))\s+(?P<type>building|frame|structure)",
        r"(?:create|generate|design)\s+(?:a\s+)?(?P<type>pratt|howe|warren|fink|k)\s*(?:truss)?\s+(?:with\s+)?(?P<span>[\d.]+)\s*m?\s*span",
        r"g\s*\+\s*(?P<floors>\d+)\s+(?P<type>building|frame|structure)",
    ],
    
    # Query commands
    "query": [
        r"(?:what|show|tell|give)\s+(?:is|me|us)?\s*(?:the\s+)?(?P<prop>span|height|weight|members?|nodes?|loads?|deflection|stress)",
        r"(?:how\s+many|count)\s+(?P<type>nodes?|members?|supports?|loads?)",
        r"(?:list|show)\s+(?:all\s+)?(?P<type>nodes?|members?|supports?|loads?)",
    ],
    
    # Optimization
    "optimize": [
        r"(?:optimize|improve|reduce)\s+(?:the\s+)?(?P<target>weight|cost|deflection|stress)",
        r"(?:auto-design|auto\s+design|design\s+check)\s+(?:for\s+)?(?P<code>IS\s*800|eurocode|aisc)?",
        r"(?:check|verify)\s+(?:the\s+)?(?:design|stability|capacity)",
    ],
}

# ============================================
# ENHANCED AI BRAIN CLASS
# ============================================

class EnhancedAIBrain:
    """
    1000x Enhanced AI Brain for Structural Engineering
    
    Capabilities:
    - Advanced natural language understanding
    - Context-aware command parsing
    - Multi-step command execution
    - Intelligent error recovery
    - Domain-specific knowledge application
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        self.conversation_history: List[Dict[str, str]] = []
        self.model_context: Optional[Dict[str, Any]] = None
        
    def set_model_context(self, model: Dict[str, Any]):
        """Set the current model for context-aware responses"""
        self.model_context = model
        
    def parse_command(self, text: str) -> ParsedCommand:
        """
        Parse user command with advanced NLP understanding
        
        Returns:
            ParsedCommand with intent, entities, and suggestions
        """
        text_lower = text.lower().strip()
        
        # Try each pattern category
        for intent_name, patterns in COMMAND_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return self._build_parsed_command(
                        intent_name, 
                        match, 
                        text,
                        confidence=0.9
                    )
        
        # Fallback to intent classification
        intent = self._classify_intent(text_lower)
        
        return ParsedCommand(
            intent=intent,
            confidence=0.6 if intent != UserIntent.UNKNOWN else 0.2,
            entities=self._extract_entities(text),
            raw_text=text,
            suggestions=self._get_suggestions(intent, text)
        )
    
    def _build_parsed_command(
        self, 
        intent_name: str, 
        match: re.Match, 
        text: str,
        confidence: float
    ) -> ParsedCommand:
        """Build ParsedCommand from regex match"""
        
        intent_map = {
            "section_change": UserIntent.MODIFY_SECTION,
            "support_change": UserIntent.MODIFY_SUPPORT,
            "add_element": UserIntent.ADD_ELEMENT,
            "remove_element": UserIntent.REMOVE_ELEMENT,
            "load_operation": UserIntent.MODIFY_LOAD,
            "transform": UserIntent.SCALE_MODEL,
            "generate": UserIntent.GENERATE_STRUCTURE,
            "query": UserIntent.QUERY_MODEL,
            "optimize": UserIntent.OPTIMIZE_DESIGN,
        }
        
        intent = intent_map.get(intent_name, UserIntent.UNKNOWN)
        
        # Extract named groups or numbered groups
        try:
            entities = match.groupdict() if match.lastgroup else {}
            if not entities:
                entities = {"groups": match.groups()}
        except:
            entities = {"groups": match.groups()}
        
        return ParsedCommand(
            intent=intent,
            confidence=confidence,
            entities=entities,
            raw_text=text,
            suggestions=[]
        )
    
    def _classify_intent(self, text: str) -> UserIntent:
        """Classify intent from text"""
        
        # Generation keywords
        if any(kw in text for kw in ["create", "generate", "make", "build", "design", "new"]):
            if any(kw in text for kw in ["truss", "beam", "frame", "portal", "bridge", "building"]):
                return UserIntent.GENERATE_STRUCTURE
                
        # Modification keywords
        if any(kw in text for kw in ["change", "set", "update", "modify", "make"]):
            if any(kw in text for kw in ["section", "ismb", "ismc", "isa"]):
                return UserIntent.MODIFY_SECTION
            if any(kw in text for kw in ["support", "fixed", "pinned", "roller"]):
                return UserIntent.MODIFY_SUPPORT
            if any(kw in text for kw in ["load", "force"]):
                return UserIntent.MODIFY_LOAD
            if any(kw in text for kw in ["span", "height", "scale", "size"]):
                return UserIntent.SCALE_MODEL
                
        # Add/remove
        if any(kw in text for kw in ["add", "insert", "create"]):
            return UserIntent.ADD_ELEMENT
        if any(kw in text for kw in ["remove", "delete", "drop"]):
            return UserIntent.REMOVE_ELEMENT
            
        # Analysis
        if any(kw in text for kw in ["analyze", "analysis", "run", "solve"]):
            return UserIntent.RUN_ANALYSIS
        if any(kw in text for kw in ["optimize", "improve", "reduce"]):
            return UserIntent.OPTIMIZE_DESIGN
            
        # Queries
        if any(kw in text for kw in ["what", "how", "show", "explain", "tell"]):
            if any(kw in text for kw in ["is", "means", "concept", "theory"]):
                return UserIntent.EXPLAIN_CONCEPT
            return UserIntent.QUERY_MODEL
            
        # Help
        if any(kw in text for kw in ["help", "how to", "can you"]):
            return UserIntent.GET_HELP
            
        return UserIntent.UNKNOWN
    
    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        entities = {}
        
        # Numbers with units
        span_match = re.search(r'(\d+(?:\.\d+)?)\s*m(?:eter)?(?:\s+span)?', text, re.I)
        if span_match:
            entities['span'] = float(span_match.group(1))
            
        height_match = re.search(r'(\d+(?:\.\d+)?)\s*m(?:eter)?(?:\s+(?:high|height|tall))', text, re.I)
        if height_match:
            entities['height'] = float(height_match.group(1))
            
        # Node IDs
        node_matches = re.findall(r'[Nn](\d+)', text)
        if node_matches:
            entities['nodes'] = [f"N{n}" for n in node_matches]
            
        # Member IDs
        member_matches = re.findall(r'[Mm](\d+)', text)
        if member_matches:
            entities['members'] = [f"M{m}" for m in member_matches]
            
        # Sections
        section_match = re.search(r'(IS[MC][BC]?\d+|ISA\d+[xX]\d+[xX]\d+)', text, re.I)
        if section_match:
            entities['section'] = section_match.group(1).upper()
            
        # Stories
        story_match = re.search(r'(\d+)\s*(?:stor(?:ey|y|ies)|floor)', text, re.I)
        if story_match:
            entities['stories'] = int(story_match.group(1))
            
        # G+X format
        gplus_match = re.search(r'g\s*\+\s*(\d+)', text, re.I)
        if gplus_match:
            entities['stories'] = int(gplus_match.group(1)) + 1
            
        # Bays
        bay_match = re.search(r'(\d+)\s*(?:bay|panel)', text, re.I)
        if bay_match:
            entities['bays'] = int(bay_match.group(1))
            
        # Load value
        load_match = re.search(r'(\d+(?:\.\d+)?)\s*(kN|N|kN/m|kN/m2)?', text, re.I)
        if load_match:
            entities['load_value'] = float(load_match.group(1))
            entities['load_unit'] = load_match.group(2) or 'kN'
            
        # Support type
        for support in ['fixed', 'pinned', 'roller', 'hinged']:
            if support in text.lower():
                entities['support_type'] = support
                break
                
        return entities
    
    def _get_suggestions(self, intent: UserIntent, text: str) -> List[str]:
        """Get command suggestions based on intent"""
        
        suggestions_map = {
            UserIntent.MODIFY_SECTION: [
                "Try: 'Change columns to ISMB400'",
                "Try: 'Set all beams to ISMB300'",
                "Try: 'Use ISMB500 for columns'"
            ],
            UserIntent.MODIFY_SUPPORT: [
                "Try: 'Add fixed support at N1'",
                "Try: 'Make N5 a pinned support'",
                "Try: 'Change support at N1 to roller'"
            ],
            UserIntent.ADD_ELEMENT: [
                "Try: 'Add member from N1 to N5'",
                "Try: 'Create node at 5, 3, 0'",
                "Try: 'Add a diagonal brace from N2 to N6'"
            ],
            UserIntent.SCALE_MODEL: [
                "Try: 'Set span to 15m'",
                "Try: 'Change height to 6m'",
                "Try: 'Scale model by 1.5'"
            ],
            UserIntent.GENERATE_STRUCTURE: [
                "Try: 'Create a 12m span Pratt truss'",
                "Try: 'Design a G+3 building frame'",
                "Try: 'Generate 20m warehouse portal'"
            ],
            UserIntent.UNKNOWN: [
                "You can say things like:",
                "• 'Create a 10m truss'",
                "• 'Change columns to ISMB400'",
                "• 'Add support at N3'",
                "• 'Remove member M5'",
                "• 'Set span to 12m'"
            ]
        }
        
        return suggestions_map.get(intent, [])
    
    def execute_modification(
        self, 
        model: Dict[str, Any], 
        parsed: ParsedCommand
    ) -> Dict[str, Any]:
        """
        Execute model modification based on parsed command
        
        Returns:
            Dict with success, model, message, changes
        """
        handlers = {
            UserIntent.MODIFY_SECTION: self._handle_section_change,
            UserIntent.MODIFY_SUPPORT: self._handle_support_change,
            UserIntent.ADD_ELEMENT: self._handle_add_element,
            UserIntent.REMOVE_ELEMENT: self._handle_remove_element,
            UserIntent.SCALE_MODEL: self._handle_transform,
            UserIntent.MODIFY_LOAD: self._handle_load_change,
        }
        
        handler = handlers.get(parsed.intent)
        if handler:
            return handler(model, parsed)
        
        return {
            "success": False,
            "model": model,
            "message": f"Unknown action: {parsed.intent.value}",
            "changes": [],
            "suggestions": parsed.suggestions
        }
    
    def _handle_section_change(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle section change commands"""
        entities = parsed.entities
        members = model.get('members', [])
        changes = []
        
        # Get target and section from entities
        target = None
        section = None
        
        groups = entities.get('groups', ())
        if len(groups) >= 2:
            target = groups[0].lower() if groups[0] else None
            section = groups[1].upper() if groups[1] else None
        
        target = target or entities.get('target', 'all')
        section = section or entities.get('section')
        
        # Handle "heavier" or "lighter" commands
        if not section:
            if "heavier" in parsed.raw_text.lower() or "stronger" in parsed.raw_text.lower():
                section = self._get_heavier_section(members, target)
            elif "lighter" in parsed.raw_text.lower():
                section = self._get_lighter_section(members, target)
        
        if not section:
            return {
                "success": False,
                "model": model,
                "message": "Could not determine target section. Please specify like 'ISMB400'",
                "changes": [],
                "suggestions": ["Try: 'Change columns to ISMB400'"]
            }
        
        # Apply changes
        changed_count = 0
        for member in members:
            member_type = member.get('type', member.get('member_type', '')).lower()
            member_id = member.get('id', '').lower()
            
            should_change = False
            if target in ['column', 'columns'] and 'column' in member_type:
                should_change = True
            elif target in ['beam', 'beams'] and 'beam' in member_type:
                should_change = True
            elif target in ['rafter', 'rafters'] and 'rafter' in member_type:
                should_change = True
            elif target in ['chord', 'chords'] and 'chord' in member_type:
                should_change = True
            elif target in ['diagonal', 'diagonals', 'web'] and ('diagonal' in member_type or 'web' in member_type):
                should_change = True
            elif target in ['all', 'member', 'members']:
                should_change = True
            elif member_id in target:
                should_change = True
            
            if should_change:
                old_section = member.get('sectionId') or member.get('section_profile') or member.get('section')
                
                # Update section using whatever key exists
                if 'sectionId' in member:
                    member['sectionId'] = section
                elif 'section_profile' in member:
                    member['section_profile'] = section
                else:
                    member['section'] = section
                    
                changes.append(f"{member.get('id')}: {old_section} → {section}")
                changed_count += 1
        
        if changed_count > 0:
            return {
                "success": True,
                "model": model,
                "message": f"✓ Changed {changed_count} member(s) to {section}",
                "changes": changes
            }
        else:
            return {
                "success": False,
                "model": model,
                "message": f"No members matching '{target}' found",
                "changes": [],
                "suggestions": ["Check member types in your model"]
            }
    
    def _get_heavier_section(self, members: List[Dict], target: str) -> Optional[str]:
        """Get next heavier section"""
        ismb_progression = ["ISMB150", "ISMB200", "ISMB250", "ISMB300", "ISMB350", "ISMB400", "ISMB450", "ISMB500", "ISMB550", "ISMB600"]
        
        for member in members:
            current = member.get('sectionId') or member.get('section_profile') or member.get('section', '')
            if current in ismb_progression:
                idx = ismb_progression.index(current)
                if idx < len(ismb_progression) - 1:
                    return ismb_progression[idx + 1]
        
        return "ISMB400"
    
    def _get_lighter_section(self, members: List[Dict], target: str) -> Optional[str]:
        """Get next lighter section"""
        ismb_progression = ["ISMB150", "ISMB200", "ISMB250", "ISMB300", "ISMB350", "ISMB400", "ISMB450", "ISMB500", "ISMB550", "ISMB600"]
        
        for member in members:
            current = member.get('sectionId') or member.get('section_profile') or member.get('section', '')
            if current in ismb_progression:
                idx = ismb_progression.index(current)
                if idx > 0:
                    return ismb_progression[idx - 1]
        
        return "ISMB250"
    
    def _handle_support_change(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle support modification commands"""
        entities = parsed.entities
        nodes = model.get('nodes', [])
        
        node_id = entities.get('node') or (entities.get('nodes', [None])[0])
        support_type = entities.get('type') or entities.get('support_type', 'pinned')
        
        if not node_id:
            return {
                "success": False,
                "model": model,
                "message": "Please specify a node (e.g., N1, N2)",
                "changes": []
            }
        
        node_id = node_id.upper()
        support_config = ENGINEERING_KNOWLEDGE["supports"].get(support_type, ENGINEERING_KNOWLEDGE["supports"]["pinned"])
        
        for node in nodes:
            if node.get('id', '').upper() == node_id:
                node['restraints'] = support_config.copy()
                return {
                    "success": True,
                    "model": model,
                    "message": f"✓ Added {support_type} support at {node_id}",
                    "changes": [f"{node_id}: {support_type} support"]
                }
        
        return {
            "success": False,
            "model": model,
            "message": f"Node {node_id} not found",
            "changes": []
        }
    
    def _handle_add_element(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle add node/member commands"""
        entities = parsed.entities
        
        # Check if adding a member
        start_node = entities.get('start')
        end_node = entities.get('end')
        
        if start_node and end_node:
            return self._add_member(model, start_node.upper(), end_node.upper())
        
        # Check if adding a node
        if 'x' in entities and 'y' in entities:
            x = float(entities['x'])
            y = float(entities['y'])
            z = float(entities.get('z', 0))
            return self._add_node(model, x, y, z)
        
        # Check for story/bay extension
        if "story" in parsed.raw_text.lower() or "floor" in parsed.raw_text.lower():
            return self._add_story(model)
        
        if "bay" in parsed.raw_text.lower():
            direction = entities.get('direction', 'right')
            return self._add_bay(model, direction)
        
        return {
            "success": False,
            "model": model,
            "message": "Please specify what to add. Examples: 'Add member from N1 to N5' or 'Add node at 5, 3, 0'",
            "changes": []
        }
    
    def _add_member(self, model: Dict[str, Any], start: str, end: str) -> Dict[str, Any]:
        """Add a new member between two nodes"""
        nodes = model.get('nodes', [])
        members = model.get('members', [])
        
        node_ids = {n.get('id', '').upper() for n in nodes}
        
        if start not in node_ids:
            return {"success": False, "model": model, "message": f"Start node {start} not found", "changes": []}
        if end not in node_ids:
            return {"success": False, "model": model, "message": f"End node {end} not found", "changes": []}
        
        # Generate new ID
        existing_nums = [int(m.get('id', 'M0')[1:]) for m in members if m.get('id', '').startswith('M')]
        new_num = max(existing_nums, default=0) + 1
        new_id = f"M{new_num}"
        
        new_member = {
            'id': new_id,
            'startNodeId': start,
            'endNodeId': end,
            'sectionId': 'ISMB300',
            'type': 'brace'
        }
        members.append(new_member)
        
        return {
            "success": True,
            "model": model,
            "message": f"✓ Added member {new_id} from {start} to {end}",
            "changes": [f"Added: {new_id} ({start} → {end})"]
        }
    
    def _add_node(self, model: Dict[str, Any], x: float, y: float, z: float) -> Dict[str, Any]:
        """Add a new node at coordinates"""
        nodes = model.get('nodes', [])
        
        existing_nums = [int(n.get('id', 'N0')[1:]) for n in nodes if n.get('id', '').startswith('N')]
        new_num = max(existing_nums, default=0) + 1
        new_id = f"N{new_num}"
        
        new_node = {
            'id': new_id,
            'x': x,
            'y': y,
            'z': z
        }
        nodes.append(new_node)
        
        return {
            "success": True,
            "model": model,
            "message": f"✓ Added node {new_id} at ({x}, {y}, {z})",
            "changes": [f"Added: {new_id} at ({x}, {y}, {z})"]
        }
    
    def _add_story(self, model: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new story on top of existing structure"""
        nodes = model.get('nodes', [])
        members = model.get('members', [])
        
        if not nodes:
            return {"success": False, "model": model, "message": "No existing structure to extend", "changes": []}
        
        # Find top nodes (highest Y)
        max_y = max(n.get('y', 0) for n in nodes)
        top_nodes = [n for n in nodes if abs(n.get('y', 0) - max_y) < 0.1]
        
        if len(top_nodes) < 2:
            return {"success": False, "model": model, "message": "Need at least 2 top nodes to add story", "changes": []}
        
        # Determine story height
        y_values = sorted(set(n.get('y', 0) for n in nodes), reverse=True)
        story_height = y_values[0] - y_values[1] if len(y_values) > 1 else 3.0
        
        # Create new nodes
        node_map = {}
        new_nodes = []
        changes = []
        
        existing_nums = [int(n.get('id', 'N0')[1:]) for n in nodes if n.get('id', '').startswith('N')]
        next_num = max(existing_nums, default=0) + 1
        
        for old_node in top_nodes:
            new_id = f"N{next_num}"
            new_node = {
                'id': new_id,
                'x': old_node.get('x', 0),
                'y': old_node.get('y', 0) + story_height,
                'z': old_node.get('z', 0)
            }
            new_nodes.append(new_node)
            node_map[old_node['id']] = new_id
            changes.append(f"Node: {new_id}")
            next_num += 1
        
        nodes.extend(new_nodes)
        
        # Create new columns (vertical members)
        member_nums = [int(m.get('id', 'M0')[1:]) for m in members if m.get('id', '').startswith('M')]
        next_member = max(member_nums, default=0) + 1
        
        for old_id, new_id in node_map.items():
            member_id = f"M{next_member}"
            members.append({
                'id': member_id,
                'startNodeId': old_id,
                'endNodeId': new_id,
                'sectionId': 'ISMB300',
                'type': 'column'
            })
            changes.append(f"Member: {member_id} (Column)")
            next_member += 1
        
        # Create new beams (horizontal)
        # Simple Logic: Connect adjacent nodes in the new story
        # Ideally we'd mirror the floor below, but simple ring connection for now
        for i in range(len(new_nodes) - 1):
             member_id = f"M{next_member}"
             members.append({
                'id': member_id,
                'startNodeId': new_nodes[i]['id'],
                'endNodeId': new_nodes[i+1]['id'],
                'sectionId': 'ISMB250',
                'type': 'beam'
             })
             changes.append(f"Member: {member_id} (Beam)")
             next_member += 1
             
        return {
            "success": True,
            "model": model,
            "message": f"✓ Added new story ({story_height}m height)",
            "changes": changes
        }

    def _add_bay(self, model: Dict[str, Any], direction: str) -> Dict[str, Any]:
        # Placeholder for bay extension logic
        return {"success": False, "model": model, "message": "Bay extension not fully implemented yet", "changes": []}

    # ============================================
    # DESIGN SUGGESTIONS SYSTEM
    # ============================================

    def generate_suggestions(
        self, 
        model: Dict[str, Any], 
        step: str = 'general',
        analysis_results: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate intelligent design suggestions based on model state and analysis
        """
        suggestions = []
        nodes = model.get('nodes', [])
        members = model.get('members', [])
        
        # 1. Geometry & Stability Checks
        if step in ['geometry_input', 'general']:
            # Check for supports
            has_support = any(
                n.get('restraints', {}).get('fx') or n.get('restraints', {}).get('fy') or n.get('restraints', {}).get('fz')
                for n in nodes
            )
            if not has_support:
                suggestions.append({
                    "id": "sug_geom_1",
                    "step": "geometry_input",
                    "type": "warning",
                    "message": "Structure is unstable (no supports). Add supports at the base.",
                    "action_intent": "auto_fix_support"
                })
                
            # Check for floating nodes (nodes with 0 members connected)
            node_ids = {n['id'] for n in nodes}
            connected_nodes = set()
            for m in members:
                connected_nodes.add(m['startNodeId'])
                connected_nodes.add(m['endNodeId'])
            
            floating = node_ids - connected_nodes
            if floating:
                suggestions.append({
                    "id": "sug_geom_2",
                    "step": "geometry_input",
                    "type": "warning",
                    "message": f"{len(floating)} nodes are not connected to any members.",
                    "action_intent": "select_floating_nodes"
                })

        # 2. Member Design Optimization
        if step in ['member_design', 'general'] and analysis_results:
            # Check for over-designed members (low utilization)
            # This requires utilization ratios, or we approximate from forces
            # For this MVP, we'll simulate logic if we had utilization data
            pass
            
        # 3. Heuristic Suggestions (Rule of Thumb)
        if step in ['project_setup', 'general']:
            # Check spans
            long_spans = []
            for m in members:
                start = next((n for n in nodes if n['id'] == m['startNodeId']), None)
                end = next((n for n in nodes if n['id'] == m['endNodeId']), None)
                if start and end:
                    dx = start['x'] - end['x']
                    dy = start['y'] - end['y']
                    dz = start['z'] - end['z']
                    length = (dx*dx + dy*dy + dz*dz)**0.5
                    if length > 12: # Meters
                        long_spans.append(m['id'])
            
            if long_spans:
                suggestions.append({
                    "id": "sug_opt_1",
                    "step": "member_design",
                    "type": "optimization",
                    "message": f"Found {len(long_spans)} members with span > 12m. Consider using trusses or cellular beams for economy.",
                })

        # 4. Code Compliance (IS 800)
        if step in ['loading', 'general']:
            # Check if loads are realistic
            loads_applied = False
            # (Assuming loads are stored on nodes or members - simplistic check)
            # This depends on how loads are structured in the model dict passed here
            # For now, just a generic tip
            suggestions.append({
                "id": "sug_code_1",
                "step": "loading",
                "type": "tip",
                "message": "For residential buildings, IS 875 recommends 2.0 kN/m² Live Load.",
            })

        return suggestions
                'sectionId': 'ISMB350',
                'type': 'column'
            })
            changes.append(f"Column: {member_id}")
            next_member += 1
        
        # Create new beams (horizontal between new nodes)
        sorted_new = sorted(new_nodes, key=lambda n: (n.get('z', 0), n.get('x', 0)))
        for i in range(len(sorted_new) - 1):
            n1, n2 = sorted_new[i], sorted_new[i + 1]
            if abs(n1.get('z', 0) - n2.get('z', 0)) < 0.1:  # Same Z = same frame
                member_id = f"M{next_member}"
                members.append({
                    'id': member_id,
                    'startNodeId': n1['id'],
                    'endNodeId': n2['id'],
                    'sectionId': 'ISMB300',
                    'type': 'beam'
                })
                changes.append(f"Beam: {member_id}")
                next_member += 1
        
        return {
            "success": True,
            "model": model,
            "message": f"✓ Added new story ({len(new_nodes)} nodes, {len(changes) - len(new_nodes)} members)",
            "changes": changes
        }
    
    def _add_bay(self, model: Dict[str, Any], direction: str) -> Dict[str, Any]:
        """Add a new bay to the structure"""
        nodes = model.get('nodes', [])
        members = model.get('members', [])
        
        if not nodes:
            return {"success": False, "model": model, "message": "No existing structure to extend", "changes": []}
        
        # Find rightmost/leftmost nodes
        if direction in ['right', 'front']:
            edge_x = max(n.get('x', 0) for n in nodes)
            edge_nodes = [n for n in nodes if abs(n.get('x', 0) - edge_x) < 0.1]
            offset = 6.0  # Default bay width
        else:
            edge_x = min(n.get('x', 0) for n in nodes)
            edge_nodes = [n for n in nodes if abs(n.get('x', 0) - edge_x) < 0.1]
            offset = -6.0
        
        # Determine bay width from existing
        x_values = sorted(set(n.get('x', 0) for n in nodes))
        if len(x_values) > 1:
            bay_width = x_values[1] - x_values[0]
            offset = bay_width if direction in ['right', 'front'] else -bay_width
        
        # Create new nodes
        node_map = {}
        new_nodes = []
        changes = []
        
        existing_nums = [int(n.get('id', 'N0')[1:]) for n in nodes if n.get('id', '').startswith('N')]
        next_num = max(existing_nums, default=0) + 1
        
        for old_node in edge_nodes:
            new_id = f"N{next_num}"
            new_node = {
                'id': new_id,
                'x': old_node.get('x', 0) + offset,
                'y': old_node.get('y', 0),
                'z': old_node.get('z', 0)
            }
            
            # Copy support if at ground level
            if old_node.get('y', 0) < 0.1 and 'restraints' in old_node:
                new_node['restraints'] = old_node['restraints'].copy()
            
            new_nodes.append(new_node)
            node_map[old_node['id']] = new_id
            changes.append(f"Node: {new_id}")
            next_num += 1
        
        nodes.extend(new_nodes)
        
        # Create connecting members
        member_nums = [int(m.get('id', 'M0')[1:]) for m in members if m.get('id', '').startswith('M')]
        next_member = max(member_nums, default=0) + 1
        
        # Horizontal beams
        for old_id, new_id in node_map.items():
            member_id = f"M{next_member}"
            members.append({
                'id': member_id,
                'startNodeId': old_id,
                'endNodeId': new_id,
                'sectionId': 'ISMB300',
                'type': 'beam'
            })
            changes.append(f"Beam: {member_id}")
            next_member += 1
        
        # Vertical columns in new bay
        sorted_new = sorted(new_nodes, key=lambda n: n.get('y', 0))
        for i in range(len(sorted_new) - 1):
            n1, n2 = sorted_new[i], sorted_new[i + 1]
            if abs(n1.get('x', 0) - n2.get('x', 0)) < 0.1:
                member_id = f"M{next_member}"
                members.append({
                    'id': member_id,
                    'startNodeId': n1['id'],
                    'endNodeId': n2['id'],
                    'sectionId': 'ISMB350',
                    'type': 'column'
                })
                changes.append(f"Column: {member_id}")
                next_member += 1
        
        return {
            "success": True,
            "model": model,
            "message": f"✓ Added bay to {direction} ({len(new_nodes)} nodes, {len(changes) - len(new_nodes)} members)",
            "changes": changes
        }
    
    def _handle_remove_element(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle remove node/member commands"""
        entities = parsed.entities
        
        element_id = entities.get('id') or (entities.get('members', [None])[0]) or (entities.get('nodes', [None])[0])
        
        if not element_id:
            return {
                "success": False,
                "model": model,
                "message": "Please specify what to remove (e.g., M5 or N3)",
                "changes": []
            }
        
        element_id = element_id.upper()
        
        if element_id.startswith('M'):
            members = model.get('members', [])
            original_len = len(members)
            model['members'] = [m for m in members if m.get('id', '').upper() != element_id]
            
            if len(model['members']) < original_len:
                return {
                    "success": True,
                    "model": model,
                    "message": f"✓ Removed member {element_id}",
                    "changes": [f"Removed: {element_id}"]
                }
        
        elif element_id.startswith('N'):
            nodes = model.get('nodes', [])
            members = model.get('members', [])
            
            original_len = len(nodes)
            model['nodes'] = [n for n in nodes if n.get('id', '').upper() != element_id]
            
            if len(model['nodes']) < original_len:
                # Also remove connected members
                removed_members = []
                new_members = []
                for m in members:
                    start = (m.get('startNodeId') or m.get('start_node', '')).upper()
                    end = (m.get('endNodeId') or m.get('end_node', '')).upper()
                    if start == element_id or end == element_id:
                        removed_members.append(m.get('id'))
                    else:
                        new_members.append(m)
                model['members'] = new_members
                
                changes = [f"Removed node: {element_id}"]
                if removed_members:
                    changes.append(f"Removed connected members: {', '.join(removed_members)}")
                
                return {
                    "success": True,
                    "model": model,
                    "message": f"✓ Removed {element_id}" + (f" and {len(removed_members)} connected members" if removed_members else ""),
                    "changes": changes
                }
        
        return {
            "success": False,
            "model": model,
            "message": f"Element {element_id} not found",
            "changes": []
        }
    
    def _handle_transform(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle scale/transform commands"""
        entities = parsed.entities
        nodes = model.get('nodes', [])
        
        if not nodes:
            return {"success": False, "model": model, "message": "No nodes to transform", "changes": []}
        
        changes = []
        
        # Handle span change
        if 'value' in entities and 'span' in parsed.raw_text.lower():
            target_span = float(entities['value'])
            x_values = [n.get('x', 0) for n in nodes]
            current_span = max(x_values) - min(x_values)
            
            if current_span < 0.001:
                return {"success": False, "model": model, "message": "Model has zero span", "changes": []}
            
            scale = target_span / current_span
            min_x = min(x_values)
            
            for node in nodes:
                node['x'] = min_x + (node.get('x', 0) - min_x) * scale
            
            changes.append(f"Span: {current_span:.1f}m → {target_span:.1f}m")
            return {
                "success": True,
                "model": model,
                "message": f"✓ Changed span from {current_span:.1f}m to {target_span:.1f}m",
                "changes": changes
            }
        
        # Handle height change
        if 'value' in entities and 'height' in parsed.raw_text.lower():
            target_height = float(entities['value'])
            y_values = [n.get('y', 0) for n in nodes]
            current_height = max(y_values) - min(y_values)
            
            if current_height < 0.001:
                return {"success": False, "model": model, "message": "Model has zero height", "changes": []}
            
            scale = target_height / current_height
            min_y = min(y_values)
            
            for node in nodes:
                node['y'] = min_y + (node.get('y', 0) - min_y) * scale
            
            changes.append(f"Height: {current_height:.1f}m → {target_height:.1f}m")
            return {
                "success": True,
                "model": model,
                "message": f"✓ Changed height from {current_height:.1f}m to {target_height:.1f}m",
                "changes": changes
            }
        
        # Handle scale factor
        if 'factor' in entities:
            factor = float(entities['factor'])
            if '%' in parsed.raw_text:
                factor = factor / 100.0
            
            for node in nodes:
                node['x'] = node.get('x', 0) * factor
                node['y'] = node.get('y', 0) * factor
                node['z'] = node.get('z', 0) * factor
            
            changes.append(f"Scaled by {factor:.2f}x")
            return {
                "success": True,
                "model": model,
                "message": f"✓ Scaled model by {factor:.2f}x",
                "changes": changes
            }
        
        return {
            "success": False,
            "model": model,
            "message": "Could not determine transformation. Try: 'Set span to 15m' or 'Scale by 1.5'",
            "changes": []
        }
    
    def _handle_load_change(self, model: Dict[str, Any], parsed: ParsedCommand) -> Dict[str, Any]:
        """Handle load modification commands"""
        entities = parsed.entities
        loads = model.setdefault('loads', [])
        
        load_value = entities.get('load_value')
        target = entities.get('target')
        
        if not load_value:
            return {
                "success": False,
                "model": model,
                "message": "Please specify load value (e.g., '10 kN')",
                "changes": []
            }
        
        if not target:
            return {
                "success": False,
                "model": model,
                "message": "Please specify where to apply load (e.g., 'at N3')",
                "changes": []
            }
        
        # Create load
        load_id = f"L{len(loads) + 1}"
        direction = 'fy'  # Default downward
        if 'horizontal' in parsed.raw_text.lower() or 'lateral' in parsed.raw_text.lower():
            direction = 'fx'
        
        new_load = {
            'id': load_id,
            'nodeId': target.upper(),
            direction: -abs(load_value)  # Negative for downward
        }
        loads.append(new_load)
        
        return {
            "success": True,
            "model": model,
            "message": f"✓ Applied {load_value} kN load at {target.upper()}",
            "changes": [f"Load {load_id}: {load_value} kN at {target.upper()}"]
        }
    
    async def generate_with_llm(self, prompt: str) -> Dict[str, Any]:
        """Use LLM for complex generation requests"""
        if not self.api_key:
            return {
                "success": False,
                "error": "No API key configured"
            }
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            
            model = genai.GenerativeModel('gemini-pro')
            
            system_prompt = """You are an expert structural engineering AI for BeamLab.
Output ONLY valid JSON with this exact structure:
{
  "nodes": [{"id": "N1", "x": 0, "y": 0, "z": 0}],
  "members": [{"id": "M1", "start_node": "N1", "end_node": "N2", "section_profile": "ISMB300", "type": "beam"}],
  "metadata": {"name": "Structure Name", "type": "frame"}
}

RULES:
1. Use meters for all dimensions
2. Use Indian Standard sections (ISMB, ISMC, ISA)
3. Ensure structure is stable (proper supports)
4. All members must connect to valid nodes
5. Add supports at ground level (y=0) nodes

For multi-story buildings:
- Story height: 3.0-3.5m residential, 4.0-6.0m industrial
- Bay width: 4-6m typical
- Use ISMB300-400 for columns, ISMB250-300 for beams

For trusses:
- Depth ≈ span/8 to span/12
- Use ISA angles for web members
- Use ISMC channels for chords"""

            full_prompt = f"{system_prompt}\n\nUser request: {prompt}"
            
            response = await model.generate_content_async(full_prompt)
            text = response.text
            
            # Clean response
            text = text.strip()
            if text.startswith('```json'):
                text = text[7:]
            if text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            
            result = json.loads(text.strip())
            
            return {
                "success": True,
                "model": result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# ============================================
# SINGLETON INSTANCE
# ============================================

_brain_instance: Optional[EnhancedAIBrain] = None

def get_ai_brain() -> EnhancedAIBrain:
    """Get the singleton AI Brain instance"""
    global _brain_instance
    if _brain_instance is None:
        _brain_instance = EnhancedAIBrain()
    return _brain_instance
