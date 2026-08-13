import { Global, Module } from '@nestjs/common';
import { processEnvProvider } from './process-env.provider';
import { envProvider } from './env.provider';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [processEnvProvider, envProvider],
  exports: [envProvider],
})
export class EnvModule {}
