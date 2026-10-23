// Mock visitor sessions and analytics events for the last 60 days.
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { createRandom, type Random } from './random';

const DAYS = 60;
const TARGET_SESSIONS = 350;
const MAX_SESSION_MINUTES = 30;
const SEARCH_CHANCE = 0.27; // about 95 searches over 350 sessions

const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 13; TECNO KG5) Chrome/120 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; Infinix X669) Chrome/119 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
];

const OTHER_PATHS = ['/', '/commodities', '/how-it-works', '/feedback'];
const OTHER_PATH_WEIGHTS = [5, 3, 1, 0.5];
const SEARCH_TERMS = [
  'tomato',
  'rice',
  'beans',
  'yam',
  'garri',
  'onion',
  'oil',
  'eggs',
  'pepper',
  'chicken',
  'sugar',
  'fish',
];

// How many commodity pages / other pages a session views (index = count)
const COMMODITY_VIEW_WEIGHTS = [0.15, 0.25, 0.22, 0.15, 0.1, 0.08, 0.05];
const OTHER_VIEW_WEIGHTS = [0.15, 0.4, 0.25, 0.12, 0.08];
// Evening and early-morning peaks (hour of day, UTC), index 0 = 05:00
const HOUR_WEIGHTS = [1, 3, 4, 3, 2, 2, 2, 2, 2, 3, 4, 5, 5, 4, 3, 2, 1, 1];
const FIRST_HOUR = 5;

export interface SeededSession {
  id: string;
  firstSeenAt: Date;
}

export interface CommodityRef {
  id: number;
  slug: string;
}

/** Sessions per day: busier on weekdays, growing over time. */
function sessionsPerDay(now: Date): { date: Date; count: number }[] {
  const raw = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (DAYS - 1 - index)),
    );
    const weekday = date.getUTCDay();
    const weekendFactor = weekday === 0 ? 0.65 : weekday === 6 ? 0.7 : 1.15;
    return { date, weight: (15 + (20 * index) / (DAYS - 1)) * weekendFactor };
  });
  const totalWeight = raw.reduce((sum, day) => sum + day.weight, 0);
  return raw.map((day) => ({
    date: day.date,
    count: Math.round((day.weight / totalWeight) * TARGET_SESSIONS),
  }));
}

/** Random moment on a given day, weighted toward busy hours. */
function randomMomentOn(date: Date, random: Random): Date {
  const hours = Array.from({ length: HOUR_WEIGHTS.length }, (_, i) => FIRST_HOUR + i);
  const hour = random.weighted(hours, HOUR_WEIGHTS);
  return new Date(
    date.getTime() + hour * 3_600_000 + random.int(0, 59) * 60_000 + random.int(0, 59) * 1000,
  );
}

/** Commodity pick with extra weight for tomato, rice and beans. */
export function pickCommodity(commodities: CommodityRef[], random: Random): CommodityRef {
  const popular = ['tomato', 'rice-local', 'beans-brown'];
  const weights = commodities.map((item) => (popular.includes(item.slug) ? 8 : 1));
  return random.weighted(commodities, weights);
}

export function buildSessionsAndEvents(now: Date, commodities: CommodityRef[]) {
  const random = createRandom(7001);
  const sessions: Prisma.VisitorSessionCreateManyInput[] = [];
  const events: Prisma.AnalyticsEventCreateManyInput[] = [];
  const seeded: SeededSession[] = [];

  for (const day of sessionsPerDay(now)) {
    for (let i = 0; i < day.count; i++) {
      const sessionId = randomUUID();
      const firstSeenAt = randomMomentOn(day.date, random);
      if (firstSeenAt > now) continue;
      const lastSeenAt = new Date(
        Math.min(
          now.getTime(),
          firstSeenAt.getTime() + random.int(0, MAX_SESSION_MINUTES) * 60_000,
        ),
      );
      sessions.push({
        id: sessionId,
        firstSeenAt,
        lastSeenAt,
        userAgent: random.pick(USER_AGENTS),
      });
      seeded.push({ id: sessionId, firstSeenAt });

      // Spread this session's events over its visit, in order
      const duration = Math.max(lastSeenAt.getTime() - firstSeenAt.getTime(), 1000);
      let step = 0;
      const timeOf = () =>
        new Date(
          firstSeenAt.getTime() + Math.min(duration, step++ * Math.max(duration / 10, 1000)),
        );

      const otherViews = random.weighted([0, 1, 2, 3, 4], OTHER_VIEW_WEIGHTS);
      for (let v = 0; v < otherViews; v++) {
        events.push({
          sessionId,
          type: 'PAGE_VIEW',
          path: random.weighted(OTHER_PATHS, OTHER_PATH_WEIGHTS),
          createdAt: timeOf(),
        });
      }
      if (random.chance(SEARCH_CHANCE)) {
        const term = random.pick(SEARCH_TERMS);
        events.push({
          sessionId,
          type: 'SEARCH',
          path: '/',
          metadata: { query: term },
          createdAt: timeOf(),
        });
      }
      const commodityViews = random.weighted([0, 1, 2, 3, 4, 5, 6], COMMODITY_VIEW_WEIGHTS);
      for (let v = 0; v < commodityViews; v++) {
        const commodity = pickCommodity(commodities, random);
        const path = `/commodities/${commodity.slug}`;
        const createdAt = timeOf();
        // Opening a commodity page counts as both a page view and a commodity view
        events.push({ sessionId, type: 'PAGE_VIEW', path, commodityId: commodity.id, createdAt });
        events.push({
          sessionId,
          type: 'COMMODITY_VIEW',
          path,
          commodityId: commodity.id,
          createdAt,
        });
      }
    }
  }
  return { sessions, events, seeded };
}
