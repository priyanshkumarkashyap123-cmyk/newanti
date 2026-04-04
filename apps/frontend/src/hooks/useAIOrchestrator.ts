/**
 * ============================================================================
 * useAIOrchestrator — React Hook for AI Orchestrator
 * ============================================================================
 *
 * Provides a React-friendly interface to the AI Orchestrator with:
 * - Automatic state management (loading, error, streaming)
 * - System status monitoring
 * - Event subscription with cleanup
 * - Conversation history in component state
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const ai = useAIOrchestrator();
 *
 *   const handleChat = async () => {
 *     const response = await ai.chat('Design a cantilever beam');
 *     console.log(response.content);
 *   };
 *
 *   return (
 *     <div>
 *       {ai.loading && <Spinner />}
 *       {ai.error && <ErrorBanner message={ai.error} />}
 *       {ai.streamingText && <StreamView text={ai.streamingText} />}
 *       <button onClick={handleChat} disabled={ai.loading}>Ask AI</button>
 *       <StatusBadge status={ai.status} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  aiOrchestrator,
  type AIResponse,
  type AIRequest,
  type NormalizedStructureData,
  type DesignRequest,
  type DesignResult,
} from "../services/ai-orchestrator";

// ============================================================================
// TYPES
// ============================================================================

export interface AIHookState {
  /** Whether a request is currently in progress */
  loading: boolean;

  /** Current error message, if any */
  error: string | null;

  /** Last successful response */
  lastResponse: AIResponse | null;

  /** Text from active stream */
  streamingText: string;

  /** Whether streaming is active */
  isStreaming: boolean;

  /** Current system status */
  status: ReturnType<typeof aiOrchestrator.getStatus> | null;

  /** Number of messages in the conversation */
  messageCount: number;
}

export interface AIHookActions {
  /** Send a chat message */
  chat: (message: string, context?: string) => Promise<AIResponse>;

  /** Generate a structural model */
  generateStructure: (
    prompt: string,
    constraints?: Record<string, any>,
  ) => Promise<AIResponse & { structure?: NormalizedStructureData }>;

  /** Check design code compliance */
  checkCompliance: (
    member: Record<string, any>,
    forces: Record<string, any>,
    code?: string,
  ) => Promise<AIResponse>;

  /** Explain an engineering concept */
  explain: (topic: string) => Promise<AIResponse>;

  /** Diagnose model issues */
  diagnoseModel: (modelData: Record<string, any>) => Promise<AIResponse>;

  /** Auto-fix model issues */
  autoFix: (
    modelData: Record<string, any>,
    issues: string[],
  ) => Promise<AIResponse>;

  /** Modify model via natural language */
  modifyModel: (
    modelData: Record<string, any>,
    instruction: string,
  ) => Promise<AIResponse>;

  /** Analyze a sketch image */
  analyzeSketch: (imageData: string) => Promise<AIResponse>;

  /** Run full autonomous design from a prompt (no external LLM needed) */
  autonomousDesign: (
    prompt: string,
    options?: Partial<DesignRequest>,
  ) => Promise<DesignResult>;

  /** Quick design check without optimization */
  quickDesignCheck: (prompt: string) => Promise<{
    passed: boolean;
    maxUtilization: number;
    weight: number;
    report: string;
    failedMembers: string[];
  }>;

  /** Stream a chat message */
  streamChat: (message: string) => Promise<unknown>;

  /** Process a raw request */
  process: (request: AIRequest) => Promise<AIResponse>;

  /** Clear conversation history */
  clearHistory: () => void;

  /** Reset entire session */
  resetSession: () => void;

  /** Clear current error */
  clearError: () => void;

  /** Record feedback for a response */
  recordFeedback: (
    requestId: string,
    rating: 1 | 2 | 3 | 4 | 5,
    comment?: string,
  ) => Promise<void>;

  /** Refresh system status */
  refreshStatus: () => void;
}

export type UseAIOrchestratorReturn = AIHookState & AIHookActions;

// ============================================================================
// HOOK
// ============================================================================

