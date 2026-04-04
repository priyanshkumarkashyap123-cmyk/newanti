/**
 * ============================================================================
 * AI Architect Engine — Unified Structural Engineering AI Service
 * ============================================================================
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { logger } from '../../utils/logger.js';
import { SYSTEM_PROMPTS } from './engine/prompts.js';
import { classifyIntent } from './engine/intents.js';
import { IS_SECTIONS } from './engine/sectionsDb.js';
import {
  type AIAction,
  type AIResponse,
  type ChatMessage,
  type CodeCheckResult,
  type DiagnosisResult,
  type ModelContext,
  type StructuralModel,
} from './engine/types.js';
import {
  enforceGenerationSafety,
  estimateSectionDepthMeters,
  normalizeModel,
  validateModel,
  validateStructuralModel,
} from './engine/modelUtils.js';
import {
  handleConversation,
  handleExplain,
  generateStructure,
  diagnoseModel,
  checkCodeCompliance,
  handleAddLoad,
  handleAddSupport,
  handleChangeSection,
  handleRunAnalysis,
  handleReviewModel,
  handleAboutModel,
  handleTroubleshoot,
  handleClearModel,
  handleModifyModel,
  generateLocally,
} from './engine/handlers/index.js';

export class AIArchitectEngine {
  private model: GenerativeModel | null = null;
  private apiKey: string;
  private pythonApiUrl: string;
  private conversationHistory: ChatMessage[] = [];
  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min

  constructor() {
    this.apiKey = process.env['GEMINI_API_KEY'] || '';
    this.pythonApiUrl = process.env['PYTHON_API_URL'] || 'http://localhost:8081';

    if (this.apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        logger.info('[AIArchitectEngine] Gemini model initialized (gemini-2.0-flash)');
      } catch (err) {
        logger.error({ err }, '[AIArchitectEngine] Failed to init Gemini');
      }
    } else {
      logger.warn('[AIArchitectEngine] No GEMINI_API_KEY -- using local fallback mode');
    }
  }

  // MAIN CHAT ENDPOINT
  async chat(message: string, context?: ModelContext, history?: ChatMessage[]): Promise<AIResponse> {
    const startTime = Date.now();
    const { intent, confidence } = classifyIntent(message);

    const cacheKey = `${intent}:${message.slice(0, 200)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return { ...cached.response, metadata: { ...cached.response.metadata!, processingTimeMs: 0 } };
    }

    let result: AIResponse;

    try {
      switch (intent) {
        case 'greeting':
          result = this.handleGreeting();
          break;
        case 'thanks':
          result = this.handleThanks();
          break;
        case 'help':
          result = this.handleHelp();
          break;
        case 'create_structure':
          result = await generateStructure(this.model, message);
          break;
        case 'modify_model':
          result = await handleModifyModel(message, context, this.model);
          break;
        case 'add_load':
          result = await handleAddLoad(message, context, this.model);
          break;
        case 'add_support':
          result = await handleAddSupport(message, context);
          break;
        case 'change_section':
          result = await handleChangeSection(message, context);
          break;
        case 'run_analysis':
          result = handleRunAnalysis(context);
          break;
        case 'diagnose':
          result = context ? await this.handleDiagnose(context) : { success: false, response: 'No model loaded to diagnose.' };
          break;
        case 'optimize':
          result = await this.handleOptimize(context);
          break;
        case 'code_check':
          result = context ? await this.handleCodeCheck(message, context) : { success: false, response: 'No model to check.' };
          break;
        case 'review_model':
          result = handleReviewModel(context);
          break;
        case 'about_model':
          result = handleAboutModel(context);
          break;
        case 'troubleshoot':
          result = await handleTroubleshoot(message, context);
          break;
        case 'clear_model':
          result = handleClearModel();
          break;
        case 'explain':
          result = await handleExplain(this.model, message);
          break;
        case 'conversation':
        default:
          result = await handleConversation(this.model, message, context, history || this.conversationHistory);
      }

      result.metadata = {
        intent,
        confidence,
        processingTimeMs: Date.now() - startTime,
        provider: result.metadata?.provider || (this.model ? 'gemini' : 'local'),
        tokensUsed: result.metadata?.tokensUsed,
      };

      this.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: result.response });
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      this.responseCache.set(cacheKey, { response: result, timestamp: Date.now() });
      for (const [key, value] of this.responseCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL) {
          this.responseCache.delete(key);
        }
      }

      return result;
    } catch (error) {
      logger.error({ err: error }, '[AIArchitectEngine] Error');
      return {
        success: false,
        response: `I encountered an error processing your request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          intent,
          confidence,
          processingTimeMs: Date.now() - startTime,
          provider: 'local',
        },
      };
    }
  }

  // STRUCTURE GENERATION
  async generateStructure(prompt: string, constraints?: Record<string, unknown>): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (this.model) {
        const result = enforceGenerationSafety(await this.generateViaGemini(prompt, constraints));
        if (result.success || (result.validation?.errors ?? 0) > 0) {
          result.metadata = { intent: 'create_structure', confidence: 0.9, processingTimeMs: Date.now() - startTime, provider: 'gemini' };
          return result;
        }
      }

      const localResult = enforceGenerationSafety(this.generateLocally(prompt));
      localResult.metadata = { intent: 'create_structure', confidence: 0.7, processingTimeMs: Date.now() - startTime, provider: 'local' };
      return localResult;
    } catch (error) {
      logger.error({ err: error }, '[AIArchitectEngine] Generate error');
      const fallback = enforceGenerationSafety(this.generateLocally(prompt));
      fallback.metadata = { intent: 'create_structure', confidence: 0.5, processingTimeMs: Date.now() - startTime, provider: 'local' };
      return fallback;
    }
  }

  private async generateViaGemini(prompt: string, constraints?: Record<string, unknown>): Promise<AIResponse> {
    if (!this.model) throw new Error('Gemini not initialized');

    const constraintText = constraints ? `\n\nConstraints: ${JSON.stringify(constraints)}` : '';
    const fullPrompt = `${SYSTEM_PROMPTS.generate}\n\nUser request: ${prompt}${constraintText}`;
    const result = await this.model.generateContent(fullPrompt);
    const text = result.response.text();
    const cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const model = JSON.parse(cleanedText) as StructuralModel;
    const normalized = normalizeModel(model);
    const validation = validateModel(normalized);

    if (!validation.valid) {
      return {
        success: false,
        response: `❌ Generated model is unsafe and failed validation with ${validation.errors} critical issue(s).`,
        model: normalized,
        validation,
      };
    }

    return {
      success: true,
      response: `✅ Generated a ${normalized.nodes.length}-node, ${normalized.members.length}-member structure based on your description.${
        validation.warnings > 0 ? `\n\n⚠️ Validation warnings:\n${validation.issues.filter(i => i.severity === 'warning').map(i => `- ${i.message}`).join('\n')}` : ''
      }`,
      model: normalized,
      validation,
      actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply generated model' }],
    };
  }

  // LOCAL FALLBACK GENERATION
  private generateLocally = generateLocally;

  // MODEL DIAGNOSIS
  private async handleDiagnose(context?: ModelContext): Promise<AIResponse> {
    if (!context) return { success: false, response: 'No model loaded to diagnose.' };
    const diagnosis = await diagnoseModel(context, this.model);

    let response = `## 🔍 Model Diagnosis — ${diagnosis.overallHealth === 'good' ? '✅ Healthy' : diagnosis.overallHealth === 'warning' ? '⚠️ Warnings' : '❌ Critical Issues'}\n\n`;
    if (diagnosis.issues.length === 0) {
      response += 'No issues found! Your model looks structurally sound.\n';
    } else {
      for (const issue of diagnosis.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        response += `${icon} **${issue.category}**: ${issue.message}\n`;
        if (issue.suggestedFix) response += `   → Fix: ${issue.suggestedFix}\n`;
        response += '\n';
      }
    }
    if (diagnosis.autoFixAvailable) response += '\n💡 Some issues can be auto-fixed. Say "fix these issues" to apply suggested fixes.';
    return { success: true, response };
  }

  private async handleOptimize(context?: ModelContext): Promise<AIResponse> {
    if (!context || context.members.length === 0) return { success: false, response: 'No model loaded to optimize.' };
    if (!context.analysisResults) {
      return { success: true, response: 'To optimize sections, please run a structural analysis first. Then I can suggest lighter sections based on utilization ratios.\n\nSay "run analysis" to start.' };
    }

    const actions: AIAction[] = [];
    const suggestions: string[] = [];
    for (const m of context.members) {
      const startNode = context.nodes.find(n => n.id === m.startNode);
      const endNode = context.nodes.find(n => n.id === m.endNode);
      let memberLength = 3.0;
      let memberType: 'beam' | 'column' = 'beam';
      if (startNode && endNode) {
        const dx = Math.abs(endNode.x - startNode.x);
        const dy = Math.abs(endNode.y - startNode.y);
        memberType = dy > dx ? 'column' : 'beam';
        memberLength = Math.sqrt(dx * dx + dy * dy + (endNode.z - startNode.z || 0) ** 2);
      }

      const currentSection = m.section || 'ISMB300';
      const result = await checkCodeCompliance(
        { section: currentSection, length: memberLength, type: memberType },
        { moment: context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : 10 },
        'IS_800'
      );

      const maxRatio = Math.max(...(result.checks.map(c => c.ratio || 0)));
      if (maxRatio < 0.5 && maxRatio > 0) {
        const sectionSizes = Object.keys(IS_SECTIONS).filter(s => s.startsWith(currentSection.replace(/\d+$/, '')));
        const currentIdx = sectionSizes.indexOf(currentSection);
        if (currentIdx > 0) {
          const smallerSection = sectionSizes[currentIdx - 1];
          actions.push({
            type: 'changeSection',
            params: { memberId: m.id, section: smallerSection },
            description: `${m.id}: ${currentSection} → ${smallerSection} (ratio=${maxRatio.toFixed(2)}, over-designed)`,
          });
          suggestions.push(`${m.id}: ${currentSection} → ${smallerSection}`);
        }
      }
    }

    if (actions.length > 0) {
      return {
        success: true,
        response: `## 🎯 Optimization Results\n\n${suggestions.map(s => `- ${s}`).join('\n')}\n\n**${actions.length} member(s) can be downsized.** Click **Execute** to apply.`,
        actions,
        metadata: { intent: 'optimize', confidence: 0.8, processingTimeMs: 0, provider: this.model ? 'gemini' : 'local' },
      };
    }

    return { success: true, response: '✅ All members appear reasonably sized based on current analysis.' };
  }

  private async handleCodeCheck(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.members.length === 0) return { success: false, response: 'No model to check. Create a structure and run analysis first.' };

    let code = 'IS_800';
    if (/aisc/i.test(message)) code = 'AISC_360';
    else if (/eurocode/i.test(message)) code = 'EN_1993';
    else if (/is\s*456/i.test(message)) code = 'IS_456';

    let response = `## 📋 Code Compliance Check — ${code}\n\n`;
    if (!context.analysisResults) response += `⚠️ No analysis results available. Running simplified checks based on member properties only.\n\n`;

    let overallPass = true;
    const memberResults: string[] = [];

    for (const m of context.members) {
      const startNode = context.nodes.find(n => n.id === m.startNode);
      const endNode = context.nodes.find(n => n.id === m.endNode);
      let memberType: 'beam' | 'column' = 'beam';
      let memberLength = 3.0;
      if (startNode && endNode) {
        const dx = Math.abs(endNode.x - startNode.x);
        const dy = Math.abs(endNode.y - startNode.y);
        memberType = dy > dx ? 'column' : 'beam';
        memberLength = Math.sqrt(dx * dx + dy * dy + (endNode.z - startNode.z || 0) ** 2);
      }

      const forces: { axial?: number; moment?: number; shear?: number } = {};
      if (context.analysisResults) {
        forces.moment = context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : undefined;
        forces.shear = context.analysisResults.maxShear ? context.analysisResults.maxShear / context.members.length : undefined;
        if (memberType === 'column') forces.axial = -50;
      }

      const result = await checkCodeCompliance({ section: m.section || 'ISMB300', length: memberLength, type: memberType }, forces, code);
      const icon = result.overallStatus === 'pass' ? '✅' : result.overallStatus === 'warning' ? '⚠️' : '❌';
      memberResults.push(`${icon} **${m.id}** (${m.section || 'ISMB300'}, ${memberType}, L=${memberLength.toFixed(1)}m): ${result.summary}`);
      if (result.overallStatus === 'fail') {
        overallPass = false;
        for (const check of result.checks.filter(c => c.status === 'fail')) {
          memberResults.push(`   → ${check.clause}: ratio = ${check.ratio?.toFixed(3)} (${check.details})`);
        }
      }
    }

    response += memberResults.join('\n\n');
    response += `\n\n---\n**Overall: ${overallPass ? '✅ All members pass' : '❌ Some members failed — consider upgrading sections'}**`;

    return { success: true, response, metadata: { intent: 'code_check', confidence: 0.9, processingTimeMs: 0, provider: 'local' } };
  }

  private async handleModifyModel(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.nodes.length === 0) {
      return { success: false, response: "There's no model to modify. Please create a structure first, then I can modify it." };
    }

    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.modify}\n\nCurrent model:\n${JSON.stringify({ nodes: context.nodes, members: context.members }, null, 2)}\n\nModification request: "${message}"\n\nOutput the complete modified model as JSON.`;
        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const modified = JSON.parse(text) as StructuralModel;
        const normalized = normalizeModel(modified);
        return {
          success: true,
          response: `✅ Model modified successfully. Now has ${normalized.nodes.length} nodes and ${normalized.members.length} members.`,
          model: normalized,
          actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply modified model' }],
          metadata: { intent: 'modify_model', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini modify failed');
      }
    }

    return {
      success: true,
      response: 'I understand you want to modify the model. Could you be more specific? For example:\n- "Add a bay of 6m to the right"\n- "Add a floor of 3.5m height"\n- "Move node n3 to x=8, y=4"',
    };
  }

  private handleGreeting(): AIResponse {
    const greetings = [
      "Hello! I'm the AI Architect for BeamLab. I can help you create structures, run analyses, optimize designs, and check code compliance. What would you like to build today?",
      "Hi there! Ready to engineer something? I can create frames, trusses, bridges, buildings — just describe what you need in plain English.",
      "Welcome to BeamLab AI Architect! Tell me what structure you'd like to design and I'll generate it for you. I understand Indian Standards (IS 800, IS 456) and international codes too.",
    ];
    return { success: true, response: greetings[Math.floor(Math.random() * greetings.length)] };
  }

  private handleThanks(): AIResponse {
    return { success: true, response: "You're welcome! Let me know if you need anything else — I'm here to help with your structural design." };
  }

  private handleHelp(): AIResponse {
    return {
      success: true,
      response: `## 🏗️ AI Architect — What I Can Do

**Create Structures:**
- "Create a 10m span portal frame with 6m height"
- "Build a 3-story, 2-bay steel frame"
- "Make a 15m Pratt truss with 3m depth"
- "Design an industrial shed 20m × 10m"

**Modify Existing Model:**
- "Add another bay to the right"
- "Increase the height to 8m"
- "Add a third floor"
- "Change all columns to ISMB500"

**Apply Loads:**
- "Add 50 kN downward load at the top"
- "Apply UDL of 10 kN/m on all beams"
- "Add wind load of 1.5 kN/m² on the left face"

**Analyze & Check:**
- "Run static analysis"
- "Diagnose this model for issues"
- "Check code compliance per IS 800"
- "Optimize the sections"

**Learn & Explain:**
- "What is P-Delta analysis?"
- "Explain IS 800 slenderness limits"
- "What's the difference between ISMB and ISHB?"

💡 **Tip:** Be specific with dimensions and I'll generate more accurate models!`,
    };
  }

  private handleClearModel(): AIResponse {
    return { success: true, response: '⚠️ This will clear the entire model. Click **Execute** to confirm.', actions: [{ type: 'clearModel', params: {}, description: 'Clear the entire model' }] };
  }

  // Route compatibility surface
  async diagnoseModel(context: ModelContext): Promise<DiagnosisResult> {
    return diagnoseModel(context, this.model);
  }

  async checkCodeCompliance(
    member: { section: string; length: number; type: 'beam' | 'column' },
    forces: { axial?: number; moment?: number; shear?: number },
    code: string = 'IS_800'
  ): Promise<CodeCheckResult> {
    return checkCodeCompliance(member, forces, code);
  }

  async proxyToPython(endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const base = this.pythonApiUrl.replace(/\/$/, '');
    const path = endpoint.replace(/^\//, '');
    const response = await fetch(`${base}/ai/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Python AI proxy failed: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  getStatus(): { gemini: boolean; local: boolean; model: string } {
    return {
      gemini: this.model !== null,
      local: true,
      model: this.model ? 'gemini-2.0-flash' : 'local-fallback',
    };
  }

  public validateStructuralModel = validateStructuralModel;
  private validateModel = validateModel;
  private estimateSectionDepthMeters = estimateSectionDepthMeters;
  private normalizeModel = normalizeModel;
}

export const aiArchitectEngine = new AIArchitectEngine();
export default aiArchitectEngine;
