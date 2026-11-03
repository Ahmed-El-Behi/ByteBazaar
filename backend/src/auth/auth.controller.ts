import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthedRequest) {
    return this.auth.me(request.user!.id);
  }
}