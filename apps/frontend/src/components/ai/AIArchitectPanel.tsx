/**
 * AIArchitectPanel.tsx - AI-Powered Structure Generation
 *
 * Allows users to describe a structure in natural language
 * and generates it using the unified AI backend (Express → Gemini).
 *
 * V3.0: Unified backend integration with fallback chain:
 *   1. Express API (/api/ai/*) — server-side Gemini proxy
 *   2. Local AICommandInterpreter — instant offline commands
 *   3. Python backend — structural generation fallback
 */

import { FC, useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  MessageCircle,
  Send,
  Bot,
  User,
  Wand2,
  Edit3,
  Settings2,
  Lightbulb,
  History,
  Plus,
  Key,
  X,
  Brain,
  Cpu,
} from "lucide-react";
import { useModelStore } from "../../store/model";
import { aiLogger } from "../../utils/logger";
import { API_CONFIG, AI_CONFIG } from "../../config/env";
import { useAISessionStore } from "../../store/aiSessionStore";
import { aiArchitect } from "../../ai/EnhancedAIArchitect";
import { AISessionHistoryPanel } from "./AISessionHistoryPanel";
import { interpretCommand, isActionCommand } from "./AICommandInterpreter";
import { interpretCommandAI } from "./LLMCommandInterpreter";
import { executeCommand } from "./AIModelExecutor";
import type { ExecutionResult } from "./AIModelExecutor";
import { aiOrchestrator } from "./AIOrchestrator";
import { logger } from '../../lib/logging/logger';

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_API = API_CONFIG.pythonUrl;

// Unified backend API base URL (Express API with server-side Gemini)
const API_BASE = API_CONFIG.baseUrl;

// ============================================
// TYPES
// ============================================

interface GenerateResponse {
  success: boolean;
  model?: {
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      z: number;
      support?: string;
    }>;
    members: Array<{
      id: string;
      start_node: string;
      end_node: string;
      section_profile: string;
    }>;
    metadata?: Record<string, string>;
  };
  error?: string;
  details?: string;
  hint?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isModification?: boolean;
  changes?: string[];
}

interface AIStatus {
  gemini_configured: boolean;
  mock_mode: boolean;
  model: string;
  capabilities: string[];
  version?: string;
}

interface ModifyResponse {
  success: boolean;
  message: string;
  model?: any;
  changes?: string[];
  parsed?: {
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  };
  suggestions?: string[];
}

// ============================================
// EXAMPLE PROMPTS
// ============================================

const EXAMPLE_PROMPTS = [
  "Create a simply supported beam of 8m span with 20 kN/m UDL",
  "Design a 3-story building frame, 5m bays, 3.5m height",
  "Generate a 20m warehouse portal frame with dead load 5 kN/m",
  "Create a 12m span Pratt truss with 6 panels",
  "Make a cantilever beam 5m with 10kN point load at free end",
  "Design a 3-bay portal frame 30m wide, 8m eave height",
  "Create a continuous beam with 3 spans of 6m each with UDL 15 kN/m",
  "Generate a Warren truss bridge 30m span 5m depth",
];

// Modification examples for smart modify
const MODIFY_EXAMPLES = [
  "Select node N1",
  "Select member M1",
  "Apply 20 kN/m UDL on M1",
  "Add fixed support at N1",
  "Add pinned support at N2",
  "Change section to ISMB400",
  "Delete member M5",
  "Add 50 kN load at N3",
  "Move N2 to (10, 0, 0)",
  "Show model info",
  "List all loads",
  "Select all beams",
  "Remove support from N1",
  "Split member M1",
  "Add node at (5, 3, 0)",
  "Show BMD",
];

const CHAT_SUGGESTIONS = [
  "Select node N1",
  "Apply 20 kN/m UDL on M1",
  "Show model info",
  "What is a Pratt truss?",
  "List all loads",
  "Add fixed support at N1",
  "How to reduce deflection?",
  "Select all beams",
];

// ============================================
// MAIN COMPONENT
// ============================================

