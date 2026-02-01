/**
 * AI Module Index
 * 
 * Central export point for the Enhanced AI Architect system
 * for BeamLab Civil Engineering Application.
 * 
 * This module provides:
 * - Comprehensive Civil Engineering Knowledge Base
 * - Advanced NLP Interpretation
 * - Intelligent Response Generation
 * - Unified AI Architect Interface
 */

// ============================================
// KNOWLEDGE BASE EXPORTS
// ============================================
export {
  CIVIL_ENGINEERING_KNOWLEDGE,
  STRUCTURAL_ENGINEERING,
  GEOTECHNICAL_ENGINEERING,
  TRANSPORTATION_ENGINEERING,
  HYDRAULIC_ENGINEERING,
  ENVIRONMENTAL_ENGINEERING,
  CONSTRUCTION_MANAGEMENT,
  NLP_PATTERNS,
  UNIT_CONVERSIONS,
  FORMULA_LIBRARY,
} from './CivilEngineeringKnowledgeBase';

// ============================================
// NLP INTERPRETER EXPORTS
// ============================================
export {
  AdvancedNLPInterpreter,
  nlpInterpreter,
  type IntentType,
  type EntityType,
  type ParsedIntent,
  type ExtractedEntity,
  type InterpretationResult,
  type ConversationalContext,
  type UserPreferences,
} from './AdvancedNLPInterpreter';

// ============================================
// RESPONSE GENERATOR EXPORTS
// ============================================
export {
  IntelligentResponseGenerator,
  responseGenerator,
  type ResponseType as GeneratedResponseType,
  type GeneratedResponse,
  type Calculation,
  type CodeReference,
  type Recommendation,
  type Warning,
  type FollowUpQuestion,
} from './IntelligentResponseGenerator';

// ============================================
// MAIN AI ARCHITECT EXPORTS
// ============================================
export {
  EnhancedAIArchitect,
  aiArchitect,
  type AIArchitectConfig,
  type AIRequest,
  type AIResponse,
  type ResponseType,
  type ModelContext,
  type NodeData,
  type MemberData,
  type LoadData,
  type SupportData,
  type AnalysisResults,
  type StructureData,
  type CalculationResult,
  type Attachment,
  type ConversationEntry,
} from './EnhancedAIArchitect';

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

import { aiArchitect, AIRequest, AIResponse } from './EnhancedAIArchitect';
import { nlpInterpreter, InterpretationResult } from './AdvancedNLPInterpreter';
import { responseGenerator, GeneratedResponse } from './IntelligentResponseGenerator';

/**
 * Quick process function for simple queries
 */
export async function processQuery(message: string, modelContext?: any): Promise<AIResponse> {
  return aiArchitect.processRequest({
    message,
    modelContext,
  });
}

/**
 * Quick interpretation without full response generation
 */
export function interpretMessage(message: string): InterpretationResult {
  return nlpInterpreter.interpret(message);
}

/**
 * Generate response from interpretation
 */
export function generateResponse(interpretation: InterpretationResult): GeneratedResponse {
  return responseGenerator.generateResponse(interpretation);
}

/**
 * Get explanation of how a message was interpreted
 */
export function explainInterpretation(message: string): string {
  const interpretation = nlpInterpreter.interpret(message);
  return nlpInterpreter.explainInterpretation(interpretation);
}

/**
 * Get context-aware suggestions
 */
export function getSuggestions(): string[] {
  // Return default suggestions for structural engineering tasks
  return [
    'Create a portal frame for a warehouse',
    'Analyze beam deflection under UDL',
    'Check column design per IS 800',
    'Calculate load combinations',
    'Optimize truss weight',
  ];
}

/**
 * Clear conversation context
 */
export function clearContext(): void {
  aiArchitect.clearHistory();
}

// ============================================
// DEFAULT EXPORT
// ============================================
export default aiArchitect;

// ============================================
// MODULE VERSION INFO
// ============================================
export const AI_MODULE_VERSION = '2.0.0';
export const AI_MODULE_FEATURES = [
  'Comprehensive Civil Engineering Knowledge Base',
  'Advanced NLP with 20+ Intent Types',
  'Entity Extraction (Structures, Dimensions, Materials, Loads)',
  'Context-Aware Conversation Management',
  'Intelligent Response Generation',
  'Code-Referenced Explanations (IS800, IS456, IS1893, Eurocode, AISC)',
  'Automatic Structure Generation',
  'Design Check Calculations',
  'Multi-Domain Support (Structural, Geo, Transport, Hydraulic, Environmental)',
];
