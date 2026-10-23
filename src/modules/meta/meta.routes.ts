// Routes for /health and /meta.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getHealth, getStatus } from './meta.controller';

export const healthRouter = Router();
healthRouter.get('/', asyncHandler(getHealth));

export const metaRouter = Router();
metaRouter.get('/data-status', asyncHandler(getStatus));