export const AIArchitectPanel: FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Chat state
  const [activeTab, setActiveTab] = useState<"generate" | "modify" | "chat">(
    "generate",
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Session history state
  const [showHistory, setShowHistory] = useState(false);

  // Gemini settings state
  const [showGeminiSettings, setShowGeminiSettings] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState(
    aiOrchestrator.isGeminiConfigured,
  );

  // Modify state
  const [modifyCommand, setModifyCommand] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [modifyHistory, setModifyHistory] = useState<
    { command: string; result: string; success: boolean }[]
  >([]);

  // Session store
  const {
    createSession,
    addMessage,
    activeSessionId,
    setActiveSession,
    getActiveSession,
    sessions,
  } = useAISessionStore();

  // Store actions
  const clearModel = useModelStore((state) => state.clearModel);
  const addNode = useModelStore((state) => state.addNode);
  const addMember = useModelStore((state) => state.addMember);
  const addMemberLoad = useModelStore((state) => state.addMemberLoad);
  const addNodeLoad = useModelStore((state) => state.addLoad);
  const updateNode = useModelStore((state) => state.updateNode);
  const updateMember = useModelStore((state) => state.updateMember);
  const removeNode = useModelStore((state) => state.removeNode);
  const removeMember = useModelStore((state) => state.removeMember);
  const nodes = useModelStore((state) => state.nodes);
  const members = useModelStore((state) => state.members);
  const selectedIds = useModelStore((state) => state.selectedIds);
  const loads = useModelStore((state) => state.loads);
  const memberLoads = useModelStore((state) => state.memberLoads);

  // Ensure we have an active session
  const ensureSession = useCallback(() => {
    if (!activeSessionId) {
      return createSession();
    }
    return activeSessionId;
  }, [activeSessionId, createSession]);

  // Check AI status on mount
  useEffect(() => {
    fetch(`${PYTHON_API}/ai/status`)
      .then((res) => res.json())
      .then((data) => setAIStatus(data))
      .catch(() => setAIStatus(null));

    // Initialize Gemini from env or localStorage
    const envKey = AI_CONFIG.geminiApiKey;
    const storedKey = localStorage.getItem("beamlab_gemini_api_key");
    const key = envKey || storedKey;
    if (key) {
      aiOrchestrator.configureGemini(key);
      setGeminiConfigured(true);
    }
    // Apply orchestrator settings from env
    aiOrchestrator.updateConfig({
      preferGemini: AI_CONFIG.preferGemini,
      geminiTimeout: AI_CONFIG.geminiTimeout,
    });
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ========================================
  // HELPER: Convert store to API model format
  // ========================================
  const getModelForAPI = useCallback(() => {
    const nodesArray = Array.from(nodes.values()).map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      z: n.z,
      restraints: n.restraints || {},
    }));

    const membersArray = Array.from(members.values()).map((m) => ({
      id: m.id,
      startNodeId: m.startNodeId,
      endNodeId: m.endNodeId,
      sectionId: m.sectionId,
    }));

    return { nodes: nodesArray, members: membersArray, loads: [] };
  }, [nodes, members]);

  // ========================================
  // HELPER: Apply model changes from API response
  // ========================================
  const applyModelChanges = useCallback(
    (model: any) => {
      // Clear and rebuild model
      clearModel();

      // Add nodes
      if (model.nodes) {
        for (const node of model.nodes) {
          addNode({
            id: node.id,
            x: node.x,
            y: node.y,
            z: node.z || 0,
            restraints: node.restraints,
          });
        }
      }

      // Add members
      if (model.members) {
        for (const member of model.members) {
          addMember({
            id: member.id,
            startNodeId: member.startNodeId || member.start_node,
            endNodeId: member.endNodeId || member.end_node,
            sectionId:
              member.sectionId ||
              member.section_profile ||
              member.section ||
              "ISMB300",
          });
        }
      }
    },
    [clearModel, addNode, addMember],
  );

  // ========================================
  // SMART MODIFY HANDLER (LOCAL AI COMMAND EXECUTION + backend fallback)
  // ========================================
  const handleSmartModify = useCallback(async () => {
    if (!modifyCommand.trim()) {
      setError("Please enter a modification command");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsModifying(true);

    // Track in session
    const sessionId = ensureSession();
    addMessage(sessionId, {
      role: "user",
      content: modifyCommand,
      type: "modify",
    });

    aiLogger.debug("Smart modify:", modifyCommand);

    try {
      // ========================================
      // STEP 1: TRY GEMINI LLM INTERPRETER FIRST (smart semantic parsing)
      // ========================================
      let parsed = await interpretCommandAI(modifyCommand);

      // Fallback to local regex interpreter if AI is unsure or unavailable
      if (parsed.action === "unknown" || parsed.confidence < 0.4) {
        parsed = interpretCommand(modifyCommand);
      }
      
      aiLogger.debug("Parsed command:", parsed.action, parsed.confidence);

      if (parsed.action !== "unknown" && parsed.confidence >= 0.4) {
        // Execute locally — instant response
        const result: ExecutionResult = executeCommand(parsed);

        if (result.success) {
          setSuccess(result.message);
          setModifyHistory((prev) => [
            ...prev,
            {
              command: modifyCommand,
              result: result.message,
              success: true,
            },
          ]);
          addMessage(sessionId, {
            role: "assistant",
            content: result.message,
            type: "modify",
          });
          setModifyCommand("");
          setIsModifying(false);
          return;
        } else {
          // Local execution failed (e.g. element not found) — show error but try backend too
          aiLogger.debug("Local execution failed:", result.message);
          // For high-confidence commands that failed, show the error directly
          if (parsed.confidence >= 0.7) {
            setError(result.message);
            setModifyHistory((prev) => [
              ...prev,
              {
                command: modifyCommand,
                result: result.message,
                success: false,
              },
            ]);
            addMessage(sessionId, {
              role: "assistant",
              content: result.message,
              type: "error",
            });
            setIsModifying(false);
            return;
          }
        }
      }

      // ========================================
      // STEP 2: TRY UNIFIED BACKEND for AI-powered modifications
      // ========================================
      const model = getModelForAPI();

      try {
        const unifiedResponse = await fetch(`${API_BASE}/api/ai/modify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            command: modifyCommand,
          }),
        });

        if (unifiedResponse.ok) {
          const unifiedData = await unifiedResponse.json();
          if (unifiedData.success && unifiedData.model) {
            applyModelChanges(unifiedData.model);
            setSuccess(unifiedData.message || "Model modified successfully");
            setModifyHistory((prev) => [
              ...prev,
              { command: modifyCommand, result: unifiedData.message, success: true },
            ]);
            addMessage(sessionId, {
              role: "assistant",
              content: unifiedData.message,
              type: "modify",
            });
            setModifyCommand("");
            setIsModifying(false);
            return;
          } else if (unifiedData.success && unifiedData.response) {
            // AI responded with text guidance instead of model changes
            setSuccess(unifiedData.response);
            setModifyHistory((prev) => [
              ...prev,
              { command: modifyCommand, result: unifiedData.response, success: true },
            ]);
            addMessage(sessionId, {
              role: "assistant",
              content: unifiedData.response,
              type: "modify",
            });
            setModifyCommand("");
            setIsModifying(false);
            return;
          }
        }
      } catch (unifiedErr) {
        aiLogger.debug("[Modify] Unified backend unavailable:", unifiedErr);
      }

      // ========================================
      // STEP 3: FALL BACK TO ORCHESTRATOR (BeamLabAI + Gemini) for complex commands
      // ========================================
      const orchestratorResult =
        await aiOrchestrator.processMessage(modifyCommand);

      if (
        orchestratorResult.commandExecuted &&
        orchestratorResult.executionResult?.success
      ) {
        setSuccess(orchestratorResult.text);
        setModifyHistory((prev) => [
          ...prev,
          {
            command: modifyCommand,
            result: orchestratorResult.text,
            success: true,
          },
        ]);
        addMessage(sessionId, {
          role: "assistant",
          content: orchestratorResult.text,
          type: "modify",
        });
        setModifyCommand("");
        setIsModifying(false);
        return;
      }

      // If orchestrator can't execute as command, try the Python backend for model-level changes
      if (nodes.size === 0) {
        setError(
          'No model to modify. Generate a structure first, or try: "Add node at (0,0,0)"',
        );
        setIsModifying(false);
        return;
      }

      const response = await fetch(`${PYTHON_API}/ai/smart-modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          command: modifyCommand,
        }),
      });

      const data: ModifyResponse = await response.json();
      aiLogger.debug("Response:", data);

      if (data.success && data.model) {
        // Apply the modified model to the store
        applyModelChanges(data.model);

        setSuccess(data.message);
        setModifyHistory((prev) => [
          ...prev,
          {
            command: modifyCommand,
            result: data.message,
            success: true,
          },
        ]);
        addMessage(sessionId, {
          role: "assistant",
          content: data.message,
          type: "modify",
        });
        setModifyCommand("");
      } else {
        const errorMsg = data.message || "Modification failed";
        setError(errorMsg);

        if (data.suggestions && data.suggestions.length > 0) {
          setError(`${errorMsg}\n\nTry: ${data.suggestions[0]}`);
        }

        setModifyHistory((prev) => [
          ...prev,
          {
            command: modifyCommand,
            result: errorMsg,
            success: false,
          },
        ]);
        addMessage(sessionId, {
          role: "assistant",
          content: errorMsg,
          type: "error",
        });
      }
    } catch (err) {
      logger.error('[AI Brain] Error', { error: err instanceof Error ? err.message : String(err) });

      // Try orchestrator as fallback (local + Gemini)
      try {
        const orchResult = await aiOrchestrator.processMessage(modifyCommand);
        if (orchResult.confidence > 0.3) {
          setSuccess(orchResult.text + " (AI-assisted)");
          setModifyHistory((prev) => [
            ...prev,
            { command: modifyCommand, result: orchResult.text, success: true },
          ]);
          addMessage(sessionId, {
            role: "assistant",
            content: orchResult.text,
            type: "modify",
          });
          setModifyCommand("");
          setIsModifying(false);
          return;
        }
      } catch {
        // orchestrator also failed, continue to error
      }

      // Last resort: try local execution even for unknown commands
      const parsed = interpretCommand(modifyCommand);
      if (parsed.action !== "unknown") {
        const result = executeCommand(parsed);
        if (result.success) {
          setSuccess(result.message + " (offline mode)");
          setModifyHistory((prev) => [
            ...prev,
            { command: modifyCommand, result: result.message, success: true },
          ]);
          addMessage(sessionId, {
            role: "assistant",
            content: result.message,
            type: "modify",
          });
          setModifyCommand("");
          setIsModifying(false);
          return;
        }
      }

      const errMsg = err instanceof Error ? err.message : "Connection error";
      setError(
        `Backend unavailable. ${errMsg}\n\nTry local commands like: "Select N1", "Add UDL on M1", "Add fixed support at N2"`,
      );
      addMessage(sessionId, {
        role: "assistant",
        content: errMsg,
        type: "error",
      });
    } finally {
      setIsModifying(false);
    }
  }, [
    modifyCommand,
    nodes.size,
    getModelForAPI,
    applyModelChanges,
    ensureSession,
    addMessage,
  ]);

  // ========================================
  // GENERATE HANDLER (Unified backend → Python → Local fallback)
  // ========================================
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a description");
      return;
    }

    // Clear previous states
    setError(null);
    setSuccess(null);
    setIsGenerating(true);

    // Track in session
    const sessionId = ensureSession();
    addMessage(sessionId, { role: "user", content: prompt, type: "generate" });

    let generatedViaBackend = false;

    try {
      // ========================================
      // STEP 1: Try unified Express backend first (server-side Gemini)
      // ========================================
      try {
        const response = await fetch(`${API_BASE}/api/ai/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        const data = await response.json();

        if (data.success && data.model) {
          clearModel();
          // Apply the generated model
          applyModelChanges(data.model);

          generatedViaBackend = true;
          const modelName = data.model.metadata?.name || "AI Generated";
          const nodeCount = data.model.nodes?.length || 0;
          const memberCount = data.model.members?.length || 0;
          const successMsg = `✓ Generated "${modelName}" (${nodeCount} nodes, ${memberCount} members)`;
          setSuccess(successMsg);
          addMessage(sessionId, {
            role: "assistant",
            content: successMsg,
            type: "generate",
            metadata: {
              structureType: modelName,
              nodesGenerated: nodeCount,
              membersGenerated: memberCount,
            },
          });
          setPrompt("");
          return; // Done!
        }
      } catch (unifiedErr) {
        aiLogger.debug("[AIArchitect] Unified backend unavailable, trying Python backend:", unifiedErr);
      }

      // ========================================
      // STEP 2: Try Python backend
      // ========================================
      const response = await fetch(`${PYTHON_API}/generate/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

// console.log("[AIArchitect] Response status:", response.status);

      const data: GenerateResponse = await response.json();
// console.log("[AIArchitect] Response data:", data);

      if (!data.success) {
        const errorMsg = data.error || "Generation failed";
        const details = data.details ? ` - ${data.details}` : "";
        const hint = data.hint ? ` (${data.hint})` : "";
        throw new Error(`${errorMsg}${details}${hint}`);
      }

      if (!data.model) {
        throw new Error("No model data returned");
      }

      // Success! Populate the model
      clearModel();

      // Add nodes with support conditions from AI
      for (const node of data.model.nodes) {
        const restraints: any = {};
        const support = (node.support || "").toUpperCase();
        if (support === "FIXED") {
          restraints.fx = true;
          restraints.fy = true;
          restraints.fz = true;
          restraints.mx = true;
          restraints.my = true;
          restraints.mz = true;
        } else if (support === "PINNED") {
          restraints.fx = true;
          restraints.fy = true;
          restraints.fz = true;
        } else if (support === "ROLLER") {
          restraints.fy = true;
        }
        addNode({
          id: node.id,
          x: node.x,
          y: node.y,
          z: node.z || 0,
          restraints:
            Object.keys(restraints).length > 0 ? restraints : undefined,
        });
      }

      // Add members
      for (const member of data.model.members) {
        addMember({
          id: member.id,
          startNodeId: member.start_node,
          endNodeId: member.end_node,
          sectionId: member.section_profile || "ISMB300",
        });
      }

      generatedViaBackend = true;
      const modelName = data.model.metadata?.["name"] || "AI Generated";
      const successMsg = `✓ Generated "${modelName}" (${data.model.nodes.length} nodes, ${data.model.members.length} members)`;
      setSuccess(successMsg);

      addMessage(sessionId, {
        role: "assistant",
        content: successMsg,
        type: "generate",
        metadata: {
          structureType: modelName,
          nodesGenerated: data.model.nodes.length,
          membersGenerated: data.model.members.length,
        },
      });
      setPrompt("");
    } catch (err) {
      logger.warn('[AIArchitect] Backend failed, trying local EnhancedAIArchitect', {
        error: err instanceof Error ? err.message : String(err),
      });

      // FALLBACK: Use local EnhancedAIArchitect
      try {
        const localResponse = await aiArchitect.processRequest({
          message: prompt,
        });

        if (localResponse.structureData) {
          clearModel();
          const sd = localResponse.structureData;

          for (const node of sd.nodes) {
            addNode({
              id: node.id,
              x: node.x,
              y: node.y,
              z: node.z || 0,
              restraints: undefined,
            });
          }

          for (const member of sd.members) {
            addMember({
              id: member.id,
              startNodeId: member.startNodeId,
              endNodeId: member.endNodeId,
              sectionId: member.section || "ISMB300",
            });
          }

          // Apply supports from structure data
          if (sd.supports) {
            for (const sup of sd.supports) {
              const restraints: any = {};
              if (sup.type === "fixed") {
                restraints.fx = true;
                restraints.fy = true;
                restraints.fz = true;
                restraints.mx = true;
                restraints.my = true;
                restraints.mz = true;
              } else if (sup.type === "pinned") {
                restraints.fx = true;
                restraints.fy = true;
                restraints.fz = true;
              } else if (sup.type === "roller") {
                restraints.fy = true;
              }
              if (Object.keys(restraints).length > 0) {
                updateNode(sup.nodeId, { restraints });
              }
            }
          }

          // Apply loads from structure data
          if (sd.loads) {
            for (const load of sd.loads) {
              if (load.type === "member_distributed" && load.memberId) {
                try {
                  addMemberLoad({
                    id:
                      load.id ||
                      `ML-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    memberId: load.memberId,
                    type: "UDL",
                    w1: load.values?.[0] || -10,
                    direction: "global_y",
                  });
                } catch (e) {
                  logger.warn('Failed to add member load', { error: e instanceof Error ? e.message : String(e) });
                }
              } else if (load.type === "node_force" && load.nodeId) {
                try {
                  addNodeLoad({
                    id:
                      load.id ||
                      `NL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    nodeId: load.nodeId,
                    fx: load.values?.[0] || 0,
                    fy: load.values?.[1] || 0,
                    fz: load.values?.[2] || 0,
                  });
                } catch (e) {
                  logger.warn('Failed to add node load', { error: e instanceof Error ? e.message : String(e) });
                }
              }
            }
          }

          generatedViaBackend = true;
          const name =
            sd.metadata?.name || localResponse.type || "Local AI Generated";
          const successMsg = `✓ Generated "${name}" (${sd.nodes.length} nodes, ${sd.members.length} members) [Local AI]`;
          setSuccess(successMsg);
          addMessage(sessionId, {
            role: "assistant",
            content: successMsg,
            type: "generate",
            metadata: {
              structureType: name as string,
              nodesGenerated: sd.nodes.length,
              membersGenerated: sd.members.length,
            },
          });
          setPrompt("");
        } else {
          // Show AI explanation if no structure was generated
          const aiMsg =
            localResponse.message ||
            "I understood your request but could not generate a structure. Please try being more specific.";
          setError(aiMsg);
          addMessage(sessionId, {
            role: "assistant",
            content: aiMsg,
            type: "error",
          });
        }
      } catch (localErr) {
        logger.error('[AIArchitect] Both backends failed', { error: localErr instanceof Error ? localErr.message : String(localErr) });
        const errorMsg =
          err instanceof TypeError &&
          (err as TypeError).message.includes("fetch")
            ? "Cannot connect to AI Server. Using local fallback also failed. Please check your connection."
            : err instanceof Error
              ? err.message
              : "Unknown error occurred";
        setError(errorMsg);
        addMessage(sessionId, {
          role: "assistant",
          content: errorMsg,
          type: "error",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    prompt,
    clearModel,
    addNode,
    addMember,
    addMemberLoad,
    addNodeLoad,
    updateNode,
    ensureSession,
    addMessage,
  ]);

  // ========================================
  // CHAT HANDLER — Unified Backend → Orchestrator fallback
  // ========================================
  const handleChat = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);

    // Track in session
    const sessionId = ensureSession();
    addMessage(sessionId, { role: "user", content: chatInput, type: "chat" });

    const inputText = chatInput;
    setChatInput("");
    setIsChatting(true);

    try {
      // ========================================
      // STEP 1: Try local command interpreter first (instant, offline)
      // ========================================
      if (isActionCommand(inputText)) {
        const parsed = interpretCommand(inputText);
        if (parsed.action !== "unknown" && parsed.confidence >= 0.5) {
          const result: ExecutionResult = executeCommand(parsed);
          if (result.success) {
            const assistantMessage: ChatMessage = {
              role: "assistant",
              content: `✅ ${result.message}`,
              timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, assistantMessage]);
            addMessage(sessionId, { role: "assistant", content: result.message, type: "chat" });
            setIsChatting(false);
            return;
          }
        }
      }

      // ========================================
      // STEP 2: Try unified backend API (server-side Gemini — no API key in browser)
      // ========================================
      let responded = false;
      try {
        const model = getModelForAPI();
        const chatHistory = chatMessages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(`${API_BASE}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: inputText,
            context: JSON.stringify({
              currentModel: model,
              nodeCount: nodes.size,
              memberCount: members.size,
              loadCount: loads.length + memberLoads.length,
            }),
            history: chatHistory,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.response) {
            const assistantMessage: ChatMessage = {
              role: "assistant",
              content: data.response,
              timestamp: new Date(),
              changes: data.actions?.map((a: any) => a.description) || undefined,
            };
            setChatMessages((prev) => [...prev, assistantMessage]);
            addMessage(sessionId, { role: "assistant", content: data.response, type: "chat" });

            // Auto-apply model changes if returned
            if (data.model) {
              applyModelChanges(data.model);
            }

            responded = true;
            aiLogger.debug(`[Chat] Unified backend response OK`);
          }
        }
      } catch (backendErr) {
        aiLogger.debug("[Chat] Unified backend unavailable, trying orchestrator:", backendErr);
      }

      // ========================================
      // STEP 3: Fall back to orchestrator (local BeamLabAI + direct Gemini)
      // ========================================
      if (!responded) {
        const response = await aiOrchestrator.processMessage(inputText);

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.text,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        addMessage(sessionId, { role: "assistant", content: response.text, type: "chat" });

        aiLogger.debug(
          `[Chat] Orchestrator: source=${response.source}, confidence=${response.confidence}`,
        );
      }
    } catch (err) {
      logger.error('[AIChat] All paths failed', { error: err instanceof Error ? err.message : String(err) });

      // Ultimate fallback: local EnhancedAIArchitect
      let fallbackResponse: string;
      try {
        const localResponse = await aiArchitect.processRequest({
          message: inputText,
        });
        fallbackResponse =
          localResponse.message ||
          "I can help with structural engineering questions. Please try rephrasing your question.";
      } catch {
        fallbackResponse =
          'Unable to process. Try action commands like "Select N1", "Add UDL on M1", "Show model info"';
      }

      const errorMessage: ChatMessage = {
        role: "assistant",
        content: fallbackResponse,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      addMessage(sessionId, {
        role: "assistant",
        content: fallbackResponse,
        type: "chat",
      });
    } finally {
      setIsChatting(false);
    }
  }, [chatInput, chatMessages, nodes.size, members.size, loads.length, memberLoads.length, getModelForAPI, applyModelChanges, ensureSession, addMessage]);

  // ========================================
  // HANDLE EXAMPLE CLICK
  // ========================================
  const handleExampleClick = (example: string) => {
    setPrompt(example);
    setError(null);
    setSuccess(null);
  };

  const handleChatSuggestion = (suggestion: string) => {
    setChatInput(suggestion);
  };

  // Resume a session from history
  const handleResumeSession = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        // Restore chat messages from session
        const restored: ChatMessage[] = session.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));
        setChatMessages(restored);

        // Switch to the most relevant tab
        const hasGenerate = session.messages.some((m) => m.type === "generate");
        const hasModify = session.messages.some((m) => m.type === "modify");
        const hasChat = session.messages.some((m) => m.type === "chat");
        if (hasChat) setActiveTab("chat");
        else if (hasModify) setActiveTab("modify");
        else if (hasGenerate) setActiveTab("generate");
      }
      setShowHistory(false);
    },
    [sessions, setActiveSession],
  );

  // Start new session
  const handleNewSession = useCallback(() => {
    const id = createSession();
    setChatMessages([]);
    setModifyHistory([]);
    setPrompt("");
    setModifyCommand("");
    setError(null);
    setSuccess(null);
    aiOrchestrator.resetConversation();
  }, [createSession]);

  // If showing history, render the history panel
  if (showHistory) {
    return (
      <AISessionHistoryPanel
        onResumeSession={handleResumeSession}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col w-[380px] bg-[#0b1326]">
      {/* Header with Dual AI branding */}
      <div className="px-4 py-3 border-b border-[#1a2333]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#dae2fd]">AI Architect</h3>
              <p className="text-[10px] text-[#869ab8] flex items-center gap-1">
                <Cpu className="w-2.5 h-2.5" />
                <span className="text-emerald-400 font-medium tracking-wide">BeamLab AI</span>
                {geminiConfigured && (
                  <>
                    <span className="text-slate-500">+</span>
                    <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium tracking-wide">
                      Gemini
                    </span>
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  </>
                )}
              </p>
            </div>
          </div>
          {/* Session controls */}
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={() => setShowGeminiSettings(!showGeminiSettings)}
              className={`p-1.5 rounded-lg transition-colors ${
                geminiConfigured
                  ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  : "text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
              title={
                geminiConfigured
                  ? "Gemini Connected — Settings"
                  : "Configure Gemini API Key"
              }
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={handleNewSession}
              className="p-1.5 text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              title="New Session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={() => setShowHistory(true)}
              className="p-1.5 text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors relative"
              title="Session History"
            >
              <History className="w-3.5 h-3.5" />
              {sessions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center">
                  {sessions.length > 9 ? "9+" : sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Gemini Settings Dropdown */}
        {showGeminiSettings && (
          <div className="mt-2 p-3 bg-slate-100/80 dark:bg-slate-800/80 border border-[#1a2333] rounded-lg space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Brain className="w-3 h-3" />
                Gemini Configuration
              </span>
              <button type="button"
                onClick={() => setShowGeminiSettings(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {geminiConfigured ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[11px] text-green-400">
                    Gemini API key configured
                  </span>
                </div>
                <div className="flex gap-1">
                  <button type="button"
                    onClick={() => {
                      aiOrchestrator.removeGemini();
                      setGeminiConfigured(false);
                    }}
                    className="flex-1 text-[10px] py-1.5 px-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                  >
                    Remove Key
                  </button>
                  <button type="button"
                    onClick={() => {
                      aiOrchestrator.resetConversation();
                      setGeminiConfigured(aiOrchestrator.isGeminiConfigured);
                    }}
                    className="flex-1 text-[10px] py-1.5 px-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Reset Chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500">
                  Add your Gemini API key for enhanced AI responses. Get one
                  free at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    aistudio.google.com
                  </a>
                </p>
                <div className="flex gap-1">
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-2 py-1.5 bg-[#0b1326] border border-slate-300 dark:border-slate-600 rounded text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button type="button"
                    onClick={() => {
                      if (geminiKeyInput.trim()) {
                        aiOrchestrator.configureGemini(geminiKeyInput.trim());
                        setGeminiConfigured(true);
                        setGeminiKeyInput("");
                        setShowGeminiSettings(false);
                      }
                    }}
                    disabled={!geminiKeyInput.trim()}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-[#1a2333]">
              <p className="text-[9px] text-slate-500">
                BeamLab AI always runs locally (instant). Gemini enhances
                answers with deeper analysis.
              </p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex gap-1 mt-3 p-0.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
          <button type="button"
            onClick={() => setActiveTab("generate")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium tracking-wide transition-all ${
              activeTab === "generate"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm"
                : "text-[#869ab8] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate
          </button>
          <button type="button"
            onClick={() => setActiveTab("modify")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium tracking-wide transition-all ${
              activeTab === "modify"
                ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm"
                : "text-[#869ab8] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modify
          </button>
          <button type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium tracking-wide transition-all ${
              activeTab === "chat"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm"
                : "text-[#869ab8] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>
      </div>

      {/* Main Content - Generate Tab */}
      {activeTab === "generate" && (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Prompt Input */}
          <div>
            <label className="block text-xs text-[#869ab8] mb-1">
              Describe your structure
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a 15m span Pratt truss..."
              disabled={isGenerating}
              className="
                                w-full h-24 px-3 py-2
                                bg-[#131b2e] border border-[#1a2333] rounded-lg
                                text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600
                                focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500
                                resize-none
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
            />
          </div>

          {/* Example Prompts */}
          <div>
            <label className="block text-xs text-[#869ab8] mb-1.5">
              Try an example
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.slice(0, 5).map((example, i) => (
                <button type="button"
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  disabled={isGenerating}
                  className="
                                        px-2 py-1 text-[10px]
                                        bg-slate-100/50 dark:bg-slate-800/50 border border-[#1a2333]
                                        text-[#869ab8] rounded
                                        hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white
                                        transition-colors
                                        disabled:opacity-50
                                    "
                >
                  {example.slice(0, 35)}...
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`
                            w-full flex items-center justify-center gap-2
                            py-3 rounded-lg font-medium tracking-wide text-sm
                            transition-all duration-200
                            ${
                              isGenerating
                                ? "bg-purple-600/20 text-purple-300 cursor-wait"
                                : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/20"
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                        `}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gemini is thinking...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate Structure
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-400">{success}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Content - Modify Tab (Interactive AI Agent) */}
      {activeTab === "modify" && (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Model Status */}
          <div
            className={`flex items-center gap-2 p-2 rounded-lg ${nodes.size > 0 ? "bg-green-500/10 border border-green-500/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}
          >
            <Settings2
              className={`w-4 h-4 ${nodes.size > 0 ? "text-green-400" : "text-yellow-400"}`}
            />
            <span
              className={`text-xs ${nodes.size > 0 ? "text-green-400" : "text-yellow-400"}`}
            >
              {nodes.size > 0
                ? `Model: ${nodes.size} nodes, ${members.size} members${selectedIds.size > 0 ? ` | ${selectedIds.size} selected` : ""}${loads.length + memberLoads.length > 0 ? ` | ${loads.length + memberLoads.length} loads` : ""}`
                : 'No model loaded — Generate one or use "Add node at (0,0,0)"'}
            </span>
          </div>

          {/* Command Input */}
          <div>
            <label className="block text-xs text-[#869ab8] mb-1">
              Tell me what to do (select, load, modify, delete...)
            </label>
            <textarea
              value={modifyCommand}
              onChange={(e) => setModifyCommand(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), handleSmartModify())
              }
              placeholder='e.g., "Select node N1", "Apply 20 kN/m UDL on M1", "Add fixed support at N2"...'
              disabled={isModifying}
              className="
                                w-full h-20 px-3 py-2
                                bg-[#131b2e] border border-[#1a2333] rounded-lg
                                text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600
                                focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500
                                resize-none
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
            />
          </div>

          {/* Quick Modify Examples */}
          <div>
            <label className="block text-xs text-[#869ab8] mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Quick commands
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MODIFY_EXAMPLES.slice(0, 8).map((example, i) => (
                <button type="button"
                  key={i}
                  onClick={() => setModifyCommand(example)}
                  disabled={isModifying}
                  className="
                                        px-2 py-1 text-[10px]
                                        bg-slate-100/50 dark:bg-slate-800/50 border border-[#1a2333]
                                        text-[#869ab8] rounded
                                        hover:bg-green-600/20 hover:border-green-600/50 hover:text-green-300
                                        transition-colors
                                        disabled:opacity-50
                                    "
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <button type="button"
            onClick={handleSmartModify}
            disabled={isModifying || !modifyCommand.trim()}
            className={`
                            w-full flex items-center justify-center gap-2
                            py-3 rounded-lg font-medium tracking-wide text-sm
                            transition-all duration-200
                            ${
                              isModifying
                                ? "bg-green-600/20 text-green-300 cursor-wait"
                                : "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-600/20"
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                        `}
          >
            {isModifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI is modifying...
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                Apply Changes
              </>
            )}
          </button>

          {/* Error Message */}
          {error && activeTab === "modify" && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {success && activeTab === "modify" && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-400">{success}</p>
            </div>
          )}

          {/* Modification History */}
          {modifyHistory.length > 0 && (
            <div className="mt-2">
              <label className="block text-xs text-[#869ab8] mb-1.5">
                Recent changes
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {modifyHistory
                  .slice(-5)
                  .reverse()
                  .map((item, i) => (
                    <div
                      key={i}
                      className={`text-[10px] p-1.5 rounded ${
                        item.success
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      <span className="font-medium tracking-wide">{item.command}</span>
                      <span className="opacity-70"> → {item.result}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content - Chat Tab */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-[#869ab8] mb-1">
                  I can execute commands & answer questions!
                </p>
                <p className="text-[10px] text-slate-500 mb-1">
                  Powered by{" "}
                  <span className="text-emerald-400">BeamLab AI</span>
                  {geminiConfigured && (
                    <>
                      {" "}
                      + <span className="text-blue-400">Gemini</span>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 mb-4">
                  Try: "Select N1", "What is a Pratt truss?", "Show model info"
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {CHAT_SUGGESTIONS.map((suggestion, i) => (
                    <button type="button"
                      key={i}
                      onClick={() => handleChatSuggestion(suggestion)}
                      className="px-2 py-1 text-[10px] bg-slate-100/50 dark:bg-slate-800/50 border border-[#1a2333] text-[#869ab8] rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                      msg.role === "user"
                        ? "bg-slate-200 dark:bg-slate-700 text-[#dae2fd]"
                        : "bg-[#131b2e] text-slate-800 dark:text-slate-200 border-l-2 border-blue-500"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isChatting && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#131b2e] border border-[#1a2333]">
                  <Loader2 className="w-4 h-4 text-[#869ab8] animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-[#1a2333]">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleChat()
                }
                placeholder="Type a command or ask a question..."
                disabled={isChatting}
                className="flex-1 px-3 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
              />
              <button type="button"
                onClick={handleChat}
                disabled={isChatting || !chatInput.trim()}
                className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[#1a2333]">
        <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
          {geminiConfigured ? (
            <>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              BeamLab AI + Gemini · Dual Engine
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              BeamLab AI Active
              <span className="text-slate-600 mx-0.5">·</span>
              <button type="button"
                onClick={() => setShowGeminiSettings(true)}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Add Gemini
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default AIArchitectPanel;
