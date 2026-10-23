// Pipeline step 2: loads monthly market indicators into the database.
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { readIndicatorFile } from './mlData';
import type { StepResult } from './logStep';

export async function ingestIndicators(): Promise<StepResult> {
  if (env.DATA_SOURCE !== 'mock') {
    throw new Error('The NBS data source is not connected yet. Set DATA_SOURCE=mock.');
  }

  const existing = await prisma.macroIndicator.findMany({ select: { key: true, period: true } });
  const existingKeys = new Set(existing.map((row) => `${row.key}|${row.period.toISOString()}`));

  const newRows = readIndicatorFile().filter(
    (row) => !existingKeys.has(`${row.key}|${row.period.toISOString()}`),
  );
  if (newRows.length > 0)
    await prisma.macroIndicator.createMany({ data: newRows, skipDuplicates: true });

  const latest = await prisma.macroIndicator.aggregate({ _max: { period: true } });
  return { recordsProcessed: newRows.length, dataPeriod: latest._max.period };
}
