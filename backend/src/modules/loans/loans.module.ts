import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { PrismaService } from '../../prisma.service';
import { InterestRateService } from './interest-rate.service';

@Module({
  controllers: [LoansController],
  providers: [LoansService, PrismaService, InterestRateService],
  exports: [LoansService, InterestRateService],
})
export class LoansModule {}
