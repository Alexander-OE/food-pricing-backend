// Turns forecast factors into plain-English text.
import type { Direction } from '@prisma/client';
import { round } from '../lib/format';
import type { PredictionFactor } from '../types';

interface FactorText {
  /** Short clause for the explanation sentence. */
  up: string;
  down: string;
  /** One full sentence shown on the factor card. */
  upDetail: string;
  downDetail: string;
}

/** Wording for each factor key we know about. UP = pushes the price up. */
const FACTOR_TEXT: Record<string, FactorText> = {
  TREND: {
    up: 'prices have been climbing steadily in recent months',
    down: 'prices have been drifting down in recent months',
    upDetail:
      'Prices have been rising steadily over the past year and that momentum is likely to continue.',
    downDetail:
      'Prices have been easing over the past year and that softer trend is likely to continue.',
  },
  SEASONALITY: {
    up: 'this time of year is usually a more expensive season',
    down: 'prices usually ease at this time of year',
    upDetail: 'In past years, prices usually rose in this month because of the growing season.',
    downDetail:
      'In past years, prices usually fell in this month as new harvest reaches the market.',
  },
  DIESEL_PRICE: {
    up: 'higher diesel costs are pushing up transport',
    down: 'lower diesel costs are easing transport',
    upDetail:
      'Diesel got more expensive recently, which raises the cost of trucking food into Lagos.',
    downDetail: 'Diesel got cheaper recently, which lowers the cost of trucking food into Lagos.',
  },
  FX_RATE: {
    up: 'a weaker naira is making imports and inputs costlier',
    down: 'a stronger naira is making imports and inputs cheaper',
    upDetail:
      'The naira weakened against the dollar, which raises the cost of imported goods and inputs.',
    downDetail:
      'The naira strengthened against the dollar, which lowers the cost of imported goods and inputs.',
  },
  SUPPLY: {
    up: 'supply is lower in this season',
    down: 'supply is improving with the harvest',
    upDetail: 'Less of this food is reaching the market right now, which tends to push prices up.',
    downDetail:
      'More of this food is reaching the market right now, which tends to pull prices down.',
  },
};

/** Clause for one factor, e.g. "higher diesel costs are pushing up transport". */
export function factorClause(
  factor: Pick<PredictionFactor, 'key' | 'label' | 'direction'>,
): string {
  const text = FACTOR_TEXT[factor.key];
  if (text) return factor.direction === 'UP' ? text.up : text.down;
  // Unknown factor from a remote model: use its label.
  return `${factor.label.toLowerCase()} is ${factor.direction === 'UP' ? 'pushing prices up' : 'pulling prices down'}`;
}

export function factorDetail(key: string, direction: 'UP' | 'DOWN', label: string): string {
  const text = FACTOR_TEXT[key];
  if (text) return direction === 'UP' ? text.upDetail : text.downDetail;
  return `${label} is ${direction === 'UP' ? 'pushing prices up' : 'pulling prices down'}.`;
}

/** Explanation for the detail page, built from the top two factors. */
export function buildExplanation(
  commodityName: string,
  percentChange: number,
  direction: Direction,
  factors: PredictionFactor[],
): string {
  const [first, second] = factors;
  const size = round(Math.abs(percentChange), 1);

  if (!first) {
    return `${commodityName} prices are predicted to change by ${percentChange}% next month.`;
  }
  const reasons = second
    ? `${factorClause(first)}, and ${factorClause(second)}`
    : factorClause(first);

  if (direction === 'STABLE') {
    return `${commodityName} prices are expected to stay about the same next month (${percentChange > 0 ? '+' : ''}${percentChange}%), because ${reasons}, which roughly balance out.`;
  }
  const verb = direction === 'UP' ? 'rise' : 'fall';
  return `${commodityName} prices are predicted to ${verb} ${size}% next month, mainly because ${reasons}.`;
}
