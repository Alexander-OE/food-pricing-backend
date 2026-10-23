// Rate limiters against abuse; the limits live in constants.ts.
import rateLimit from 'express-rate-limit';
import {
  ADMIN_LOGIN_LIMIT,
  ANALYTICS_LIMIT,
  CHAT_PER_DAY_LIMIT,
  CHAT_PER_MINUTE_LIMIT,
  FEEDBACK_LIMIT,
  GLOBAL_LIMIT,
} from '../constants';
import { fail } from '../utils/response';

interface LimitConfig {
  windowMs: number;
  max: number;
}

/** Builds a limiter that replies with a RATE_LIMITED error. */
function createLimiter({ windowMs, max }: LimitConfig, message: string) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      fail(res, 429, 'RATE_LIMITED', message);
    },
  });
}

export const globalLimiter = createLimiter(GLOBAL_LIMIT, 'Too many requests. Please slow down.');
export const chatPerMinuteLimiter = createLimiter(
  CHAT_PER_MINUTE_LIMIT,
  'You are sending messages too fast. Try again shortly.',
);
export const chatPerDayLimiter = createLimiter(
  CHAT_PER_DAY_LIMIT,
  'Daily chat limit reached. Please come back tomorrow.',
);
export const feedbackLimiter = createLimiter(
  FEEDBACK_LIMIT,
  'Too many feedback messages. Please try again later.',
);
export const analyticsLimiter = createLimiter(ANALYTICS_LIMIT, 'Too many analytics events.');
export const adminLoginLimiter = createLimiter(
  ADMIN_LOGIN_LIMIT,
  'Too many login attempts. Try again in 15 minutes.',
);
