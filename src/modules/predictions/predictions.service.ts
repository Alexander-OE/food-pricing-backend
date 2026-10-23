// Business logic for predictions: reading forecasts and their accuracy records.
import type { Prediction } from '@prisma/client';
import { toNumber, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';

export interface TrackRecord {
  targetPeriod: string;
  predictedPrice: number;
  actualPrice: number;
  percentError: number;
  directionHit: boolean;
}

/** The current (ACTIVE) prediction for each commodity, keyed by commodity id. */
export async function getActivePredictions(
  commodityIds?: number[],
): Promise<Map<number, Prediction>> {
  const predictions = await prisma.prediction.findMany({
    where: { status: 'ACTIVE', ...(commodityIds ? { commodityId: { in: commodityIds } } : {}) },
    orderBy: { targetPeriod: 'asc' }, // if there are ever two, the latest wins when mapped
  });
  return new Map(predictions.map((prediction) => [prediction.commodityId, prediction]));
}

/** Predicted vs actual for the latest scored month. */
export async function getLastMonthTrackRecord(commodityId: number): Promise<TrackRecord | null> {
  const [latest] = await getTrackRecords(commodityId, 1);
  return latest ?? null;
}

/** Latest scored predictions for a commodity, oldest first. */
export async function getTrackRecords(commodityId: number, months: number): Promise<TrackRecord[]> {
  const rows = await prisma.predictionAccuracy.findMany({
    where: { prediction: { commodityId } },
    include: { prediction: true },
    orderBy: { prediction: { targetPeriod: 'desc' } },
    take: months,
  });
  return rows.reverse().map((row) => ({
    targetPeriod: toPeriodString(row.prediction.targetPeriod),
    predictedPrice: toNumber(row.prediction.predictedPrice),
    actualPrice: toNumber(row.actualPrice),
    percentError: Math.round(row.percentError * 10) / 10,
    directionHit: row.directionHit,
  }));
}
