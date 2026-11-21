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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './auth.dto';

const FIFTEEN_MINUTES = 15 * 60_000;

@ApiTags('Comptes')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({
    summary: 'Créer un compte',
    description:
      'Renvoie le jeton de session et le profil. 10 essais / 15 min.',
  })
  @Post('register')
  @RateLimit(10, FIFTEEN_MINUTES)
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @ApiOperation({
    summary: 'Se connecter',
    description:
      'Renvoie le jeton de session (à utiliser dans « Authorize »). 10 essais / 15 min.',
  })
  @Post('login')
  @HttpCode(200)
  @RateLimit(10, FIFTEEN_MINUTES)
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  // Envoie un lien de réinitialisation (valable 15 min, utilisable une seule fois)
  @ApiOperation({
    summary: 'Mot de passe oublié',
    description:
      'Envoie un lien de réinitialisation par e-mail. La réponse est la même que le compte existe ou non.',
  })
  @Post('forgot-password')
  @HttpCode(200)
  @RateLimit(5, FIFTEEN_MINUTES)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body);
  }

  @ApiOperation({
    summary: 'Réinitialiser le mot de passe',
    description:
      'Avec le jeton reçu par e-mail ; déconnecte les autres sessions.',
  })
  @Post('reset-password')
  @HttpCode(200)
  @RateLimit(10, FIFTEEN_MINUTES)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body);
  }

  @ApiOperation({ summary: 'Profil de l’utilisateur connecté' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthedRequest) {
    return this.auth.me(request.user!.id);
  }

  @ApiOperation({
    summary: 'Modifier son profil',
    description:
      'Nom, téléphone, et mot de passe (le mot de passe actuel est alors requis).',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Req() request: AuthedRequest, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(request.user!.id, body);
  }
}
