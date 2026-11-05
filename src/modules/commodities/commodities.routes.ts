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

// GET /commodities: list commodities with search, filter and sort.
commoditiesRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(controller.listCommodities),
);

// GET /commodities/categories: list the food categories.
commoditiesRouter.get('/categories', asyncHandler(controller.listCategories));


// GET /commodities/:slug: get one commodity with its forecast.
commoditiesRouter.get(
  '/:slug',
  validate({ params: slugParamsSchema }),
  asyncHandler(controller.getDetail),
);


// GET /commodities/:slug/history: get past monthly prices.
commoditiesRouter.get(
  '/:slug/history',
  validate({ params: slugParamsSchema, query: historyQuerySchema }),
  asyncHandler(controller.getHistory),
);


// GET /commodities/:slug/accuracy: get how close past forecasts were.
commoditiesRouter.get(
  '/:slug/accuracy',
  validate({ params: slugParamsSchema, query: accuracyQuerySchema }),
  asyncHandler(controller.getAccuracy),
);


// GET /commodities/:slug/related: get similar commodities.
commoditiesRouter.get(
  '/:slug/related',
  validate({ params: slugParamsSchema }),
  asyncHandler(controller.getRelated),
);
