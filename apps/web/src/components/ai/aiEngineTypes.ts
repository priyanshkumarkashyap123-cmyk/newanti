/**
 * Shared types for BeamLabAIEngine and its handler modules.
 */

export interface BeamLabAIResponse {
  text: string;
  source: "beamlab-ai";
  confidence: number;
  latencyMs: number;
  category: ResponseCategory;
  suggestions?: string[];
  calculations?: CalculationStep[];
}

export type ResponseCategory =
  | "model_query"
  | "engineering_knowledge"
  | "design_code"
  | "calculation"
  | "recommendation"
  | "diagnosis"
  | "material_info"
  | "section_info"
  | "analysis_help"
  | "software_help"
  | "general";

export interface CalculationStep {
  description: string;
  formula: string;
  result: string;
}

export interface TopicHandler {
  pattern: RegExp;
  category: ResponseCategory;
  handler: (input: string, match: RegExpMatchArray) => BeamLabAIResponse;
}

/** Context passed to handler factory functions so they can build responses and access model state */
export interface AIHandlerContext {
  buildResponse: (
    text: string,
    category: ResponseCategory,
    confidence: number,
    suggestions?: string[],
    calculations?: CalculationStep[],
  ) => BeamLabAIResponse;
  getStore: () => any;
}
