// Business logic for admin usage analytics: visitors, views, chats and commodity rankings.
import { MS_PER_DAY } from '../../constants';
import { daysAgo } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import type { RangeQuery } from './admin.schemas';

const RANGE_DAYS: Record<RangeQuery['range'], number> = { '7d': 7, '30d': 30, '90d': 90 };

export function rangeToDays(range: RangeQuery['range']): number {
  return RANGE_DAYS[range];
}

interface DailyRow {
  day: string;
  type: string;
  visitors: bigint;
  total: bigint;
}

/** Counts visitors: distinct sessions with at least one event. */
export async function countVisitors(from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(DISTINCT "sessionId") AS total FROM "AnalyticsEvent" WHERE "createdAt" >= ${from} AND "createdAt" < ${to}`;
  return Number(rows[0]?.total ?? 0);
}

/** One row per day with visitors, page views, commodity views and chats. */
export async function getUsage(range: RangeQuery['range']) {
  const days = rangeToDays(range);
  const start = daysAgo(days - 1);

  const [eventRows, visitorRows, chatRows] = await Promise.all([
    prisma.$queryRaw<DailyRow[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, type, 0 AS visitors, COUNT(*) AS total
      FROM "AnalyticsEvent" WHERE "createdAt" >= ${start} GROUP BY day, type`,
    prisma.$queryRaw<{ day: string; visitors: bigint }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(DISTINCT "sessionId") AS visitors
      FROM "AnalyticsEvent" WHERE "createdAt" >= ${start} GROUP BY day`,
    prisma.$queryRaw<{ day: string; total: bigint }[]>`
      SELECT to_char("startedAt", 'YYYY-MM-DD') AS day, COUNT(*) AS total
      FROM "ChatConversation" WHERE "startedAt" >= ${start} GROUP BY day`,
  ]);

  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * MS_PER_DAY).toISOString().slice(0, 10);
    const countFor = (type: string) =>
      Number(eventRows.find((row) => row.day === date && row.type === type)?.total ?? 0);
    return {
      date,
      visitors: Number(visitorRows.find((row) => row.day === date)?.visitors ?? 0),
      pageViews: countFor('PAGE_VIEW'),
      commodityViews: countFor('COMMODITY_VIEW'),
      chats: Number(chatRows.find((row) => row.day === date)?.total ?? 0),
    };
  });
  return { range, series };
}

/** Commodities ranked by views, with their chat counts. */
export async function getCommodityRanking(range: RangeQuery['range']) {
  const start = daysAgo(rangeToDays(range) - 1);
  const [views, chats, commodities] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['commodityId'],
      where: { type: 'COMMODITY_VIEW', createdAt: { gte: start }, commodityId: { not: null } },
      _count: { _all: true },
    }),
    prisma.chatConversation.groupBy({
      by: ['commodityId'],
      where: { startedAt: { gte: start } },
      _count: { _all: true },
    }),
    prisma.commodity.findMany({ select: { id: true, name: true, slug: true } }),
  ]);

  return commodities
    .map((commodity) => ({
      slug: commodity.slug,
      name: commodity.name,
      views: views.find((row) => row.commodityId === commodity.id)?._count._all ?? 0,
      chats: chats.find((row) => row.commodityId === commodity.id)?._count._all ?? 0,
    }))
    .sort((a, b) => b.views - a.views);
}
