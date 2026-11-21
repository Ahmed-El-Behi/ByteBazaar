import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import type { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  it('reports a healthy database', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.health()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns 503 when the database is unreachable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('down')),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.health()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
