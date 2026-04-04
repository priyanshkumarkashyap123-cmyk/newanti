/**
 * Tests for asyncHandler utility
 *
 * Verifies that async route handlers properly forward
 * errors to Express error middleware via next().
 */

import { describe, it, expect, vi } from 'vitest';
import { asyncHandler, HttpError } from '../src/utils/asyncHandler.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(overrides = {}): Request {
  return { method: 'GET', url: '/test', ...overrides } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('asyncHandler', () => {
  it('calls the handler and completes normally', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards thrown sync errors to next()', async () => {
    const error = new Error('sync boom');
    const handler = () => { throw error; };
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('forwards rejected promises to next()', async () => {
    const error = new Error('async boom');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('forwards HttpError with statusCode to next()', async () => {
    const error = new HttpError(404, 'Not found');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(error);
    const passedError = next.mock.calls[0][0];
    expect(passedError.statusCode).toBe(404);
    expect(passedError.message).toBe('Not found');
  });
});

describe('HttpError', () => {
  it('creates error with statusCode and message', () => {
    const err = new HttpError(400, 'Bad request');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad request');
    expect(err.name).toBe('HttpError');
    expect(err).toBeInstanceOf(Error);
  });
});
