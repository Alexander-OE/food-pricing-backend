// Business logic for forecast accuracy: error rates over time and per commodity.
import { addMonths, round, toNumber, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';

interface ScoredRow {
  percentError: number;
  directionHit: boolean;
}

/** MAPE is the average percent error; hit rate is the share of direction calls that were right. */
export function summarise(rows: ScoredRow[]): {
  mape: number;
  directionHitRate: number;
  count: number;
} {
  const count = rows.length || 1;
  return {
    mape: round(rows.reduce((sum, row) => sum + row.percentError, 0) / count, 1),
    directionHitRate: round((rows.filter((row) => row.directionHit).length / count) * 100, 1),
    count: rows.length,
  };
}

async function getLatestScoredPeriod(): Promise<Date | null> {
  const latest = await prisma.prediction.findFirst({
    where: { accuracy: { isNot: null } },
    orderBy: { targetPeriod: 'desc' },
    select: { targetPeriod: true },
  });
  return latest?.targetPeriod ?? null;
}

/** Accuracy over the most recent N scored months. */
export async function getRecentAccuracy(months: number) {
  const latest = await getLatestScoredPeriod();
  if (!latest) return { mape: 0, directionHitRate: 0, count: 0 };
  const rows = await prisma.predictionAccuracy.findMany({
    where: { prediction: { targetPeriod: { gte: addMonths(latest, -(months - 1)) } } },
  });
  return summarise(rows);
}

export async function getAccuracyReport(months: number) {
  const latest = await getLatestScoredPeriod();
  if (!latest) return { monthly: [], perCommodity: [], best: [], worst: [], latestMonth: [] };

  const rows = await prisma.predictionAccuracy.findMany({
    where: { prediction: { targetPeriod: { gte: addMonths(latest, -(months - 1)) } } },
    include: { prediction: { include: { commodity: { select: { name: true, slug: true } } } } },
  });

  const byMonth = new Map<string, typeof rows>();
  const byCommodity = new Map<string, typeof rows>();
  for (const row of rows) {
    const monthKey = toPeriodString(row.prediction.targetPeriod);
    byMonth.set(monthKey, [...(byMonth.get(monthKey) ?? []), row]);
    const slug = row.prediction.commodity.slug;
    byCommodity.set(slug, [...(byCommodity.get(slug) ?? []), row]);
  }

  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, group]) => ({ period, ...summarise(group) }));

  const perCommodity = [...byCommodity.entries()]
    .map(([slug, group]) => ({
      slug,
      name: group[0].prediction.commodity.name,
      ...summarise(group),
    }))
    .sort((a, b) => a.mape - b.mape); // lowest error first

  const latestMonth = (byMonth.get(toPeriodString(latest)) ?? []).map((row) => ({
    slug: row.prediction.commodity.slug,
    name: row.prediction.commodity.name,
    predictedPrice: toNumber(row.prediction.predictedPrice),
    actualPrice: toNumber(row.actualPrice),
    percentError: round(row.percentError, 1),
    directionHit: row.directionHit,
  }));

  return {
    monthly,
    perCommodity,
    best: perCommodity.slice(0, 3),
    worst: perCommodity.slice(-3).reverse(),
    latestMonth,
  };
}
