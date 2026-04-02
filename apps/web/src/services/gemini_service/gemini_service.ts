import { apiLogger } from '../../lib/logging/logger';
import { fetchWithTimeout } from '../../utils/fetchUtils';
import { API_CONFIG } from '../../config/env';
import type { AIAction, AIConversation, AIModelContext, AIPlan } from './types';
import { callGeminiViaProxy, getGeminiApiKey } from './auth';
import { SYSTEM_PROMPT, TASK_PROMPTS, formatForExpertMode, parseAIPlan, formatPlanResponse, extractKeyPoints, addMentorNotes } from './prompt_builder';
import { extractTaskPayload, normalizeRawOutput, parseStreamingText } from './stream_parser';
import { buildGeminiGenerateContentRequest } from './templates/requestPayload';
import { buildReasoningPrompt, buildTaskDecompositionPrompt } from './templates/taskPrompts';
import { calculateConfidenceScore as calculateConfidenceScoreUtil } from './utils/confidence';
import { classifyGeminiIntent, GEMINI_INTENTS, type GeminiIntent } from './utils/intent';
import {
  buildWarrenBottomNodeDescription,
  buildWarrenBottomNodeKey,
  buildWarrenGoal,
  buildWarrenNodeId,
  buildWarrenTopNodeKey,
  buildWarrenTopNodeDescription,
  computeWarrenPanelCount,
  getWarrenSupportType,
  computeWarrenTrussCount,
  computeWarrenTrussDepth,
  inferOccupancyFromDescription,
  OPTIMIZATION_PLANNING_DEFAULTS,
  parsePlanningInputs,
  PLANNING_DEFAULTS,
  WARREN_PLANNING_HEURISTICS,
  WARREN_SECTION_DEFAULTS,
  WARREN_TEXT_DEFAULTS,
} from './utils/planning';
import { parseStructuralCommandFromTranscript } from './utils/commandParser';
import { ACTION_ICON_BY_TYPE, DEFAULT_ACTION_ICON } from './utils/presentation';
import { GEMINI_ACTION_TEXT, GEMINI_FALLBACK_RESPONSES } from './utils/responses';
import { GEMINI_INITIAL_PERFORMANCE_METRICS, GEMINI_RUNTIME_DEFAULTS } from './utils/runtime';
import { buildConversationPrompt, buildEnrichedModelContext } from './contextBuilders/modelContextPrompt';
import { STEEL_SECTIONS } from './knowledgeBase/structuralCatalog';
import {
  BEAM_SECTIONS_ASCENDING,
  CALCULATION_INPUT_DEFAULTS,
  COLUMN_LOAD_TO_SECTION,
  DEAD_LOAD_BY_STRUCTURE,
  DEFAULT_DEAD_LOAD,
  DEFAULT_IMPORTANCE_FACTOR,
  DEFAULT_LIVE_LOAD,
  DEFAULT_OCCUPANCY,
  DEFAULT_ROOF_LIVE_LOAD,
  DEFAULT_ROOF_TYPE,
  DEFAULT_SEISMIC_ZONE_FACTOR,
  DEFAULT_SEISMIC_ZONE,
  DEFAULT_TERRAIN_CATEGORY,
  DEFAULT_WIND_ZONE,
  HEIGHT_BRACKETS,
  LOAD_FACTORS,
  LIVE_LOAD_TABLE,
  MEMBER_TYPE_KEYS,
  RESPONSE_REDUCTION_FACTOR,
  ROOF_TYPE_KEYS,
  ROOF_DEAD_LOAD_BY_TYPE,
  SEISMIC_ZONE_FACTORS,
  SEISMIC_PERIOD_CONSTANTS,
  SECTION_SELECTION_FACTORS,
  SECTION_FALLBACKS,
  SELF_WEIGHT_MODELS,
  STRUCTURE_TYPE_KEYS,
  TERRAIN_FACTOR_K2,
  TRUSS_CHORD_SPAN_TO_SECTION,
  TRUSS_WEB_SPAN_TO_SECTION,
  WIND_FACTORS,
  WIND_ZONE_SPEEDS,
} from './knowledgeBase/loadCalculationCatalog';

