// Validates request body, query and params with zod.
import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

interface ValidatedInput<B, Q, P> {
  body: B;
  query: Q;
  params: P;
}

/** Stores parsed values in res.locals, because Express 5 makes req.query read-only. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    try {
      res.locals.valid = {
        body: schemas.body ? schemas.body.parse(req.body) : req.body,
        query: schemas.query ? schemas.query.parse(req.query) : req.query,
        params: schemas.params ? schemas.params.parse(req.params) : req.params,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Reads the parsed input back in a controller. */
export function getValid<B = unknown, Q = unknown, P = unknown>(
  res: Response,
): ValidatedInput<B, Q, P> {
  return res.locals.valid as ValidatedInput<B, Q, P>;
}
