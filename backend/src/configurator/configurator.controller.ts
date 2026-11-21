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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { ConfiguratorService } from './configurator.service';
import { ConfigurationDto } from './configurator.dto';
import { CORE_SLOTS, OPTIONAL_SLOTS } from './compatibility';

const SLOTS = [...CORE_SLOTS, ...OPTIONAL_SLOTS];
const IDS = {
  name: 'ids',
  required: false,
  description: 'Composants déjà choisis, séparés par des virgules (ex. 12,40)',
};

// Public : composants compatibles et vérification d'une configuration
@ApiTags('Configurateur')
@Controller('configurator')
export class ConfiguratorController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @ApiOperation({
    summary: 'Pièces compatibles pour un emplacement',
    description:
      'Seules les pièces compatibles avec la sélection en cours (socket, type de mémoire, format, puissance…).',
  })
  @ApiQuery({ name: 'slot', required: true, enum: SLOTS })
  @ApiQuery(IDS)
  @Get('parts')
  parts(@Query('slot') slot?: string, @Query('ids') ids?: string) {
    return this.configurator.parts(slot, ids);
  }

  @ApiOperation({
    summary: 'Pièces à suggérer sur une fiche produit',
    description: 'Composants compatibles avec le produit consulté.',
  })
  @ApiQuery({ name: 'productId', required: true, example: 2494 })
  @Get('suggestions')
  suggestions(@Query('productId') productId?: string) {
    return this.configurator.suggestions(productId);
  }

  @ApiOperation({
    summary: 'Vérifier une configuration',
    description:
      'Compatibilité pièce par pièce, consommation estimée et configuration complète ou non.',
  })
  @ApiQuery({ ...IDS, required: true })
  @Get('check')
  check(@Query('ids') ids?: string) {
    return this.configurator.check(ids);
  }
}

// Connecté : configurations enregistrées de l'utilisateur
@ApiTags('Configurations enregistrées')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('configurations')
export class ConfigurationsController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @ApiOperation({ summary: 'Mes configurations' })
  @Get()
  list(@Req() req: AuthedRequest) {
    return this.configurator.listConfigurations(req.user!.id);
  }

  @ApiOperation({ summary: 'Détail d’une configuration' })
  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.configurator.getConfiguration(req.user!.id, id);
  }

  @ApiOperation({
    summary: 'Enregistrer une configuration',
    description: 'Refusée si les pièces sont incompatibles entre elles.',
  })
  @Post()
  create(@Req() req: AuthedRequest, @Body() body: ConfigurationDto) {
    return this.configurator.createConfiguration(req.user!.id, body);
  }

  @ApiOperation({ summary: 'Modifier une configuration' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConfigurationDto,
  ) {
    return this.configurator.updateConfiguration(req.user!.id, id, body);
  }

  @ApiOperation({ summary: 'Supprimer une configuration' })
  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.configurator.deleteConfiguration(req.user!.id, id);
  }
}