export class GeminiAIService {
  private apiKey: string | null = null;
  private model: string = GEMINI_RUNTIME_DEFAULTS.model;
  private conversationHistory: AIConversation[] = [];
  private listeners: Set<(event: string, data: any) => void> = new Set();
  private isProcessing: boolean = false;
  private reasoningContext: string[] = [];
  private taskMemory: Map<string, any> = new Map();
  private conversationSummary: string = GEMINI_RUNTIME_DEFAULTS.defaultConversationSummary;
  private maxContextLength: number = GEMINI_RUNTIME_DEFAULTS.maxContextLength;
  private lastModelState: AIModelContext | null = null;
  private expertMode: 'assistant' | 'expert' | 'mentor' = GEMINI_RUNTIME_DEFAULTS.defaultExpertMode;
  private performanceMetrics: {
    totalQueries: number;
    successfulQueries: number;
    avgResponseTime: number;
    codeReferencesUsed: number;
  } = {
    ...GEMINI_INITIAL_PERFORMANCE_METRICS
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
    return calculateConfidenceScoreUtil(query, response, context);
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
    return parseStructuralCommandFromTranscript(transcript);
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
    const fallbackTasks = [query];
    if (!this.apiKey) return fallbackTasks;
    try {
      const decompositionPrompt = buildTaskDecompositionPrompt(query, context);
      const response = await this.callGemini(decompositionPrompt);
      try {
        const tasks = JSON.parse(response);
        return Array.isArray(tasks) ? tasks : fallbackTasks;
      } catch {
        return fallbackTasks;
      }
    } catch (error) {
      apiLogger.warn(GEMINI_RUNTIME_DEFAULTS.messages.decompositionFailed, { error });
      return fallbackTasks;
    }
  }

  private buildEnrichedContext(modelContext: AIModelContext): string {
    return buildEnrichedModelContext(modelContext);
  }

  private buildMultiTurnPrompt(query: string, modelContext: AIModelContext): string {
    return buildConversationPrompt(
      query,
      modelContext,
      this.conversationHistory,
      this.reasoningContext,
      Array.from(this.taskMemory.keys()),
    );
  }

  private async reasonThroughProblem(problem: string, context: AIModelContext): Promise<string> {
    if (!this.apiKey) return problem;
    try {
      const reasoningPrompt = buildReasoningPrompt(problem, this.buildEnrichedContext(context));
      return await this.callGemini(reasoningPrompt, SYSTEM_PROMPT);
    } catch (error) {
      apiLogger.warn(GEMINI_RUNTIME_DEFAULTS.messages.reasoningFailed, { error });
      return problem;
    }
  }

  private updateReasoningMemory(response: string): void {
    this.reasoningContext.push(response.substring(0, GEMINI_RUNTIME_DEFAULTS.reasoningSnippetLength));
    if (this.reasoningContext.length > GEMINI_RUNTIME_DEFAULTS.reasoningHistoryLimit) {
      this.reasoningContext.shift();
    }
  }

  private async callGeminiViaProxy(prompt: string, systemPrompt?: string): Promise<string> {
    return callGeminiViaProxy(prompt, systemPrompt);
  }

