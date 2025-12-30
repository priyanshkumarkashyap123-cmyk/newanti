"""
Enhanced AI Architect for Structural Model Generation
Uses a hybrid approach: Parameter extraction + Factory fallback + LLM generation
"""

import re
import json
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass
from enum import Enum

class StructureType(Enum):
    SIMPLE_BEAM = "simple_beam"
    CANTILEVER = "cantilever"
    CONTINUOUS_BEAM = "continuous_beam"
    PRATT_TRUSS = "pratt_truss"
    HOWE_TRUSS = "howe_truss"
    WARREN_TRUSS = "warren_truss"
    PORTAL_FRAME = "portal_frame"
    BUILDING_FRAME = "building_frame"
    WAREHOUSE = "warehouse"
    BRIDGE = "bridge"
    FOOTBRIDGE = "footbridge"
    TOWER = "tower"
    TRANSMISSION_TOWER = "transmission_tower"
    CRANE = "crane"
    UNKNOWN = "unknown"

@dataclass
class ExtractedParams:
    """Parameters extracted from natural language prompt"""
    structure_type: StructureType
    span: Optional[float] = None
    height: Optional[float] = None
    width: Optional[float] = None
    length: Optional[float] = None
    stories: Optional[int] = None
    bays: Optional[int] = None
    bays_x: Optional[int] = None
    bays_z: Optional[int] = None
    roof_angle: Optional[float] = None
    support_type: Optional[str] = None
    material: Optional[str] = None
    load: Optional[float] = None
    raw_prompt: str = ""

