// Runs a pipeline step and records it in DataRefreshLog as RUNNING, then SUCCESS or FAILED.
import type { DataRefreshLog, RefreshType } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export interface StepResult {
  recordsProcessed: number;
  dataPeriod?: Date | null;
}

/** A failing step is logged as FAILED and never crashes the server. */
export async function runLoggedStep(
  type: RefreshType,
  trigger: string,
  step: () => Promise<StepResult>,
): Promise<DataRefreshLog> {
  const log = await prisma.dataRefreshLog.create({ data: { type, status: 'RUNNING', trigger } });
  try {
    const result = await step();
    return await prisma.dataRefreshLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
        dataPeriod: result.dataPeriod ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, type }, 'Pipeline step failed');
    return prisma.dataRefreshLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
