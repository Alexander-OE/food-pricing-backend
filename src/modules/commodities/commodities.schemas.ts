// Validation rules for commodity requests.
import { z } from 'zod';
import {
  DEFAULT_ACCURACY_MONTHS,
  DEFAULT_HISTORY_MONTHS,
  DEFAULT_PAGE_SIZE,
  MAX_HISTORY_MONTHS,
  MAX_PAGE_SIZE,
} from '../../constants';

export const slugParamsSchema = z.object({ slug: z.string().min(1).max(100) });

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z
    .enum(['GRAINS', 'LEGUMES', 'TUBERS', 'VEGETABLES', 'FRUITS', 'PROTEIN', 'OILS', 'OTHERS'])
    .optional(),
  direction: z.enum(['UP', 'DOWN', 'STABLE']).optional(),
  sort: z.enum(['name', 'price', 'change', '-change']).default('name'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const historyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(MAX_HISTORY_MONTHS).default(DEFAULT_HISTORY_MONTHS),
});

export const accuracyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(MAX_HISTORY_MONTHS).default(DEFAULT_ACCURACY_MONTHS),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type AccuracyQuery = z.infer<typeof accuracyQuerySchema>;
