import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from '../config/env.provider';
import { Env } from '../config/env.schema';
import { entities } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        type: 'postgres',
        url: env.DATABASE_URL,
        poolSize: env.DB_POOL_SIZE,
        entities: entities,
        migrations: [],
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
