// Built-in forecaster: price trend, seasonality and macro adjustments.
import { linearRegression, mean, standardDeviation } from 'simple-statistics';
import sensitivityFile from '../../../ml-data/commodity_sensitivities.json';
import {
  INTERVAL_Z_SCORE,
  LOCAL_MODEL_VERSION,
  MACRO_LOOKBACK_MONTHS,
  MACRO_PASS_THROUGH,
  MAX_CONFIDENCE,
  MAX_FACTORS,
  MAX_FACTOR_IMPACT_PERCENT,
  MIN_CONFIDENCE,
  MIN_FACTORS,
  MIN_FACTOR_IMPACT_PERCENT,
  SUPPLY_PASS_THROUGH,
  TREND_WINDOW_MONTHS,
  WIDE_BAND_RATIO,
} from '../../constants';
import { round } from '../../lib/format';
import type { PredictionFactor, Sensitivity } from '../../types';
import { factorDetail } from '../explanation';
import type { ForecastInput, ForecastOutput, ModelProvider } from './ModelProvider';

const SENSITIVITIES = sensitivityFile as Record<string, Sensitivity>;
const NEUTRAL_SENSITIVITY: Sensitivity = {
  fx: 0.3,
  diesel: 0.3,
  seasonality: 0.3,
  supply: 0.3,
  inflation: 0.3,
};

const FACTOR_LABELS: Record<string, string> = {
  TREND: 'Recent price trend',
  SEASONALITY: 'Seasonal pattern',
  DIESEL_PRICE: 'Diesel and transport costs',
  FX_RATE: 'Exchange rate (naira vs dollar)',
  SUPPLY: 'Food supply',
};

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/** Recent percent change of an indicator, 0 without enough data. */
function recentChangePercent(series: { value: number }[] | undefined): number {
  if (!series || series.length <= MACRO_LOOKBACK_MONTHS) return 0;
  const latest = series[series.length - 1].value;
  const earlier = series[series.length - 1 - MACRO_LOOKBACK_MONTHS].value;
  return earlier === 0 ? 0 : ((latest - earlier) / earlier) * 100;
}

/** Step 2: monthly growth from a straight-line fit on log prices, plus the fit's spread. */
function fitTrend(prices: number[]): { monthlyGrowthPercent: number; residualSd: number } {
  const window = prices.slice(-TREND_WINDOW_MONTHS);
  // Log prices turn constant percentage growth into a straight line
  const points = window.map((price, index) => [index, Math.log(price)] as [number, number]);
  const { m: slope, b: intercept } = linearRegression(points);
  const residuals = points.map(([x, y]) => y - (slope * x + intercept));
  return {
    monthlyGrowthPercent: (Math.exp(slope) - 1) * 100,
    residualSd: standardDeviation(residuals),
  };
}

/** Step 3: how the target month usually differs from an average month (ignores inflation). */
function seasonalPercent(input: ForecastInput, sensitivity: number): number {
  const history = input.priceHistory;
  const targetMonth = Number(input.targetPeriod.slice(5, 7));
  const allRatios: number[] = [];
  const targetRatios: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const ratio = history[i].price / history[i - 1].price;
    allRatios.push(ratio);
    if (Number(history[i].period.slice(5, 7)) === targetMonth) targetRatios.push(ratio);
  }
  if (targetRatios.length === 0) return 0;
  return (mean(targetRatios) / mean(allRatios) - 1) * 100 * sensitivity;
}

/** Builds the sorted list of factors with plain-language details. */
function buildFactors(impacts: Record<string, number>): PredictionFactor[] {
  const all = Object.entries(impacts)
    .map(([key, impact]) => {
      const direction: 'UP' | 'DOWN' = impact >= 0 ? 'UP' : 'DOWN';
      const label = FACTOR_LABELS[key];
      return {
        key,
        label,
        impactPercent: round(impact, 1),
        direction,
        detail: factorDetail(key, direction, label),
      };
    })
    .sort((a, b) => Math.abs(b.impactPercent) - Math.abs(a.impactPercent));

  const meaningful = all.filter(
    (factor) => Math.abs(factor.impactPercent) >= MIN_FACTOR_IMPACT_PERCENT,
  );
  const count = Math.max(MIN_FACTORS, Math.min(MAX_FACTORS, meaningful.length));
  return all.slice(0, count);
}

function forecastOne(input: ForecastInput): ForecastOutput {
  const prices = input.priceHistory.map((point) => point.price);
  const lastPrice = prices[prices.length - 1];
  const sensitivity = SENSITIVITIES[input.commoditySlug] ?? NEUTRAL_SENSITIVITY;

  const trend = fitTrend(prices);
  // Macro changes are scaled down and capped so one noisy indicator cannot dominate.
  const impacts: Record<string, number> = {
    TREND: trend.monthlyGrowthPercent,
    SEASONALITY: seasonalPercent(input, sensitivity.seasonality),
    DIESEL_PRICE: clamp(
      recentChangePercent(input.indicators.DIESEL_PRICE) * sensitivity.diesel * MACRO_PASS_THROUGH,
      MAX_FACTOR_IMPACT_PERCENT,
    ),
    FX_RATE: clamp(
      recentChangePercent(input.indicators.USD_NGN) * sensitivity.fx * MACRO_PASS_THROUGH,
      MAX_FACTOR_IMPACT_PERCENT,
    ),
    // More supply pushes prices down, so the sign is flipped
    SUPPLY: clamp(
      -recentChangePercent(input.indicators.SUPPLY_INDEX) *
        sensitivity.supply *
        SUPPLY_PASS_THROUGH,
      MAX_FACTOR_IMPACT_PERCENT,
    ),
  };

  const totalPercent = Object.values(impacts).reduce((sum, value) => sum + value, 0);
  const predictedPrice = lastPrice * (1 + totalPercent / 100);

  // 80% interval: predicted price times exp(+/- 1.28 x spread of the log-price fit)
  const spread = INTERVAL_Z_SCORE * trend.residualSd;
  const lowerBound = predictedPrice * Math.exp(-spread);
  const upperBound = predictedPrice * Math.exp(spread);

  // Tighter band = more confidence, scaled between MIN and MAX confidence
  const bandRatio = (upperBound - lowerBound) / predictedPrice;
  const tightness = 1 - Math.min(bandRatio / WIDE_BAND_RATIO, 1);
  const confidence = MIN_CONFIDENCE + (MAX_CONFIDENCE - MIN_CONFIDENCE) * tightness;

  return {
    commoditySlug: input.commoditySlug,
    targetPeriod: input.targetPeriod,
    predictedPrice: round(predictedPrice, 2),
    lowerBound: round(lowerBound, 2),
    upperBound: round(upperBound, 2),
    confidence: round(confidence, 2),
    factors: buildFactors(impacts),
    modelVersion: LOCAL_MODEL_VERSION,
  };
}

export class LocalForecastModel implements ModelProvider {
  name = 'local';

  async forecast(inputs: ForecastInput[]): Promise<ForecastOutput[]> {
    return inputs.map(forecastOne);
  }
}
