import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [PrismaModule, CatalogModule, AuthModule, CartModule, OrderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}