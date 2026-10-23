// Mock pipeline history: monthly runs, daily indicator runs and a few failures.
import type { Prisma, RefreshType } from '@prisma/client';
import { addMonths } from '../../src/lib/format';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MONTHLY_RUN_DAY = 16;
const RUN_HOUR_UTC = 6; // 07:00 Lagos
const MONTHS_OF_HISTORY = 12;
const DAILY_MACRO_DAYS = 30;
const MONTHLY_TYPES: RefreshType[] = ['NBS_PRICES', 'MACRO_FEATURES', 'ACCURACY', 'PREDICTIONS'];
const FAILURE_MESSAGE = 'NBS endpoint timeout after 30000ms';

interface LogRow {
  type: RefreshType;
  status: 'SUCCESS' | 'FAILED';
  trigger: string;
  startedAt: Date;
  finishedAt: Date;
  recordsProcessed: number;
  dataPeriod: Date | null;
  errorMessage: string | null;
}

/** One finished log row; failures carry an error message. */
function makeRow(
  type: RefreshType,
  startedAt: Date,
  dataPeriod: Date,
  failed: boolean,
  recordsProcessed: number,
): LogRow {
  return {
    type,
    status: failed ? 'FAILED' : 'SUCCESS',
    trigger: 'cron',
    startedAt,
    finishedAt: new Date(startedAt.getTime() + (failed ? 30_000 : 4_000)),
    recordsProcessed: failed ? 0 : recordsProcessed,
    dataPeriod: failed ? null : dataPeriod,
    errorMessage: failed ? FAILURE_MESSAGE : null,
  };
}

/** Records processed per monthly step. */
const MONTHLY_RECORDS: Record<RefreshType, number> = {
  NBS_PRICES: 25,
  MACRO_FEATURES: 7,
  ACCURACY: 25,
  PREDICTIONS: 25,
};

/** Builds the log rows without claiming data newer than latestDataPeriod. */
export function buildRefreshLogs(
  now: Date,
  latestDataPeriod: Date,
): Prisma.DataRefreshLogCreateManyInput[] {
  const rows: LogRow[] = [];

  // The most recent monthly run is this month's 16th if it has passed, otherwise last month's
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const latestRunMonth = now.getUTCDate() >= MONTHLY_RUN_DAY ? thisMonth : addMonths(thisMonth, -1);

  for (let back = 0; back < MONTHS_OF_HISTORY; back++) {
    const runMonth = addMonths(latestRunMonth, -back);
    const runAt = new Date(
      Date.UTC(runMonth.getUTCFullYear(), runMonth.getUTCMonth(), MONTHLY_RUN_DAY, RUN_HOUR_UTC),
    );
    const published = addMonths(runMonth, -1); // NBS publishes last month's prices mid-month
    const clampedPublished = published > latestDataPeriod ? latestDataPeriod : published;

    for (const type of MONTHLY_TYPES) {
      const period = type === 'PREDICTIONS' ? addMonths(clampedPublished, 1) : clampedPublished;
      // Two historic NBS timeouts: failed on the 16th, successful retry the next day
      const failedFirst = type === 'NBS_PRICES' && (back === 2 || back === 6);
      if (failedFirst) {
        rows.push(makeRow(type, runAt, period, true, 0));
        rows.push(
          makeRow(
            type,
            new Date(runAt.getTime() + MS_PER_DAY),
            period,
            false,
            MONTHLY_RECORDS[type],
          ),
        );
      } else {
        rows.push(makeRow(type, runAt, period, false, MONTHLY_RECORDS[type]));
      }
    }
  }

  // Daily indicator refreshes for 30 days, with one failure and a retry.
  for (let back = 0; back < DAILY_MACRO_DAYS; back++) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, RUN_HOUR_UTC),
    );
    if (day > now) continue; // today's 06:00 run has not happened yet
    if (back === 11) {
      rows.push(makeRow('MACRO_FEATURES', day, latestDataPeriod, true, 0));
      rows.push(
        makeRow(
          'MACRO_FEATURES',
          new Date(day.getTime() + MS_PER_HOUR),
          latestDataPeriod,
          false,
          0,
        ),
      );
    } else {
      rows.push(makeRow('MACRO_FEATURES', day, latestDataPeriod, false, 0));
    }
  }

  return rows;
}
