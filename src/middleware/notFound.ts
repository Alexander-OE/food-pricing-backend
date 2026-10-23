// Handles requests that match no route.
import type { RequestHandler } from 'express';
import { fail } from '../utils/response';

export const notFound: RequestHandler = (req, res) => {
  fail(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
};
