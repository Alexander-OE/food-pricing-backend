// Pipeline step 4: builds model inputs, runs the model and saves the predictions.
import type { IndicatorKey, Prisma } from '@prisma/client';
import { MODEL_HISTORY_MONTHS } from '../../constants';
import {
  addMonths,
  calculatePercentChange,
  classifyDirection,
  toNumber,
  toPeriodString,
} from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { buildExplanation } from '../explanation';
import { forecastWithFallback } from '../model';
import type { ForecastInput } from '../model/ModelProvider';
import { getLatestPricePeriod } from './ingestPrices';
import type { StepResult } from './logStep';

const INDICATOR_KEYS: IndicatorKey[] = [
  'USD_NGN',
  'DIESEL_PRICE',
  'PETROL_PRICE',
  'HEADLINE_INFLATION',
  'FOOD_INFLATION',
  'RAINFALL_INDEX',
  'SUPPLY_INDEX',
];

/** Collects recent prices and indicators up to basePeriod (inclusive). */
async function buildForecastInputs(basePeriod: Date): Promise<ForecastInput[]> {
  const firstPeriod = addMonths(basePeriod, -(MODEL_HISTORY_MONTHS - 1));
  const targetPeriod = addMonths(basePeriod, 1);

  const [commodities, prices, indicators] = await Promise.all([
    prisma.commodity.findMany({ orderBy: { id: 'asc' } }),
    prisma.priceRecord.findMany({
      where: { period: { gte: firstPeriod, lte: basePeriod } },
      orderBy: { period: 'asc' },
    }),
    prisma.macroIndicator.findMany({
      where: { period: { gte: firstPeriod, lte: basePeriod } },
      orderBy: { period: 'asc' },
    }),
  ]);

  // Indicators are the same for every commodity, so build them once
  const indicatorSeries = Object.fromEntries(
    INDICATOR_KEYS.map((key) => [key, [] as { period: string; value: number }[]]),
  );
  for (const row of indicators) {
    indicatorSeries[row.key].push({ period: toPeriodString(row.period), value: row.value });
  }

  return commodities.map((commodity) => ({
    commoditySlug: commodity.slug,
    basePeriod: toPeriodString(basePeriod),
    targetPeriod: toPeriodString(targetPeriod),
    priceHistory: prices
      .filter((row) => row.commodityId === commodity.id)
      .map((row) => ({ period: toPeriodString(row.period), price: toNumber(row.price) })),
    indicators: indicatorSeries as ForecastInput['indicators'],
  }));
}

/** Predicts the month after basePeriod using only data up to it, which keeps back-testing honest. */
export async function generatePredictionsForPeriod(basePeriod: Date): Promise<number> {
  const inputs = await buildForecastInputs(basePeriod);
  const outputs = await forecastWithFallback(
    inputs.filter((input) => input.priceHistory.length > 0),
  );
  const targetPeriod = addMonths(basePeriod, 1);

  const commodities = await prisma.commodity.findMany();
  const commodityBySlug = new Map(commodities.map((commodity) => [commodity.slug, commodity]));
  const inputBySlug = new Map(inputs.map((input) => [input.commoditySlug, input]));

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  for (const output of outputs) {
    const commodity = commodityBySlug.get(output.commoditySlug);
    const input = inputBySlug.get(output.commoditySlug);
    if (!commodity || !input) continue;

    const currentPrice = input.priceHistory[input.priceHistory.length - 1].price;
    // The backend, not the model, derives change and direction so the rules stay consistent.
    const percentChange = calculatePercentChange(currentPrice, output.predictedPrice);
    const direction = classifyDirection(percentChange);
    const data = {
      basePeriod,
      currentPrice,
      predictedPrice: output.predictedPrice,
      lowerBound: output.lowerBound,
      upperBound: output.upperBound,
      percentChange,
      direction,
      confidence: output.confidence,
      factors: output.factors as unknown as Prisma.InputJsonValue,
      explanation: buildExplanation(commodity.name, percentChange, direction, output.factors),
      modelVersion: output.modelVersion,
      status: 'ACTIVE' as const,
    };
    operations.push(
      prisma.prediction.upsert({
        where: { commodityId_targetPeriod: { commodityId: commodity.id, targetPeriod } },
        create: { commodityId: commodity.id, targetPeriod, ...data },
        update: data,
      }),
      // Older predictions for this commodity are superseded.
      prisma.prediction.updateMany({
        where: { commodityId: commodity.id, targetPeriod: { lt: targetPeriod }, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      }),
    );
  }

  await prisma.$transaction(operations);
  return outputs.length;
}

/** Predicts the month after the latest month with data. */
export async function generatePredictions(): Promise<StepResult> {
  const latest = await getLatestPricePeriod();
  if (!latest) throw new Error('No price data available to predict from');
  const count = await generatePredictionsForPeriod(latest);
  return { recordsProcessed: count, dataPeriod: addMonths(latest, 1) };
}
