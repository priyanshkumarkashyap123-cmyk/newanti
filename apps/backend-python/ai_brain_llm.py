"""LLM interaction utilities for EnhancedAIBrain."""

from __future__ import annotations

import json
from typing import Any, Dict


SYSTEM_PROMPT = """You are an expert structural engineering AI for BeamLab.
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
- Depth ~= span/8 to span/12
- Use ISA angles for web members
- Use ISMC channels for chords"""


async def generate_structural_model_with_llm(api_key: str, prompt: str) -> Dict[str, Any]:
    if not api_key:
        return {"success": False, "error": "No API key configured"}

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-pro")

        full_prompt = f"{SYSTEM_PROMPT}\n\nUser request: {prompt}"
        response = await model.generate_content_async(full_prompt)
        text = response.text.strip()

        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        result = json.loads(text.strip())
        return {"success": True, "model": result}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
