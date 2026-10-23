// Business logic for the admin overview cards.
import type { RefreshType } from '@prisma/client';
import { MS_PER_DAY, OVERVIEW_ACCURACY_MONTHS } from '../../constants';
import { calculatePercentChange, daysAgo, round } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { getRecentAccuracy } from './admin.accuracy.service';
import { countVisitors } from './admin.analytics.service';

const OVERVIEW_TYPES: RefreshType[] = ['NBS_PRICES', 'MACRO_FEATURES', 'ACCURACY', 'PREDICTIONS'];
const WEEK = 7;
const MONTH = 30;

/** Visitors in the last N days, compared with the N days before. */
async function visitorsWithChange(days: number, now: Date) {
  const currentStart = daysAgo(days - 1, now);
  const previousStart = new Date(currentStart.getTime() - days * MS_PER_DAY);
  const end = new Date(now.getTime() + 1);
  const [current, previous] = await Promise.all([
    countVisitors(currentStart, end),
    countVisitors(previousStart, currentStart),
  ]);
  return { value: current, previous, changePercent: calculatePercentChange(previous, current) };
}

export async function getOverview() {
  const now = new Date();
  const monthStart = daysAgo(MONTH - 1, now);
  const previousMonthStart = new Date(monthStart.getTime() - MONTH * MS_PER_DAY);

  const [
    today,
    week,
    month,
    pageViews,
    pageViewsPrevious,
    commodityViews,
    conversations,
    newFeedback,
    accuracy,
    refreshes,
  ] = await Promise.all([
    visitorsWithChange(1, now),
    visitorsWithChange(WEEK, now),
    visitorsWithChange(MONTH, now),
    prisma.analyticsEvent.count({ where: { type: 'PAGE_VIEW', createdAt: { gte: monthStart } } }),
    prisma.analyticsEvent.count({
      where: { type: 'PAGE_VIEW', createdAt: { gte: previousMonthStart, lt: monthStart } },
    }),
    prisma.analyticsEvent.count({
      where: { type: 'COMMODITY_VIEW', createdAt: { gte: monthStart } },
    }),
    prisma.chatConversation.findMany({
      where: { startedAt: { gte: monthStart } },
      select: { messageCount: true },
    }),
    prisma.feedback.count({ where: { status: 'NEW' } }),
    getRecentAccuracy(OVERVIEW_ACCURACY_MONTHS),
    Promise.all(
      OVERVIEW_TYPES.map((type) =>
        prisma.dataRefreshLog.findFirst({ where: { type }, orderBy: { startedAt: 'desc' } }),
      ),
    ),
  ]);

  const messageTotal = conversations.reduce(
    (sum, conversation) => sum + conversation.messageCount,
    0,
  );

  return {
    visitors: { today, last7Days: week, last30Days: month },
    pageViews30d: {
      value: pageViews,
      changePercent: calculatePercentChange(pageViewsPrevious, pageViews),
    },
    commodityViews30d: commodityViews,
    chats30d: conversations.length,
    averageMessagesPerChat: round(messageTotal / (conversations.length || 1), 1),
    newFeedbackCount: newFeedback,
    accuracy: {
      mape: accuracy.mape,
      directionHitRate: accuracy.directionHitRate,
      months: OVERVIEW_ACCURACY_MONTHS,
    },
    lastRefreshes: refreshes
      .filter((log): log is NonNullable<typeof log> => log !== null)
      .map((log) => ({
        type: log.type,
        status: log.status,
        at: log.finishedAt ?? log.startedAt,
        errorMessage: log.errorMessage,
      })),
  };
}
