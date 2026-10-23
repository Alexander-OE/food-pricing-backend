// Routes for /admin; everything except login needs an admin token.
import { Router } from 'express';
import { adminLoginLimiter } from '../../middleware/rateLimiters';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './admin.controller';
import * as schemas from './admin.schemas';

export const adminRouter = Router();

adminRouter.post(
  '/auth/login',
  adminLoginLimiter,
  validate({ body: schemas.loginSchema }),
  asyncHandler(controller.login),
);

// Routes below need a valid admin token.
adminRouter.use(requireAdmin);

adminRouter.get('/auth/me', asyncHandler(controller.me));
adminRouter.get('/overview', asyncHandler(controller.getOverview));

adminRouter.get(
  '/analytics/usage',
  validate({ query: schemas.rangeQuerySchema }),
  asyncHandler(controller.getUsage),
);
adminRouter.get(
  '/analytics/commodities',
  validate({ query: schemas.rangeQuerySchema }),
  asyncHandler(controller.getCommodityRanking),
);

adminRouter.get('/data/status', asyncHandler(controller.getDataStatus));
adminRouter.get(
  '/data/refresh-logs',
  validate({ query: schemas.refreshLogsQuerySchema }),
  asyncHandler(controller.getRefreshLogs),
);
adminRouter.post(
  '/data/refresh',
  validate({ body: schemas.refreshBodySchema }),
  asyncHandler(controller.refreshData),
);

adminRouter.get(
  '/accuracy',
  validate({ query: schemas.accuracyQuerySchema }),
  asyncHandler(controller.getAccuracy),
);

adminRouter.get(
  '/feedback',
  validate({ query: schemas.feedbackQuerySchema }),
  asyncHandler(controller.listFeedback),
);
adminRouter.patch(
  '/feedback/:id',
  validate({ params: schemas.feedbackParamsSchema, body: schemas.feedbackUpdateSchema }),
  asyncHandler(controller.updateFeedback),
);

adminRouter.get('/commodities', asyncHandler(controller.listCommodities));
