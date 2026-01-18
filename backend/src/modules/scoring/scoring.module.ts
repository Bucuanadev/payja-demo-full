import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PrismaService } from '../../prisma.service';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';

@Module({
  imports: [BankAdaptersModule],
  controllers: [ScoringController],
  providers: [ScoringService, PrismaService],
  exports: [ScoringService],
})
export class ScoringModule {}
