// Runs the monthly pipeline or a single step; also available as "npm run pipeline:run".
import type { DataRefreshLog, RefreshType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { evaluateAccuracy } from './evaluateAccuracy';
import { generatePredictions } from './generatePredictions';
import { ingestIndicators } from './ingestIndicators';
import { ingestPrices } from './ingestPrices';
import { runLoggedStep, type StepResult } from './logStep';

const STEPS: Record<RefreshType, () => Promise<StepResult>> = {
  NBS_PRICES: ingestPrices,
  MACRO_FEATURES: ingestIndicators,
  ACCURACY: evaluateAccuracy,
  PREDICTIONS: generatePredictions,
};

/** Order matters: accuracy must run before new predictions, and predictions need fresh prices. */
const PIPELINE_ORDER: RefreshType[] = ['NBS_PRICES', 'MACRO_FEATURES', 'ACCURACY', 'PREDICTIONS'];

export function runPipelineStep(type: RefreshType, trigger: string): Promise<DataRefreshLog> {
  return runLoggedStep(type, trigger, STEPS[type]);
}

/** Runs every step in order; a failed step does not stop the others. */
export async function runMonthlyPipeline(trigger: string): Promise<DataRefreshLog[]> {
  const logs: DataRefreshLog[] = [];
  for (const type of PIPELINE_ORDER) {
    logs.push(await runPipelineStep(type, trigger));
  }
  return logs;
}

// Command-line entry point; the typeof check keeps imports safe in test runners.
if (typeof require !== 'undefined' && require.main === module) {
  runMonthlyPipeline('manual')
    .then((logs) => {
      for (const log of logs)
        console.log(`${log.type}: ${log.status} (${log.recordsProcessed} records)`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
