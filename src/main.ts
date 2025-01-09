import { NestFactory } from '@nestjs/core';
import { AppModule } from './server/app.module';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomLogger } from './logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger(AppModule.name),
  });
  // manage static files
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  // listen on port 3000
  await app.listen(3000);
}
bootstrap();
