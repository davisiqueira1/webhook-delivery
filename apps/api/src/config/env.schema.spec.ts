import { envSchema } from './env.schema';
import { validEnv } from './env.fixture';

describe('envSchema', () => {
  it('accepts a complete config and coerces numeric values', () => {
    const result = envSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      NODE_ENV: 'production',
      PORT: 8080,
      DB_POOL_SIZE: 8,
      LOG_LEVEL: 'debug',
    });
  });

  it('fails when a numeric variable cannot be coerced', () => {
    const mockedEnv = { ...validEnv, PORT: 'some-string' };
    const result = envSchema.safeParse(mockedEnv);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['PORT'],
        code: 'invalid_type',
        expected: 'number',
        received: 'NaN',
      }),
    );
  });

  it('fails when a required variable is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { API_KEY, ...mockedEnv } = validEnv;

    const result = envSchema.safeParse(mockedEnv);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['API_KEY'], code: 'invalid_type' }),
    );
  });

  it('fails when a variable has a wrong type', () => {
    const mockedEnv = { ...validEnv, SQS_QUEUE_URL: 8080 };
    const result = envSchema.safeParse(mockedEnv);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['SQS_QUEUE_URL'],
        code: 'invalid_type',
      }),
    );
  });
});
