import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucketRateLimiter } from '@/lib/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  it('creates with default config', () => {
    const limiter = new TokenBucketRateLimiter();
    const info = limiter.getInfo();
    expect(info.limit).toBe(100);
    expect(info.remaining).toBe(100);
    limiter.destroy();
  });

  it('creates with custom config', () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 5,
      refillRate: 1,
      refillInterval: 2000,
    });
    const info = limiter.getInfo();
    expect(info.limit).toBe(5);
    expect(info.remaining).toBe(5);
    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // acquire / tryAcquire
  // -----------------------------------------------------------------------

  it('acquire() succeeds when tokens are available', async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 5 });
    await expect(limiter.acquire()).resolves.toBeUndefined();
    limiter.destroy();
  });

  it('acquire() removes a token', async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 5 });
    await limiter.acquire();
    const info = limiter.getInfo();
    expect(info.remaining).toBe(4);
    limiter.destroy();
  });

  it('tryAcquire() fails when bucket is empty', async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 2, refillRate: 0 });
    // Drain the bucket
    await limiter.acquire();
    await limiter.acquire();
    const acquired = limiter.tryAcquire();
    expect(acquired).toBe(false);
    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // getInfo
  // -----------------------------------------------------------------------

  it('getInfo() returns remaining tokens count', async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 10 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.getInfo().remaining).toBe(7);
    limiter.destroy();
  });

  it('getInfo() returns limit', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 42 });
    expect(limiter.getInfo().limit).toBe(42);
    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // Refill
  // -----------------------------------------------------------------------

  it('refills tokens over time', async () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 5,
      refillRate: 2,
      refillInterval: 1000,
    });

    // Drain 4 tokens
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.getInfo().remaining).toBe(1);

    // Advance time by one refill interval
    vi.advanceTimersByTime(1000);

    // Should have refilled 2 tokens → 1 + 2 = 3
    expect(limiter.getInfo().remaining).toBe(3);

    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // Per-endpoint limits
  // -----------------------------------------------------------------------

  it('per-endpoint limits work', () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 100,
      refillRate: 10,
      refillInterval: 1000,
      endpointLimits: {
        '/api/heavy': { maxTokens: 3, refillRate: 1 },
      },
    });
    const info = limiter.getInfo('/api/heavy');
    expect(info.limit).toBe(3);
    expect(info.remaining).toBe(3);
    limiter.destroy();
  });

  it('multiple endpoints have separate buckets', async () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 100,
      refillRate: 10,
      refillInterval: 1000,
      endpointLimits: {
        '/a': { maxTokens: 5, refillRate: 1 },
        '/b': { maxTokens: 10, refillRate: 2 },
      },
    });

    await limiter.acquire('/a');
    await limiter.acquire('/a');

    expect(limiter.getInfo('/a').remaining).toBe(3);
    expect(limiter.getInfo('/b').remaining).toBe(10); // untouched

    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // destroy / reset
  // -----------------------------------------------------------------------

  it('destroy() cleans up timers', async () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 5,
      refillRate: 1,
      refillInterval: 500,
    });

    // Trigger bucket creation so timers are started
    await limiter.acquire();
    limiter.destroy();

    // After destroy, advancing timers should not cause errors
    vi.advanceTimersByTime(5000);
    // No assertion fail = success; timers were cleaned up
  });

  it('reset() restores tokens to max', async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 5 });

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.getInfo().remaining).toBe(3);

    limiter.reset();
    expect(limiter.getInfo().remaining).toBe(5);

    limiter.destroy();
  });
});
