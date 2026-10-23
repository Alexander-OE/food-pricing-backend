// Pipeline step 3: scores past predictions against the real price once it is known.
import { calculatePercentChange, classifyDirection, toNumber } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import type { StepResult } from './logStep';

export async function evaluateAccuracy(): Promise<StepResult> {
  const pending = await prisma.prediction.findMany({ where: { accuracy: null } });
  const targetPeriods = [
    ...new Set(pending.map((prediction) => prediction.targetPeriod.getTime())),
  ].map((time) => new Date(time));
  const actuals = await prisma.priceRecord.findMany({ where: { period: { in: targetPeriods } } });
  const actualByKey = new Map(
    actuals.map((row) => [`${row.commodityId}|${row.period.getTime()}`, toNumber(row.price)]),
  );

  const rows = pending.flatMap((prediction) => {
    const actualPrice = actualByKey.get(
      `${prediction.commodityId}|${prediction.targetPeriod.getTime()}`,
    );
    if (actualPrice === undefined) return []; // actual price not published yet
    const predictedPrice = toNumber(prediction.predictedPrice);
    const currentPrice = toNumber(prediction.currentPrice);
    const absoluteError = Math.abs(predictedPrice - actualPrice);
    const actualDirection = classifyDirection(calculatePercentChange(currentPrice, actualPrice));
    return [
      {
        predictionId: prediction.id,
        actualPrice,
        absoluteError,
        // Absolute percent error: error as a share of the actual price.
        percentError: (absoluteError / actualPrice) * 100,
        // A direction hit means UP, DOWN or STABLE was called correctly.
        directionHit: actualDirection === prediction.direction,
      },
    ];
  });

  if (rows.length > 0)
    await prisma.predictionAccuracy.createMany({ data: rows, skipDuplicates: true });

  // Report the latest scored month so admins can see how current accuracy is.
  const latestScored = await prisma.prediction.findFirst({
    where: { accuracy: { isNot: null } },
    orderBy: { targetPeriod: 'desc' },
    select: { targetPeriod: true },
  });
  return { recordsProcessed: rows.length, dataPeriod: latestScored?.targetPeriod ?? null };
}
