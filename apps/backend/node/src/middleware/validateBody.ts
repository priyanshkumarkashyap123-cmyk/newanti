/**
 * validateBody.ts — Generic Zod request body validation middleware factory.
 *
 * Usage:
 *   router.post('/route', validateBody(mySchema), handler);
 *
 * On validation failure, returns HTTP 400 with:
 *   { error: 'VALIDATION_ERROR', fields: [{ field: string, message: string }] }
 */

import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'VALIDATION_ERROR', fields });
      return;
    }
    // Replace with parsed/coerced data
    req.body = result.data;
    next();
  };
}

export default validateBody;
