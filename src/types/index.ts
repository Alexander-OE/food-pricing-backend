// Types shared by more than one module.
import type { Direction, IndicatorKey } from '@prisma/client';

/** One reason behind a prediction, stored as JSON on the Prediction row. */
export interface PredictionFactor {
  key: string; // e.g. "DIESEL_PRICE", "SEASONALITY", "FX_RATE", "SUPPLY", "TREND"
  label: string; // "Diesel and transport costs"
  impactPercent: number; // contribution to the predicted change, e.g. +5.2
  direction: 'UP' | 'DOWN';
  detail: string; // one plain-language sentence
}

export interface PricePoint {
  period: string; // YYYY-MM-DD
  price: number;
}

/** How strongly one commodity reacts to each factor (0 to 1). */
export interface Sensitivity {
  fx: number;
  diesel: number;
  seasonality: number;
  supply: number;
  inflation: number;
}

/** Summary used on dashboard cards and lists. */
export interface CommodityCard {
  id: number;
  name: string;
  slug: string;
  category: string;
  unit: string;
  imageUrl: string | null;
  currentPrice: number;
  previousPrice: number;
  monthOnMonthChange: number;
  predictedPrice: number;
  percentChange: number;
  direction: Direction;
  confidence: number;
}

export type IndicatorSeries = Record<IndicatorKey, { period: string; value: number }[]>;

/** Admin identity attached to the request after the token check. */
export interface AdminIdentity {
  id: number;
  email: string;
}
