import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CustomLogger } from '../logger.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { TaskSchedulerService } from 'src/server/task-scheduler.service';
import { SseSubjectService } from './sse-subject.service';
import { JwtModule } from '@nestjs/jwt';
import { LangchainChatController } from './langchain/langchain-chat.controller';
import { LangchainChatService } from './langchain/langchain-chat.service';
import { CCXTController } from './ccxt.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'dist', 'platforms', 'browser'),
      exclude: ['/api*', '/debug*'],
    }),
  ],
  controllers: [AppController, LangchainChatController, CCXTController],
  providers: [
    AppService,
    LangchainChatService,
    TaskSchedulerService,
    SseSubjectService,
    CustomLogger,
  ],
})
export class AppModule {
  constructor(private readonly _logger: CustomLogger) {
    this._logger.setContext(AppModule.name);
  }
}
