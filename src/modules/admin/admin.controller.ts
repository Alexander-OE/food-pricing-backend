// Handles all admin requests, from login to the feedback inbox.
import type { Request, Response } from 'express';
import { getValid } from '../../middleware/validate';
import type { AdminIdentity } from '../../types';
import { ok } from '../../utils/response';
import * as accuracy from './admin.accuracy.service';
import * as analytics from './admin.analytics.service';
import * as auth from './admin.auth.service';
import * as commodities from './admin.commodities.service';
import * as data from './admin.data.service';
import * as feedback from './admin.feedback.service';
import * as overview from './admin.overview.service';
import type {
  AccuracyQuery,
  FeedbackQuery,
  FeedbackUpdateBody,
  LoginBody,
  RangeQuery,
  RefreshBody,
  RefreshLogsQuery,
} from './admin.schemas';

export async function login(_req: Request, res: Response) {
  const { body } = getValid<LoginBody>(res);
  ok(res, await auth.login(body.email, body.password));
}

export async function me(_req: Request, res: Response) {
  const identity = res.locals.admin as AdminIdentity;
  ok(res, await auth.getAdminById(identity.id));
}

export async function getOverview(_req: Request, res: Response) {
  ok(res, await overview.getOverview());
}

export async function getUsage(_req: Request, res: Response) {
  const { query } = getValid<unknown, RangeQuery>(res);
  ok(res, await analytics.getUsage(query.range));
}

export async function getCommodityRanking(_req: Request, res: Response) {
  const { query } = getValid<unknown, RangeQuery>(res);
  ok(res, await analytics.getCommodityRanking(query.range));
}

export async function getDataStatus(_req: Request, res: Response) {
  ok(res, await data.getDataStatus());
}

export async function getRefreshLogs(_req: Request, res: Response) {
  const { query } = getValid<unknown, RefreshLogsQuery>(res);
  const { items, total } = await data.getRefreshLogs(query);
  ok(res, items, { page: query.page, limit: query.limit, total });
}

export async function refreshData(_req: Request, res: Response) {
  const { body } = getValid<RefreshBody>(res);
  ok(res, await data.triggerRefresh(body));
}

export async function getAccuracy(_req: Request, res: Response) {
  const { query } = getValid<unknown, AccuracyQuery>(res);
  ok(res, await accuracy.getAccuracyReport(query.months));
}

export async function listFeedback(_req: Request, res: Response) {
  const { query } = getValid<unknown, FeedbackQuery>(res);
  const { items, total } = await feedback.listFeedback(query);
  ok(res, items, { page: query.page, limit: query.limit, total });
}

export async function updateFeedback(_req: Request, res: Response) {
  const { body, params } = getValid<FeedbackUpdateBody, unknown, { id: number }>(res);
  ok(res, await feedback.updateFeedbackStatus(params.id, body));
}

export async function listCommodities(_req: Request, res: Response) {
  ok(res, await commodities.listAllCommodities());
}
