// Pipeline step 1: loads monthly commodity prices, adding only rows that are missing.
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { readPriceFile } from './mlData';
import type { StepResult } from './logStep';

/** Latest month with price data, or null if there is none. */
export async function getLatestPricePeriod(): Promise<Date | null> {
  const result = await prisma.priceRecord.aggregate({ _max: { period: true } });
  return result._max.period;
}

export async function ingestPrices(): Promise<StepResult> {
  if (env.DATA_SOURCE !== 'mock') {
    // "nbs" is reserved for the real feed, so fail clearly for now.
    throw new Error('The NBS data source is not connected yet. Set DATA_SOURCE=mock.');
  }

  const commodities = await prisma.commodity.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(commodities.map((commodity) => [commodity.slug, commodity.id]));

  // Skip (commodity, month) rows that already exist.
  const existing = await prisma.priceRecord.findMany({
    select: { commodityId: true, period: true },
  });
  const existingKeys = new Set(
    existing.map((row) => `${row.commodityId}|${row.period.toISOString()}`),
  );

  const newRows = readPriceFile().flatMap((row) => {
    const commodityId = idBySlug.get(row.commoditySlug);
    if (commodityId === undefined || existingKeys.has(`${commodityId}|${row.period.toISOString()}`))
      return [];
    return [{ commodityId, period: row.period, price: row.price, source: 'MOCK' as const }];
  });

  if (newRows.length > 0)
    await prisma.priceRecord.createMany({ data: newRows, skipDuplicates: true });
  return { recordsProcessed: newRows.length, dataPeriod: await getLatestPricePeriod() };
}
