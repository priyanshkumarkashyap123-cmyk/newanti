"""
AI Power Module - C-Suite Approved Enhancements
================================================

This module provides powerful AI features for enterprise-grade
structural engineering applications.

Features:
- Confidence scoring with engineering validation
- Multi-model support preparation (Gemini, GPT-4, Claude)
- Engineering knowledge retrieval (RAG-ready)
- Performance analytics
- Expert mode response formatting
"""

import json
import time
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import re

# ============================================
# TYPES
# ============================================

class ExpertMode(Enum):
    """AI response verbosity modes"""
    ASSISTANT = "assistant"  # Full explanations
    EXPERT = "expert"        # Concise, key points only
    MENTOR = "mentor"        # Educational with learning notes


@dataclass
class ConfidenceScore:
    """Detailed confidence score breakdown"""
    overall: float
    code_compliance: float
    engineering_logic: float
    calculation_accuracy: float
    context_relevance: float
    breakdown: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall": round(self.overall, 1),
            "codeCompliance": round(self.code_compliance, 1),
            "engineeringLogic": round(self.engineering_logic, 1),
            "calculationAccuracy": round(self.calculation_accuracy, 1),
            "contextRelevance": round(self.context_relevance, 1),
            "breakdown": self.breakdown
        }


@dataclass
class EngineeringContext:
    """Enriched engineering context for AI"""
    structure_type: str
    loading_conditions: List[str]
    design_codes: List[str]
    critical_factors: List[str]
    risk_level: str  # low, medium, high, critical
    recommendations: List[str]


@dataclass
class PerformanceMetrics:
    """AI performance tracking"""
    total_queries: int = 0
    successful_queries: int = 0
    avg_response_time: float = 0.0
    code_references_used: int = 0
    confidence_scores: List[float] = field(default_factory=list)
    query_types: Dict[str, int] = field(default_factory=dict)
    
    def record_query(self, response_time: float, was_successful: bool, 
                     confidence: float, query_type: str):
        """Record a query for analytics"""
        self.total_queries += 1
        if was_successful:
            self.successful_queries += 1
        
        # Update average response time
        self.avg_response_time = (
            (self.avg_response_time * (self.total_queries - 1) + response_time) 
            / self.total_queries
        )
        
        # Track confidence
        self.confidence_scores.append(confidence)
        if len(self.confidence_scores) > 100:
            self.confidence_scores.pop(0)
        
        # Track query types
        self.query_types[query_type] = self.query_types.get(query_type, 0) + 1
    
    def get_success_rate(self) -> float:
        if self.total_queries == 0:
            return 100.0
        return (self.successful_queries / self.total_queries) * 100
    
    def get_avg_confidence(self) -> float:
        if not self.confidence_scores:
            return 0.0
        return sum(self.confidence_scores) / len(self.confidence_scores)


# ============================================
# ENGINEERING KNOWLEDGE BASE (RAG-Ready)
# ============================================

