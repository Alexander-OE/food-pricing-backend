// Validation rules for usage events.
import { z } from 'zod';

export const trackEventSchema = z.object({
  type: z.enum(['PAGE_VIEW', 'COMMODITY_VIEW', 'SEARCH']),
  path: z.string().min(1).max(255),
  commoditySlug: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TrackEventBody = z.infer<typeof trackEventSchema>;
