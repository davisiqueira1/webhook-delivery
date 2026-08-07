import { Test } from '@nestjs/testing';
import { ENV, envProvider } from './env.provider';
import { PROCESS_ENV } from './process-env.provider';
import { Env } from './env.schema';
import { validEnv } from './env.fixture';

describe('envProvider', () => {
  it('resolve the ENV token with the already parsed config', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: PROCESS_ENV, useValue: validEnv }, envProvider],
    }).compile();

    const env = moduleRef.get<Env>(ENV);

    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe('number');
  });
});
