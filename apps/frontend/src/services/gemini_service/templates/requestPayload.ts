import { GEMINI_RUNTIME_DEFAULTS } from '../utils/runtime';

export function buildGeminiGenerateContentRequest(prompt: string, systemPrompt?: string) {
  return {
    contents: [
      ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
      { role: 'user', parts: [{ text: prompt }] },
    ],
    generationConfig: {
      temperature: GEMINI_RUNTIME_DEFAULTS.generation.temperature,
      maxOutputTokens: GEMINI_RUNTIME_DEFAULTS.generation.maxOutputTokens,
      topP: GEMINI_RUNTIME_DEFAULTS.generation.topP,
    },
    safetySettings: GEMINI_RUNTIME_DEFAULTS.safetySettings,
  };
}
