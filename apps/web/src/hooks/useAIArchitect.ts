/**
 * ============================================================================
 * useAIArchitect Hook — AI Architect Integration for BeamLab
 * ============================================================================
 *
 * Provides the bridge between the AI Architect backend and the frontend:
 * - Extracts current model context from the Zustand store
 * - Sends requests to the AI backend
 * - Executes AI-generated actions on the model
 * - Manages AI session state
 *
 * Usage:
 *   const { sendMessage, isProcessing, executeActions, modelContext } = useAIArchitect();
 *
 * @version 3.0.0
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useModelStore } from '../store/model';
import { useAISessionStore, type AIMessage } from '../store/aiSessionStore';
import { API_CONFIG, AI_CONFIG, FEATURES } from '../config/env';

// ============================================
// TYPES
// ============================================

export interface AIAction {
  type: 'addNode' | 'addMember' | 'addSupport' | 'addLoad' | 'removeMember' |
        'removeNode' | 'changeSection' | 'runAnalysis' | 'optimize' | 'applyModel' |
        'clearModel' | 'report';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
  description: string;
}

export interface AIPlan {
  goal: string;
  reasoning: string;
  steps: AIAction[];
  confidence: number;
  alternatives?: string[];
}

export interface AIModel {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    isSupport?: boolean;
    restraints?: Record<string, boolean>;
  }>;
  members: Array<{
    id: string;
    s: string;
    e: string;
    section: string;
    material?: string;
  }>;
  loads?: Array<{
    nodeId?: string;
    memberId?: string;
    type?: string;
    fx?: number;
    fy?: number;
    fz?: number;
    w1?: number;
    direction?: string;
  }>;
}

export interface AIResponse {
  success: boolean;
  response: string;
  actions?: AIAction[];
  model?: AIModel;
  plan?: AIPlan;
  metadata?: {
    intent: string;
    confidence: number;
    processingTimeMs: number;
    provider: string;
    tokensUsed?: number;
  };
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'plan' | 'result' | 'error' | 'model';
  actions?: AIAction[];
  model?: AIModel;
  plan?: AIPlan;
  metadata?: AIResponse['metadata'];
  isExecuting?: boolean;
}

export interface ModelContext {
  nodes: Array<{ id: string; x: number; y: number; z: number; hasSupport: boolean }>;
  members: Array<{ id: string; startNode: string; endNode: string; section?: string }>;
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>;
  analysisResults?: {
    maxDisplacement?: number;
    maxStress?: number;
    maxMoment?: number;
    maxShear?: number;
    failedMembers?: string[];
  };
}

// ============================================
// API CLIENT
// ============================================

const AI_API_BASE = `${API_CONFIG.baseUrl}/api/ai`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAIApi(endpoint: string, body: Record<string, any>): Promise<AIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include auth token if available
    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${AI_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `AI service returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAIApi(endpoint: string): Promise<unknown> {
  const response = await fetch(`${AI_API_BASE}/${endpoint}`);
  if (!response.ok) throw new Error(`AI service returned ${response.status}`);
  return response.json();
}

// ============================================
// HOOK
// ============================================

export function useAIArchitect() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<AIAction[]>([]);
  const messageIdRef = useRef(0);

  // Model store
  const store = useModelStore();

  // AI session store
  const sessionStore = useAISessionStore();

  // ============================================
  // EXTRACT MODEL CONTEXT
  // ============================================

  const modelContext: ModelContext = useMemo(() => {
    const nodes = Array.from(store.nodes.values()).map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      z: n.z,
      hasSupport: !!(n.restraints && (n.restraints.fx || n.restraints.fy)),
    }));

    const members = Array.from(store.members.values()).map((m) => ({
      id: m.id,
      startNode: m.startNodeId,
      endNode: m.endNodeId,
      section: m.sectionId,
    }));

    // Get loads from store.loads (direct array) and load cases
    const allLoads: ModelContext['loads'] = [];

    // Direct loads
    if (store.loads && Array.isArray(store.loads)) {
      for (const load of store.loads) {
        allLoads.push({
          nodeId: load.nodeId,
          fx: load.fx,
          fy: load.fy,
          fz: load.fz,
        });
      }
    }

    // Load case loads
    if (store.loadCases) {
      for (const lc of store.loadCases) {
        for (const load of lc.loads || []) {
          allLoads.push({
            nodeId: load.nodeId,
            fx: load.fx,
            fy: load.fy,
            fz: load.fz,
          });
        }
      }
    }

    // Get analysis results summary if available
    let analysisResults: ModelContext['analysisResults'];
    if (store.analysisResults) {
      const results = store.analysisResults;

      // Compute max displacement from displacements map
      let maxDisp = 0;
      if (results.displacements) {
        results.displacements.forEach((d: Record<string, number>) => {
          const mag = Math.sqrt((d.dx || 0) ** 2 + (d.dy || 0) ** 2 + (d.dz || 0) ** 2);
          if (mag > maxDisp) maxDisp = mag;
        });
      }

      // Compute max moment/shear from memberForces map
      let maxMoment = 0;
      let maxShear = 0;
      if (results.memberForces) {
        results.memberForces.forEach((f) => {
          if (f.startForces) {
            const sf = f.startForces as Record<string, number>;
            const mz = Math.abs(sf.mz || 0);
            const fy = Math.abs(sf.fy || 0);
            if (mz > maxMoment) maxMoment = mz;
            if (fy > maxShear) maxShear = fy;
          }
          if (f.endForces) {
            const ef = f.endForces as Record<string, number>;
            const mz = Math.abs(ef.mz || 0);
            const fy = Math.abs(ef.fy || 0);
            if (mz > maxMoment) maxMoment = mz;
            if (fy > maxShear) maxShear = fy;
          }
        });
      }

      analysisResults = {
        maxDisplacement: maxDisp,
        maxStress: 0, // Would need section properties to compute
        maxMoment: maxMoment,
        maxShear: maxShear,
      };
    }

    return { nodes, members, loads: allLoads, analysisResults };
  }, [store.nodes, store.members, store.loads, store.loadCases, store.analysisResults]);

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = useCallback(async (text: string): Promise<ChatMessage | null> => {
    if (!text.trim() || isProcessing) return null;

    setError(null);
    setIsProcessing(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${++messageIdRef.current}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await callAIApi('chat', {
        message: text,
        context: modelContext,
        history: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${++messageIdRef.current}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        type: response.model ? 'model' : response.plan ? 'plan' : 'text',
        actions: response.actions,
        model: response.model,
        plan: response.plan,
        metadata: response.metadata,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Store pending actions
      if (response.actions && response.actions.length > 0) {
        setPendingActions(response.actions);
      }

      // Save to session store
      const activeSessionId = sessionStore.activeSessionId || sessionStore.createSession(text.slice(0, 50));
      sessionStore.addMessage(activeSessionId, {
        role: 'user',
        content: text,
        type: 'chat',
      });
      sessionStore.addMessage(activeSessionId, {
        role: 'assistant',
        content: response.response,
        type: response.model ? 'generate' : 'chat',
        metadata: {
          intent: response.metadata?.intent,
          confidence: response.metadata?.confidence,
          nodesGenerated: response.model?.nodes?.length,
          membersGenerated: response.model?.members?.length,
        },
      });

      setIsProcessing(false);
      return assistantMsg;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process request';
      setError(errorMessage);

      const errorMsg: ChatMessage = {
        id: `msg-${++messageIdRef.current}`,
        role: 'assistant',
        content: `❌ ${errorMessage}\n\nPlease check your connection and try again.`,
        timestamp: new Date(),
        type: 'error',
      };

      setMessages(prev => [...prev, errorMsg]);
      setIsProcessing(false);
      return errorMsg;
    }
  }, [isProcessing, modelContext, messages, sessionStore]);

  // ============================================
  // EXECUTE ACTIONS ON MODEL
  // ============================================

  const executeActions = useCallback(async (actions?: AIAction[]): Promise<{ success: boolean; executed: number }> => {
    const actionsToExecute = actions || pendingActions;
    if (actionsToExecute.length === 0) return { success: true, executed: 0 };

    let executed = 0;

    for (const action of actionsToExecute) {
      try {
        switch (action.type) {
          case 'applyModel': {
            const model = action.params.model as AIModel;
            if (!model) break;

            // Clear existing model
            store.clearModel();

            // Add nodes
            for (const node of model.nodes) {
              store.addNode({
                id: node.id,
                x: node.x,
                y: node.y,
                z: node.z || 0,
                restraints: node.isSupport || node.restraints
                  ? {
                      fx: node.restraints?.fx ?? (node.isSupport || false),
                      fy: node.restraints?.fy ?? (node.isSupport || false),
                      fz: node.restraints?.fz ?? (node.isSupport || false),
                      mx: node.restraints?.mx ?? (node.isSupport || false),
                      my: node.restraints?.my ?? (node.isSupport || false),
                      mz: node.restraints?.mz ?? (node.isSupport || false),
                    }
                  : undefined,
              });
            }

            // Add members
            for (const member of model.members) {
              store.addMember({
                id: member.id,
                startNodeId: member.s,
                endNodeId: member.e,
                sectionId: member.section || 'Default',
              });
            }

            // Add loads to default load case
            if (model.loads && model.loads.length > 0) {
              // Check if there's a default load case
              let defaultLCId = store.loadCases?.[0]?.id;
              if (!defaultLCId) {
                const lcId = `lc-${Date.now()}`;
                store.addLoadCase({
                  id: lcId,
                  name: 'Dead Load',
                  type: 'dead',
                  loads: [],
                  memberLoads: [],
                });
                defaultLCId = lcId;
              }

              for (const load of model.loads) {
                if (load.nodeId) {
                  store.addLoad({
                    id: `load-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    nodeId: load.nodeId,
                    fx: load.fx || 0,
                    fy: load.fy || 0,
                    fz: load.fz || 0,
                  });
                }
              }
            }

            executed++;
            break;
          }

          case 'addNode': {
            store.addNode({
              id: action.params.id || `n${store.nodes.size + 1}`,
              x: action.params.x || 0,
              y: action.params.y || 0,
              z: action.params.z || 0,
              restraints: action.params.restraints,
            });
            executed++;
            break;
          }

          case 'addMember': {
            store.addMember({
              id: action.params.id || `m${store.members.size + 1}`,
              startNodeId: action.params.startNode || action.params.s,
              endNodeId: action.params.endNode || action.params.e,
              sectionId: action.params.section || 'Default',
            });
            executed++;
            break;
          }

          case 'addSupport': {
            const nodeId = action.params.nodeId;
            if (nodeId) {
              store.setNodeRestraints(nodeId, {
                fx: action.params.restraints?.fx ?? true,
                fy: action.params.restraints?.fy ?? true,
                fz: action.params.restraints?.fz ?? true,
                mx: action.params.restraints?.mx ?? true,
                my: action.params.restraints?.my ?? true,
                mz: action.params.restraints?.mz ?? true,
              });
            }
            executed++;
            break;
          }

          case 'addLoad': {
            store.addLoad({
              id: `load-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nodeId: action.params.nodeId,
              fx: action.params.fx || 0,
              fy: action.params.fy || 0,
              fz: action.params.fz || 0,
            });
            executed++;
            break;
          }

          case 'removeNode': {
            store.removeNode(action.params.nodeId || action.params.id);
            executed++;
            break;
          }

          case 'removeMember': {
            store.removeMember(action.params.memberId || action.params.id);
            executed++;
            break;
          }

          case 'changeSection': {
            store.updateMember(action.params.memberId, {
              sectionId: action.params.section,
            });
            executed++;
            break;
          }

          case 'clearModel': {
            store.clearModel();
            executed++;
            break;
          }

          case 'runAnalysis': {
            // Trigger analysis — dispatch to the analysis module
            // The actual analysis runs via WASM/backend, so we just set the flag
            store.setIsAnalyzing(true);
            executed++;
            break;
          }

          case 'optimize':
          case 'report': {
            // These are informational actions
            executed++;
            break;
          }

          default:
            console.warn(`[AIArchitect] Unknown action type: ${action.type}`);
        }
      } catch (err) {
        console.error(`[AIArchitect] Failed to execute action ${action.type}:`, err);
      }
    }

    // Clear pending actions after execution
    setPendingActions([]);

    // Add execution result message
    setMessages(prev => [...prev, {
      id: `msg-${++messageIdRef.current}`,
      role: 'system',
      content: `✅ Executed ${executed}/${actionsToExecute.length} action(s) successfully.`,
      timestamp: new Date(),
      type: 'result',
    }]);

    return { success: executed > 0, executed };
  }, [pendingActions, store]);

  // ============================================
  // GENERATE STRUCTURE
  // ============================================

  const generateStructure = useCallback(async (prompt: string): Promise<AIResponse | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await callAIApi('generate', { prompt });

      if (response.success && response.model) {
        // Auto-apply the model
        await executeActions([{
          type: 'applyModel',
          params: { model: response.model },
          description: 'Apply generated model',
        }]);
      }

      setIsProcessing(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  }, [executeActions]);

  // ============================================
  // DIAGNOSE MODEL
  // ============================================

  const diagnoseModel = useCallback(async (): Promise<AIResponse | null> => {
    try {
      const response = await callAIApi('diagnose', { context: modelContext });
      return response;
    } catch (err) {
      console.error('[AIArchitect] Diagnose failed:', err);
      return null;
    }
  }, [modelContext]);

  // ============================================
  // GET TEMPLATES
  // ============================================

  const getTemplates = useCallback(async () => {
    try {
      return await fetchAIApi('templates');
    } catch {
      return { success: false, templates: [] };
    }
  }, []);

  // ============================================
  // GET AI STATUS
  // ============================================

  const getStatus = useCallback(async () => {
    try {
      return await fetchAIApi('status');
    } catch {
      return { success: false, status: { gemini: false, local: true, healthy: true } };
    }
  }, []);

  // ============================================
  // CLEAR CHAT
  // ============================================

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingActions([]);
    setError(null);
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    messages,
    isProcessing,
    error,
    pendingActions,
    modelContext,

    // Actions
    sendMessage,
    executeActions,
    generateStructure,
    diagnoseModel,
    getTemplates,
    getStatus,
    clearChat,

    // Utilities
    hasModel: modelContext.nodes.length > 0,
    hasAnalysis: !!modelContext.analysisResults,
    isAIEnabled: FEATURES.ai,
  };
}

export default useAIArchitect;
