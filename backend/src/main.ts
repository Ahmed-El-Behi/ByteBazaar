import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { langMiddleware } from './common/i18n';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:4200').split(','),
  });
  // Langue des messages renvoyés (en-tête Accept-Language envoyé par le frontend)
  app.use(langMiddleware);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
