// The contract every forecasting model follows, so swapping models never touches the routes.
import type { IndicatorKey } from '@prisma/client';
import type { PredictionFactor } from '../../types';

export interface ForecastInput {
  commoditySlug: string;
  basePeriod: string; // "2026-05-01"
  targetPeriod: string; // "2026-06-01"
  priceHistory: { period: string; price: number }[]; // last 36 months, oldest first
  indicators: Record<IndicatorKey, { period: string; value: number }[]>; // oldest first
}

export interface ForecastOutput {
  commoditySlug: string;
  targetPeriod: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0 to 1
  factors: PredictionFactor[]; // top 3 to 4
  modelVersion: string;
}

export interface ModelProvider {
  name: string;
  forecast(inputs: ForecastInput[]): Promise<ForecastOutput[]>;
}
