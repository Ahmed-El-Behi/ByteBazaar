import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [AdminController],
  providers: [AdminService, DashboardService],
})
export class AdminModule {}
