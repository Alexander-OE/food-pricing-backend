// Business logic for data health: freshness, refresh logs and manual refreshes.
import type { DataRefreshLog, RefreshType } from '@prisma/client';
import { addMonths, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { runMonthlyPipeline, runPipelineStep } from '../../ml-services/pipeline/runMonthlyPipeline';
import type { RefreshBody, RefreshLogsQuery } from './admin.schemas';

const REFRESH_TYPES: RefreshType[] = ['NBS_PRICES', 'MACRO_FEATURES', 'ACCURACY', 'PREDICTIONS'];

function toLogDto(log: DataRefreshLog) {
  return {
    id: log.id,
    type: log.type,
    status: log.status,
    trigger: log.trigger,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    recordsProcessed: log.recordsProcessed,
    dataPeriod: log.dataPeriod ? toPeriodString(log.dataPeriod) : null,
    errorMessage: log.errorMessage,
  };
}

function currentMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Freshness of each refresh type. */
export async function getDataStatus(now: Date = new Date()) {
  return Promise.all(
    REFRESH_TYPES.map(async (type) => {
      const [lastSuccess, lastAttempt] = await Promise.all([
        prisma.dataRefreshLog.findFirst({
          where: { type, status: 'SUCCESS' },
          orderBy: { startedAt: 'desc' },
        }),
        prisma.dataRefreshLog.findFirst({ where: { type }, orderBy: { startedAt: 'desc' } }),
      ]);
      // Prices, indicators and accuracy should reach last month; forecasts this month or later.
      const expected =
        type === 'PREDICTIONS' ? currentMonthStart(now) : addMonths(currentMonthStart(now), -1);
      const latestPeriod = lastSuccess?.dataPeriod ?? null;
      return {
        type,
        lastSuccessAt: lastSuccess?.finishedAt ?? null,
        lastAttemptAt: lastAttempt?.startedAt ?? null,
        status: lastAttempt?.status ?? null,
        latestDataPeriod: latestPeriod ? toPeriodString(latestPeriod) : null,
        isFresh: latestPeriod ? latestPeriod >= expected : false,
        lastError: lastAttempt?.status === 'FAILED' ? lastAttempt.errorMessage : null,
      };
    }),
  );
}

export async function getRefreshLogs(query: RefreshLogsQuery) {
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [logs, total] = await Promise.all([
    prisma.dataRefreshLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.dataRefreshLog.count({ where }),
  ]);
  return { items: logs.map(toLogDto), total };
}

/** Runs one step, or the whole pipeline, on an admin's request. */
export async function triggerRefresh(body: RefreshBody) {
  const logs =
    body.type === 'ALL'
      ? await runMonthlyPipeline('manual')
      : [await runPipelineStep(body.type, 'manual')];
  return logs.map(toLogDto);
}
