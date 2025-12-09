import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PrismaService } from '../../prisma.service';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';
import { CrossValidationModule } from '../cross-validation/cross-validation.module';

@Module({
  imports: [BankAdaptersModule, CrossValidationModule],
  controllers: [ScoringController],
  providers: [ScoringService, PrismaService],
  exports: [ScoringService],
})
export class ScoringModule {}
