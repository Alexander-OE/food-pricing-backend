// Routes for /dashboard.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getSummary } from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', asyncHandler(getSummary));
