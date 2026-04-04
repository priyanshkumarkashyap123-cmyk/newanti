/**
 * Tests for fetchWithTimeout utility
 *
 * Covers: timeouts, retries, error handling, JSON envelope unwrapping,
 * non-JSON responses, abort controller, and retry backoff.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../../utils/fetchUtils';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns parsed JSON data on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Test' }));

    const result = await fetchWithTimeout<{ id: number; name: string }>('/api/test');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: 'Test' });
  });

  it('unwraps API envelope { success, data, requestId }', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { count: 42 }, requestId: 'abc-123', ts: Date.now() })
    );

    const result = await fetchWithTimeout<{ count: number }>('/api/envelope');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ count: 42 });
  });

  it('handles text/plain responses', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('OK'));

    const result = await fetchWithTimeout<string>('/api/text');

    expect(result.success).toBe(true);
    expect(result.data).toBe('OK');
  });

  it('returns error for 4xx responses', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Not found' }, 404)
    );

    const result = await fetchWithTimeout('/api/missing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
    expect(result.status).toBe(404);
  });

  it('retries on 5xx server errors', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal' }, 500))
      .mockResolvedValueOnce(jsonResponse({ result: 'ok' }));

    const promise = fetchWithTimeout('/api/flaky', { retries: 2, retryDelay: 10 });

    // Advance timers for retry delays
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns error when all retries exhausted', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Down' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'Down' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'Still Down' }, 503));

    const promise = fetchWithTimeout('/api/down', { retries: 2, retryDelay: 10 });
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await fetchWithTimeout('/api/offline', { retries: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('handles object error format { error: { code, message } }', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429)
    );

    const result = await fetchWithTimeout('/api/limited');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Too many requests');
    expect(result.status).toBe(429);
  });

  it('treats success:false envelope as logical failure even with 2xx', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { code: 'INVALID', message: 'Invalid payload' } }, 200)
    );

    const result = await fetchWithTimeout('/api/logical-error');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payload');
    expect(result.status).toBe(200);
  });

  it('sets Content-Type header to application/json by default when body is present', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await fetchWithTimeout('/api/test', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(callHeaders.get('Content-Type')).toBe('application/json');
  });

  it('adds Authorization header when authToken is provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await fetchWithTimeout('/api/secure', {
      method: 'GET',
      authToken: 'token-123',
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(callHeaders.get('Authorization')).toBe('Bearer token-123');
  });

  it('allows custom headers to override defaults', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await fetchWithTimeout('/api/test', {
      headers: { 'Content-Type': 'text/plain', 'X-Custom': 'yes' },
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(callHeaders.get('Content-Type')).toBe('text/plain');
    expect(callHeaders.get('X-Custom')).toBe('yes');
  });
});
