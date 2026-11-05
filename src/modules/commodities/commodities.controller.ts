import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { getValid } from '../../middleware/validate';
import type { AccuracyQuery, HistoryQuery, ListQuery } from './commodities.schemas';
import * as service from './commodities.service';

type SlugParams = { slug: string };

// Returns a page of commodities, with search, filter and sort options.
export async function listCommodities(_req: Request, res: Response) {
  const { query } = getValid<unknown, ListQuery>(res);
  const { items, total } = await service.listCommodities(query);
  ok(res, items, { page: query.page, limit: query.limit, total });
}

// Returns the list of food categories.
export async function listCategories(_req: Request, res: Response) {
  ok(res, await service.listCategories());
}

// Returns one commodity with its price, forecast and explanation.
export async function getDetail(_req: Request, res: Response) {
  const { params } = getValid<unknown, unknown, SlugParams>(res);
  ok(res, await service.getCommodityDetail(params.slug));
}

// Returns the past monthly prices of one commodity.
export async function getHistory(_req: Request, res: Response) {
  const { params, query } = getValid<unknown, HistoryQuery, SlugParams>(res);
  ok(res, await service.getCommodityHistory(params.slug, query.months));
}

// Returns how close past forecasts were to the real price.
export async function getAccuracy(_req: Request, res: Response) {
  const { params, query } = getValid<unknown, AccuracyQuery, SlugParams>(res);
  ok(res, await service.getCommodityAccuracy(params.slug, query.months));
}

// Returns similar commodities to show alongside this one.
export async function getRelated(_req: Request, res: Response) {
  const { params } = getValid<unknown, unknown, SlugParams>(res);
  ok(res, await service.getRelatedCards(params.slug));
}
