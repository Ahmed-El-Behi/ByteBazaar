import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest, RoleName } from './jwt-auth.guard';

const ROLES_KEY = 'roles';

// Usage : @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    return true;
  }
}