class PromptAnalyzer:
    """Analyzes natural language prompts to extract structural parameters"""
    
    # Keywords for structure type detection
    STRUCTURE_KEYWORDS = {
        StructureType.SIMPLE_BEAM: ["simple beam", "simply supported", "ss beam", "beam with roller"],
        StructureType.CANTILEVER: ["cantilever", "cantilevered", "fixed free", "overhang"],
        StructureType.CONTINUOUS_BEAM: ["continuous", "multi-span", "multispan", "2-span", "3-span", "4-span", "two span", "three span"],
        StructureType.PRATT_TRUSS: ["pratt", "pratt truss"],
        StructureType.HOWE_TRUSS: ["howe", "howe truss"],
        StructureType.WARREN_TRUSS: ["warren", "warren truss", "triangular truss"],
        StructureType.PORTAL_FRAME: ["portal", "portal frame", "rigid frame"],
        StructureType.BUILDING_FRAME: ["building", "frame", "multi-story", "multistory", "storey", "story", "floor", "office", "residential"],
        StructureType.WAREHOUSE: ["warehouse", "industrial shed", "factory", "godown", "storage"],
        StructureType.BRIDGE: ["bridge", "overpass", "flyover", "viaduct"],
        StructureType.FOOTBRIDGE: ["footbridge", "pedestrian bridge", "walkway"],
        StructureType.TOWER: ["tower", "mast"],
        StructureType.TRANSMISSION_TOWER: ["transmission", "power line", "electricity tower", "lattice tower"],
        StructureType.CRANE: ["crane", "gantry", "overhead crane"],
    }
    
    # Dimension patterns
    DIMENSION_PATTERNS = {
        'span': [
            r'(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)?\s*(?:span|long|length)',
            r'span\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?',
            r'(\d+(?:\.\d+)?)\s*(?:m|meter)\s+(?:beam|truss|bridge)',
        ],
        'height': [
            r'(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*(?:high|height|tall)',
            r'height\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?',
            r'(\d+(?:\.\d+)?)\s*(?:m|meter)?\s*(?:eave|ridge)',
        ],
        'width': [
            r'(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*wide',
            r'width\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?',
        ],
        'stories': [
            r'(\d+)\s*(?:stor(?:ey|y|ies)|floor)',
            r'g\s*\+\s*(\d+)',  # G+3 format
            r'(\d+)\s*level',
        ],
        'bays': [
            r'(\d+)\s*(?:bay|panel|segment)',
            r'(\d+)\s*division',
        ],
        'angle': [
            r'(\d+(?:\.\d+)?)\s*(?:degree|deg|°)\s*(?:roof|pitch|slope)',
            r'(?:roof|pitch|slope)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:degree|deg|°)?',
        ],
        'load': [
            r'(\d+(?:\.\d+)?)\s*(?:kN|kn|kilonewton)',
            r'load\s*(?:of|:)?\s*(\d+(?:\.\d+)?)',
        ],
    }
    
    @classmethod
    def analyze(cls, prompt: str) -> ExtractedParams:
        """Analyze a natural language prompt and extract parameters"""
        prompt_lower = prompt.lower().strip()
        
        # Detect structure type
        structure_type = cls._detect_structure_type(prompt_lower)
        
        # Extract dimensions
        span = cls._extract_dimension(prompt_lower, 'span')
        height = cls._extract_dimension(prompt_lower, 'height')
        width = cls._extract_dimension(prompt_lower, 'width')
        stories = cls._extract_integer(prompt_lower, 'stories')
        bays = cls._extract_integer(prompt_lower, 'bays')
        angle = cls._extract_dimension(prompt_lower, 'angle')
        load = cls._extract_dimension(prompt_lower, 'load')
        
        # Apply defaults based on structure type
        params = cls._apply_defaults(ExtractedParams(
            structure_type=structure_type,
            span=span,
            height=height,
            width=width,
            stories=stories,
            bays=bays,
            roof_angle=angle,
            load=load,
            raw_prompt=prompt
        ))
        
        return params
    
    @classmethod
    def _detect_structure_type(cls, prompt: str) -> StructureType:
        """Detect the type of structure from keywords"""
        for struct_type, keywords in cls.STRUCTURE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in prompt:
                    return struct_type
        
        # Fallback detection
        if 'beam' in prompt:
            if 'cantilever' in prompt or 'fixed' in prompt:
                return StructureType.CANTILEVER
            return StructureType.SIMPLE_BEAM
        elif 'truss' in prompt:
            return StructureType.PRATT_TRUSS
        elif 'frame' in prompt:
            return StructureType.BUILDING_FRAME
        
        return StructureType.UNKNOWN
    
    @classmethod
    def _extract_dimension(cls, prompt: str, dim_type: str) -> Optional[float]:
        """Extract a dimension value from the prompt"""
        patterns = cls.DIMENSION_PATTERNS.get(dim_type, [])
        for pattern in patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except (ValueError, IndexError):
                    continue
        return None
    
    @classmethod
    def _extract_integer(cls, prompt: str, dim_type: str) -> Optional[int]:
        """Extract an integer value from the prompt"""
        value = cls._extract_dimension(prompt, dim_type)
        if value is not None:
            return int(value)
        return None
    
    @classmethod
    def _apply_defaults(cls, params: ExtractedParams) -> ExtractedParams:
        """Apply sensible defaults based on structure type"""
        st = params.structure_type
        
        # Default spans
        if params.span is None:
            if st in [StructureType.SIMPLE_BEAM, StructureType.CANTILEVER]:
                params.span = 6.0
            elif st in [StructureType.PRATT_TRUSS, StructureType.HOWE_TRUSS, StructureType.WARREN_TRUSS]:
                params.span = 12.0
            elif st == StructureType.BRIDGE:
                params.span = 20.0
            elif st == StructureType.FOOTBRIDGE:
                params.span = 15.0
            elif st == StructureType.PORTAL_FRAME:
                params.span = 15.0
            elif st == StructureType.WAREHOUSE:
                params.span = 20.0
        
        # Default heights
        if params.height is None:
            if st in [StructureType.PRATT_TRUSS, StructureType.HOWE_TRUSS, StructureType.WARREN_TRUSS]:
                params.height = params.span / 4 if params.span else 3.0
            elif st == StructureType.PORTAL_FRAME:
                params.height = 6.0
            elif st == StructureType.WAREHOUSE:
                params.height = 8.0
            elif st == StructureType.BUILDING_FRAME:
                params.height = 3.5
            elif st == StructureType.TOWER:
                params.height = 30.0
        
        # Default stories
        if params.stories is None and st == StructureType.BUILDING_FRAME:
            params.stories = 3
        
        # Default bays
        if params.bays is None:
            if st in [StructureType.PRATT_TRUSS, StructureType.HOWE_TRUSS, StructureType.WARREN_TRUSS]:
                params.bays = 6
            elif st == StructureType.BUILDING_FRAME:
                params.bays_x = 2
                params.bays_z = 2
        
        # Default roof angle
        if params.roof_angle is None:
            if st in [StructureType.PORTAL_FRAME, StructureType.WAREHOUSE]:
                params.roof_angle = 15.0
        
        # Default width
        if params.width is None:
            if st == StructureType.WAREHOUSE:
                params.width = params.span or 20.0
            elif st == StructureType.BUILDING_FRAME:
                params.width = 12.0
                params.length = 12.0
        
        return params


