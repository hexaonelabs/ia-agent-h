import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CustomLogger } from '../logger.service';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { TaskSchedulerService } from 'src/server/task-scheduler.service';
import { SseSubjectService } from './sse-subject.service';
import { LangchainModule } from './langchain/langchain.module';

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
    LangchainModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
