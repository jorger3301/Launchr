/**
 * Zod Schema Exports
 *
 * Centralized exports for all validation schemas.
 */

// Common schemas
export * from './common';

// Launch schemas
export * from './launch';

// Trade schemas
export * from './trade';

// User schemas
export * from './user';

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

import { z, ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Format Zod errors into a user-friendly message
 */
export function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
}

/**
 * Safe parse with formatted error message
 */
export function safeParse<T>(schema: ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: formatZodError(result.error) };
}

/**
 * Parse or throw with formatted error
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = safeParse(schema, data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Express middleware factory for request validation
 */
export function validate<TParams = unknown, TQuery = unknown, TBody = unknown>(options: {
  params?: ZodSchema<TParams>;
  query?: ZodSchema<TQuery>;
  body?: ZodSchema<TBody>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.params) {
        const result = options.params.safeParse(req.params);
        if (!result.success) {
          return res.status(400).json({
            error: 'Invalid URL parameters',
            details: formatZodError(result.error),
          });
        }
        req.params = result.data as any;
      }

      if (options.query) {
        const result = options.query.safeParse(req.query);
        if (!result.success) {
          return res.status(400).json({
            error: 'Invalid query parameters',
            details: formatZodError(result.error),
          });
        }
        req.query = result.data as any;
      }

      if (options.body) {
        const result = options.body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Invalid request body',
            details: formatZodError(result.error),
          });
        }
        req.body = result.data;
      }

      next();
    } catch (err) {
      return res.status(500).json({ error: 'Validation error' });
    }
  };
}

/**
 * Type-safe validated request helper type
 * Use with type assertion after validation middleware
 */
export type ValidatedRequest<TParams = unknown, TQuery = unknown, TBody = unknown> = Request & {
  validatedParams: TParams;
  validatedQuery: TQuery;
  validatedBody: TBody;
};
