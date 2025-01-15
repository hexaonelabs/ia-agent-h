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
    .addTag('agent-h')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);
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
