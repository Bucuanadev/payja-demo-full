import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { LoansModule } from './modules/loans/loans.module';
import { AdminModule } from './modules/admin/admin.module';
import { BankAdaptersModule } from './modules/bank-adapters/bank-adapters.module';
import { MobileOperatorAdaptersModule } from './modules/mobile-operator-adapters/mobile-operator-adapters.module';
import { PayjaSyncModule } from './modules/payja-sync/payja-sync.module';
import { BankSyncModule } from './modules/bank-sync/bank-sync.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    ScoringModule,
    LoansModule,
    AdminModule,
    BankAdaptersModule,
    MobileOperatorAdaptersModule,
    PayjaSyncModule,
    BankSyncModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
