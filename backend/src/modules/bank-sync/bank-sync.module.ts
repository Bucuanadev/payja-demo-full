import { Module } from '@nestjs/common';
import { BankSyncController } from './bank-sync.controller';
import { BankSyncService } from './bank-sync.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [BankSyncController],
  providers: [BankSyncService, PrismaService],
})
export class BankSyncModule {}
