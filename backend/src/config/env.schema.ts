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
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
