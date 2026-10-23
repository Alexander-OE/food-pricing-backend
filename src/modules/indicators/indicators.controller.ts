// Handles requests for the latest market indicators.
import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { getLatestIndicators } from './indicators.service';

export async function getLatest(_req: Request, res: Response) {
  ok(res, await getLatestIndicators());
}
