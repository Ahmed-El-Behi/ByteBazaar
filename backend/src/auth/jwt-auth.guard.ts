import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { tr } from '../common/i18n';

export type RoleName = 'CUSTOMER' | 'ADMIN';
export interface AuthUser {
  id: number;
  role: RoleName;
}
export type AuthedRequest = Request & { user?: AuthUser };

interface SessionPayload {
  sub: number;
  iat: number;
  purpose?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        tr('Connexion requise', 'Login required'),
      );
    }

    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException(
        tr('Session invalide ou expirée', 'Invalid or expired session'),
      );
    }
    if (payload.purpose)
      throw new UnauthorizedException(
        tr('Session invalide ou expirée', 'Invalid or expired session'),
      );

    // Le rôle est relu en base : une promotion / rétrogradation s'applique immédiatement,
    // et un compte supprimé ou dont le mot de passe a changé perd ses anciennes sessions.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, passwordChangedAt: true },
    });
    const changedAt = user?.passwordChangedAt
      ? Math.floor(user.passwordChangedAt.getTime() / 1000)
      : 0;
    if (!user || payload.iat < changedAt) {
      throw new UnauthorizedException(
        tr('Session invalide ou expirée', 'Invalid or expired session'),
      );
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }
}
