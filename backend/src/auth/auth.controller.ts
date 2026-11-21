import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';

const FIFTEEN_MINUTES = 15 * 60_000;

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit(10, FIFTEEN_MINUTES)
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit(10, FIFTEEN_MINUTES)
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }

  // Envoie un lien de réinitialisation (valable 15 min, utilisable une seule fois)
  @Post('forgot-password')
  @HttpCode(200)
  @RateLimit(5, FIFTEEN_MINUTES)
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  @RateLimit(10, FIFTEEN_MINUTES)
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthedRequest) {
    return this.auth.me(request.user!.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.auth.updateProfile(request.user!.id, body);
  }
}
