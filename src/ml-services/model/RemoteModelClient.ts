// HTTP client for the data scientist's model server.
// NOTE: the request and response format is still to be confirmed with Daniel.
import { z } from 'zod';
import { env } from '../../config/env';
import type { ForecastInput, ForecastOutput, ModelProvider } from './ModelProvider';

const factorSchema = z.object({
  key: z.string(),
  label: z.string(),
  impactPercent: z.number(),
  direction: z.enum(['UP', 'DOWN']),
  detail: z.string(),
});

const outputSchema = z.object({
  predictions: z.array(
    z.object({
      commoditySlug: z.string(),
      targetPeriod: z.string(),
      predictedPrice: z.number(),
      lowerBound: z.number(),
      upperBound: z.number(),
      confidence: z.number().min(0).max(1),
      factors: z.array(factorSchema),
      modelVersion: z.string(),
    }),
  ),
});

export class RemoteModelClient implements ModelProvider {
  name = 'remote';

  /** Calls POST /predict on the model server, retrying once on network errors. */
  async forecast(inputs: ForecastInput[]): Promise<ForecastOutput[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.callServer(inputs);
      } catch (error) {
        lastError = error;
        // Only network errors and timeouts are worth retrying.
        if (!(error instanceof TypeError) && !(error instanceof DOMException)) break;
      }
    }
    throw lastError;
  }

  private async callServer(inputs: ForecastInput[]): Promise<ForecastOutput[]> {
    const response = await fetch(`${env.MODEL_SERVER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs }),
      signal: AbortSignal.timeout(env.MODEL_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Model server returned HTTP ${response.status}`);

    // Check the response shape so a changed model server cannot corrupt our data.
    return outputSchema.parse(await response.json()).predictions;
  }
}
