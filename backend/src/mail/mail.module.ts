import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'node:path';
import { MailService } from './mail.service';

const port = Number(process.env.SMTP_PORT) || 465;

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465, // SSL direct sur 465, STARTTLS sur 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: {
        from: `"ByteBazaar" <${process.env.SMTP_USER}>`,
      },
      template: {
        // Les templates sont copiés à côté du module compilé (voir nest-cli.json)
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: { strict: true },
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
