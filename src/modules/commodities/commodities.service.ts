// Business logic for commodities: fetching, filtering and building price cards.
import type { Commodity, Prediction, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { RELATED_COMMODITIES_COUNT, CARD_PRICE_MONTHS } from '../../constants';
import { addMonths, calculatePercentChange, toNumber, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { getLatestPricePeriod } from '../../ml-services/pipeline/ingestPrices';
import type { CommodityCard, PredictionFactor, PricePoint } from '../../types';
import { ApiError } from '../../utils/ApiError';
import {
  getActivePredictions,
  getLastMonthTrackRecord,
  getTrackRecords,
} from '../predictions/predictions.service';
import type { ListQuery } from './commodities.schemas';

/** Builds the full image URL from the stored path. */
function toImageUrl(path: string | null): string | null {
  return path ? `${env.PUBLIC_URL}${path}` : null;
}

export type CommodityDetail = Awaited<ReturnType<typeof getCommodityDetail>>;

export async function findCommodityOrThrow(slug: string): Promise<Commodity> {
  const commodity = await prisma.commodity.findUnique({ where: { slug } });
  if (!commodity) throw ApiError.notFound('Commodity not found');
  return commodity;
}

/** Builds the price and forecast card for each commodity. */
export async function buildCards(commodities: Commodity[]): Promise<CommodityCard[]> {
  const latest = await getLatestPricePeriod();
  if (!latest || commodities.length === 0) return [];

  const ids = commodities.map((commodity) => commodity.id);
  const [prices, predictions] = await Promise.all([
    prisma.priceRecord.findMany({
      where: {
        commodityId: { in: ids },
        period: { gte: addMonths(latest, -(CARD_PRICE_MONTHS - 1)), lte: latest },
      },
      orderBy: { period: 'asc' },
    }),
    getActivePredictions(ids),
  ]);

  return commodities.map((commodity) => {
    const series: PricePoint[] = prices
      .filter((row) => row.commodityId === commodity.id)
      .map((row) => ({ period: toPeriodString(row.period), price: toNumber(row.price) }));
    const currentPrice = series[series.length - 1]?.price ?? 0;
    const previousPrice = series[series.length - 2]?.price ?? currentPrice;
    const prediction = predictions.get(commodity.id);

    return {
      id: commodity.id,
      name: commodity.name,
      slug: commodity.slug,
      category: commodity.category,
      unit: commodity.unit,
      imageUrl: toImageUrl(commodity.imageUrl),
      currentPrice,
      previousPrice,
      monthOnMonthChange: calculatePercentChange(previousPrice, currentPrice),
      predictedPrice: prediction ? toNumber(prediction.predictedPrice) : currentPrice,
      percentChange: prediction?.percentChange ?? 0,
      direction: prediction?.direction ?? 'STABLE',
      confidence: prediction?.confidence ?? 0,
    };
  });
}

/** Sorts in memory, which is fine for 25 commodities. */
function sortCards(cards: CommodityCard[], sort: ListQuery['sort']): CommodityCard[] {
  const sorted = [...cards];
  if (sort === 'price') sorted.sort((a, b) => b.currentPrice - a.currentPrice);
  else if (sort === 'change')
    sorted.sort((a, b) => a.percentChange - b.percentChange); // biggest drop first
  else if (sort === '-change')
    sorted.sort((a, b) => b.percentChange - a.percentChange); // biggest rise first
  else sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

export async function listCommodities(
  query: ListQuery,
): Promise<{ items: CommodityCard[]; total: number }> {
  const where: Prisma.CommodityWhereInput = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const commodities = await prisma.commodity.findMany({ where });
  let cards = await buildCards(commodities);
  // Direction comes from the prediction, so filter after the cards are built.
  if (query.direction) cards = cards.filter((card) => card.direction === query.direction);

  const sorted = sortCards(cards, query.sort);
  const start = (query.page - 1) * query.limit;
  return { items: sorted.slice(start, start + query.limit), total: sorted.length };
}

export async function listCategories(): Promise<{ category: string; count: number }[]> {
  const groups = await prisma.commodity.groupBy({ by: ['category'], _count: { _all: true } });
  return groups.map((group) => ({ category: group.category, count: group._count._all }));
}

export async function getCommodityDetail(slug: string) {
  const commodity = await findCommodityOrThrow(slug);
  const [card] = await buildCards([commodity]);
  const predictions = await getActivePredictions([commodity.id]);
  const prediction = predictions.get(commodity.id) as Prediction | undefined;
  const latest = await getLatestPricePeriod();

  // Year-on-year compares with the same month last year.
  const yearAgo = latest
    ? await prisma.priceRecord.findUnique({
        where: {
          commodityId_period: { commodityId: commodity.id, period: addMonths(latest, -12) },
        },
      })
    : null;

  return {
    ...card,
    description: commodity.description,
    lowerBound: prediction ? toNumber(prediction.lowerBound) : card.currentPrice,
    upperBound: prediction ? toNumber(prediction.upperBound) : card.currentPrice,
    basePeriod: prediction ? toPeriodString(prediction.basePeriod) : null,
    targetPeriod: prediction ? toPeriodString(prediction.targetPeriod) : null,
    factors: (prediction?.factors ?? []) as unknown as PredictionFactor[],
    explanation: prediction?.explanation ?? '',
    modelVersion: prediction?.modelVersion ?? null,
    yearOnYearChange: yearAgo
      ? calculatePercentChange(toNumber(yearAgo.price), card.currentPrice)
      : null,
    lastMonthTrackRecord: await getLastMonthTrackRecord(commodity.id),
  };
}

/** Price history for the chart, plus the forecast point and its range. */
export async function getCommodityHistory(slug: string, months: number) {
  const commodity = await findCommodityOrThrow(slug);
  const latest = await getLatestPricePeriod();
  if (!latest) return { slug, history: [], forecast: null };

  const rows = await prisma.priceRecord.findMany({
    where: { commodityId: commodity.id, period: { gte: addMonths(latest, -(months - 1)) } },
    orderBy: { period: 'asc' },
  });
  const prediction = (await getActivePredictions([commodity.id])).get(commodity.id);

  return {
    slug,
    history: rows.map((row) => ({
      period: toPeriodString(row.period),
      price: toNumber(row.price),
    })),
    forecast: prediction
      ? {
          period: toPeriodString(prediction.targetPeriod),
          price: toNumber(prediction.predictedPrice),
          lowerBound: toNumber(prediction.lowerBound),
          upperBound: toNumber(prediction.upperBound),
        }
      : null,
  };
}

/** Predicted vs actual price for past months. */
export async function getCommodityAccuracy(slug: string, months: number) {
  const commodity = await findCommodityOrThrow(slug);
  return getTrackRecords(commodity.id, months);
}

/** Up to 4 related commodities: same category first, then others. */
export async function getRelatedCards(slug: string): Promise<CommodityCard[]> {
  const commodity = await findCommodityOrThrow(slug);
  const sameCategory = await prisma.commodity.findMany({
    where: { category: commodity.category, NOT: { id: commodity.id } },
    take: RELATED_COMMODITIES_COUNT,
    orderBy: { name: 'asc' },
  });

  let related = sameCategory;
  if (related.length < RELATED_COMMODITIES_COUNT) {
    // Small categories (e.g. FRUITS has one item) are topped up with other commodities.
    const fillers = await prisma.commodity.findMany({
      where: { id: { notIn: [commodity.id, ...related.map((item) => item.id)] } },
      orderBy: { name: 'asc' },
      take: RELATED_COMMODITIES_COUNT - related.length,
    });
    related = [...related, ...fillers];
  }
  return buildCards(related);
}
