import { describe, it, expect, vi } from 'vitest';
import { proxyRequest } from '../services/serviceProxy.js';
import fetch from 'node-fetch';

vi.stubGlobal('fetch', fetch as any);

describe('Service Proxy', () => {
  it('should return success when Rust health endpoint responds OK', async () => {
    // Mock fetch to return a successful health check
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok', version: '2.1.0' }),
    })));

    const result = await proxyRequest({ service: 'rust', method: 'GET', path: '/health' });
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: 'ok', version: '2.1.0' });
  });

  it('should open circuit after failures', async () => {
    // Mock fetch to throw error
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Timeout'))));
    // First 5 failures
    for (let i = 0; i < 5; i++) {
      await proxyRequest({ service: 'python', method: 'GET', path: '/health', retries: 0 });
    }
    // Circuit should now be open
    const result = await proxyRequest({ service: 'python', method: 'GET', path: '/health', retries: 0 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toMatch(/Circuit OPEN/);
  });
});