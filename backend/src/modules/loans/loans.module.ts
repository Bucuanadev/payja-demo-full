import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { PrismaService } from '../../prisma.service';
import { CommissionService } from './commission.service';
import { BankValidationService } from './bank-validation.service';
import { DisbursementService } from './disbursement.service';
import { InstallmentService } from './installment.service';
import { InterestRateService } from './interest-rate.service';
import { CrossValidationModule } from '../cross-validation/cross-validation.module';

@Module({
  imports: [CrossValidationModule],
  controllers: [LoansController],
  providers: [
    LoansService,
    PrismaService,
    CommissionService,
    BankValidationService,
    DisbursementService,
    InstallmentService,
    InterestRateService,
  ],
  exports: [
    LoansService,
    CommissionService,
    BankValidationService,
    DisbursementService,
    InstallmentService,
    InterestRateService,
  ],
})
export class LoansModule {}
