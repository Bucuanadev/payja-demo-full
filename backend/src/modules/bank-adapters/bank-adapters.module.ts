import { Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BankAdaptersService } from './bank-adapters-v2.service';
import { BankAdaptersController } from './bank-adapters.controller';
import { BankPartnersController } from './bank-partners.controller';
import { PrismaService } from '../../prisma.service';
import { UniversalBankAdapter } from './adapters/universal.adapter';

@Module({
  imports: [HttpModule],
  controllers: [BankAdaptersController, BankPartnersController],
  providers: [
    BankAdaptersService,
    PrismaService,
    UniversalBankAdapter,
  ],
  exports: [BankAdaptersService],
})
export class BankAdaptersModule implements OnModuleInit {
  constructor(private readonly bankAdaptersService: BankAdaptersService) {}
  async onModuleInit() {
    await this.bankAdaptersService.initializeAdapters();
  }
}
