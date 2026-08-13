import 'dotenv/config';
import { envSchema } from '../config/env.schema';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source.options';

const env = envSchema.parse(process.env);
export default new DataSource(buildDataSourceOptions(env));
