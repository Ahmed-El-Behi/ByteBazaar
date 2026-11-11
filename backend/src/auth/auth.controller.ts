import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }

  // NOUVELLE ROUTE : Demande de réinitialisation de mot de passe
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  // NOUVELLE ROUTE : Soumission du nouveau mot de passe avec le token
  @Post('reset-password')
  @HttpCode(200)
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