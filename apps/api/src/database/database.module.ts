import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from '../config/env.provider';
import { Env } from '../config/env.schema';
import { buildDataSourceOptions } from './data-source.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => buildDataSourceOptions(env),
    }),
  ],
})
export class DatabaseModule {}
