import { Module, OnModuleInit } from '@nestjs/common';
import { BankAdaptersService } from './bank-adapters-v2.service';
import { BankAdaptersController } from './bank-adapters.controller';
import { BankPartnersController } from './bank-partners.controller';
import { PrismaService } from '../../prisma.service';

// Adaptador Universal
import { UniversalBankAdapter } from './adapters/universal.adapter';

@Module({
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
    // Inicializar adaptadores ao iniciar o módulo
    await this.bankAdaptersService.initializeAdapters();
  }
}
