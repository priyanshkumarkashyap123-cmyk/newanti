/**
 * Tests for Web Vitals tracking module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('webVitals module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports initWebVitals function', async () => {
    const mod = await import('../../utils/webVitals');
    expect(mod.initWebVitals).toBeDefined();
    expect(typeof mod.initWebVitals).toBe('function');
  });

  it('initWebVitals does not throw when web-vitals is available', async () => {
    const { initWebVitals } = await import('../../utils/webVitals');
    // Should not throw even in test environment
    await expect(initWebVitals()).resolves.not.toThrow();
  });
});