export function useAIOrchestrator(): UseAIOrchestratorReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AIResponse | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<ReturnType<
    typeof aiOrchestrator.getStatus
  > | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const abortRef = useRef<(() => void) | null>(null);

  // Refresh status periodically
  const refreshStatus = useCallback(() => {
    setStatus(aiOrchestrator.getStatus());
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000); // every 30s
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Subscribe to orchestrator events
  useEffect(() => {
    const unsubError = aiOrchestrator.on("error", (event) => {
      console.warn("[useAI] Error event:", event.data);
    });

    const unsubCircuitOpen = aiOrchestrator.on("circuit-opened", (event) => {
      console.warn(
        `[useAI] Circuit opened for provider: ${event.data?.provider}`,
      );
      refreshStatus();
    });

    return () => {
      unsubError();
      unsubCircuitOpen();
    };
  }, [refreshStatus]);

  // Wrap an async AI call with loading/error state
  const wrapCall = useCallback(
    async <T extends AIResponse>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fn();

        if (!response.success) {
          setError(response.errors[0] || "AI request failed");
        }

        setLastResponse(response);
        refreshStatus();
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refreshStatus],
  );

  // ── Actions ──

  const chat = useCallback(
    async (message: string, context?: string) => {
      const response = await wrapCall(() =>
        aiOrchestrator.chat(message, context),
      );
      setMessageCount((prev) => prev + 1);
      return response;
    },
    [wrapCall],
  );

  const generateStructure = useCallback(
    async (prompt: string, constraints?: Record<string, any>) => {
      return wrapCall(() =>
        aiOrchestrator.generateStructure(prompt, constraints),
      );
    },
    [wrapCall],
  );

  const checkCompliance = useCallback(
    async (
      member: Record<string, any>,
      forces: Record<string, any>,
      code?: string,
    ) => {
      return wrapCall(() =>
        aiOrchestrator.checkCompliance(member, forces, code),
      );
    },
    [wrapCall],
  );

  const explain = useCallback(
    async (topic: string) => {
      return wrapCall(() => aiOrchestrator.explain(topic));
    },
    [wrapCall],
  );

  const diagnoseModel = useCallback(
    async (modelData: Record<string, any>) => {
      return wrapCall(() => aiOrchestrator.diagnoseModel(modelData));
    },
    [wrapCall],
  );

  const autoFix = useCallback(
    async (modelData: Record<string, any>, issues: string[]) => {
      return wrapCall(() => aiOrchestrator.autoFix(modelData, issues));
    },
    [wrapCall],
  );

  const modifyModel = useCallback(
    async (modelData: Record<string, any>, instruction: string) => {
      return wrapCall(() => aiOrchestrator.modifyModel(modelData, instruction));
    },
    [wrapCall],
  );

  const analyzeSketch = useCallback(
    async (imageData: string) => {
      return wrapCall(() => aiOrchestrator.analyzeSketch(imageData));
    },
    [wrapCall],
  );

  const autonomousDesign = useCallback(
    async (prompt: string, options?: Partial<DesignRequest>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await aiOrchestrator.autonomousDesign(prompt, options);
        if (!result.passed) {
          setError(`Design has ${result.failedMembers.length} failed members`);
        }
        refreshStatus();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Autonomous design failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refreshStatus],
  );

  const quickDesignCheck = useCallback(
    async (prompt: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await aiOrchestrator.quickDesignCheck(prompt);
        refreshStatus();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Quick check failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refreshStatus],
  );

  const process = useCallback(
    async (request: AIRequest) => {
      return wrapCall(() => aiOrchestrator.process(request));
    },
    [wrapCall],
  );

  const streamChat = useCallback(
    (message: string) => {
      setIsStreaming(true);
      setStreamingText("");
      setError(null);

      const streamState = aiOrchestrator.streamChat(message, (s) => {
        setStreamingText(s.text);
        setIsStreaming(s.streaming);
        if (s.error) {
          setError(s.error);
        }
        if (!s.streaming) {
          setMessageCount((prev) => prev + 1);
          refreshStatus();
        }
      });

      abortRef.current = () => {
        /* stream will complete or error */
      };
      return streamState;
    },
    [refreshStatus],
  );

  const clearHistory = useCallback(() => {
    aiOrchestrator.clearHistory();
    setMessageCount(0);
    setLastResponse(null);
  }, []);

  const resetSession = useCallback(() => {
    abortRef.current?.();
    aiOrchestrator.resetSession();
    setLoading(false);
    setError(null);
    setLastResponse(null);
    setStreamingText("");
    setIsStreaming(false);
    setMessageCount(0);
    refreshStatus();
  }, [refreshStatus]);

  const clearError = useCallback(() => setError(null), []);

  const recordFeedback = useCallback(
    async (requestId: string, rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
      await aiOrchestrator.recordFeedback(requestId, rating, comment);
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  return {
    // State
    loading,
    error,
    lastResponse,
    streamingText,
    isStreaming,
    status,
    messageCount,

    // Actions
    chat,
    generateStructure,
    checkCompliance,
    explain,
    diagnoseModel,
    autoFix,
    modifyModel,
    analyzeSketch,
    autonomousDesign,
    quickDesignCheck,
    streamChat,
    process,
    clearHistory,
    resetSession,
    clearError,
    recordFeedback,
    refreshStatus,
  };
}
