// Loads and checks environment variables, exiting with a clear message if any are wrong.
import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_PORT } from '../constants';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // Public address of this API, used to build image URLs. Images sit at /images, not under /api/v1,
  // so any path or trailing slash on the value is dropped and only the origin is kept.
  PUBLIC_URL: z
    .string()
    .url('PUBLIC_URL must be a full URL such as https://your-api.onrender.com')
    .default('http://localhost:5000')
    .transform((value) => new URL(value).origin),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  ADMIN_NAME: z.string().default('Admin'),

  MODEL_PROVIDER: z.enum(['local', 'remote']).default('local'),
  MODEL_SERVER_URL: z.string().default('http://localhost:8000'),
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  DATA_SOURCE: z.enum(['mock', 'nbs']).default('mock'),

  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('gemini-2.5-flash'),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(1024),

  // Env vars are strings, so "false" needs converting.
  ENABLE_CRON: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/** Parses process.env once at startup. */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
