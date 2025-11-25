import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
  API_PREFIX: z.string().default('/api'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(20000),
  META_VERIFY_TOKEN: z.string(),
  META_GRAPH_API_BASE: z.string().default('https://graph.facebook.com'),
  META_GRAPH_API_VERSION: z.string().default('v17.0'),
  UPLOAD_DIR: z.string().default('uploads'),
  SESSION_EXPIRATION_MINUTES: z.coerce.number().default(45)
});

export type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = envSchema.parse(process.env);
