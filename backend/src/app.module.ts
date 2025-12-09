import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { LoansModule } from './modules/loans/loans.module';
import { AdminModule } from './modules/admin/admin.module';
import { BankAdaptersModule } from './modules/bank-adapters/bank-adapters.module';
import { MobileOperatorAdaptersModule } from './modules/mobile-operator-adapters/mobile-operator-adapters.module';
import { SmsModule } from './modules/sms/sms.module';
import { UssdMovitelModule } from './modules/ussd-movitel/ussd-movitel.module';
import { CrossValidationModule } from './modules/cross-validation/cross-validation.module';
import { BancoWebhooksModule } from './modules/banco-webhooks/banco-webhooks.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UssdMovitelModule,
    SmsModule,
    ScoringModule,
    LoansModule,
    AdminModule,
    BankAdaptersModule,
    MobileOperatorAdaptersModule,
    CrossValidationModule,
    BancoWebhooksModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
