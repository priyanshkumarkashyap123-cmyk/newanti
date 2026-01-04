from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from ai_assistant import AIModelAssistant
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

# Helper dependency
def get_ai_assistant():
    return AIModelAssistant()

@router.get("/status")
async def ai_status():
    """
    Check AI system status and configuration.
    """
    use_mock_ai = os.getenv('USE_MOCK_AI', 'true').lower() in ('true', '1', 'yes')
    has_gemini_key = bool(os.getenv('GEMINI_API_KEY'))
    
    return {
        "status": "operational",
        "ai_engine": "Gemini" if has_gemini_key and not use_mock_ai else "Mock (Local)",
        "mock_mode": use_mock_ai,
        "gemini_configured": has_gemini_key,
        "endpoints": [
            "/ai/diagnose",
            "/ai/fix",
            "/ai/modify",
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
    Modify a structural model using natural language commands.
    """
    try:
        result = assistant.modify(request.model, request.command)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
