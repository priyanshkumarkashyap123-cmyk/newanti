import { describe, expect, it } from 'vitest';

import {
  assertAnalysisPayload,
  assertDesignPayload,
  assertProxyObjectPayload,
} from '../src/utils/proxyContracts.js';

describe('proxy contract guards', () => {
  it('accepts generic non-array objects', () => {
    expect(assertProxyObjectPayload({ ok: true }, 'generic').ok).toBe(true);
    expect(assertProxyObjectPayload([], 'generic').ok).toBe(false);
  });

  it('accepts analysis payload with success flag', () => {
    const result = assertAnalysisPayload({ success: true, result: {} }, 'analysis');
    expect(result.ok).toBe(true);
  });

  it('accepts analysis payload with known result keys', () => {
    const result = assertAnalysisPayload(
      { displacements: { N1: { dx: 0.001 } } },
      'analysis',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects analysis payload without expected contract markers', () => {
    const result = assertAnalysisPayload({ foo: 'bar' }, 'analysis');
    expect(result.ok).toBe(false);
  });

  it('accepts design leaf result payload', () => {
    const result = assertDesignPayload(
      { passed: true, utilization: 0.42, message: 'ok' },
      'design',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts design envelope result payload', () => {
    const result = assertDesignPayload(
      {
        success: true,
        result: { passed: true, utilization: 0.37, message: 'ok' },
      },
      'design',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects design payload without passed/utilization/message contract', () => {
    const result = assertDesignPayload({ success: true, result: { hello: 'world' } }, 'design');
    expect(result.ok).toBe(false);
  });
});
