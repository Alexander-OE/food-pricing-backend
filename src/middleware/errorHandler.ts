// Turns any error into the standard error response.
import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { ApiError } from '../utils/ApiError';
import { fail } from '../utils/response';

/** Body-parser errors (bad JSON, body too large) carry a status and type. */
function isBodyParserError(
  error: unknown,
): error is { status: number; type: string; message: string } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    fail(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    fail(res, 400, 'VALIDATION_ERROR', 'Some fields are invalid', details);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint, P2025 = record not found
    if (error.code === 'P2002') {
      fail(res, 409, 'CONFLICT', 'That record already exists');
      return;
    }
    if (error.code === 'P2025') {
      fail(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
  }

  if (isBodyParserError(error)) {
    fail(res, error.status, 'BAD_REQUEST', error.message);
    return;
  }

  logger.error({ err: error }, 'Unhandled error');
  const message =
    env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'Something went wrong';
  fail(res, 500, 'INTERNAL_ERROR', message);
};
