import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedCommand, CommandAction } from "./AICommandInterpreter";
import { AI_CONFIG } from "../../config/env";
import { aiOrchestrator } from "./AIOrchestrator";

const SYSTEM_PROMPT = `
You are a structural engineering Natural Language Command (NLC) interpreter for BeamLab AI Architect.
Your job is to translate user natural language commands into a strict JSON object representing a structural command.

The allowed actions are exactly these strings (CommandAction type):
"select_node" | "select_member" | "select_all" | "clear_selection" | "invert_selection" | "delete_node" | "delete_member" | "delete_selection" | "add_node" | "add_member" | "move_node" | "move_selection" | "add_node_load" | "add_member_load" | "remove_load" | "remove_member_load" | "add_support" | "remove_support" | "change_section" | "set_tool" | "show_results" | "hide_results" | "show_bmd" | "show_sfd" | "show_afd" | "show_deflection" | "clear_model" | "renumber_nodes" | "renumber_members" | "split_member" | "merge_nodes" | "duplicate_selection" | "copy_selection" | "paste_clipboard" | "auto_fix" | "select_parallel" | "select_by_section" | "info_node" | "info_member" | "info_model" | "list_nodes" | "list_members" | "list_loads" | "add_load_case" | "query_reactions" | "query_forces" | "query_displacements" | "query_max_deflection" | "query_stability" | "query_supports" | "query_sections" | "query_member_length" | "query_total_weight" | "query_equilibrium" | "query_analysis_status" | "list_plates" | "list_supports" | "list_load_cases" | "help" | "knowledge_question" | "unknown"

You MUST return a raw JSON object (without markdown blocks like \`\`\`json) with the following structure:
{
  "action": "<one of the exact action strings above>",
  "confidence": <number between 0 and 1 representing your confidence. Be high (0.9+) if it matches well>,
  "params": { ... action specific parameters ... },
  "description": "<A human readable summary of what will happen>"
}

Common Parameter mappings:
- add_node: "coordinates" {x, y, z}
- add_member: "startNodeId" (e.g. N1), "endNodeId" (e.g. N2), "sectionId" (e.g. ISMB300)
- select_node / delete_node: "nodeIds" (Array of strings like ["N1", "N2"])
- select_member / delete_member: "memberIds" (Array of strings like ["M1"])
- add_member_load: "memberId", "type" ("UDL", "point", "moment", "UVL"), "value" (number, typically negative for downward), "direction" ("global_y", "local_y", etc)
- add_node_load: "nodeId", "fx", "fy", "fz", "mx", "my", "mz"
- add_support: "nodeId", "supportType" ("fixed", "pinned", "roller")

Examples:
User: "Select node N1 and N2" -> {"action": "select_node", "confidence": 1.0, "params": {"nodeIds": ["N1", "N2"], "multi": true}, "description": "Select nodes N1, N2"}
User: "Apply 20 kN/m UDL on M1" -> {"action": "add_member_load", "confidence": 0.95, "params": {"memberId": "M1", "type": "UDL", "value": -20, "direction": "global_y"}, "description": "Apply 20 kN/m UDL on M1 (global_y)"}
User: "Delete member M5" -> {"action": "delete_member", "confidence": 1.0, "params": {"memberIds": ["M5"]}, "description": "Delete member M5"}
User: "Add pinned support to N4" -> {"action": "add_support", "confidence": 1.0, "params": {"nodeId": "N4", "supportType": "pinned"}, "description": "Add pinned support at N4"}
User: "Move N2 to 10,0,0" -> {"action": "move_node", "confidence": 0.9, "params": {"nodeId": "N2", "position": {"x": 10, "y": 0, "z": 0}}, "description": "Move N2 to (10, 0, 0)"}

IMPORTANT:
- Only return the raw JSON object. Do not add conversational text.
- If unsure, use "action": "unknown" and "confidence": 0.
`;

export async function interpretCommandAI(prompt: string): Promise<ParsedCommand> {
  const defaultUnknown: ParsedCommand = {
    action: "unknown",
    confidence: 0,
    params: {},
    originalText: prompt,
    description: "Could not interpret command via AI.",
  };

  try {
    const apiKey = AI_CONFIG.geminiApiKey || localStorage.getItem("beamlab_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[LLMCommandInterpreter] No Gemini API Key found. Skipping AI interpretation.");
      return defaultUnknown;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const chatSession = model.startChat({
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
      systemInstruction: SYSTEM_PROMPT,
      history: [],
    });

    const result = await chatSession.sendMessage(prompt);
    let text = result.response.text();

    // In case the AI includes markdown code blocks despite instructions
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsedData = JSON.parse(text);

    return {
      action: (parsedData.action as CommandAction) || "unknown",
      confidence: typeof parsedData.confidence === 'number' ? parsedData.confidence : 0,
      params: parsedData.params || {},
      originalText: prompt,
      description: parsedData.description || "AI parsed command",
    };
  } catch (error) {
    console.error("[LLMCommandInterpreter] Failed to interpret command via AI:", error);
    return defaultUnknown;
  }
}
