import { describe, expect, it } from 'vitest';

import {
  FORWARDED_BY_HEADER,
  INTERNAL_CALLER_HEADER,
  INTERNAL_CALLER_NAME,
  INTERNAL_SERVICE_HEADER,
  isPlaceholderSecret,
  isValidInternalServiceSecret,
} from '../src/config/serviceTrust.js';

describe('service trust helpers', () => {
  it('rejects obvious placeholder secrets', () => {
    expect(isPlaceholderSecret('your_internal_service_secret_here')).toBe(true);
    expect(isPlaceholderSecret('replace_with_secure_internal_service_secret')).toBe(true);
    expect(isPlaceholderSecret('actually-secure-secret-value')).toBe(false);
  });

  it('validates strong internal service secrets', () => {
    expect(isValidInternalServiceSecret('1234567890abcdef')).toBe(true);
    expect(isValidInternalServiceSecret('short-secret')).toBe(false);
    expect(isValidInternalServiceSecret('your_internal_service_secret_here')).toBe(false);
  });

  it('exports stable internal header names', () => {
    expect(FORWARDED_BY_HEADER).toBe('X-Forwarded-By');
    expect(INTERNAL_CALLER_HEADER).toBe('X-Internal-Caller');
    expect(INTERNAL_SERVICE_HEADER).toBe('X-Internal-Service');
    expect(INTERNAL_CALLER_NAME).toBe('beamlab-node-gateway');
  });
});
