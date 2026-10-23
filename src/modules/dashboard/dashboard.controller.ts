// Handles requests for the dashboard summary.
import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { getDashboardSummary } from './dashboard.service';

export async function getSummary(_req: Request, res: Response) {
  ok(res, await getDashboardSummary());
}
