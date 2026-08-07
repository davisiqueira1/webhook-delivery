import { Provider } from '@nestjs/common';
import { Env, envSchema } from './env.schema';
import { PROCESS_ENV } from './process-env.provider';

export const ENV = Symbol('Env');

export const envProvider: Provider = {
  provide: ENV,
  inject: [PROCESS_ENV],
  useFactory: (env: unknown): Env => envSchema.parse(env),
};
