import * as z from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.url(),
  API_KEY: z.string().nonempty(),
  SQS_QUEUE_URL: z.url(),
  AWS_REGION: z.string().nonempty(),
  DB_POOL_SIZE: z.coerce.number().int().min(1),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;
