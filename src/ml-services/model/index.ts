// Picks the forecasting model from env, falling back to the local model if the remote one fails.
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { LocalForecastModel } from './LocalForecastModel';
import type { ForecastInput, ForecastOutput, ModelProvider } from './ModelProvider';
import { RemoteModelClient } from './RemoteModelClient';

const localModel = new LocalForecastModel();

/** Picks the provider named in MODEL_PROVIDER. */
export function getModelProvider(): ModelProvider {
  return env.MODEL_PROVIDER === 'remote' ? new RemoteModelClient() : localModel;
}

/** Records a failed model call so admins can see why the fallback was used. */
async function logModelFailure(reason: string): Promise<void> {
  await prisma.dataRefreshLog.create({
    data: {
      type: 'PREDICTIONS',
      status: 'FAILED',
      trigger: 'model-fallback',
      finishedAt: new Date(),
      errorMessage: `Remote model failed, local model used instead: ${reason}`,
    },
  });
}

/** Runs the chosen model, using the local one if it fails. */
export async function forecastWithFallback(inputs: ForecastInput[]): Promise<ForecastOutput[]> {
  const provider = getModelProvider();
  try {
    return await provider.forecast(inputs);
  } catch (error) {
    // The site must never show empty predictions, so fall back instead of failing.
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Model provider failed, falling back to local model');
    await logModelFailure(reason).catch((logError) =>
      logger.error({ err: logError }, 'Could not write failure log'),
    );
    return localModel.forecast(inputs);
  }
}