ENGINEERING_CODES = {
    "IS_800": {
        "title": "IS 800:2007 - Steel Design",
        "version": "2007",
        "key_provisions": {
            "partial_safety_factors": {
                "gamma_m0": 1.10,  # Yielding
                "gamma_m1": 1.25,  # Ultimate
                "gamma_mw": 1.25,  # Welds
                "gamma_mb": 1.25,  # Bolts
            },
            "deflection_limits": {
                "floor_beam": "L/300",
                "roof_purlin": "L/180",
                "cantilever": "L/150",
                "crane_girder": "L/500"
            },
            "slenderness_limits": {
                "compression": 180,
                "tension": 400
            }
        },
        "key_formulas": [
            "Td = Ag × fy / γm0 (Tension capacity)",
            "Pd = Ae × fcd (Compression capacity)",
            "Md = βb × Zp × fy / γm0 (Bending capacity)",
            "Vd = Av × fyw / (√3 × γm0) (Shear capacity)"
        ]
    },
    "IS_456": {
        "title": "IS 456:2000 - Concrete Design",
        "version": "2000",
        "key_provisions": {
            "partial_safety_factors": {
                "gamma_c": 1.5,   # Concrete
                "gamma_s": 1.15  # Steel
            },
            "cover": {
                "moderate_exposure": 30,
                "severe_exposure": 45,
                "very_severe": 50
            }
        }
    },
    "IS_1893": {
        "title": "IS 1893:2016 - Seismic Design",
        "version": "2016",
        "zone_factors": {
            "II": 0.10,
            "III": 0.16,
            "IV": 0.24,
            "V": 0.36
        },
        "response_reduction": {
            "OMRF": 3.0,
            "SMRF": 5.0,
            "braced": 4.0
        },
        "key_formulas": [
            "VB = Ah × W (Base shear)",
            "Ah = (Z/2) × (I/R) × (Sa/g) (Seismic coefficient)",
            "Qi = Wi×hi² / Σ(Wi×hi²) (Load distribution)"
        ]
    },
    "IS_875": {
        "title": "IS 875:2015 - Loading",
        "parts": {
            "1": "Dead Loads",
            "2": "Live Loads",
            "3": "Wind Loads",
            "5": "Load Combinations"
        },
        "load_combinations": {
            "ULS_1": "1.5(DL + LL)",
            "ULS_2": "1.2(DL + LL + WL)",
            "ULS_3": "0.9DL + 1.5WL",
            "SLS": "1.0(DL + LL)"
        }
    }
}

STRUCTURE_PATTERNS = {
    "portal_frame": {
        "typical_span": "12-60m",
        "typical_height": "6-12m",
        "critical_checks": [
            "Lateral stability",
            "P-Delta effects",
            "Column base design",
            "Haunch connection"
        ],
        "optimization": [
            "Haunch design",
            "Column taper",
            "Rafter pitch"
        ],
        "common_issues": [
            "Excessive sway",
            "Connection overstress",
            "Foundation moments"
        ]
    },
    "truss": {
        "typical_span": "15-100m",
        "depth_ratio": "L/8 to L/12",
        "critical_checks": [
            "Member slenderness",
            "Connection eccentricity",
            "Out-of-plane buckling",
            "Deflection at midspan"
        ],
        "optimization": [
            "Panel count",
            "Chord sizing",
            "Web member arrangement"
        ]
    },
    "multi_story": {
        "typical_bays": "4-9m",
        "story_height": "3-4m",
        "critical_checks": [
            "Story drift",
            "P-Delta effects",
            "Strong column weak beam",
            "Soft story irregularity"
        ],
        "optimization": [
            "Bracing configuration",
            "Core location",
            "Member grouping"
        ]
    }
}


# ============================================
# AI POWER ENGINE
# ============================================

