import { API_CONFIG } from '../../config/env';
import { apiLogger } from '../../lib/logging/logger';
import { fetchWithTimeout } from '../../utils/fetchUtils';
import type { GeminiProxyResponse, GeminiApiResponse } from './types';

export const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';

export function getGeminiApiKey(): string | null {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_GEMINI_API_KEY || null;
  }

  return '__PROXY__';
}

export function setGeminiApiKeyForDev(current: string | null, key: string): string | null {
  if (import.meta.env.DEV) {
    return key;
  }

  apiLogger.warn('Cannot set API key in production — all calls are proxied through the backend');
  return current;
}

export function hasGeminiApiKey(apiKey: string | null): boolean {
  return !!apiKey;
}

export async function callGeminiViaProxy(prompt: string, systemPrompt?: string): Promise<string> {
  const apiBaseUrl = API_CONFIG.baseUrl;
  const message = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const authToken = typeof window !== 'undefined' && window.localStorage?.getItem('auth_token') || undefined;

  const response = await fetchWithTimeout<GeminiProxyResponse>(
    `${apiBaseUrl}/api/ai/chat`,
    {
      method: 'POST',
      authToken,
      body: JSON.stringify({
        message,
        context: systemPrompt || undefined,
      }),
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || `AI proxy request failed`);
  }

  const data = response.data;
  if (!data.success) {
    throw new Error(data.error || 'AI proxy request failed');
  }

  return data.response || '';
}

export function buildGeminiRequestUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

export function buildGeminiRequestBody(prompt: string, systemPrompt?: string) {
  return {
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
}

export async function callGeminiDirect(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
  apiKey: string
): Promise<string> {
  const url = buildGeminiRequestUrl(model, apiKey);
  const requestBody = buildGeminiRequestBody(prompt, systemPrompt);

  if (import.meta.env.DEV) apiLogger.info('Sending request');

  const response = await fetchWithTimeout<GeminiApiResponse>(url, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.success || !response.data) {
    const error = response.data || {};
    apiLogger.error('API error', { error });
    throw new Error((error as any).error?.message || response.error || 'Gemini API request failed');
  }

  const data = response.data;
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

  if (import.meta.env.DEV) apiLogger.info('Response received', { preview: result.substring(0, 100) });
  return result;
}
