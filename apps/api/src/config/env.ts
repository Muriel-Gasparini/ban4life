import { z } from 'zod';
import * as path from 'path';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_PASSWORD: z.string().min(1).default('admin123'),
  TYPESAFE_API_KEY: z.string().optional().default(''),
  DATABASE_URL: z.string().default('file:./data/ban4life.db'),
  JWT_SECRET: z.string().optional(),
  AUTH_DIR: z.string().default('./data/baileys_auth'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  const env = result.data;
  if (!env.JWT_SECRET) {
    env.JWT_SECRET = env.ADMIN_PASSWORD + '-jwt-secret-token';
  }

  return env;
}
