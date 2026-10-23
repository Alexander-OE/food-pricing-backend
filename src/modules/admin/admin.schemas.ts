// Validation rules for admin requests.
import { z } from 'zod';
import {
  DEFAULT_ACCURACY_MONTHS,
  DEFAULT_PAGE_SIZE,
  MAX_HISTORY_MONTHS,
  MAX_PAGE_SIZE,
} from '../../constants';

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

const refreshTypes = ['NBS_PRICES', 'MACRO_FEATURES', 'PREDICTIONS', 'ACCURACY'] as const;

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const rangeQuerySchema = z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') });

export const refreshLogsQuerySchema = z.object({
  type: z.enum(refreshTypes).optional(),
  status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']).optional(),
  ...pagination,
});
export const refreshBodySchema = z.object({ type: z.enum(['ALL', ...refreshTypes]) });

export const accuracyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(MAX_HISTORY_MONTHS).default(DEFAULT_ACCURACY_MONTHS),
});

export const feedbackQuerySchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']).optional(),
  category: z.enum(['GENERAL', 'BUG', 'PREDICTION_ACCURACY', 'FEATURE_REQUEST']).optional(),
  ...pagination,
});
export const feedbackParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const feedbackUpdateSchema = z.object({ status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']) });

export type LoginBody = z.infer<typeof loginSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type RefreshLogsQuery = z.infer<typeof refreshLogsQuerySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type AccuracyQuery = z.infer<typeof accuracyQuerySchema>;
export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;
export type FeedbackUpdateBody = z.infer<typeof feedbackUpdateSchema>;