  async callGemini(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(GEMINI_RUNTIME_DEFAULTS.messages.apiKeyMissing);
    }
    if (import.meta.env.DEV) {
      apiLogger.info(GEMINI_RUNTIME_DEFAULTS.messages.callingApi, {
        promptPreview: prompt.substring(0, GEMINI_RUNTIME_DEFAULTS.logPreviewLength),
      });
    }
    if (this.apiKey === '__PROXY__' || import.meta.env.PROD) {
      return this.callGeminiViaProxy(prompt, systemPrompt);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const requestBody = buildGeminiGenerateContentRequest(prompt, systemPrompt);
    try {
      if (import.meta.env.DEV) apiLogger.info(GEMINI_RUNTIME_DEFAULTS.messages.sendingRequest);
      const response = await fetchWithTimeout<any>(url, {
        method: GEMINI_RUNTIME_DEFAULTS.http.postMethod,
        body: JSON.stringify(requestBody),
      });
      if (!response.success || !response.data) {
        const error = response.data || {};
        apiLogger.error(GEMINI_RUNTIME_DEFAULTS.messages.apiError, { error });
        throw new Error(error.error?.message || response.error || GEMINI_RUNTIME_DEFAULTS.messages.requestFailed);
      }
      const data = response.data;
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || GEMINI_RUNTIME_DEFAULTS.noResponseGenerated;
      if (import.meta.env.DEV) {
        apiLogger.info(GEMINI_RUNTIME_DEFAULTS.messages.responseReceived, {
          preview: result.substring(0, GEMINI_RUNTIME_DEFAULTS.logPreviewLength),
        });
      }
      return result;
    } catch (error) {
      apiLogger.error(GEMINI_RUNTIME_DEFAULTS.messages.geminiApiError, { error });
      throw error;
    }
  }

