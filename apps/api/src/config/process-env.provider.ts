import { Provider } from '@nestjs/common';

export const PROCESS_ENV = Symbol('PROCESS_ENV');

export const processEnvProvider: Provider = {
  provide: PROCESS_ENV,
  useValue: process.env,
};
