import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}