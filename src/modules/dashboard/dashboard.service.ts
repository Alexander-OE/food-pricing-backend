// Business logic for the dashboard: the market pulse across all commodities.
import { round, toPeriodString } from '../../lib/format';
import { prisma } from '../../lib/prisma';
import { buildCards } from '../commodities/commodities.service';
import { getActivePredictions } from '../predictions/predictions.service';

export async function getDashboardSummary() {
  const commodities = await prisma.commodity.findMany();
  const allCards = await buildCards(commodities);

  const count = (direction: string) =>
    allCards.filter((card) => card.direction === direction).length;
  const averageChange =
    allCards.reduce((sum, card) => sum + card.percentChange, 0) / (allCards.length || 1);
  const byChange = [...allCards].sort((a, b) => b.percentChange - a.percentChange);

  // All predictions share one forecast month, so any one gives the label.
  const sample = [...(await getActivePredictions()).values()][0];

  return {
    marketPulse: {
      basePeriod: sample ? toPeriodString(sample.basePeriod) : null,
      targetPeriod: sample ? toPeriodString(sample.targetPeriod) : null,
      rising: count('UP'),
      falling: count('DOWN'),
      stable: count('STABLE'),
      averagePredictedChange: round(averageChange, 1),
      biggestRiser: byChange[0] ?? null,
      biggestFaller: byChange[byChange.length - 1] ?? null,
    },
  };
}
