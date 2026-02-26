/**
 * ============================================================================
 * STREAMING RESPONSE HANDLER
 * ============================================================================
 * 
 * Handles SSE (Server-Sent Events) streaming for AI responses.
 * Provides real-time token-by-token output with proper error handling,
 * reconnection, and partial response assembly.
 * 
 * @version 1.0.0
 */

import type { AIProviderType, AIEvent, AIEventListener } from './types';
import { AIEventBus } from './ResilienceLayer';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamConfig {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onProgress?: (progress: StreamProgress) => void;
  signal?: AbortSignal;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface StreamProgress {
  tokensReceived: number;
  chunksReceived: number;
  elapsedMs: number;
  estimatedTokensPerSecond: number;
  partialResponse: string;
}

export interface StreamResult {
  fullResponse: string;
  totalTokens: number;
  totalChunks: number;
  durationMs: number;
  provider: AIProviderType;
  completed: boolean;
  error?: string;
}

// ============================================================================
// STREAMING RESPONSE HANDLER
// ============================================================================

export class StreamingResponseHandler {
  private eventBus: AIEventBus;
  private activeStreams = new Map<string, AbortController>();

  constructor(eventBus: AIEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Stream a response from the backend SSE endpoint
   */
  async streamFromEndpoint(
    url: string,
    body: Record<string, unknown>,
    config: StreamConfig,
    provider: AIProviderType = 'gemini'
  ): Promise<StreamResult> {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);

    // Merge external abort signal
    if (config.signal) {
      config.signal.addEventListener('abort', () => controller.abort());
    }

    const startTime = Date.now();
    let fullResponse = '';
    let tokenCount = 0;
    let chunkCount = 0;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ ...body, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null - streaming not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const token = this.extractTokenFromChunk(parsed, provider);

              if (token) {
                fullResponse += token;
                tokenCount++;
                chunkCount++;
                config.onToken(token);

                this.eventBus.emit({
                  type: 'stream-chunk',
                  timestamp: new Date(),
                  data: { streamId, token, tokenCount, chunkCount },
                });

                if (config.onProgress) {
                  const elapsed = Date.now() - startTime;
                  config.onProgress({
                    tokensReceived: tokenCount,
                    chunksReceived: chunkCount,
                    elapsedMs: elapsed,
                    estimatedTokensPerSecond: elapsed > 0 ? (tokenCount / elapsed) * 1000 : 0,
                    partialResponse: fullResponse,
                  });
                }
              }
            } catch {
              // Non-JSON data line, treat as raw token
              if (data.length > 0) {
                fullResponse += data;
                tokenCount++;
                config.onToken(data);
              }
            }
          }
        }
      }

      config.onComplete(fullResponse);
      this.eventBus.emit({
        type: 'stream-complete',
        timestamp: new Date(),
        data: { streamId, totalTokens: tokenCount, durationMs: Date.now() - startTime },
      });

      return {
        fullResponse,
        totalTokens: tokenCount,
        totalChunks: chunkCount,
        durationMs: Date.now() - startTime,
        provider,
        completed: true,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (err.name === 'AbortError') {
        // Intentional cancellation
        config.onComplete(fullResponse);
        return {
          fullResponse,
          totalTokens: tokenCount,
          totalChunks: chunkCount,
          durationMs: Date.now() - startTime,
          provider,
          completed: false,
          error: 'Stream cancelled',
        };
      }

      config.onError(err);
      return {
        fullResponse,
        totalTokens: tokenCount,
        totalChunks: chunkCount,
        durationMs: Date.now() - startTime,
        provider,
        completed: false,
        error: err.message,
      };
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Simulate streaming for non-streaming providers (progressive reveal)
   */
  async simulateStream(
    fullText: string,
    config: StreamConfig,
    options?: { chunkSize?: number; delayMs?: number }
  ): Promise<StreamResult> {
    const chunkSize = options?.chunkSize ?? 3;
    const delayMs = options?.delayMs ?? 20;
    const startTime = Date.now();
    let tokenCount = 0;
    let offset = 0;

    try {
      while (offset < fullText.length) {
        if (config.signal?.aborted) {
          break;
        }

        const end = Math.min(offset + chunkSize, fullText.length);
        // Try to break at word boundaries
        let adjustedEnd = end;
        if (end < fullText.length) {
          const nextSpace = fullText.indexOf(' ', end);
          if (nextSpace > 0 && nextSpace - end < 10) {
            adjustedEnd = nextSpace + 1;
          }
        }

        const chunk = fullText.slice(offset, adjustedEnd);
        config.onToken(chunk);
        tokenCount++;
        offset = adjustedEnd;

        if (config.onProgress) {
          const elapsed = Date.now() - startTime;
          config.onProgress({
            tokensReceived: tokenCount,
            chunksReceived: tokenCount,
            elapsedMs: elapsed,
            estimatedTokensPerSecond: elapsed > 0 ? (tokenCount / elapsed) * 1000 : 0,
            partialResponse: fullText.slice(0, offset),
          });
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      config.onComplete(fullText);

      return {
        fullResponse: fullText,
        totalTokens: tokenCount,
        totalChunks: tokenCount,
        durationMs: Date.now() - startTime,
        provider: 'local',
        completed: !config.signal?.aborted,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      config.onError(err);
      return {
        fullResponse: fullText.slice(0, offset),
        totalTokens: tokenCount,
        totalChunks: tokenCount,
        durationMs: Date.now() - startTime,
        provider: 'local',
        completed: false,
        error: err.message,
      };
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(streamId: string): boolean {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active streams
   */
  cancelAll(): void {
    for (const [id, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }

  /**
   * Get count of active streams
   */
  get activeStreamCount(): number {
    return this.activeStreams.size;
  }

  // ============================================================================
  // TOKEN EXTRACTION (Provider-specific)
  // ============================================================================

  private extractTokenFromChunk(chunk: any, provider: AIProviderType): string | null {
    try {
      switch (provider) {
        case 'gemini':
          return chunk?.candidates?.[0]?.content?.parts?.[0]?.text || null;

        case 'openai':
          return chunk?.choices?.[0]?.delta?.content || null;

        case 'anthropic':
          if (chunk?.type === 'content_block_delta') {
            return chunk?.delta?.text || null;
          }
          return null;

        default:
          // Generic extraction
          return chunk?.text || chunk?.content || chunk?.token || chunk?.delta?.content || null;
      }
    } catch {
      return null;
    }
  }
}

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

export interface UseStreamingResult {
  streamText: string;
  isStreaming: boolean;
  progress: StreamProgress | null;
  error: string | null;
  startStream: (url: string, body: Record<string, unknown>) => Promise<StreamResult>;
  cancelStream: () => void;
}

/**
 * Create a streaming state manager (framework-agnostic)
 */
export function createStreamingState(
  handler: StreamingResponseHandler,
  onUpdate: (state: { text: string; streaming: boolean; progress: StreamProgress | null; error: string | null }) => void
) {
  let abortController: AbortController | null = null;
  let currentText = '';

  return {
    async start(url: string, body: Record<string, unknown>, provider?: AIProviderType): Promise<StreamResult> {
      abortController = new AbortController();
      currentText = '';
      onUpdate({ text: '', streaming: true, progress: null, error: null });

      const result = await handler.streamFromEndpoint(url, body, {
        onToken: (token) => {
          currentText += token;
          onUpdate({ text: currentText, streaming: true, progress: null, error: null });
        },
        onComplete: (full) => {
          currentText = full;
          onUpdate({ text: full, streaming: false, progress: null, error: null });
        },
        onError: (err) => {
          onUpdate({ text: currentText, streaming: false, progress: null, error: err.message });
        },
        onProgress: (progress) => {
          onUpdate({ text: currentText, streaming: true, progress, error: null });
        },
        signal: abortController.signal,
      }, provider);

      return result;
    },

    cancel(): void {
      abortController?.abort();
      onUpdate({ text: currentText, streaming: false, progress: null, error: null });
    },

    async simulateStream(text: string): Promise<StreamResult> {
      abortController = new AbortController();
      currentText = '';
      onUpdate({ text: '', streaming: true, progress: null, error: null });

      return handler.simulateStream(text, {
        onToken: (token) => {
          currentText += token;
          onUpdate({ text: currentText, streaming: true, progress: null, error: null });
        },
        onComplete: (full) => {
          onUpdate({ text: full, streaming: false, progress: null, error: null });
        },
        onError: (err) => {
          onUpdate({ text: currentText, streaming: false, progress: null, error: err.message });
        },
        signal: abortController.signal,
      });
    },
  };
}
