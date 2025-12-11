import { Module } from '@nestjs/common';
import { BankAdaptersService } from './bank-adapters.service';
import { BankAdaptersController } from './bank-adapters.controller';
import { PrismaService } from '../../prisma.service';

// Adaptadores específicos por banco
import { LetsegoAdapter } from './adapters/letsego.adapter';
import { MbimAdapter } from './adapters/mbim.adapter';
import { BciAdapter } from './adapters/bci.adapter';
import { StandardBankAdapter } from './adapters/standard-bank.adapter';

@Module({
  controllers: [BankAdaptersController],
  providers: [
    BankAdaptersService,
    PrismaService,
    LetsegoAdapter,
    MbimAdapter,
    BciAdapter,
    StandardBankAdapter,
  ],
  exports: [BankAdaptersService],
})
export class BankAdaptersModule {}
