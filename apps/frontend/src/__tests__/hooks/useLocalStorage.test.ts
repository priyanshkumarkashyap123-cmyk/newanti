/**
 * Unit tests for the useLocalStorage hook
 *
 * Verifies that useLocalStorage:
 * - Returns the initial value when localStorage is empty
 * - Reads and parses existing localStorage values
 * - Persists updates to localStorage
 * - Supports functional updates
 * - Removes values from localStorage
 * - Handles JSON parse errors gracefully
 * - Syncs across tabs via storage events
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the logger used inside useIndustryStandards
vi.mock('../../utils/logger', () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/logger-enhanced', () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useLocalStorage } from '../../hooks/useIndustryStandards';

const TEST_KEY = 'test-local-storage-key';

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should return the initial value when localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));

        expect(result.current[0]).toBe('default');
    });

    it('should read an existing value from localStorage', () => {
        localStorage.setItem(TEST_KEY, JSON.stringify('persisted'));

        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));

        expect(result.current[0]).toBe('persisted');
    });

    it('should persist a new value to localStorage when setValue is called', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
        expect(JSON.parse(localStorage.getItem(TEST_KEY)!)).toBe('updated');
    });

    it('should support functional updates', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 10));

        act(() => {
            result.current[1]((prev: number) => prev + 5);
        });

        expect(result.current[0]).toBe(15);
        expect(JSON.parse(localStorage.getItem(TEST_KEY)!)).toBe(15);
    });

    it('should handle object values correctly', () => {
        const initial = { name: 'test', count: 0 };
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, initial));

        act(() => {
            result.current[1]({ name: 'updated', count: 42 });
        });

        expect(result.current[0]).toEqual({ name: 'updated', count: 42 });
        expect(JSON.parse(localStorage.getItem(TEST_KEY)!)).toEqual({ name: 'updated', count: 42 });
    });

    it('should remove the value from localStorage when removeValue is called', () => {
        localStorage.setItem(TEST_KEY, JSON.stringify('to-remove'));
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));

        expect(result.current[0]).toBe('to-remove');

        act(() => {
            result.current[2](); // removeValue
        });

        expect(result.current[0]).toBe('default');
        expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('should fall back to initialValue when localStorage contains invalid JSON', () => {
        localStorage.setItem(TEST_KEY, 'not-valid-json{{{');

        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'fallback'));

        expect(result.current[0]).toBe('fallback');
    });

    it('should sync value when a storage event is dispatched', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            // Simulate a storage event from another tab
            const event = new StorageEvent('storage', {
                key: TEST_KEY,
                newValue: JSON.stringify('from-other-tab'),
            });
            window.dispatchEvent(event);
        });

        expect(result.current[0]).toBe('from-other-tab');
    });
});