  async processUserQuery(query: string, modelContext: AIModelContext): Promise<{ response: string; plan?: AIPlan; actions?: AIAction[] }> {
    this.isProcessing = true;
    this.emit('processing', { status: GEMINI_RUNTIME_DEFAULTS.processingStatus.thinking, query });
    try {
      const intent = this.classifyIntent(query);
      let response: string;
      let plan: AIPlan | undefined;
      let actions: AIAction[] | undefined;

      switch (intent) {
        case GEMINI_INTENTS.greeting:
          response = await this.handleGreeting(query);
          break;
        case GEMINI_INTENTS.thanks:
          response = await this.handleThanks();
          break;
        case GEMINI_INTENTS.help:
          response = this.getHelpMessage();
          break;
        case GEMINI_INTENTS.troubleshoot:
          response = await this.handleTroubleshooting(query, modelContext);
          break;
        case GEMINI_INTENTS.reviewModel:
          response = await this.reviewModel(modelContext);
          break;
        case GEMINI_INTENTS.createStructure: {
          const structurePlan = await this.planStructureCreation(query, modelContext);
          plan = structurePlan;
          actions = structurePlan.steps;
          response = this.formatPlanResponse(structurePlan);
          break;
        }
        case GEMINI_INTENTS.runAnalysis:
          response = await this.generateAnalysisGuidance(modelContext);
          actions = [{ type: 'runAnalysis', params: {}, description: GEMINI_ACTION_TEXT.runStructuralAnalysis }];
          break;
        case GEMINI_INTENTS.interpretResults:
          response = await this.interpretResults(modelContext);
          break;
        case GEMINI_INTENTS.optimize: {
          const optimizePlan = await this.planOptimization(query, modelContext);
          plan = optimizePlan;
          actions = optimizePlan.steps;
          response = this.formatPlanResponse(optimizePlan);
          break;
        }
        case GEMINI_INTENTS.explain:
          response = await this.explainConcept(query);
          break;
        case GEMINI_INTENTS.designCheck:
          response = await this.performDesignCheck(modelContext);
          break;
        case GEMINI_INTENTS.clearModel:
          response = GEMINI_ACTION_TEXT.clearCurrentModelResponse;
          actions = [{ type: 'report', params: { action: 'clear' }, description: GEMINI_ACTION_TEXT.clearCurrentModelAction }];
          break;
        case GEMINI_INTENTS.aboutModel:
          response = this.describeCurrentModel(modelContext);
          break;
        case GEMINI_INTENTS.conversation:
        default:
          response = await this.handleConversation(query, modelContext);
      }

      this.conversationHistory.push(
        { role: 'user', content: query, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date(), metadata: { planGenerated: plan, actionsExecuted: actions } }
      );
      this.emit('processing', { status: GEMINI_RUNTIME_DEFAULTS.processingStatus.complete, response, plan, actions });
      return { response, plan, actions };
    } catch (error) {
      this.emit('processing', { status: GEMINI_RUNTIME_DEFAULTS.processingStatus.error, error });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private classifyIntent(query: string): GeminiIntent {
    return classifyGeminiIntent(query);
  }

  async planStructureCreation(description: string, context: AIModelContext): Promise<AIPlan> {
    const prompt = TASK_PROMPTS.createStructure(description, context);
    if (this.apiKey) {
      try {
        const aiResponse = await this.callGemini(prompt, SYSTEM_PROMPT);
        const plan = parseAIPlan(aiResponse);
        if (plan) return plan;
      } catch (error) {
        apiLogger.warn(GEMINI_RUNTIME_DEFAULTS.messages.apiFallbackToLocalPlanning, { error });
      }
    }
    return this.localPlanStructure(description);
  }

  private calculateRealisticLoads(structureType: string, params: { span: number; height?: number; bayWidth?: number; tributaryWidth?: number; occupancy?: string; roofType?: string; location?: string; seismicZone?: string; terrainCategory?: number; importanceFactor?: number; }): { deadLoad: number; liveLoad: number; roofLiveLoad?: number; windLoad?: number; seismicCoeff?: number; selfWeight: number; totalPointLoad: number; totalUDL: number; factoredLoads: { uls: number; sls: number; wind_comb: number; }; description: string; } {
    const {
      span,
      height = CALCULATION_INPUT_DEFAULTS.height,
      bayWidth = CALCULATION_INPUT_DEFAULTS.bayWidth,
      tributaryWidth = CALCULATION_INPUT_DEFAULTS.tributaryWidth,
      occupancy = DEFAULT_OCCUPANCY,
      roofType = DEFAULT_ROOF_TYPE,
      seismicZone = DEFAULT_SEISMIC_ZONE,
      terrainCategory = DEFAULT_TERRAIN_CATEGORY,
      importanceFactor = DEFAULT_IMPORTANCE_FACTOR,
    } = params;
    let deadLoadIntensity = 0;
    switch (structureType) {
      case STRUCTURE_TYPE_KEYS.building:
      case STRUCTURE_TYPE_KEYS.frame:
        deadLoadIntensity = DEAD_LOAD_BY_STRUCTURE[structureType];
        break;
      case STRUCTURE_TYPE_KEYS.roof:
      case STRUCTURE_TYPE_KEYS.truss:
        deadLoadIntensity = roofType === ROOF_TYPE_KEYS.rcc ? ROOF_DEAD_LOAD_BY_TYPE.rcc : ROOF_DEAD_LOAD_BY_TYPE.metal;
        break;
      case STRUCTURE_TYPE_KEYS.industrial:
        deadLoadIntensity = DEAD_LOAD_BY_STRUCTURE.industrial;
        break;
      case STRUCTURE_TYPE_KEYS.beam:
        deadLoadIntensity = DEAD_LOAD_BY_STRUCTURE.beam;
        break;
      default:
        deadLoadIntensity = DEFAULT_DEAD_LOAD;
    }
    const liveLoadIntensity = LIVE_LOAD_TABLE[occupancy] || DEFAULT_LIVE_LOAD;
    const roofLiveLoad = occupancy?.includes('roof') ? LIVE_LOAD_TABLE[occupancy] : DEFAULT_ROOF_LIVE_LOAD;
    const Vb = WIND_ZONE_SPEEDS[DEFAULT_WIND_ZONE];
    const k1 = WIND_FACTORS.k1;
    const heightBracket =
      height <= HEIGHT_BRACKETS.h10 ? HEIGHT_BRACKETS.b10
      : height <= HEIGHT_BRACKETS.h15 ? HEIGHT_BRACKETS.b15
      : height <= HEIGHT_BRACKETS.h20 ? HEIGHT_BRACKETS.b20
      : height <= HEIGHT_BRACKETS.h30 ? HEIGHT_BRACKETS.b30
      : HEIGHT_BRACKETS.b50;
    const k2 = TERRAIN_FACTOR_K2[terrainCategory]?.[heightBracket] || CALCULATION_INPUT_DEFAULTS.k2Fallback;
    const k3 = WIND_FACTORS.k3;
    const Vz = Vb * k1 * k2 * k3;
    const pz = WIND_FACTORS.pressureFactor * Vz * Vz / WIND_FACTORS.pressureDivisor;
    const Cp_windward = WIND_FACTORS.windwardCp;
    const Cp_leeward = WIND_FACTORS.leewardCp;
    const windPressure = pz * Math.abs(Cp_windward - Cp_leeward);
    const Z = SEISMIC_ZONE_FACTORS[seismicZone] || DEFAULT_SEISMIC_ZONE_FACTOR;
    const I = importanceFactor;
    const R = RESPONSE_REDUCTION_FACTOR;
    const T = SEISMIC_PERIOD_CONSTANTS.coeff * Math.pow(height, SEISMIC_PERIOD_CONSTANTS.exponent);
    let SaByG: number = SEISMIC_PERIOD_CONSTANTS.branch1Base;
    if (T <= SEISMIC_PERIOD_CONSTANTS.t1) {
      SaByG = SEISMIC_PERIOD_CONSTANTS.branch1Base + SEISMIC_PERIOD_CONSTANTS.branch1Slope * T;
    } else if (T <= SEISMIC_PERIOD_CONSTANTS.t2) {
      SaByG = SEISMIC_PERIOD_CONSTANTS.branch2Value;
    } else if (T <= SEISMIC_PERIOD_CONSTANTS.t3) {
      SaByG = SEISMIC_PERIOD_CONSTANTS.branch3Numerator / T;
    } else {
      SaByG = SEISMIC_PERIOD_CONSTANTS.branch4Value;
    }
    const Ah = (Z / SEISMIC_PERIOD_CONSTANTS.zoneDivisor) * (I / R) * SaByG;
    let selfWeight = 0;
    switch (structureType) {
      case STRUCTURE_TYPE_KEYS.beam:
        selfWeight = SELF_WEIGHT_MODELS.beam.base + span * SELF_WEIGHT_MODELS.beam.slope;
        break;
      case STRUCTURE_TYPE_KEYS.column:
        selfWeight = SELF_WEIGHT_MODELS.column.base + height * SELF_WEIGHT_MODELS.column.slope;
        break;
      case STRUCTURE_TYPE_KEYS.truss:
        selfWeight = SELF_WEIGHT_MODELS.truss.base + span * SELF_WEIGHT_MODELS.truss.slope;
        break;
      case STRUCTURE_TYPE_KEYS.purlin:
        selfWeight = SELF_WEIGHT_MODELS.purlin.fixed;
        break;
      default:
        selfWeight = SELF_WEIGHT_MODELS.defaultFixed;
    }
    const tributaryArea = bayWidth * tributaryWidth;
    const totalUDL = (deadLoadIntensity + liveLoadIntensity) * tributaryWidth + selfWeight;
    const totalPointLoad = (deadLoadIntensity + liveLoadIntensity) * tributaryArea;
    const factoredLoads = {
      uls: LOAD_FACTORS.uls * totalPointLoad,
      sls: LOAD_FACTORS.sls * totalPointLoad,
      wind_comb:
        LOAD_FACTORS.windComboLoad * totalPointLoad +
        LOAD_FACTORS.windComboPressure * windPressure * tributaryArea,
    };
    const description = `Realistic load calculation`; 
    return { deadLoad: deadLoadIntensity, liveLoad: liveLoadIntensity, roofLiveLoad, windLoad: windPressure, seismicCoeff: Ah, selfWeight, totalPointLoad, totalUDL, factoredLoads, description };
  }

  private selectRealisticSection(memberType: string, span: number, load: number): string {
    const getSectionMomentCapacity = (sectionName: string): number => {
      const section = STEEL_SECTIONS[sectionName];
      if (!section) return 0;
      return (
        (SECTION_SELECTION_FACTORS.fy * section.Zxx) /
        SECTION_SELECTION_FACTORS.gammaM0
      ) / SECTION_SELECTION_FACTORS.unitDivisor;
    };
    if (memberType === MEMBER_TYPE_KEYS.beam) {
      const requiredMoment = (load * span * span) / SECTION_SELECTION_FACTORS.beamMomentDivisor;
      for (const section of BEAM_SECTIONS_ASCENDING) {
        if (getSectionMomentCapacity(section) >= requiredMoment * SECTION_SELECTION_FACTORS.demandAmplification) return section;
      }
      return SECTION_FALLBACKS.beam;
    }
    if (memberType === MEMBER_TYPE_KEYS.column) {
      for (const mapping of COLUMN_LOAD_TO_SECTION) {
        if (load <= mapping.maxLoad) return mapping.section;
      }
      return SECTION_FALLBACKS.column;
    }
    if (memberType === MEMBER_TYPE_KEYS.trussChord) {
      for (const mapping of TRUSS_CHORD_SPAN_TO_SECTION) {
        if (span <= mapping.maxSpan) return mapping.section;
      }
      return SECTION_FALLBACKS.trussChord;
    }
    if (memberType === MEMBER_TYPE_KEYS.trussWeb) {
      for (const mapping of TRUSS_WEB_SPAN_TO_SECTION) {
        if (span <= mapping.maxSpan) return mapping.section;
      }
      return SECTION_FALLBACKS.trussWeb;
    }
    if (memberType === MEMBER_TYPE_KEYS.bracing) return SECTION_FALLBACKS.bracing;
    return SECTION_FALLBACKS.default;
  }

  private localPlanStructure(description: string): AIPlan {
    const d = description.toLowerCase();
    const occupancy = inferOccupancyFromDescription(d);
    const { span, height, bays, stories, specifiedLoad } = parsePlanningInputs(d);
    const bayWidth = span / Math.max(bays, 1);
    const storyHeight = stories > 1 ? Math.min(height / stories, PLANNING_DEFAULTS.maxStoryHeight) : height;
    const tributaryWidth = PLANNING_DEFAULTS.tributaryWidth;
    const defaultLoads = this.calculateRealisticLoads(STRUCTURE_TYPE_KEYS.building, { span, height, bayWidth, tributaryWidth, occupancy });
    const loadValue = specifiedLoad || defaultLoads.totalPointLoad;
    const steps: AIAction[] = [];
    let goal = '';
    let reasoning = '';
    if (d.includes('warren')) {
      const panels = computeWarrenPanelCount(span);
      const depth = computeWarrenTrussDepth(span);
      const panelWidth = span / panels;
      const numTrusses = computeWarrenTrussCount(d.includes('single'), bays);
      const trussSpacing = PLANNING_DEFAULTS.trussSpacing;
      const buildingLength = (numTrusses - 1) * trussSpacing;
      const loads = this.calculateRealisticLoads(STRUCTURE_TYPE_KEYS.truss, {
        span,
        height: depth,
        bayWidth: panelWidth,
        tributaryWidth: trussSpacing,
        occupancy,
        roofType: DEFAULT_ROOF_TYPE,
      });
      const nodeSpacing = panelWidth;
      const nodeLoad = specifiedLoad || (loads.deadLoad + loads.roofLiveLoad!) * trussSpacing * nodeSpacing;
      const chordSection = this.selectRealisticSection(MEMBER_TYPE_KEYS.trussChord, span, nodeLoad);
      const webSection = this.selectRealisticSection(MEMBER_TYPE_KEYS.trussWeb, span, nodeLoad);
      const purlinSection = WARREN_SECTION_DEFAULTS.purlinSection;
      const bracingSection = WARREN_SECTION_DEFAULTS.bracingSection;
      goal = buildWarrenGoal(span, buildingLength, numTrusses);
      reasoning = WARREN_TEXT_DEFAULTS.reasoning;
      let nodeId = 1;
      const nodeMap: Record<string, number> = {};
      for (let truss = 0; truss < numTrusses; truss++) {
        const z = truss * trussSpacing;
        for (let i = 0; i <= panels; i++) {
          const support = getWarrenSupportType(i, panels);
          const isSupport = !!support;
          const key = buildWarrenBottomNodeKey(truss, i);
          nodeMap[key] = nodeId;
          steps.push({
            type: 'addNode',
            params: { id: buildWarrenNodeId(nodeId), x: i * panelWidth, y: 0, z, support },
            description: buildWarrenBottomNodeDescription(truss + 1, i, isSupport),
          });
          nodeId++;
        }
        for (let i = 0; i < panels; i++) {
          const key = buildWarrenTopNodeKey(truss, i);
          nodeMap[key] = nodeId;
          steps.push({
            type: 'addNode',
            params: { id: buildWarrenNodeId(nodeId), x: (i + 0.5) * panelWidth, y: depth, z },
            description: buildWarrenTopNodeDescription(truss + 1, i + 1),
          });
          nodeId++;
        }
      }
      return { goal, reasoning, steps, confidence: WARREN_PLANNING_HEURISTICS.defaultConfidence };
    }
    return { goal, reasoning, steps, confidence: WARREN_PLANNING_HEURISTICS.defaultConfidence };
  }

  private parseAIPlan(response: string): AIPlan | null {
    return parseAIPlan(response);
  }

  async generateAnalysisGuidance(context: AIModelContext): Promise<string> {
    return context.nodes.length === 0
      ? GEMINI_FALLBACK_RESPONSES.noStructureToAnalyze
      : GEMINI_FALLBACK_RESPONSES.readyForAnalysis;
  }
  async interpretResults(context: AIModelContext): Promise<string> {
    return context.analysisResults
      ? GEMINI_FALLBACK_RESPONSES.resultsAvailable
      : GEMINI_FALLBACK_RESPONSES.noAnalysisResults;
  }
  async planOptimization(goal: string, context: AIModelContext): Promise<AIPlan> {
    return {
      goal: `Optimize structure for: ${goal}`,
      reasoning: OPTIMIZATION_PLANNING_DEFAULTS.reasoning,
      steps: [{ type: 'optimize', params: {}, description: OPTIMIZATION_PLANNING_DEFAULTS.actionDescription }],
      confidence: OPTIMIZATION_PLANNING_DEFAULTS.confidence,
    };
  }
  async performDesignCheck(context: AIModelContext): Promise<string> { return GEMINI_FALLBACK_RESPONSES.designCheckReport; }

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

  private getEngineeringExplanation(query: string): string { return GEMINI_FALLBACK_RESPONSES.engineeringKnowledgeBase; }
  private async handleGreeting(query: string): Promise<string> { return GEMINI_FALLBACK_RESPONSES.greeting; }
  private async handleThanks(): Promise<string> { return GEMINI_FALLBACK_RESPONSES.thanks; }
  private getHelpMessage(): string { return GEMINI_FALLBACK_RESPONSES.helpGuide; }
  private async handleTroubleshooting(query: string, context: AIModelContext): Promise<string> { return GEMINI_FALLBACK_RESPONSES.troubleshooting; }
  private async reviewModel(context: AIModelContext): Promise<string> { return GEMINI_FALLBACK_RESPONSES.review; }
  private async handleConversation(query: string, context: AIModelContext): Promise<string> { return GEMINI_FALLBACK_RESPONSES.conversation; }
  private generateLocalConversationalResponse(query: string, context: AIModelContext): string { return GEMINI_FALLBACK_RESPONSES.localResponse; }
  describeCurrentModel(context: AIModelContext): string { return GEMINI_FALLBACK_RESPONSES.modelOverview; }
  async generalResponse(query: string, context: AIModelContext): Promise<string> { return this.apiKey ? this.callGemini(`${query}`, SYSTEM_PROMPT) : GEMINI_FALLBACK_RESPONSES.generalQueryFallback; }
  private formatPlanResponse(plan: AIPlan): string { return formatPlanResponse(plan); }
  private getActionIcon(type: AIAction['type']): string {
    return ACTION_ICON_BY_TYPE[type] || DEFAULT_ACTION_ICON;
  }
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
