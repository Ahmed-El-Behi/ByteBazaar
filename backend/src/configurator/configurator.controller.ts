import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { ConfiguratorService } from './configurator.service';

// Public : composants compatibles et vérification d'une configuration
@Controller('configurator')
export class ConfiguratorController {
  constructor(private readonly configurator: ConfiguratorService) {}

  // GET /configurator/parts?slot=cpu&ids=12,40  (ids = composants déjà choisis)
  @Get('parts')
  parts(@Query('slot') slot?: string, @Query('ids') ids?: string) {
    return this.configurator.parts(slot, ids);
  }

  // GET /configurator/suggestions?productId=12 — pièces compatibles à proposer sur une fiche produit
  @Get('suggestions')
  suggestions(@Query('productId') productId?: string) {
    return this.configurator.suggestions(productId);
  }

  // GET /configurator/check?ids=12,40,77
  @Get('check')
  check(@Query('ids') ids?: string) {
    return this.configurator.check(ids);
  }
}

// Connecté : configurations enregistrées de l'utilisateur
@UseGuards(JwtAuthGuard)
@Controller('configurations')
export class ConfigurationsController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.configurator.listConfigurations(req.user!.id);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.configurator.getConfiguration(req.user!.id, id);
  }

  // Corps : { name, productIds: number[] } — refusé si la configuration est incompatible
  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.configurator.createConfiguration(req.user!.id, body);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.configurator.updateConfiguration(req.user!.id, id, body);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.configurator.deleteConfiguration(req.user!.id, id);
  }
}
