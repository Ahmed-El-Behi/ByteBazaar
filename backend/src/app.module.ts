import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, CatalogModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}