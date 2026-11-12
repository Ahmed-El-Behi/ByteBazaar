import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/** Limite le nombre d'appels par adresse IP sur une route : @RateLimit(10, 15 * 60_000) */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);

// Limiteur en mémoire (suffisant pour une seule instance du serveur)
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = `${context.getClass().name}.${context.getHandler().name}:${request.ip}`;
    const now = Date.now();

    if (this.hits.size > 10_000) this.purge(now);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    entry.count++;
    if (entry.count > options.limit) {
      const minutes = Math.ceil((entry.resetAt - now) / 60_000);
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: [`Trop de tentatives. Réessaie dans ${minutes} min.`],
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private purge(now: number) {
    for (const [key, entry] of this.hits)
      if (entry.resetAt <= now) this.hits.delete(key);
  }
}
