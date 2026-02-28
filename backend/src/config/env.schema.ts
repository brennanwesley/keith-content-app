import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .default('http://localhost:3000,http://localhost:3001'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    MUX_TOKEN_ID: z.string().min(1).optional(),
    MUX_TOKEN_SECRET: z.string().min(1).optional(),
    CONSENT_POLICY_VERSION: z.string().min(1).default('v1'),
  })
  .refine(
    (env) =>
      (!env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY) ||
      (Boolean(env.SUPABASE_URL) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY)),
    {
      message:
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set together.',
      path: ['SUPABASE_URL'],
    },
  )
  .refine(
    (env) =>
      (!env.MUX_TOKEN_ID && !env.MUX_TOKEN_SECRET) ||
      (Boolean(env.MUX_TOKEN_ID) && Boolean(env.MUX_TOKEN_SECRET)),
    {
      message: 'MUX_TOKEN_ID and MUX_TOKEN_SECRET must both be set together.',
      path: ['MUX_TOKEN_ID'],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean).length > 0,
    {
      message: 'CORS_ORIGINS must contain at least one origin in production.',
      path: ['CORS_ORIGINS'],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (Boolean(env.SUPABASE_URL) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY)),
    {
      message:
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.',
      path: ['SUPABASE_URL'],
    },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
