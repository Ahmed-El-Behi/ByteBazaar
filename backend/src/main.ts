import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { langMiddleware } from './common/i18n';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Derrière un reverse proxy, l'adresse du visiteur vient de X-Forwarded-For (limites de tentatives
  // par IP). Par défaut, seul un proxy local est cru : un client direct ne peut pas usurper son IP.
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:4200').split(','),
  });
  // Langue des messages renvoyés (en-tête Accept-Language envoyé par le frontend)
  app.use(langMiddleware);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
