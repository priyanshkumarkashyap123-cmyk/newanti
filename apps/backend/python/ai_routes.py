from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from ai_assistant import AIModelAssistant
from enhanced_ai_brain import EnhancedAIBrain, get_ai_brain
from ai_power_module import ai_power_engine, get_quick_actions
import os
import time

# Create router
router = APIRouter(prefix="/ai", tags=["AI Assistant"])

# Request models
class DiagnoseRequest(BaseModel):
    model: Dict[str, Any]

class FixRequest(BaseModel):
    model: Dict[str, Any]

class ModifyRequest(BaseModel):
    model: Dict[str, Any]
    command: str

class SmartModifyRequest(BaseModel):
    """Enhanced modification request with context"""
    model: Dict[str, Any]
    command: str
    context: Optional[Dict[str, Any]] = None

class SuggestionRequest(BaseModel):
    model: Dict[str, Any]
    step: str = 'general'
    analysis_results: Optional[Dict[str, Any]] = None


# Helper dependencies
def get_ai_assistant():
    return AIModelAssistant()

def get_enhanced_brain():
    return get_ai_brain()


def _record_ai_metric(start_time: float, success: bool, query_type: str) -> None:
    """Best-effort metrics capture for AI route execution."""
    try:
        response_time_ms = (time.time() - start_time) * 1000
        ai_power_engine.metrics.record_query(
            response_time=response_time_ms,
            was_successful=success,
            confidence=100.0 if success else 0.0,
            query_type=query_type,
        )
    except Exception:
        # Metrics must never break API flow.
        pass


def _raise_internal_error(exc: Exception, route_name: str) -> None:
    """Raise a consistent internal error for AI routes."""
    raise HTTPException(status_code=500, detail=f"{route_name} failed: {str(exc)}")

@router.get("/status")
async def ai_status():
    """
    Check AI system status and configuration.
    """
    use_mock_ai = os.getenv('USE_MOCK_AI', 'true').lower() in ('true', '1', 'yes')
    has_gemini_key = bool(os.getenv('GEMINI_API_KEY'))
    
    return {
        "status": "operational",
        "ai_engine": "Gemini Pro" if has_gemini_key and not use_mock_ai else "Enhanced Local AI",
        "mock_mode": use_mock_ai,
        "gemini_configured": has_gemini_key,
        "version": "2.0 - 1000x Enhanced",
        "capabilities": [
            "Natural language structure generation",
            "Smart model modifications",
            "Section changes",
            "Support modifications",
            "Add/remove elements",
            "Scale and transform",
            "Load operations",
            "Story/bay extensions",
            "Model diagnostics",
            "Auto-fix issues"
        ],
        "endpoints": [
            "/ai/diagnose",
            "/ai/fix",
            "/ai/modify",
            "/ai/smart-modify",
            "/ai/parse-command",
            "/ai/status"
        ]
    }

@router.post("/diagnose")
async def diagnose_model(request: DiagnoseRequest, assistant: AIModelAssistant = Depends(get_ai_assistant)):
    """
    Diagnose issues in a structural model.
    """
    start_time = time.time()
    try:
        result = assistant.diagnose(request.model)
        _record_ai_metric(start_time, True, "diagnose")
        return result
    except ValueError as e:
        _record_ai_metric(start_time, False, "diagnose")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "diagnose")
        _raise_internal_error(e, "Diagnose")

@router.post("/fix")
async def fix_model(request: FixRequest, assistant: AIModelAssistant = Depends(get_ai_assistant)):
    """
    Attempt to auto-fix issues in a structural model.
    """
    start_time = time.time()
    try:
        result = assistant.fix(request.model)
        _record_ai_metric(start_time, bool(result.get("success", True)), "fix")
        return result
    except ValueError as e:
        _record_ai_metric(start_time, False, "fix")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "fix")
        _raise_internal_error(e, "Fix")

@router.post("/modify")
async def modify_model(request: ModifyRequest, assistant: AIModelAssistant = Depends(get_ai_assistant)):
    """
    Modify a structural model using natural language commands (legacy).
    """
    start_time = time.time()
    try:
        result = assistant.modify(request.model, request.command)
        _record_ai_metric(start_time, bool(result.get("success", True)), "modify")
        return result
    except ValueError as e:
        _record_ai_metric(start_time, False, "modify")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "modify")
        _raise_internal_error(e, "Modify")

@router.post("/smart-modify")
async def smart_modify_model(request: SmartModifyRequest, brain: EnhancedAIBrain = Depends(get_enhanced_brain)):
    """
    Enhanced model modification with 1000x better understanding.
    
    This endpoint uses the Enhanced AI Brain for:
    - Advanced natural language parsing
    - Intent classification
    - Smart entity extraction
    - Context-aware modifications
    - Helpful suggestions
    """
    start_time = time.time()
    try:
        # Set model context for better understanding
        brain.set_model_context(request.model)
        
        # Parse the command
        parsed = brain.parse_command(request.command)
        
        print(f"[AI Brain] Command: {request.command}")
        print(f"[AI Brain] Intent: {parsed.intent.value} (confidence: {parsed.confidence:.2f})")
        print(f"[AI Brain] Entities: {parsed.entities}")
        
        # Execute modification
        result = brain.execute_modification(request.model, parsed)
        
        # Add parsed info to response
        result['parsed'] = {
            'intent': parsed.intent.value,
            'confidence': parsed.confidence,
            'entities': parsed.entities
        }

        _record_ai_metric(start_time, bool(result.get("success", True)), "smart_modify")
        
        return result
    except ValueError as e:
        _record_ai_metric(start_time, False, "smart_modify")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "smart_modify")
        import traceback
        traceback.print_exc()
        _raise_internal_error(e, "Smart modify")

