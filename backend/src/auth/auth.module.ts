import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles';

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET manquant : ajoute-le dans backend/.env');
}

@Module({
  imports: [JwtModule.register({ global: true, secret, signOptions: { expiresIn: '7d' } })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}