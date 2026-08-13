import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvModule } from './config/env.module';

@Module({
  imports: [EnvModule],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {}
