// Routes for /analytics.
import { Router } from 'express';
import { analyticsLimiter } from '../../middleware/rateLimiters';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { postEvent } from './analytics.controller';
import { trackEventSchema } from './analytics.schemas';

export const analyticsRouter = Router();

analyticsRouter.post(
  '/events',
  analyticsLimiter,
  validate({ body: trackEventSchema }),
  asyncHandler(postEvent),
);
