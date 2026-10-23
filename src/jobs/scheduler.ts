// Schedules the daily indicator refresh and the monthly pipeline.
import cron from 'node-cron';
import { DAILY_MACRO_CRON, MONTHLY_PIPELINE_CRON, TIMEZONE } from '../constants';
import { logger } from '../lib/logger';
import { runMonthlyPipeline, runPipelineStep } from '../ml-services/pipeline/runMonthlyPipeline';

/** Registers both cron jobs; pipeline errors are logged, never thrown. */
export function startScheduler(): void {
  cron.schedule(
    DAILY_MACRO_CRON,
    () => {
      logger.info('Cron: refreshing macro indicators');
      void runPipelineStep('MACRO_FEATURES', 'cron');
    },
    { timezone: TIMEZONE },
  );

  cron.schedule(
    MONTHLY_PIPELINE_CRON,
    () => {
      logger.info('Cron: running monthly pipeline');
      void runMonthlyPipeline('cron');
    },
    { timezone: TIMEZONE },
  );

  logger.info(
    'Scheduler started (daily macro 06:00, monthly pipeline on the 16th at 07:00, Africa/Lagos)',
  );
}
