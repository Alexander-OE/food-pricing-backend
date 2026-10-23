// Sends every response in the same success or error envelope.
import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export function ok<T>(res: Response, data: T, meta?: PageMeta, status = 200): Response {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown[] = [],
): Response {
  return res.status(status).json({ success: false, error: { code, message, details } });
}
