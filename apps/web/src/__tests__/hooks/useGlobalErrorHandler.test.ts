import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock uiLogger before importing the hook
// ---------------------------------------------------------------------------
const { mockError } = vi.hoisted(() => {
  const mockError = vi.fn();
  return { mockError };
});

vi.mock('@/lib/logging/logger', () => ({
  uiLogger: {
    error: mockError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireErrorEvent(message = 'Test error', error?: Error) {
  const event = new ErrorEvent('error', {
    message,
    filename: 'test.ts',
    lineno: 42,
    colno: 10,
    error: error ?? new Error(message),
  });
  window.dispatchEvent(event);
}

function fireUnhandledRejection(reason: unknown) {
  const event = new PromiseRejectionEvent('unhandledrejection', {
    promise: Promise.resolve(),
    reason,
  });
  window.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useGlobalErrorHandler', () => {
  beforeEach(() => {
    mockError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers error event listener on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    unmount();
  });

  it('registers unhandledrejection listener on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    unmount();
  });

  it('removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('logs errors via uiLogger when error event fires', () => {
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    fireErrorEvent('Something broke');

    expect(mockError).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({
        error: 'Something broke',
        filename: 'test.ts',
        lineno: 42,
        colno: 10,
      }),
    );
    unmount();
  });

  it('logs rejections via uiLogger when unhandledrejection fires', () => {
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    fireUnhandledRejection(new Error('Promise boom'));

    expect(mockError).toHaveBeenCalledWith(
      'Unhandled promise rejection',
      expect.objectContaining({
        error: 'Promise boom',
      }),
    );
    unmount();
  });

  it('does not crash with null error in rejection', () => {
    const { unmount } = renderHook(() => useGlobalErrorHandler());

    expect(() => fireUnhandledRejection(null)).not.toThrow();
    expect(mockError).toHaveBeenCalledWith(
      'Unhandled promise rejection',
      expect.objectContaining({ error: 'null' }),
    );
    unmount();
  });

  it('multiple mount/unmount cycles work correctly', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount: unmount1 } = renderHook(() => useGlobalErrorHandler());
    unmount1();

    // Verify listeners were removed on first unmount
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    // Second mount/unmount works without issues
    const { unmount: unmount2 } = renderHook(() => useGlobalErrorHandler());
    fireErrorEvent('Second mount error');
    expect(mockError).toHaveBeenCalledTimes(1);
    unmount2();

    removeSpy.mockRestore();
  });

  it('hook returns void / undefined', () => {
    const { result, unmount } = renderHook(() => useGlobalErrorHandler());
    expect(result.current).toBeUndefined();
    unmount();
  });
});
