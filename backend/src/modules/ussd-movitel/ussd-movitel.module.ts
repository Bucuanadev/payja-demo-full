import { Module } from '@nestjs/common';
import { UssdMovitelController } from './ussd-movitel.controller';
import { UssdMovitelService } from './ussd-movitel.service';
import { UssdMenuService } from './ussd-menu.service';
import { OtpService } from './otp.service';
import { PrismaService } from '../../prisma.service';
import { SmsModule } from '../sms/sms.module';
import { LoansModule } from '../loans/loans.module';
import { ScoringModule } from '../scoring/scoring.module';
import { CrossValidationModule } from '../cross-validation/cross-validation.module';

@Module({
  imports: [SmsModule, LoansModule, ScoringModule, CrossValidationModule],
  controllers: [UssdMovitelController],
  providers: [
    UssdMovitelService,
    UssdMenuService,
    OtpService,
    PrismaService,
  ],
  exports: [UssdMovitelService],
})
export class UssdMovitelModule {}
