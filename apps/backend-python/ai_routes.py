from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from ai_assistant import AIModelAssistant
from enhanced_ai_brain import EnhancedAIBrain, get_ai_brain
import os

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

# Helper dependencies
def get_ai_assistant():
    return AIModelAssistant()

def get_enhanced_brain():
    return get_ai_brain()

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
    try:
        return assistant.diagnose(request.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fix")
async def fix_model(request: FixRequest, assistant: AIModelAssistant = Depends(get_ai_assistant)):
    """
    Attempt to auto-fix issues in a structural model.
    """
    try:
        return assistant.fix(request.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/modify")
async def modify_model(request: ModifyRequest, assistant: AIModelAssistant = Depends(get_ai_assistant)):
    """
    Modify a structural model using natural language commands (legacy).
    """
    try:
        result = assistant.modify(request.model, request.command)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse-command")
async def parse_command(request: ModifyRequest, brain: EnhancedAIBrain = Depends(get_enhanced_brain)):
    """
    Parse a natural language command without executing it.
    Useful for previewing what the AI understood.
    """
    try:
        brain.set_model_context(request.model)
        parsed = brain.parse_command(request.command)
        
        return {
            "success": True,
            "intent": parsed.intent.value,
            "confidence": parsed.confidence,
            "entities": parsed.entities,
            "suggestions": parsed.suggestions,
            "raw_text": parsed.raw_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
