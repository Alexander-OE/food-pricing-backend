// Handles requests to submit feedback.
import type { Request, Response } from 'express';
import { getValid } from '../../middleware/validate';
import { ok } from '../../utils/response';
import type { CreateFeedbackBody } from './feedback.schemas';
import { createFeedback } from './feedback.service';

export async function postFeedback(_req: Request, res: Response) {
  const { body } = getValid<CreateFeedbackBody>(res);
  const created = await createFeedback(res.locals.sessionId as string | undefined, body);
  ok(res, created, undefined, 201);
}