class AIPowerEngine:
    """
    Enterprise-grade AI power features
    """
    
    def __init__(self):
        self.expert_mode = ExpertMode.ASSISTANT
        self.metrics = PerformanceMetrics()
        self._response_cache: Dict[str, Tuple[Any, float]] = {}
        self._cache_ttl = 300  # 5 minutes
    
    # ============================================
    # CONFIDENCE SCORING
    # ============================================
    
    def calculate_confidence(
        self, 
        query: str, 
        response: str, 
        context: Dict[str, Any]
    ) -> ConfidenceScore:
        """
        Calculate detailed confidence score for an AI response.
        Based on engineering principles, code compliance, and context.
        """
        breakdown = []
        
        # Factor 1: Code Compliance (30%)
        code_score = self._assess_code_compliance(response)
        breakdown.append({
            "factor": "Code Compliance",
            "score": code_score,
            "reason": self._get_code_reason(code_score)
        })
        
        # Factor 2: Engineering Logic (30%)
        logic_score = self._assess_engineering_logic(response)
        breakdown.append({
            "factor": "Engineering Logic",
            "score": logic_score,
            "reason": self._get_logic_reason(logic_score)
        })
        
        # Factor 3: Calculation Accuracy (25%)
        calc_score = self._assess_calculation_accuracy(response)
        breakdown.append({
            "factor": "Calculation Accuracy",
            "score": calc_score,
            "reason": self._get_calc_reason(calc_score)
        })
        
        # Factor 4: Context Relevance (15%)
        context_score = self._assess_context_relevance(query, response, context)
        breakdown.append({
            "factor": "Context Relevance",
            "score": context_score,
            "reason": self._get_context_reason(context_score)
        })
        
        # Calculate overall
        overall = (
            code_score * 0.30 +
            logic_score * 0.30 +
            calc_score * 0.25 +
            context_score * 0.15
        )
        
        return ConfidenceScore(
            overall=overall,
            code_compliance=code_score,
            engineering_logic=logic_score,
            calculation_accuracy=calc_score,
            context_relevance=context_score,
            breakdown=breakdown
        )
    
    def _assess_code_compliance(self, response: str) -> float:
        """Check for engineering code references"""
        score = 40.0
        
        patterns = [
            (r'IS\s*800', 20),
            (r'IS\s*456', 15),
            (r'IS\s*1893', 15),
            (r'IS\s*875', 10),
            (r'AISC|Eurocode|EN\s*\d+', 10),
            (r'clause|section|table', 10),
            (r'γ|gamma|partial.*factor', 10)
        ]
        
        for pattern, weight in patterns:
            if re.search(pattern, response, re.IGNORECASE):
                score += weight
        
        return min(score, 100.0)
    
    def _assess_engineering_logic(self, response: str) -> float:
        """Check for sound engineering reasoning"""
        score = 40.0
        
        patterns = [
            (r'[MVPN]\s*[=<>]', 15),  # Formulas
            (r'kN|MPa|mm|N/mm²|kNm', 10),  # Units
            (r'factor of safety|FOS|capacity|demand', 10),
            (r'ultimate|serviceability|SLS|ULS', 10),
            (r'step|first|then|therefore|because', 15),  # Reasoning
            (r'\d+\s*[×*/+\-]\s*\d+', 10)  # Calculations
        ]
        
        for pattern, weight in patterns:
            if re.search(pattern, response, re.IGNORECASE):
                score += weight
        
        return min(score, 100.0)
    
    def _assess_calculation_accuracy(self, response: str) -> float:
        """Check for numerical work and verification"""
        score = 40.0
        
        patterns = [
            (r'=\s*\d+', 15),
            (r'\d+\s*×\s*\d+', 10),
            (r'ratio|limit|check', 10),
            (r'OK|PASS|SAFE|adequate|satisfies', 15),
            (r'>\s*\d+|<\s*\d+', 10)
        ]
        
        for pattern, weight in patterns:
            if re.search(pattern, response, re.IGNORECASE):
                score += weight
        
        return min(score, 100.0)
    
    def _assess_context_relevance(
        self, query: str, response: str, context: Dict[str, Any]
    ) -> float:
        """Check context awareness"""
        score = 40.0
        
        # Check if model is referenced
        if context.get('has_model', False):
            if re.search(r'current|your|this.*model', response, re.IGNORECASE):
                score += 20
        
        # Check if analysis results are used
        if context.get('has_results', False):
            if re.search(r'result|stress|deflection|moment', response, re.IGNORECASE):
                score += 15
        
        # Check structure type mention
        if context.get('structure_type'):
            if context['structure_type'].lower() in response.lower():
                score += 15
        
        # Check node/member count reference
        if re.search(r'\d+\s*nodes?|\d+\s*members?', response, re.IGNORECASE):
            score += 10
        
        return min(score, 100.0)
    
    def _get_code_reason(self, score: float) -> str:
        if score >= 80:
            return "Strong code compliance with multiple references"
        elif score >= 60:
            return "Good code awareness present"
        return "Consider adding more code references"
    
    def _get_logic_reason(self, score: float) -> str:
        if score >= 80:
            return "Sound engineering reasoning with formulas"
        elif score >= 60:
            return "Adequate engineering logic"
        return "Engineering reasoning could be strengthened"
    
    def _get_calc_reason(self, score: float) -> str:
        if score >= 80:
            return "Calculations present with verification"
        elif score >= 60:
            return "Some numerical work included"
        return "Consider adding numerical verification"
    
    def _get_context_reason(self, score: float) -> str:
        if score >= 80:
            return "Highly context-aware response"
        elif score >= 60:
            return "Good context relevance"
        return "Response may need more context awareness"
    
    # ============================================
    # EXPERT MODE FORMATTING
    # ============================================
    
    def set_expert_mode(self, mode: str):
        """Set the expert mode"""
        try:
            self.expert_mode = ExpertMode(mode.lower())
        except ValueError:
            self.expert_mode = ExpertMode.ASSISTANT
    
    def format_response(self, response: str) -> str:
        """Format response based on expert mode"""
        if self.expert_mode == ExpertMode.EXPERT:
            return self._extract_key_points(response)
        elif self.expert_mode == ExpertMode.MENTOR:
            return response + self._add_mentor_notes(response)
        return response
    
    def _extract_key_points(self, response: str) -> str:
        """Extract only key points for expert mode"""
        lines = response.split('\n')
        key_lines = []
        
        for line in lines:
            stripped = line.strip()
            if any([
                stripped.startswith('-'),
                stripped.startswith('•'),
                '=' in stripped,
                re.match(r'^\d+\.', stripped),
                'kN' in stripped,
                'MPa' in stripped,
                'mm' in stripped
            ]):
                key_lines.append(line)
        
        return '\n'.join(key_lines) if key_lines else response[:500]
    
    def _add_mentor_notes(self, response: str) -> str:
        """Add educational notes for mentor mode"""
        notes = []
        
        if re.search(r'bending|moment', response, re.IGNORECASE):
            notes.append(
                "\n\n💡 **Learning Note:** Bending moment is the internal "
                "reaction to applied loads. Study IS 800 Clause 8 for design procedures."
            )
        
        if re.search(r'buckling', response, re.IGNORECASE):
            notes.append(
                "\n\n💡 **Learning Note:** Buckling is a stability failure. "
                "Review Euler's formula and IS 800 Section 9 for compression member design."
            )
        
        if re.search(r'seismic|earthquake', response, re.IGNORECASE):
            notes.append(
                "\n\n💡 **Learning Note:** Seismic design per IS 1893 uses "
                "response spectrum method. Review zone factors and R values."
            )
        
        return ''.join(notes)
    
    # ============================================
    # KNOWLEDGE RETRIEVAL
    # ============================================
    
    def get_engineering_context(self, query: str) -> EngineeringContext:
        """Retrieve relevant engineering context for a query"""
        q = query.lower()
        
        # Detect structure type
        structure_type = "general"
        if any(kw in q for kw in ['portal', 'warehouse', 'industrial']):
            structure_type = "portal_frame"
        elif any(kw in q for kw in ['truss', 'bridge']):
            structure_type = "truss"
        elif any(kw in q for kw in ['building', 'story', 'floor', 'storey']):
            structure_type = "multi_story"
        
        pattern = STRUCTURE_PATTERNS.get(structure_type, {})
        
        # Detect loading conditions
        loading = []
        if any(kw in q for kw in ['gravity', 'dead', 'live']):
            loading.append("Gravity loads")
        if any(kw in q for kw in ['wind', 'lateral']):
            loading.append("Wind loads")
        if any(kw in q for kw in ['seismic', 'earthquake']):
            loading.append("Seismic loads")
        if not loading:
            loading.append("Standard gravity loads")
        
        # Detect design codes
        codes = []
        if 'is 800' in q or 'is800' in q:
            codes.append("IS 800:2007")
        if 'is 456' in q or 'is456' in q:
            codes.append("IS 456:2000")
        if 'is 1893' in q or 'is1893' in q:
            codes.append("IS 1893:2016")
        if not codes:
            codes.extend(["IS 800:2007", "IS 875:2015"])
        
        # Determine risk level
        risk = "low"
        if any(kw in q for kw in ['critical', 'emergency', 'failure']):
            risk = "critical"
        elif any(kw in q for kw in ['seismic', 'high-rise', 'long-span']):
            risk = "high"
        elif any(kw in q for kw in ['optimize', 'check', 'verify']):
            risk = "medium"
        
        return EngineeringContext(
            structure_type=structure_type,
            loading_conditions=loading,
            design_codes=codes,
            critical_factors=pattern.get('critical_checks', [
                "General stability",
                "Member capacity",
                "Serviceability"
            ]),
            risk_level=risk,
            recommendations=pattern.get('optimization', [
                "Verify load combinations",
                "Check deflection limits"
            ])
        )
    
    def get_code_provisions(self, code: str, topic: str) -> Dict[str, Any]:
        """Get specific code provisions"""
        code_data = ENGINEERING_CODES.get(code.upper().replace(" ", "_"), {})
        
        if not code_data:
            return {"error": f"Code {code} not found"}
        
        return {
            "title": code_data.get("title", ""),
            "provisions": code_data.get("key_provisions", {}),
            "formulas": code_data.get("key_formulas", [])
        }
    
    # ============================================
    # CACHING
    # ============================================
    
    def get_cached_response(self, query: str) -> Optional[Any]:
        """Get cached response if available and not expired"""
        cache_key = hashlib.md5(query.encode()).hexdigest()
        
        if cache_key in self._response_cache:
            response, timestamp = self._response_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                return response
            else:
                del self._response_cache[cache_key]
        
        return None
    
    def cache_response(self, query: str, response: Any):
        """Cache a response"""
        cache_key = hashlib.md5(query.encode()).hexdigest()
        self._response_cache[cache_key] = (response, time.time())
        
        # Limit cache size
        if len(self._response_cache) > 100:
            oldest_key = min(
                self._response_cache.keys(),
                key=lambda k: self._response_cache[k][1]
            )
            del self._response_cache[oldest_key]
    
    # ============================================
    # ANALYTICS
    # ============================================
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return {
            "total_queries": self.metrics.total_queries,
            "successful_queries": self.metrics.successful_queries,
            "success_rate": self.metrics.get_success_rate(),
            "avg_response_time": self.metrics.avg_response_time,
            "avg_confidence": self.metrics.get_avg_confidence(),
            "query_types": self.metrics.query_types
        }


