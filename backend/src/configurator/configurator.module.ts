import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  ConfigurationsController,
  ConfiguratorController,
} from './configurator.controller';
import { ConfiguratorService } from './configurator.service';

@Module({
  imports: [AuthModule],
  controllers: [ConfiguratorController, ConfigurationsController],
  providers: [ConfiguratorService],
})
export class ConfiguratorModule {}
