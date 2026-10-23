// Business logic for data status: latest data month, refresh times and model version.
import { MONTHLY_PIPELINE_CRON, NBS_PUBLISH_DAY } from '../../constants';
import { env } from '../../config/env';
import { addMonths, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { getLatestPricePeriod } from '../../ml-services/pipeline/ingestPrices';

/** Next 16th at 07:00 Lagos time (06:00 UTC, as Lagos has no daylight saving). */
export function getNextScheduledRefresh(now: Date = new Date()): Date {
  const thisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), NBS_PUBLISH_DAY, 6, 0, 0),
  );
  if (thisMonth > now) return thisMonth;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, NBS_PUBLISH_DAY, 6, 0, 0));
}

export async function getDataStatus() {
  const [latest, lastSuccess, prediction] = await Promise.all([
    getLatestPricePeriod(),
    prisma.dataRefreshLog.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.prediction.findFirst({ where: { status: 'ACTIVE' }, orderBy: { targetPeriod: 'desc' } }),
  ]);

  return {
    latestDataPeriod: latest ? toPeriodString(latest) : null,
    forecastPeriod: latest ? toPeriodString(addMonths(latest, 1)) : null,
    lastSuccessfulRefresh: lastSuccess?.finishedAt ?? null,
    nextScheduledRefresh: getNextScheduledRefresh().toISOString(),
    scheduleDescription: `Monthly pipeline cron "${MONTHLY_PIPELINE_CRON}" (Africa/Lagos)`,
    modelVersion: prediction?.modelVersion ?? null,
    dataSource: env.DATA_SOURCE,
    dataSourceLabel:
      env.DATA_SOURCE === 'mock'
        ? 'Simulated data modelled on the NBS monthly format'
        : 'National Bureau of Statistics',
  };
}
