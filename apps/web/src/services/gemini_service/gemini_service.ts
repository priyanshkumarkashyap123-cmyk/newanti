import { apiLogger } from '../../lib/logging/logger';
import { fetchWithTimeout } from '../../utils/fetchUtils';
import { API_CONFIG } from '../../config/env';
import type { AIAction, AIConversation, AIModelContext, AIPlan } from './types';
import { callGeminiViaProxy, getGeminiApiKey } from './auth';
import { SYSTEM_PROMPT, TASK_PROMPTS, buildMultiTurnPrompt, formatForExpertMode, parseAIPlan, formatPlanResponse, extractKeyPoints, addMentorNotes } from './prompt_builder';
import { extractTaskPayload, normalizeRawOutput, parseStreamingText } from './stream_parser';

export class GeminiAIService {
  private apiKey: string | null = null;
  private model: string = 'gemini-2.0-flash';
  private conversationHistory: AIConversation[] = [];
  private listeners: Set<(event: string, data: any) => void> = new Set();
  private isProcessing: boolean = false;
  private reasoningContext: string[] = [];
  private taskMemory: Map<string, any> = new Map();
  private conversationSummary: string = '';
  private maxContextLength: number = 15;
  private lastModelState: AIModelContext | null = null;
  private expertMode: 'assistant' | 'expert' | 'mentor' = 'assistant';
  private performanceMetrics: {
    totalQueries: number;
    successfulQueries: number;
    avgResponseTime: number;
    codeReferencesUsed: number;
  } = {
    totalQueries: 0,
    successfulQueries: 0,
    avgResponseTime: 0,
    codeReferencesUsed: 0
  };

  constructor() {
    this.apiKey = getGeminiApiKey();
  }

  setExpertMode(mode: 'assistant' | 'expert' | 'mentor'): void {
    this.expertMode = mode;
    apiLogger.info('Expert mode set', { mode });
  }

  getExpertMode(): 'assistant' | 'expert' | 'mentor' {
    return this.expertMode;
  }

  calculateConfidenceScore(query: string, response: string, context: AIModelContext): {
    overall: number;
    codeCompliance: number;
    engineeringLogic: number;
    calculationAccuracy: number;
    contextRelevance: number;
  } {
    let codeCompliance = 40;
    let engineeringLogic = 40;
    let calculationAccuracy = 40;
    let contextRelevance = 40;

    if (/IS\s*800/i.test(response)) codeCompliance += 20;
    if (/IS\s*456/i.test(response)) codeCompliance += 15;
    if (/IS\s*1893/i.test(response)) codeCompliance += 15;
    if (/IS\s*875/i.test(response)) codeCompliance += 10;
    if (/AISC|Eurocode|EN\s*\d+/i.test(response)) codeCompliance += 10;
    if (/clause|section|table/i.test(response)) codeCompliance += 10;

    if (/[M|V|P|σ|τ]\s*[=<>]/.test(response)) engineeringLogic += 15;
    if (/(kN|MPa|mm|N\/mm²|kNm)/.test(response)) engineeringLogic += 10;
    if (/(γ|factor of safety|FOS|capacity|demand)/i.test(response)) engineeringLogic += 10;
    if (/(ultimate|serviceability|SLS|ULS)/i.test(response)) engineeringLogic += 10;
    if (/(step|first|then|therefore|because)/i.test(response)) engineeringLogic += 15;

    if (/\d+\s*[×*/+-]\s*\d+/.test(response)) calculationAccuracy += 15;
    if (/=\s*\d+/.test(response)) calculationAccuracy += 10;
    if (/(ratio|limit|check)/i.test(response)) calculationAccuracy += 10;
    if (/(OK|PASS|SAFE|adequate)/i.test(response)) calculationAccuracy += 15;

    if (context.nodes.length > 0 && /current|your|this.*model/i.test(response)) contextRelevance += 20;
    if (context.analysisResults && /(result|stress|deflection|moment)/i.test(response)) contextRelevance += 15;
    if (/\d+\s*nodes?|\d+\s*members?/i.test(response)) contextRelevance += 15;

    codeCompliance = Math.min(codeCompliance, 100);
    engineeringLogic = Math.min(engineeringLogic, 100);
    calculationAccuracy = Math.min(calculationAccuracy, 100);
    contextRelevance = Math.min(contextRelevance, 100);

    const overall = Math.round(
      codeCompliance * 0.3 +
      engineeringLogic * 0.3 +
      calculationAccuracy * 0.25 +
      contextRelevance * 0.15
    );

    return {
      overall,
      codeCompliance,
      engineeringLogic,
      calculationAccuracy,
      contextRelevance
    };
  }

