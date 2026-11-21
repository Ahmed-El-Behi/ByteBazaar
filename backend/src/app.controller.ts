import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Santé')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'État de l’API et de la base de données' })
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }
    return { status: 'ok', database: 'connected' };
  }
}
