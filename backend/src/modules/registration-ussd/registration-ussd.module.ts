import { Module } from '@nestjs/common';
import { RegistrationUssdService } from './registration-ussd.service';
import { RegistrationUssdController } from './registration-ussd.controller';
import { PrismaService } from '../../prisma.service';
import { SmsModule } from '../sms/sms.module';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';

@Module({
  imports: [SmsModule, BankAdaptersModule],
  controllers: [RegistrationUssdController],
  providers: [RegistrationUssdService, PrismaService],
  exports: [RegistrationUssdService],
})
export class RegistrationUssdModule {}
