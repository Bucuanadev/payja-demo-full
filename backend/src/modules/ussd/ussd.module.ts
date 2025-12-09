import { Module } from '@nestjs/common';
import { UssdController } from './ussd.controller';
import { UssdService } from './ussd.service';
import { PrismaService } from '../../prisma.service';
import { ScoringModule } from '../scoring/scoring.module';
import { LoansModule } from '../loans/loans.module';
import { SmsModule } from '../sms/sms.module';
import { CrossValidationModule } from '../cross-validation/cross-validation.module';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';

@Module({
  imports: [ScoringModule, LoansModule, SmsModule, CrossValidationModule, BankAdaptersModule],
  controllers: [UssdController],
  providers: [UssdService, PrismaService],
  exports: [UssdService],
})
export class UssdModule {}