  formatForExpertMode(response: string): string {
    return formatForExpertMode(response, this.expertMode);
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  recordQueryMetrics(responseTime: number, wasSuccessful: boolean): void {
    this.performanceMetrics.totalQueries++;
    if (wasSuccessful) this.performanceMetrics.successfulQueries++;
    this.performanceMetrics.avgResponseTime =
      (this.performanceMetrics.avgResponseTime * (this.performanceMetrics.totalQueries - 1) + responseTime) /
      this.performanceMetrics.totalQueries;
  }

  setApiKey(key: string): void {
    if (import.meta.env.DEV) {
      this.apiKey = key;
    } else {
      apiLogger.warn('Cannot set API key in production — all calls are proxied through the backend');
    }
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async parseStructuralCommand(transcript: string): Promise<{ action: string; target: string; parameters: Record<string, any> } | null> {
    const lower = transcript.toLowerCase();
    if (lower.includes('add') || lower.includes('create')) {
      if (lower.includes('node') || lower.includes('point')) return { action: 'add', target: 'node', parameters: {} };
      if (lower.includes('member') || lower.includes('beam') || lower.includes('column')) return { action: 'add', target: 'member', parameters: {} };
      if (lower.includes('load') || lower.includes('force')) return { action: 'add', target: 'load', parameters: {} };
    }
    if (lower.includes('remove') || lower.includes('delete')) {
      if (lower.includes('node')) return { action: 'remove', target: 'node', parameters: {} };
      if (lower.includes('member')) return { action: 'remove', target: 'member', parameters: {} };
      if (lower.includes('load')) return { action: 'remove', target: 'load', parameters: {} };
    }
    if (lower.includes('analyze') || lower.includes('run analysis')) {
      return { action: 'analyze', target: 'model', parameters: {} };
    }
    return null;
  }

  setModel(model: string): void {
    this.model = model;
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string, data: any): void {
    this.listeners.forEach(listener => listener(event, data));
  }

  private async decomposeTask(query: string, context: AIModelContext): Promise<string[]> {
    if (!this.apiKey) return [query];
    try {
      const decompositionPrompt = `Analyze this user request and break it into 2-4 clear subtasks:\n      \nUser Request: "${query}"\n\nModel Context:\n- Nodes: ${context.nodes.length}\n- Members: ${context.members.length}\n- Loads: ${context.loads.length}\n\nReturn ONLY a JSON array of subtasks:\n[\\"subtask1\\", \\"subtask2\\", \\"subtask3\\"]\n\nBe specific and actionable.`;
      const response = await this.callGemini(decompositionPrompt);
      try {
        const tasks = JSON.parse(response);
        return Array.isArray(tasks) ? tasks : [query];
      } catch {
        return [query];
      }
    } catch (error) {
      apiLogger.warn('Task decomposition failed', { error });
      return [query];
    }
  }

  private buildEnrichedContext(modelContext: AIModelContext): string {
    let context = '';
    if (modelContext.nodes.length > 0) {
      const xCoords = modelContext.nodes.map((n) => n.x);
      const yCoords = modelContext.nodes.map((n) => n.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      context += `CURRENT MODEL GEOMETRY:\n`;
      context += `- Bounding box: X[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y[${minY.toFixed(1)}, ${maxY.toFixed(1)}]\n`;
      context += `- ${modelContext.nodes.length} nodes, ${modelContext.nodes.filter((n) => n.hasSupport).length} supported\n`;
      context += `- ${modelContext.members.length} members\n`;
    }
    if (modelContext.loads.length > 0) {
      const totalVertical = modelContext.loads.reduce((sum: number, l) => sum + (l.fy || 0), 0);
      const totalHorizontal = modelContext.loads.reduce((sum: number, l) => sum + (l.fx || 0), 0);
      context += `LOAD SUMMARY:\n`;
      context += `- Total vertical: ${totalVertical.toFixed(1)} kN\n`;
      context += `- Total horizontal: ${totalHorizontal.toFixed(1)} kN\n`;
      context += `- Applied to ${modelContext.loads.length} locations\n`;
    }
    if (modelContext.analysisResults) {
      context += `ANALYSIS RESULTS:\n`;
      context += `- Max displacement: ${modelContext.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
      context += `- Max stress: ${modelContext.analysisResults.maxStress.toFixed(1)} MPa\n`;
      context += `- Max moment: ${modelContext.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
    }
    return context;
  }

  private buildMultiTurnPrompt(query: string, modelContext: AIModelContext): string {
    const recentConversation = this.conversationHistory.slice(-6)
      .map(c => `${c.role === 'user' ? 'User' : 'Gemini'}: ${c.content.substring(0, 150)}`)
      .join('\n');
    const enrichedContext = this.buildEnrichedContext(modelContext);
    return `CONVERSATION HISTORY:\n${recentConversation || 'Starting new conversation'}\n\nENRICHED MODEL CONTEXT:\n${enrichedContext || 'No model loaded'}\n\nSYSTEM REASONING:\n- Previous response style: ${this.reasoningContext.slice(-1)[0] || 'Initial conversation'}\n- Task memory: ${Array.from(this.taskMemory.keys()).join(', ') || 'None'}\n\nUSER REQUEST:\n${query}\n\nINSTRUCTIONS:\n1. Use the context above to provide informed responses\n2. Reference previous discussions when relevant\n3. Consider the model state and recent tasks\n4. Build on previous understanding\n5. Provide specific, actionable guidance`;
  }

  private async reasonThroughProblem(problem: string, context: AIModelContext): Promise<string> {
    if (!this.apiKey) return problem;
    try {
      const reasoningPrompt = `Solve this structural engineering problem step-by-step:\n\nPROBLEM:\n${problem}\n\nMODEL STATE:\n${this.buildEnrichedContext(context)}\n\nReasoning Process:\n1. Identify what we know\n2. Identify what we need to find\n3. Choose appropriate formulas/codes\n4. Work through calculations\n5. Verify against industry standards\n6. Present clear conclusion\n\nProvide detailed reasoning with formulas shown.`;
      return await this.callGemini(reasoningPrompt, SYSTEM_PROMPT);
    } catch (error) {
      apiLogger.warn('Problem reasoning failed', { error });
      return problem;
    }
  }

  private updateReasoningMemory(response: string): void {
    this.reasoningContext.push(response.substring(0, 200));
    if (this.reasoningContext.length > 10) {
      this.reasoningContext.shift();
    }
  }

  private async callGeminiViaProxy(prompt: string, systemPrompt?: string): Promise<string> {
    return callGeminiViaProxy(prompt, systemPrompt);
  }

  async callGemini(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Please set your API key.');
    }
    if (import.meta.env.DEV) {
      apiLogger.info('Calling Gemini API', { promptPreview: prompt.substring(0, 100) });
    }
    if (this.apiKey === '__PROXY__' || import.meta.env.PROD) {
      return this.callGeminiViaProxy(prompt, systemPrompt);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const requestBody = {
      contents: [
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        topP: 0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };
    try {
      if (import.meta.env.DEV) apiLogger.info('Sending request');
      const response = await fetchWithTimeout<any>(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      if (!response.success || !response.data) {
        const error = response.data || {};
        apiLogger.error('API error', { error });
        throw new Error(error.error?.message || response.error || 'Gemini API request failed');
      }
      const data = response.data;
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
      if (import.meta.env.DEV) apiLogger.info('Response received', { preview: result.substring(0, 100) });
      return result;
    } catch (error) {
      apiLogger.error('Gemini API error', { error });
      throw error;
    }
  }

  async processUserQuery(query: string, modelContext: AIModelContext): Promise<{ response: string; plan?: AIPlan; actions?: AIAction[] }> {
    this.isProcessing = true;
    this.emit('processing', { status: 'thinking', query });
    try {
      const intent = this.classifyIntent(query);
      let response: string;
      let plan: AIPlan | undefined;
      let actions: AIAction[] | undefined;

      switch (intent) {
        case 'greeting':
          response = await this.handleGreeting(query);
          break;
        case 'thanks':
          response = await this.handleThanks();
          break;
        case 'help':
          response = this.getHelpMessage();
          break;
        case 'troubleshoot':
          response = await this.handleTroubleshooting(query, modelContext);
          break;
        case 'review_model':
          response = await this.reviewModel(modelContext);
          break;
        case 'create_structure': {
          const structurePlan = await this.planStructureCreation(query, modelContext);
          plan = structurePlan;
          actions = structurePlan.steps;
          response = this.formatPlanResponse(structurePlan);
          break;
        }
        case 'run_analysis':
          response = await this.generateAnalysisGuidance(modelContext);
          actions = [{ type: 'runAnalysis', params: {}, description: 'Run structural analysis' }];
          break;
        case 'interpret_results':
          response = await this.interpretResults(modelContext);
          break;
        case 'optimize': {
          const optimizePlan = await this.planOptimization(query, modelContext);
          plan = optimizePlan;
          actions = optimizePlan.steps;
          response = this.formatPlanResponse(optimizePlan);
          break;
        }
        case 'explain':
          response = await this.explainConcept(query);
          break;
        case 'design_check':
          response = await this.performDesignCheck(modelContext);
          break;
        case 'clear_model':
          response = "I'll clear the current model for you. Click **Execute** to confirm, or you can say 'cancel' to keep your model.";
          actions = [{ type: 'report', params: { action: 'clear' }, description: 'Clear current model' }];
          break;
        case 'about_model':
          response = this.describeCurrentModel(modelContext);
          break;
        case 'conversation':
        default:
          response = await this.handleConversation(query, modelContext);
      }

      this.conversationHistory.push(
        { role: 'user', content: query, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date(), metadata: { planGenerated: plan, actionsExecuted: actions } }
      );
      this.emit('processing', { status: 'complete', response, plan, actions });
      return { response, plan, actions };
    } catch (error) {
      this.emit('processing', { status: 'error', error });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private classifyIntent(query: string): string {
    const q = query.toLowerCase().trim();
    if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings)/i) || q.match(/^(how are you|how's it going|what's up|whats up)/i)) return 'greeting';
    if (q.match(/^(thanks|thank you|thx|appreciate|great job|awesome|perfect)/i)) return 'thanks';
    if (q.match(/^(help|what can you do|capabilities|features)/i) || q === '?' || q === 'help me') return 'help';
    if (q.match(/error|problem|issue|wrong|not working|failed|crash|bug|fix|broken|stuck|help me with/i)) return 'troubleshoot';
    if (q.match(/review|check my|look at|inspect|evaluate|assess/i) && q.match(/model|structure|design|work/i)) return 'review_model';
    if (q.match(/create|build|make|generate|design|model|draw|add|new/i) && q.match(/frame|truss|beam|column|building|structure|bridge|cantilever|portal|slab|foundation/i)) return 'create_structure';
    if (q.match(/analyze|analysis|run|calculate|solve|compute/i) && !q.match(/how|what|why|explain/i)) return 'run_analysis';
    if (q.match(/result|displacement|stress|moment|reaction|deflection|interpret|show me/i) && q.match(/result|analysis|output|value/i)) return 'interpret_results';
    if (q.match(/optimize|improve|reduce|minimize|maximize|efficient|lighter|cheaper|better/i)) return 'optimize';
    if (q.match(/check|verify|validate|code|compliance|safe|adequate|pass|fail/i) && q.match(/design|code|is 800|aisc|aci|standard|requirement/i)) return 'design_check';
    if (q.match(/clear|reset|delete|remove|start over|new model|fresh/i) && q.match(/model|all|everything|structure/i)) return 'clear_model';
    if (q.match(/what is|what are|what's|explain|tell me about|teach|learn|understand|definition|meaning|concept|theory|principle/i)) return 'explain';
    if (q.match(/my|this|current/i) && q.match(/model|structure|design|frame/i)) return 'about_model';
    return 'conversation';
  }

  async planStructureCreation(description: string, context: AIModelContext): Promise<AIPlan> {
    const prompt = TASK_PROMPTS.createStructure(description, context);
    if (this.apiKey) {
      try {
        const aiResponse = await this.callGemini(prompt, SYSTEM_PROMPT);
        const plan = parseAIPlan(aiResponse);
        if (plan) return plan;
      } catch (error) {
        apiLogger.warn('Gemini API failed, using local planning', { error });
      }
    }
    return this.localPlanStructure(description);
  }

  private readonly LOAD_COMBINATIONS = {
    ULS_1: { name: '1.5(DL+LL)', DL: 1.5, LL: 1.5, WL: 0, EQ: 0 },
    ULS_2: { name: '1.5(DL+WL)', DL: 1.5, LL: 0, WL: 1.5, EQ: 0 },
    ULS_3: { name: '1.2(DL+LL+WL)', DL: 1.2, LL: 1.2, WL: 1.2, EQ: 0 },
    ULS_4: { name: '1.5(DL+EQ)', DL: 1.5, LL: 0, WL: 0, EQ: 1.5 },
    ULS_5: { name: '1.2(DL+LL+EQ)', DL: 1.2, LL: 1.2, WL: 0, EQ: 1.2 },
    ULS_6: { name: '0.9DL+1.5WL', DL: 0.9, LL: 0, WL: 1.5, EQ: 0 },
    SLS_1: { name: '1.0(DL+LL)', DL: 1.0, LL: 1.0, WL: 0, EQ: 0 },
    SLS_2: { name: '1.0(DL+0.8LL+0.8WL)', DL: 1.0, LL: 0.8, WL: 0.8, EQ: 0 },
  };

  private readonly DEFLECTION_LIMITS = {
    floor_beam: { limit: 'L/300', description: 'Floor beams supporting brittle finishes' },
    floor_beam_general: { limit: 'L/240', description: 'Floor beams general' },
    roof_purlin: { limit: 'L/180', description: 'Purlins and roof sheeting' },
    crane_girder: { limit: 'L/500', description: 'Crane girders (vertical)' },
    crane_girder_h: { limit: 'L/400', description: 'Crane girders (horizontal)' },
    cantilever: { limit: 'L/150', description: 'Cantilever beams' },
    column_drift: { limit: 'H/300', description: 'Column drift under wind/seismic' },
    total_drift: { limit: 'H/500', description: 'Total building drift' },
  };

  private readonly STEEL_SECTIONS: Record<string, { depth: number; width: number; tw: number; tf: number; area: number; weight: number; Ixx: number; Iyy: number; Zxx: number; rxx: number; ryy: number; }> = {
    'ISMB 150': { depth: 150, width: 80, tw: 4.8, tf: 7.6, area: 19.0, weight: 14.9, Ixx: 726, Iyy: 53, Zxx: 96.9, rxx: 6.18, ryy: 1.67 },
    'ISMB 200': { depth: 200, width: 100, tw: 5.7, tf: 10.8, area: 32.3, weight: 25.4, Ixx: 2235, Iyy: 150, Zxx: 224, rxx: 8.32, ryy: 2.15 },
    'ISMB 250': { depth: 250, width: 125, tw: 6.9, tf: 12.5, area: 47.1, weight: 37.3, Ixx: 5132, Iyy: 335, Zxx: 411, rxx: 10.4, ryy: 2.67 },
    'ISMB 300': { depth: 300, width: 140, tw: 7.7, tf: 13.1, area: 58.9, weight: 46.2, Ixx: 8603, Iyy: 454, Zxx: 574, rxx: 12.1, ryy: 2.78 },
    'ISMB 350': { depth: 350, width: 140, tw: 8.1, tf: 14.2, area: 66.7, weight: 52.4, Ixx: 13630, Iyy: 538, Zxx: 779, rxx: 14.3, ryy: 2.84 },
    'ISMB 400': { depth: 400, width: 140, tw: 8.9, tf: 16.0, area: 78.5, weight: 61.6, Ixx: 20500, Iyy: 622, Zxx: 1022, rxx: 16.2, ryy: 2.82 },
    'ISMB 450': { depth: 450, width: 150, tw: 9.4, tf: 17.4, area: 92.3, weight: 72.4, Ixx: 30390, Iyy: 834, Zxx: 1350, rxx: 18.1, ryy: 3.01 },
    'ISMB 500': { depth: 500, width: 180, tw: 10.2, tf: 17.2, area: 110.7, weight: 86.9, Ixx: 45220, Iyy: 1370, Zxx: 1808, rxx: 20.2, ryy: 3.52 },
    'ISMB 550': { depth: 550, width: 190, tw: 11.2, tf: 19.3, area: 132.1, weight: 103.7, Ixx: 64900, Iyy: 1830, Zxx: 2360, rxx: 22.2, ryy: 3.73 },
    'ISMB 600': { depth: 600, width: 210, tw: 12.0, tf: 20.8, area: 156.2, weight: 122.6, Ixx: 91800, Iyy: 2650, Zxx: 3060, rxx: 24.2, ryy: 4.12 },
    'ISHB 150': { depth: 150, width: 150, tw: 5.4, tf: 9.0, area: 34.5, weight: 27.1, Ixx: 1456, Iyy: 432, Zxx: 194, rxx: 6.50, ryy: 3.54 },
    'ISHB 200': { depth: 200, width: 200, tw: 6.1, tf: 9.0, area: 47.5, weight: 37.3, Ixx: 3608, Iyy: 967, Zxx: 361, rxx: 8.72, ryy: 4.51 },
    'ISHB 250': { depth: 250, width: 250, tw: 6.9, tf: 9.7, area: 65.0, weight: 51.0, Ixx: 7740, Iyy: 1961, Zxx: 619, rxx: 10.9, ryy: 5.49 },
    'ISHB 300': { depth: 300, width: 250, tw: 7.6, tf: 10.6, area: 75.0, weight: 58.8, Ixx: 12550, Iyy: 2194, Zxx: 837, rxx: 12.9, ryy: 5.41 },
    'ISHB 350': { depth: 350, width: 250, tw: 8.3, tf: 11.6, area: 85.6, weight: 67.4, Ixx: 19160, Iyy: 2451, Zxx: 1094, rxx: 15.0, ryy: 5.35 },
    'ISHB 400': { depth: 400, width: 250, tw: 9.1, tf: 12.7, area: 97.8, weight: 76.8, Ixx: 28080, Iyy: 2728, Zxx: 1404, rxx: 16.9, ryy: 5.28 },
    'ISHB 450': { depth: 450, width: 250, tw: 9.8, tf: 13.7, area: 109.7, weight: 86.1, Ixx: 39210, Iyy: 2987, Zxx: 1743, rxx: 18.9, ryy: 5.22 },
    'ISMC 75': { depth: 75, width: 40, tw: 4.4, tf: 7.3, area: 8.7, weight: 6.8, Ixx: 76, Iyy: 12.5, Zxx: 20.2, rxx: 2.95, ryy: 1.20 },
    'ISMC 100': { depth: 100, width: 50, tw: 5.0, tf: 7.7, area: 11.7, weight: 9.2, Ixx: 187, Iyy: 26.0, Zxx: 37.3, rxx: 4.00, ryy: 1.49 },
    'ISMC 125': { depth: 125, width: 65, tw: 5.3, tf: 8.2, area: 16.2, weight: 12.7, Ixx: 416, Iyy: 60.0, Zxx: 66.5, rxx: 5.07, ryy: 1.92 },
    'ISMC 150': { depth: 150, width: 75, tw: 5.7, tf: 9.0, area: 20.9, weight: 16.4, Ixx: 779, Iyy: 103, Zxx: 104, rxx: 6.11, ryy: 2.22 },
    'ISMC 200': { depth: 200, width: 75, tw: 6.2, tf: 11.4, area: 28.2, weight: 22.1, Ixx: 1819, Iyy: 141, Zxx: 182, rxx: 8.03, ryy: 2.24 },
    'ISMC 250': { depth: 250, width: 80, tw: 7.1, tf: 14.1, area: 39.0, weight: 30.6, Ixx: 3817, Iyy: 211, Zxx: 306, rxx: 9.89, ryy: 2.33 },
    'ISMC 300': { depth: 300, width: 90, tw: 7.8, tf: 13.6, area: 46.3, weight: 36.3, Ixx: 6362, Iyy: 310, Zxx: 424, rxx: 11.7, ryy: 2.59 },
    'ISA 50x50x5': { depth: 50, width: 50, tw: 5, tf: 5, area: 4.8, weight: 3.8, Ixx: 11.0, Iyy: 11.0, Zxx: 3.1, rxx: 1.51, ryy: 1.51 },
    'ISA 65x65x6': { depth: 65, width: 65, tw: 6, tf: 6, area: 7.4, weight: 5.8, Ixx: 28.2, Iyy: 28.2, Zxx: 6.1, rxx: 1.95, ryy: 1.95 },
    'ISA 75x75x8': { depth: 75, width: 75, tw: 8, tf: 8, area: 11.4, weight: 8.9, Ixx: 59.3, Iyy: 59.3, Zxx: 11.1, rxx: 2.28, ryy: 2.28 },
    'ISA 90x90x10': { depth: 90, width: 90, tw: 10, tf: 10, area: 17.0, weight: 13.4, Ixx: 127, Iyy: 127, Zxx: 19.8, rxx: 2.73, ryy: 2.73 },
    'ISA 100x100x10': { depth: 100, width: 100, tw: 10, tf: 10, area: 19.0, weight: 14.9, Ixx: 177, Iyy: 177, Zxx: 24.9, rxx: 3.05, ryy: 3.05 },
    'ISA 100x100x12': { depth: 100, width: 100, tw: 12, tf: 12, area: 22.6, weight: 17.7, Ixx: 207, Iyy: 207, Zxx: 29.3, rxx: 3.03, ryy: 3.03 },
    'ISA 150x150x15': { depth: 150, width: 150, tw: 15, tf: 15, area: 43.0, weight: 33.8, Ixx: 699, Iyy: 699, Zxx: 66.4, rxx: 4.03, ryy: 4.03 },
  };

  private calculateRealisticLoads(structureType: string, params: { span: number; height?: number; bayWidth?: number; tributaryWidth?: number; occupancy?: string; roofType?: string; location?: string; seismicZone?: string; terrainCategory?: number; importanceFactor?: number; }): { deadLoad: number; liveLoad: number; roofLiveLoad?: number; windLoad?: number; seismicCoeff?: number; selfWeight: number; totalPointLoad: number; totalUDL: number; factoredLoads: { uls: number; sls: number; wind_comb: number; }; description: string; } {
    const { span, height = 4, bayWidth = 6, tributaryWidth = 3, occupancy = 'office', roofType = 'metal', seismicZone = 'III', terrainCategory = 2, importanceFactor = 1.0 } = params;
    let deadLoadIntensity = 0;
    switch (structureType) {
      case 'building':
      case 'frame':
        deadLoadIntensity = 6.75;
        break;
      case 'roof':
      case 'truss':
        deadLoadIntensity = roofType === 'rcc' ? 3.5 : 0.5;
        break;
      case 'industrial':
        deadLoadIntensity = 8.0;
        break;
      case 'beam':
        deadLoadIntensity = 5.5;
        break;
      default:
        deadLoadIntensity = 5.0;
    }
    const liveLoadTable: Record<string, number> = { residential: 2.0, office: 2.5, office_heavy: 4.0, assembly: 4.0, assembly_dense: 5.0, retail: 4.0, warehouse_light: 6.0, warehouse_medium: 10.0, warehouse_heavy: 15.0, industrial_light: 5.0, industrial_heavy: 10.0, hospital: 3.0, hospital_operating: 4.0, school: 3.0, library: 6.0, library_reading: 4.0, parking: 2.5, parking_heavy: 5.0, corridor: 4.0, stairs: 5.0, balcony: 3.0, roof_access: 1.5, roof_no_access: 0.75 };
    const liveLoadIntensity = liveLoadTable[occupancy] || 3.0;
    const roofLiveLoad = occupancy?.includes('roof') ? liveLoadTable[occupancy] : 0.75;
    const windZones: Record<string, number> = { I: 33, II: 39, III: 44, IV: 47, V: 50, VI: 55 };
    const Vb = windZones['III'];
    const k1 = 1.0;
    const k2Table: Record<number, Record<string, number>> = { 1: { '10': 1.05, '15': 1.09, '20': 1.12, '30': 1.16, '50': 1.20 }, 2: { '10': 1.00, '15': 1.05, '20': 1.07, '30': 1.12, '50': 1.17 }, 3: { '10': 0.91, '15': 0.97, '20': 1.01, '30': 1.06, '50': 1.12 }, 4: { '10': 0.80, '15': 0.80, '20': 0.88, '30': 0.98, '50': 1.05 } };
    const heightBracket = height <= 10 ? '10' : height <= 15 ? '15' : height <= 20 ? '20' : height <= 30 ? '30' : '50';
    const k2 = k2Table[terrainCategory]?.[heightBracket] || 1.0;
    const k3 = 1.0;
    const Vz = Vb * k1 * k2 * k3;
    const pz = 0.6 * Vz * Vz / 1000;
    const Cp_windward = 0.8;
    const Cp_leeward = -0.4;
    const windPressure = pz * Math.abs(Cp_windward - Cp_leeward);
    const seismicZones: Record<string, number> = { II: 0.10, III: 0.16, IV: 0.24, V: 0.36 };
    const Z = seismicZones[seismicZone] || 0.16;
    const I = importanceFactor;
    const R = 5.0;
    const T = 0.075 * Math.pow(height, 0.75);
    let SaByG = 1.0;
    if (T <= 0.10) SaByG = 1.0 + 15 * T;
    else if (T <= 0.55) SaByG = 2.5;
    else if (T <= 4.0) SaByG = 1.36 / T;
    else SaByG = 0.34;
    const Ah = (Z / 2) * (I / R) * SaByG;
    let selfWeight = 0;
    switch (structureType) {
      case 'beam': selfWeight = 0.4 + span * 0.035; break;
      case 'column': selfWeight = 0.6 + height * 0.04; break;
      case 'truss': selfWeight = 0.10 + span * 0.012; break;
      case 'purlin': selfWeight = 0.15; break;
      default: selfWeight = 0.5;
    }
    const tributaryArea = bayWidth * tributaryWidth;
    const totalUDL = (deadLoadIntensity + liveLoadIntensity) * tributaryWidth + selfWeight;
    const totalPointLoad = (deadLoadIntensity + liveLoadIntensity) * tributaryArea;
    const factoredLoads = { uls: 1.5 * totalPointLoad, sls: 1.0 * totalPointLoad, wind_comb: 1.2 * totalPointLoad + 1.2 * windPressure * tributaryArea };
    const description = `Realistic load calculation`; 
    return { deadLoad: deadLoadIntensity, liveLoad: liveLoadIntensity, roofLiveLoad, windLoad: windPressure, seismicCoeff: Ah, selfWeight, totalPointLoad, totalUDL, factoredLoads, description };
  }

  private selectRealisticSection(memberType: string, span: number, load: number): string {
    const getSectionMomentCapacity = (sectionName: string): number => {
      const section = this.STEEL_SECTIONS[sectionName];
      if (!section) return 0;
      return (250 * section.Zxx / 1.1) / 1000;
    };
    if (memberType === 'beam') {
      const requiredMoment = (load * span * span) / 8;
      const beamSections = ['ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 350', 'ISMB 400', 'ISMB 450', 'ISMB 500', 'ISMB 550', 'ISMB 600'];
      for (const section of beamSections) {
        if (getSectionMomentCapacity(section) >= requiredMoment * 1.1) return section;
      }
      return 'ISMB 600';
    }
    if (memberType === 'column') {
      if (load <= 500) return 'ISHB 200';
      if (load <= 1000) return 'ISHB 250';
      if (load <= 1500) return 'ISHB 300';
      if (load <= 2500) return 'ISHB 350';
      if (load <= 4000) return 'ISHB 400';
      return 'ISHB 450';
    }
    if (memberType === 'truss_chord') {
      if (span <= 15) return 'ISMC 150';
      if (span <= 25) return 'ISMC 200';
      if (span <= 35) return 'ISMC 250';
      return 'ISMC 300';
    }
    if (memberType === 'truss_web') {
      if (span <= 15) return 'ISA 65x65x6';
      if (span <= 25) return 'ISA 75x75x8';
      if (span <= 35) return 'ISA 90x90x10';
      return 'ISA 100x100x10';
    }
    if (memberType === 'bracing') return 'ISA 75x75x8';
    return 'ISMB 300';
  }

  private localPlanStructure(description: string): AIPlan {
    const d = description.toLowerCase();
    const spanMatch = d.match(/(\d+(?:\.\d+)?)\s*m?\s*(span|wide|width|long|length|meter)/i) || d.match(/(span|width|length)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m?/i);
    const heightMatch = d.match(/(\d+(?:\.\d+)?)\s*m?\s*(height|tall|high|deep|depth)/i) || d.match(/(\d+)\s*(story|storey|floor|level)/i);
    const bayMatch = d.match(/(\d+)\s*bay/i);
    const storyMatch = d.match(/(\d+)\s*(story|storey|floor|level)/i);
    const loadMatch = d.match(/(\d+(?:\.\d+)?)\s*(kn|kilo|load)/i);
    let occupancy = 'office';
    if (d.includes('warehouse') || d.includes('storage')) occupancy = 'warehouse_light';
    if (d.includes('industrial') || d.includes('factory')) occupancy = 'industrial_light';
    if (d.includes('residential') || d.includes('house') || d.includes('apartment')) occupancy = 'residential';
    if (d.includes('hospital') || d.includes('medical')) occupancy = 'hospital';
    if (d.includes('school') || d.includes('college')) occupancy = 'school';
    if (d.includes('retail') || d.includes('shop') || d.includes('mall')) occupancy = 'retail';
    if (d.includes('assembly') || d.includes('auditorium') || d.includes('hall')) occupancy = 'assembly';
    if (d.includes('library')) occupancy = 'library';
    if (d.includes('parking') || d.includes('garage')) occupancy = 'parking';
    const span = spanMatch ? parseFloat(spanMatch[1]) : 12;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 6;
    const bays = bayMatch ? parseInt(bayMatch[1]) : 3;
    const stories = storyMatch ? parseInt(storyMatch[1]) : 3;
    const specifiedLoad = loadMatch ? parseFloat(loadMatch[1]) : null;
    const bayWidth = span / Math.max(bays, 1);
    const storyHeight = stories > 1 ? Math.min(height / stories, 4.0) : height;
    const tributaryWidth = 6;
    const defaultLoads = this.calculateRealisticLoads('building', { span, height, bayWidth, tributaryWidth, occupancy });
    const loadValue = specifiedLoad || defaultLoads.totalPointLoad;
    const steps: AIAction[] = [];
    let goal = '';
    let reasoning = '';
    if (d.includes('warren')) {
      const panels = Math.max(6, Math.round(span / 2) % 2 === 0 ? Math.round(span / 2) : Math.round(span / 2) + 1);
      const depth = span / 8;
      const panelWidth = span / panels;
      const numTrusses = d.includes('single') ? 1 : Math.max(3, bays);
      const trussSpacing = 6;
      const buildingLength = (numTrusses - 1) * trussSpacing;
      const loads = this.calculateRealisticLoads('truss', { span, height: depth, bayWidth: panelWidth, tributaryWidth: trussSpacing, occupancy, roofType: 'metal' });
      const nodeSpacing = panelWidth;
      const nodeLoad = specifiedLoad || (loads.deadLoad + loads.roofLiveLoad!) * trussSpacing * nodeSpacing;
      const chordSection = this.selectRealisticSection('truss_chord', span, nodeLoad);
      const webSection = this.selectRealisticSection('truss_web', span, nodeLoad);
      const purlinSection = 'ISMC 125';
      const bracingSection = 'ISA 50x50x6';
      goal = `Create a REAL 3D Warren Truss Roof: ${span}m × ${buildingLength}m (${numTrusses} trusses)`;
      reasoning = `Warren truss roof system.`;
      let nodeId = 1;
      const nodeMap: Record<string, number> = {};
      for (let truss = 0; truss < numTrusses; truss++) {
        const z = truss * trussSpacing;
        for (let i = 0; i <= panels; i++) {
          const isSupport = i === 0 || i === panels;
          const key = `bottom-${truss}-${i}`;
          nodeMap[key] = nodeId;
          steps.push({ type: 'addNode', params: { id: `N${nodeId}`, x: i * panelWidth, y: 0, z, support: isSupport ? (i === 0 ? 'pinned' : 'roller') : undefined }, description: `Truss ${truss + 1}: Bottom node ${i}${isSupport ? ' (Support)' : ''}` });
          nodeId++;
        }
        for (let i = 0; i < panels; i++) {
          const key = `top-${truss}-${i}`;
          nodeMap[key] = nodeId;
          steps.push({ type: 'addNode', params: { id: `N${nodeId}`, x: (i + 0.5) * panelWidth, y: depth, z }, description: `Truss ${truss + 1}: Top chord node ${i + 1}` });
          nodeId++;
        }
      }
      return { goal, reasoning, steps, confidence: 0.9 };
    }
    return { goal, reasoning, steps, confidence: 0.9 };
  }

  private parseAIPlan(response: string): AIPlan | null {
    return parseAIPlan(response);
  }

  async generateAnalysisGuidance(context: AIModelContext): Promise<string> { return context.nodes.length === 0 ? 'No Structure to Analyze' : 'Ready for Analysis'; }
  async interpretResults(context: AIModelContext): Promise<string> { return context.analysisResults ? 'Results available' : 'No analysis results available.'; }
  async planOptimization(goal: string, context: AIModelContext): Promise<AIPlan> { return { goal: `Optimize structure for: ${goal}`, reasoning: 'Optimization plan.', steps: [{ type: 'optimize', params: {}, description: 'Optimize structure' }], confidence: 0.85 }; }
  async performDesignCheck(context: AIModelContext): Promise<string> { return 'Design check report'; }

  async explainConcept(query: string): Promise<string> {
    const q = query.toLowerCase();
    if (this.apiKey) {
      try {
        if (q.match(/why|how|problem|calculate|design|check|formula|stress|moment|deflection|buckling/i)) {
          return await this.reasonThroughProblem(`Explain: ${query}`, this.lastModelState || { nodes: [], members: [], loads: [] });
        }
        const prompt = TASK_PROMPTS.explainConcept(query);
        const response = await this.callGemini(prompt, SYSTEM_PROMPT);
        this.updateReasoningMemory(response);
        return response;
      } catch (error) {
        apiLogger.warn('Gemini unavailable for explanation', { error });
      }
    }
    return this.getEngineeringExplanation(q);
  }

  private getEngineeringExplanation(query: string): string { return 'Engineering knowledge base'; }
  private async handleGreeting(query: string): Promise<string> { return 'Hello!'; }
  private async handleThanks(): Promise<string> { return 'You are welcome.'; }
  private getHelpMessage(): string { return 'Help guide'; }
  private async handleTroubleshooting(query: string, context: AIModelContext): Promise<string> { return 'Troubleshooting'; }
  private async reviewModel(context: AIModelContext): Promise<string> { return 'Review'; }
  private async handleConversation(query: string, context: AIModelContext): Promise<string> { return 'Conversation'; }
  private generateLocalConversationalResponse(query: string, context: AIModelContext): string { return 'Local response'; }
  describeCurrentModel(context: AIModelContext): string { return 'Current model overview'; }
  async generalResponse(query: string, context: AIModelContext): Promise<string> { return this.apiKey ? this.callGemini(`${query}`, SYSTEM_PROMPT) : 'I understand you are asking about this query.'; }
  private formatPlanResponse(plan: AIPlan): string { return formatPlanResponse(plan); }
  private getActionIcon(type: AIAction['type']): string { const icons: Record<string, string> = { addNode: '📍', addMember: '📏', addSupport: '🔩', addLoad: '⬇️', runAnalysis: '📊', optimize: '🎯', report: '📄' }; return icons[type] || '•'; }
  getConversationHistory(): AIConversation[] { return [...this.conversationHistory]; }
  clearConversation(): void { this.conversationHistory = []; this.reasoningContext = []; this.taskMemory.clear(); this.conversationSummary = ''; }
  storeTask(taskId: string, taskData: any): void { this.taskMemory.set(taskId, { ...taskData, timestamp: new Date() }); }
  retrieveTask(taskId: string): any { return this.taskMemory.get(taskId); }
  getReasoningContext(): string[] { return [...this.reasoningContext]; }
  private manageConversationMemory(): void { if (this.conversationHistory.length > this.maxContextLength) { const systemMessages = this.conversationHistory.filter(c => c.role === 'system'); const recentMessages = this.conversationHistory.slice(-this.maxContextLength); this.conversationHistory = [...systemMessages, ...recentMessages]; } }
  isCurrentlyProcessing(): boolean { return this.isProcessing; }
}

export const geminiAI = new GeminiAIService();
export default GeminiAIService;
