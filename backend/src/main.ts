import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppModule } from './app.module';
import { langMiddleware } from './common/i18n';
import { validationPipe } from './common/validation';

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
  // Corps de requête validés par leur DTO (messages traduits, format { message: string[] })
  app.useGlobalPipes(validationPipe);

  // Documentation interactive : /docs sur l'API, /api/docs à travers le site
  const config = new DocumentBuilder()
    .setTitle('ByteBazaar — API')
    .setDescription(
      'API de la boutique de composants PC ByteBazaar : catalogue, comptes, panier, commandes, ' +
        'configurateur PC et administration. Prix en dinars tunisiens (TND).\n\n' +
        'Routes protégées : se connecter avec `POST /auth/login`, puis coller le `accessToken` dans « Authorize ». ' +
        'Messages en français par défaut (en anglais avec l’en-tête `Accept-Language: en`).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'ByteBazaar — API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
    },
    // « Try it out » doit viser l'API telle que le navigateur la voit : préfixe /api derrière le site
    patchDocumentOnRequest: (req, _res, doc) => {
      const prefix = (req as Request).headers['x-forwarded-prefix'];
      return {
        ...doc,
        servers: [{ url: typeof prefix === 'string' && prefix ? prefix : '/' }],
      };
    },
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
