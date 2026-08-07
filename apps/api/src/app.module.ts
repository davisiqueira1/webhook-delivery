import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envSchema } from './config/env.schema';
import { envProvider } from './config/env.provider';
import { processEnvProvider } from './config/process-env.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate(config) {
        return envSchema.parse(config);
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, envProvider, processEnvProvider],
  exports: [envProvider],
})
export class AppModule {}
