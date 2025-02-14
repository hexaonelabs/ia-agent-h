import { NestFactory } from '@nestjs/core';
import { AppModule } from './server/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomLogger } from './logger.service';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrapServer() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger(AppModule.name),
  });
  app.enableShutdownHooks();
  // enable cors
  app.enableCors();
  // enable validation
  app.useGlobalPipes(new ValidationPipe());
  // set global prefix
  app.setGlobalPrefix('api');
  // manage static files
  app.useStaticAssets(join(__dirname, '..', 'public'));
  // app.setBaseViewsDir(join(__dirname, '..', 'views'));
  // app.setViewEngine('hbs');
  const options = new DocumentBuilder()
    .setTitle('Agent-H API Hub')
    .setDescription('Here you can find all the endpoints for the Agent-H API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);
  return app;
}

function run() {
  console.log(`Run srcipt...`);
  const port = process.env['PORT'] || 3000;
  const host = process.env['HOST'] || 'localhost';
  // Start up the Node server
  bootstrapServer().then((server) => {
    server.listen(port, host, async () => {
      new CustomLogger('NestApplication').log(
        `Node Express server listening on this url ${await server.getUrl()}`,
      );
    });
  });
}

run();
