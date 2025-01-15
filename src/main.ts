import { NestFactory } from '@nestjs/core';
import { AppModule } from './server/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomLogger } from './logger.service';
import { join } from 'node:path';

async function bootstrapServer() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger(AppModule.name),
  });
  // manage static files
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  return app;
}

function run() {
  console.log(`Run srcipt...`);
  const port = process.env['PORT'] || 3000;
  // Start up the Node server
  bootstrapServer().then((server) => {
    server.listen(port, () => {
      new CustomLogger('NestApplication').log(
        `Node Express server listening on http://localhost:${port}`,
      );
    });
  });
}

run();