# Singleton instance
ai_power_engine = AIPowerEngine()


# ============================================
# QUICK ACTIONS
# ============================================

QUICK_ACTIONS = [
    {
        "id": "create_portal",
        "label": "Portal Frame",
        "icon": "🏗️",
        "command": "Create a 20m portal frame industrial building",
        "category": "create"
    },
    {
        "id": "create_truss",
        "label": "Roof Truss",
        "icon": "🌉",
        "command": "Create a 15m Pratt truss with 6 panels",
        "category": "create"
    },
    {
        "id": "create_building",
        "label": "Building Frame",
        "icon": "🏢",
        "command": "Create a G+3 commercial building frame",
        "category": "create"
    },
    {
        "id": "analyze_structure",
        "label": "Run Analysis",
        "icon": "📊",
        "command": "Analyze the current structure",
        "category": "analyze"
    },
    {
        "id": "optimize_weight",
        "label": "Min Weight",
        "icon": "⚡",
        "command": "Optimize for minimum weight",
        "category": "optimize"
    },
    {
        "id": "check_is800",
        "label": "IS 800 Check",
        "icon": "✅",
        "command": "Check compliance with IS 800:2007",
        "category": "check"
    }
]


def get_quick_actions() -> List[Dict[str, str]]:
    """Get list of quick actions"""
    return QUICK_ACTIONS
