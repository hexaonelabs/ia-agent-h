import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentService } from '../agents/agent.service';
import { ConfigModule } from '@nestjs/config';
import { CustomLogger } from 'src/logger.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, AgentService, CustomLogger],
})
export class AppModule {
  constructor(private readonly _logger: CustomLogger) {
    this._logger.setContext(AppModule.name);
  }
}
