// Handles requests for commodity lists, details and price history.
import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { getValid } from '../../middleware/validate';
import type { AccuracyQuery, HistoryQuery, ListQuery } from './commodities.schemas';
import * as service from './commodities.service';

type SlugParams = { slug: string };

export async function listCommodities(_req: Request, res: Response) {
  const { query } = getValid<unknown, ListQuery>(res);
  const { items, total } = await service.listCommodities(query);
  ok(res, items, { page: query.page, limit: query.limit, total });
}

export async function listCategories(_req: Request, res: Response) {
  ok(res, await service.listCategories());
}

export async function getDetail(_req: Request, res: Response) {
  const { params } = getValid<unknown, unknown, SlugParams>(res);
  ok(res, await service.getCommodityDetail(params.slug));
}

export async function getHistory(_req: Request, res: Response) {
  const { params, query } = getValid<unknown, HistoryQuery, SlugParams>(res);
  ok(res, await service.getCommodityHistory(params.slug, query.months));
}

export async function getAccuracy(_req: Request, res: Response) {
  const { params, query } = getValid<unknown, AccuracyQuery, SlugParams>(res);
  ok(res, await service.getCommodityAccuracy(params.slug, query.months));
}

export async function getRelated(_req: Request, res: Response) {
  const { params } = getValid<unknown, unknown, SlugParams>(res);
  ok(res, await service.getRelatedCards(params.slug));
}