@router.post("/parse-command")
async def parse_command(request: ModifyRequest, brain: EnhancedAIBrain = Depends(get_enhanced_brain)):
    """
    Parse a natural language command without executing it.
    Useful for previewing what the AI understood.
    """
    start_time = time.time()
    try:
        brain.set_model_context(request.model)
        parsed = brain.parse_command(request.command)
        _record_ai_metric(start_time, True, "parse_command")
        
        return {
            "success": True,
            "intent": parsed.intent.value,
            "confidence": parsed.confidence,
            "entities": parsed.entities,
            "suggestions": parsed.suggestions,
            "raw_text": parsed.raw_text
        }
    except ValueError as e:
        _record_ai_metric(start_time, False, "parse_command")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "parse_command")
        _raise_internal_error(e, "Parse command")

@router.post("/suggest")
async def suggest_improvements(request: SuggestionRequest, brain: EnhancedAIBrain = Depends(get_enhanced_brain)):
    """
    Generate intelligent design suggestions for the model.
    """
    start_time = time.time()
    try:
        suggestions = brain.generate_suggestions(
            model=request.model,
            step=request.step,
            analysis_results=request.analysis_results
        )
        _record_ai_metric(start_time, True, "suggest")
        return {"success": True, "suggestions": suggestions}
    except ValueError as e:
        _record_ai_metric(start_time, False, "suggest")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        _record_ai_metric(start_time, False, "suggest")
        import traceback
        traceback.print_exc()
        _raise_internal_error(e, "Suggest")


# ============================================
# 🚀 POWER AI ENDPOINTS (C-Suite Approved)
# ============================================

class ConfidenceRequest(BaseModel):
    """Request for confidence scoring"""
    query: str
    response: str
    context: Optional[Dict[str, Any]] = None

class ExpertModeRequest(BaseModel):
    """Request to set expert mode"""
    mode: str  # assistant, expert, mentor

class FormatRequest(BaseModel):
    """Request to format response for expert mode"""
    response: str


@router.get("/power/status")
async def power_ai_status():
    """
    Get Power AI system status and capabilities.
    """
    return {
        "status": "operational",
        "version": "Power AI 1.0",
        "expert_mode": ai_power_engine.expert_mode.value,
        "features": [
            "Confidence scoring",
            "Expert mode formatting",
            "Engineering knowledge retrieval",
            "Performance analytics",
            "Response caching"
        ],
        "metrics": ai_power_engine.get_metrics()
    }


@router.post("/power/confidence")
async def calculate_confidence(request: ConfidenceRequest):
    """
    Calculate confidence score for an AI response.
    Returns detailed breakdown of confidence factors.
    """
    try:
        start_time = time.time()
        
        context = request.context or {}
        score = ai_power_engine.calculate_confidence(
            request.query,
            request.response,
            context
        )
        
        # Record metrics
        response_time = (time.time() - start_time) * 1000
        ai_power_engine.metrics.record_query(
            response_time,
            score.overall >= 70,
            score.overall,
            "confidence_check"
        )
        
        return {
            "success": True,
            "confidence": score.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/power/expert-mode")
async def set_expert_mode(request: ExpertModeRequest):
    """
    Set the AI expert mode for response formatting.
    
    Modes:
    - assistant: Full explanations (default)
    - expert: Concise, key points only
    - mentor: Educational with learning notes
    """
    try:
        ai_power_engine.set_expert_mode(request.mode)
        return {
            "success": True,
            "mode": ai_power_engine.expert_mode.value,
            "description": {
                "assistant": "Full explanations for all users",
                "expert": "Concise responses for experienced engineers",
                "mentor": "Educational mode with learning notes"
            }.get(ai_power_engine.expert_mode.value, "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/power/expert-mode")
async def get_expert_mode():
    """Get current expert mode setting."""
    return {
        "mode": ai_power_engine.expert_mode.value
    }


@router.post("/power/format")
async def format_response(request: FormatRequest):
    """
    Format a response according to current expert mode.
    """
    try:
        formatted = ai_power_engine.format_response(request.response)
        return {
            "success": True,
            "formatted": formatted,
            "mode": ai_power_engine.expert_mode.value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/power/quick-actions")
async def get_power_quick_actions():
    """
    Get list of quick action templates.
    """
    return {
        "success": True,
        "actions": get_quick_actions()
    }


@router.get("/power/metrics")
async def get_power_metrics():
    """
    Get AI performance metrics for dashboard.
    """
    return {
        "success": True,
        "metrics": ai_power_engine.get_metrics()
    }


class EngineeringContextRequest(BaseModel):
    """Request for engineering context"""
    query: str

@router.post("/power/context")
async def get_engineering_context(request: EngineeringContextRequest):
    """
    Get enriched engineering context for a query.
    Useful for understanding what codes and checks are relevant.
    """
    try:
        context = ai_power_engine.get_engineering_context(request.query)
        return {
            "success": True,
            "context": {
                "structureType": context.structure_type,
                "loadingConditions": context.loading_conditions,
                "designCodes": context.design_codes,
                "criticalFactors": context.critical_factors,
                "riskLevel": context.risk_level,
                "recommendations": context.recommendations
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CodeProvisionRequest(BaseModel):
    """Request for code provisions"""
    code: str
    topic: Optional[str] = None

@router.post("/power/code-provisions")
async def get_code_provisions(request: CodeProvisionRequest):
    """
    Get specific code provisions and formulas.
    """
    try:
        provisions = ai_power_engine.get_code_provisions(
            request.code,
            request.topic or ""
        )
        return {
            "success": True,
            "provisions": provisions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
