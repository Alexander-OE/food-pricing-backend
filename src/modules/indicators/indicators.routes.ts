// Routes for /indicators.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getLatest } from './indicators.controller';

export const indicatorsRouter = Router();

indicatorsRouter.get('/latest', asyncHandler(getLatest));
