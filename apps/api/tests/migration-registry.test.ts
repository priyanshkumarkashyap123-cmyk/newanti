import { describe, expect, it } from 'vitest';
import { getRegisteredMigrationNames } from '../src/migrations/runner.js';

describe('migration registry', () => {
  it('includes billing idempotency hardening migration', () => {
    const names = getRegisteredMigrationNames();
    expect(names).toContain('20260317010000_harden_billing_idempotency');
  });

  it('keeps migration names unique and chronologically sorted', () => {
    const names = getRegisteredMigrationNames();

    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});
