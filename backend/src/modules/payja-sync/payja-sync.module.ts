import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { PayjaSyncController } from './payja-sync.controller';
import { PayjaSyncService } from './payja-sync.service';
import { PayjaSyncAdminController } from './payja-sync.admin.controller';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
    ScheduleModule.forRoot(),
  ],
  controllers: [PayjaSyncController, PayjaSyncAdminController],
  providers: [PayjaSyncService, PrismaService],
  exports: [PayjaSyncService],
})
export class PayjaSyncModule {}
