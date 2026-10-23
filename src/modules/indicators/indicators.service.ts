// Business logic for market indicators: latest values and monthly change.
import type { IndicatorKey } from '@prisma/client';
import { calculatePercentChange, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';

/** Indicators shown in the home page's market drivers strip. */
export const DASHBOARD_INDICATORS: IndicatorKey[] = [
  'USD_NGN',
  'DIESEL_PRICE',
  'PETROL_PRICE',
  'FOOD_INFLATION',
];

export interface LatestIndicator {
  key: IndicatorKey;
  period: string;
  value: number;
  previousValue: number;
  changePercent: number;
}

/** Latest value per key, with the change from the previous month. */
export async function getLatestIndicators(
  keys: IndicatorKey[] = DASHBOARD_INDICATORS,
): Promise<LatestIndicator[]> {
  const results = await Promise.all(
    keys.map(async (key) => {
      const [latest, previous] = await prisma.macroIndicator.findMany({
        where: { key },
        orderBy: { period: 'desc' },
        take: 2,
      });
      if (!latest) return null;
      const previousValue = previous?.value ?? latest.value;
      return {
        key,
        period: toPeriodString(latest.period),
        value: latest.value,
        previousValue,
        changePercent: calculatePercentChange(previousValue, latest.value),
      };
    }),
  );
  return results.filter((result): result is LatestIndicator => result !== null);
}
