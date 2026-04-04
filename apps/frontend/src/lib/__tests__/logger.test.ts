/**
 * logger.test.ts — Tests for the structured logging service
 *
 * Verifies that the logger methods exist, don't throw, and that
 * child loggers and named loggers are correctly wired.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub sessionStorage (used by getSessionId inside logger.ts)
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Import after mocking
import {
  logger,
  apiLogger,
  authLogger,
  analysisLogger,
  uiLogger,
} from '@/lib/logging/logger';

describe('logger', () => {
  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ──────────────────────────────────────────
  // Core log methods
  // ──────────────────────────────────────────

  it('logger.info() does not throw', () => {
    expect(() => logger.info('Test info message')).not.toThrow();
  });

  it('logger.warn() does not throw', () => {
    expect(() => logger.warn('Test warning', { detail: 42 })).not.toThrow();
  });

  it('logger.error() does not throw with an Error object', () => {
    expect(() => logger.error('Something failed', new Error('boom'))).not.toThrow();
  });

  it('logger.debug() does not throw', () => {
    expect(() => logger.debug('Debug trace')).not.toThrow();
  });

  // ──────────────────────────────────────────
  // Child loggers
  // ──────────────────────────────────────────

  it('logger.child() returns a logger instance', () => {
    const child = logger.child('myModule');
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('child logger methods do not throw', () => {
    const child = logger.child('test');
    expect(() => child.info('child info')).not.toThrow();
    expect(() => child.error('child error', new Error('oops'))).not.toThrow();
  });

  // ──────────────────────────────────────────
  // Named / pre-built loggers
  // ──────────────────────────────────────────

  it('apiLogger is defined and has log methods', () => {
    expect(apiLogger).toBeDefined();
    expect(typeof apiLogger.info).toBe('function');
  });

  it('analysisLogger is defined and has log methods', () => {
    expect(analysisLogger).toBeDefined();
    expect(typeof analysisLogger.warn).toBe('function');
  });

  it('authLogger is defined', () => {
    expect(authLogger).toBeDefined();
  });

  it('uiLogger is defined', () => {
    expect(uiLogger).toBeDefined();
  });
});
