// Routes for /commodities; fixed paths like /categories come before /:slug.
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './commodities.controller';
import {
  accuracyQuerySchema,
  historyQuerySchema,
  listQuerySchema,
  slugParamsSchema,
} from './commodities.schemas';

export const commoditiesRouter = Router();

commoditiesRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(controller.listCommodities),
);
commoditiesRouter.get('/categories', asyncHandler(controller.listCategories));
commoditiesRouter.get(
  '/:slug',
  validate({ params: slugParamsSchema }),
  asyncHandler(controller.getDetail),
);
commoditiesRouter.get(
  '/:slug/history',
  validate({ params: slugParamsSchema, query: historyQuerySchema }),
  asyncHandler(controller.getHistory),
);
commoditiesRouter.get(
  '/:slug/accuracy',
  validate({ params: slugParamsSchema, query: accuracyQuerySchema }),
  asyncHandler(controller.getAccuracy),
);
commoditiesRouter.get(
  '/:slug/related',
  validate({ params: slugParamsSchema }),
  asyncHandler(controller.getRelated),
);