class EnhancedAIArchitect:
    """Enhanced AI Architect that combines rule-based and LLM-based generation"""
    
    def __init__(self, gemini_api_key: Optional[str] = None):
        self.api_key = gemini_api_key
        self.analyzer = PromptAnalyzer()
    
    def generate(self, prompt: str) -> Tuple[Dict[str, Any], str]:
        """
        Generate a structural model from a natural language prompt.
        
        Returns:
            Tuple of (model_dict, generation_method)
        """
        # Step 1: Analyze the prompt
        params = self.analyzer.analyze(prompt)
        
        # Step 2: Try factory-based generation first (reliable)
        factory_result = self._try_factory_generation(params)
        if factory_result is not None:
            return factory_result, "factory"
        
        # Step 3: Fall back to LLM if factory can't handle it
        if self.api_key:
            llm_result = self._try_llm_generation(prompt, params)
            if llm_result is not None:
                return llm_result, "llm"
        
        # Step 4: Ultimate fallback - basic structure
        return self._fallback_generation(params), "fallback"
    
    def _try_factory_generation(self, params: ExtractedParams) -> Optional[Dict[str, Any]]:
        """Try to generate using the deterministic factory"""
        from factory import StructuralFactory as SF
        
        st = params.structure_type
        
        try:
            if st == StructureType.SIMPLE_BEAM:
                model = SF.generate_simple_beam(
                    span=params.span or 6.0,
                    support_type="simple"
                )
            elif st == StructureType.CANTILEVER:
                model = SF.generate_simple_beam(
                    span=params.span or 5.0,
                    support_type="cantilever"
                )
            elif st == StructureType.CONTINUOUS_BEAM:
                # Parse spans from prompt or use defaults
                spans = self._parse_spans(params.raw_prompt, params.span or 6.0)
                model = SF.generate_continuous_beam(spans=spans)
            elif st == StructureType.PRATT_TRUSS:
                model = SF.generate_pratt_truss(
                    span=params.span or 12.0,
                    height=params.height or 3.0,
                    bays=params.bays or 6
                )
            elif st == StructureType.PORTAL_FRAME:
                model = SF.generate_portal_frame(
                    width=params.span or params.width or 15.0,
                    eave_height=params.height or 6.0,
                    roof_angle=params.roof_angle or 15.0
                )
            elif st == StructureType.WAREHOUSE:
                model = SF.generate_portal_frame(
                    width=params.width or params.span or 20.0,
                    eave_height=params.height or 8.0,
                    roof_angle=params.roof_angle or 10.0
                )
            elif st == StructureType.BUILDING_FRAME:
                model = SF.generate_3d_frame(
                    width=params.width or 12.0,
                    length=params.length or 12.0,
                    height=params.height or 3.5,
                    stories=params.stories or 3,
                    bays_x=params.bays_x or 2,
                    bays_z=params.bays_z or 2
                )
            else:
                return None
            
            return self._model_to_dict(model, params)
            
        except Exception as e:
            print(f"[AI Architect] Factory generation failed: {e}")
            return None
    
    def _try_llm_generation(self, prompt: str, params: ExtractedParams) -> Optional[Dict[str, Any]]:
        """Try to generate using the LLM"""
        try:
            import google.generativeai as genai
            from analysis.ai_prompts import SYSTEM_PROMPT_v2
            
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            # Add extracted parameters to help the LLM
            enhanced_prompt = f"""
{SYSTEM_PROMPT_v2}

CONTEXT (Extracted from user request):
- Structure Type: {params.structure_type.value}
- Span: {params.span}m
- Height: {params.height}m
- Width: {params.width}m
- Stories: {params.stories}
- Bays: {params.bays}

USER REQUEST: {prompt}

Generate a complete structural model JSON:
"""
            
            response = model.generate_content(enhanced_prompt)
            raw_text = response.text
            
            # Clean and parse JSON
            cleaned = self._clean_json(raw_text)
            parsed = json.loads(cleaned)
            
            # Validate structure
            if 'nodes' in parsed and 'members' in parsed:
                return parsed
            
            return None
            
        except Exception as e:
            print(f"[AI Architect] LLM generation failed: {e}")
            return None
    
    def _fallback_generation(self, params: ExtractedParams) -> Dict[str, Any]:
        """Generate a basic structure as fallback"""
        span = params.span or 6.0
        
        return {
            "nodes": [
                {"id": "n1", "x": 0, "y": 0, "z": 0, "support": "PINNED"},
                {"id": "n2", "x": span/2, "y": 0, "z": 0, "support": "NONE"},
                {"id": "n3", "x": span, "y": 0, "z": 0, "support": "ROLLER"}
            ],
            "members": [
                {"id": "m1", "start_node": "n1", "end_node": "n2", "section_profile": "ISMB300"},
                {"id": "m2", "start_node": "n2", "end_node": "n3", "section_profile": "ISMB300"}
            ],
            "metadata": {
                "name": f"Basic Beam ({span}m)",
                "generated_by": "fallback",
                "original_prompt": params.raw_prompt[:100]
            }
        }
    
    def _model_to_dict(self, model, params: ExtractedParams) -> Dict[str, Any]:
        """Convert StructuralModel to dictionary"""
        nodes = [
            {
                "id": n.id,
                "x": n.x,
                "y": n.y,
                "z": n.z,
                "support": n.support.value if hasattr(n.support, 'value') else str(n.support)
            }
            for n in model.nodes
        ]
        
        members = [
            {
                "id": m.id,
                "start_node": m.start_node,
                "end_node": m.end_node,
                "section_profile": m.section_profile
            }
            for m in model.members
        ]
        
        metadata = model.metadata.copy() if model.metadata else {}
        metadata["generated_by"] = "factory"
        metadata["original_prompt"] = params.raw_prompt[:100]
        
        return {
            "nodes": nodes,
            "members": members,
            "metadata": metadata
        }
    
    def _parse_spans(self, prompt: str, default_span: float) -> List[float]:
        """Parse multiple span values from prompt"""
        # Try to find patterns like "5m + 6m + 5m" or "5, 6, 5"
        patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:m|meter)?\s*(?:\+|,|and)\s*(\d+(?:\.\d+)?)\s*(?:m|meter)?\s*(?:\+|,|and)?\s*(\d+(?:\.\d+)?)?',
            r'(\d+)[\s-]span',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, prompt.lower())
            if match:
                groups = [g for g in match.groups() if g is not None]
                try:
                    return [float(g) for g in groups]
                except ValueError:
                    continue
        
        # Check for "X-span" pattern
        span_count_match = re.search(r'(\d+)[\s-]span', prompt.lower())
        if span_count_match:
            count = int(span_count_match.group(1))
            return [default_span] * count
        
        # Default: 2 equal spans
        return [default_span, default_span]
    
    def _clean_json(self, raw_text: str) -> str:
        """Clean LLM response to extract valid JSON"""
        # Remove markdown code blocks
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        
        # Find JSON boundaries
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            return cleaned[start_idx:end_idx + 1]
        
        return cleaned
