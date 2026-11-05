import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { AdminModule } from './admin/admin.module'; // <-- AJOUTER ICI
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrderModule,
    AdminModule, // <-- AJOUTER ICI
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}