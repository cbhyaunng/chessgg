import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRES_SEC: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  GOOGLE_CLIENT_ID: z.string().optional(),

  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  ANALYSIS_DAILY_LIMIT_FREE: z.coerce.number().int().nonnegative().default(2),
  ANALYSIS_DAILY_LIMIT_PRO: z.coerce.number().int().nonnegative().default(30),

  DATASET_TTL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  CHESSCOM_MAX_ARCHIVES: z.coerce.number().int().positive().default(12),
  LICHESS_MAX_GAMES: z.coerce.number().int().positive().default(200),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
  STRIPE_BILLING_SUCCESS_URL: z.string().url().optional(),
  STRIPE_BILLING_CANCEL_URL: z.string().url().optional(),

  SENTRY_DSN: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function isProdLike(): boolean {
  return env.NODE_ENV === "production" || env.NODE_ENV === "staging";
}
