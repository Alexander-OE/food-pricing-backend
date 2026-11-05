// Named constants for thresholds, limits and settings.

// ---- Predictions ----
/** A forecast change within +/- this percent is STABLE; smaller moves are mostly noise. */
export const STABLE_THRESHOLD_PERCENT = 2;
/** How many months of price history are passed to the model. */
export const MODEL_HISTORY_MONTHS = 36;
/** Commodities saved per database transaction, so no single transaction stays open for long. */
export const PREDICTION_SAVE_BATCH_SIZE = 5;
/** A remote database can be slow, so saving a batch may take far longer than Prisma's 5s default. */
export const DB_TRANSACTION_TIMEOUT_MS = 120_000;
/** How long to wait for a free database connection before a transaction gives up. */
export const DB_TRANSACTION_MAX_WAIT_MS = 30_000;
/** Months used to fit the trend line. */
export const TREND_WINDOW_MONTHS = 12;
/** Months used to measure recent change in diesel, FX and supply. */
export const MACRO_LOOKBACK_MONTHS = 3;
/** z-score for an 80% prediction interval. */
export const INTERVAL_Z_SCORE = 1.28;
export const MIN_CONFIDENCE = 0.55;
export const MAX_CONFIDENCE = 0.92;
/** Band width (bounds / price) at which confidence is lowest. */
export const WIDE_BAND_RATIO = 0.4;
/** Scales macro changes so a 10% diesel rise does not move price by a full 10%. */
export const MACRO_PASS_THROUGH = 0.25;
/** Supply index swings a lot with the seasons, so its pass-through is smaller. */
export const SUPPLY_PASS_THROUGH = 0.1;
/** No single macro factor can move the forecast by more than this many percent. */
export const MAX_FACTOR_IMPACT_PERCENT = 8;
export const MAX_FACTORS = 4;
export const MIN_FACTORS = 3;
/** Factors smaller than this (in percent) are ignored when explaining a prediction. */
export const MIN_FACTOR_IMPACT_PERCENT = 0.05;
export const LOCAL_MODEL_VERSION = 'local-baseline-v1';
/** Months back-tested when seeding. */
export const BACKTEST_MONTHS = 12;

// ---- Commodities and dashboard ----
export const CARD_PRICE_MONTHS = 2; // latest month plus the one before, for the month-on-month change
export const DEFAULT_HISTORY_MONTHS = 24;
export const MAX_HISTORY_MONTHS = 120;
export const DEFAULT_ACCURACY_MONTHS = 12;
export const RELATED_COMMODITIES_COUNT = 4;
/** Where commodity photos are served from (under public/). */
export const COMMODITY_IMAGES_PATH = '/images/commodities';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ---- Sessions and analytics ----
/** How often a session's lastSeenAt is saved, to avoid a write on every request. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Months used for the accuracy card on the admin overview. */
export const OVERVIEW_ACCURACY_MONTHS = 3;

// ---- Chatbot ----
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const CHAT_HISTORY_LIMIT = 10;
export const LLM_TIMEOUT_MS = 20_000;
export const SUGGESTED_QUESTION_COUNT = 4;

// ---- Feedback ----
export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 1000;

// ---- Rate limits (see middleware/rateLimiters.ts) ----
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const GLOBAL_LIMIT = { windowMs: 15 * MINUTE_MS, max: 300 };
export const CHAT_PER_MINUTE_LIMIT = { windowMs: MINUTE_MS, max: 20 };
export const CHAT_PER_DAY_LIMIT = { windowMs: 24 * HOUR_MS, max: 200 };
export const FEEDBACK_LIMIT = { windowMs: HOUR_MS, max: 5 };
export const ANALYTICS_LIMIT = { windowMs: MINUTE_MS, max: 120 };
export const ADMIN_LOGIN_LIMIT = { windowMs: 15 * MINUTE_MS, max: 5 };

// ---- Server ----
export const JSON_BODY_LIMIT = '100kb';
export const TIMEZONE = 'Africa/Lagos';
/** Daily macro refresh at 06:00 Lagos time. */
export const DAILY_MACRO_CRON = '0 6 * * *';
/** Monthly pipeline on the 16th at 07:00 Lagos time, after the NBS usually publishes. */
export const MONTHLY_PIPELINE_CRON = '0 7 16 * *';
export const DEFAULT_PORT = 5000;
export const BCRYPT_ROUNDS = 10;
export const NBS_PUBLISH_DAY = 16;
