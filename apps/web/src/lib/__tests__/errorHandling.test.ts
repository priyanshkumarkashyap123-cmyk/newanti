import { describe, expect, it } from 'vitest';
import {
  getApiErrorMessage,
  getErrorMessage,
  isAbortError,
} from '../errorUtils';

describe('errorHandling utilities', () => {
  it('getErrorMessage returns message for Error/string/object and fallback otherwise', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage('plain error', 'fallback')).toBe('plain error');
    expect(getErrorMessage({ message: 'from object' }, 'fallback')).toBe('from object');
    expect(getErrorMessage({ nope: true }, 'fallback')).toBe('fallback');
  });

  it('isAbortError detects AbortError DOMException', () => {
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    const otherErr = new DOMException('Other', 'SecurityError');

    expect(isAbortError(abortErr)).toBe(true);
    expect(isAbortError(otherErr)).toBe(false);
    expect(isAbortError(new Error('AbortError'))).toBe(false);
  });

  it('getApiErrorMessage prioritizes axios-style response.data.detail', () => {
    const axiosLike = { response: { data: { detail: 'Detailed API error' } } };
    expect(getApiErrorMessage(axiosLike, 'fallback')).toBe('Detailed API error');

    expect(getApiErrorMessage(new Error('Generic failure'), 'fallback')).toBe('Generic failure');
    expect(getApiErrorMessage({ random: true }, 'fallback')).toBe('fallback');
  });
});
