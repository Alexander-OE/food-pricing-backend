// Routes for /feedback.
import { Router } from 'express';
import { feedbackLimiter } from '../../middleware/rateLimiters';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { postFeedback } from './feedback.controller';
import { createFeedbackSchema } from './feedback.schemas';

export const feedbackRouter = Router();

feedbackRouter.post(
  '/',
  feedbackLimiter,
  validate({ body: createFeedbackSchema }),
  asyncHandler(postFeedback),
);
