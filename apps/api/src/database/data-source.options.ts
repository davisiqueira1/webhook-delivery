import { DataSourceOptions } from 'typeorm';
import { Env } from '../config/env.schema';
import { entities } from './entities';
import { migrations } from './migrations';

export function buildDataSourceOptions(env: Env): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    poolSize: env.DB_POOL_SIZE,
    entities: entities,
    migrations: migrations,
    synchronize: false, // schema changes come from migrations only; inferred DDL would drop data
  };
}
