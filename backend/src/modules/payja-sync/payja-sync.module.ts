import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { PayjaSyncController } from './payja-sync.controller';
import { PayjaSyncService } from './payja-sync.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  controllers: [PayjaSyncController],
  providers: [PayjaSyncService, PrismaService],
  exports: [PayjaSyncService],
})
export class PayjaSyncModule {}
