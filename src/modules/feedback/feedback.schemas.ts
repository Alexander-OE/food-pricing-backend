// Validation rules for the feedback form.
import { z } from 'zod';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from '../../constants';

export const createFeedbackSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(150).optional(),
  category: z.enum(['GENERAL', 'BUG', 'PREDICTION_ACCURACY', 'FEATURE_REQUEST']).default('GENERAL'),
  message: z.string().trim().min(FEEDBACK_MIN_LENGTH).max(FEEDBACK_MAX_LENGTH),
  commoditySlug: z.string().max(100).optional(),
});

export type CreateFeedbackBody = z.infer<typeof createFeedbackSchema>;
