import { describe, expect, it } from 'vitest';

import { normalizeOrigin, sanitizeConfiguredOrigins } from '../src/config/cors.js';

describe('cors config helpers', () => {
  it('normalizes origin casing and trailing slashes', () => {
    expect(normalizeOrigin('HTTPS://BeamLabUltimate.Tech/')).toBe('https://beamlabultimate.tech');
  });

  it('filters wildcard and localhost configured origins', () => {
    const sanitized = sanitizeConfiguredOrigins([
      '*',
      'http://localhost:5173',
      'https://beamlabultimate.tech',
      'https://www.beamlabultimate.tech/',
    ]);

    expect(sanitized).toEqual([
      'https://beamlabultimate.tech',
      'https://www.beamlabultimate.tech',
    ]);
  });
});
