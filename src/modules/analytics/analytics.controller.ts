// Handles requests to record usage events.
import type { Request, Response } from 'express';
import { getValid } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { ok } from '../../utils/response';
import type { TrackEventBody } from './analytics.schemas';
import { trackEvent } from './analytics.service';

export async function postEvent(_req: Request, res: Response) {
  const sessionId = res.locals.sessionId as string | undefined;
  if (!sessionId) throw ApiError.badRequest('A valid X-Session-Id header is required');

  const { body } = getValid<TrackEventBody>(res);
  await trackEvent(sessionId, body);
  ok(res, { accepted: true }, undefined, 202);
}
