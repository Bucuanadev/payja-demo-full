import { Module } from '@nestjs/common';
import { MobileOperatorAdaptersService } from './mobile-operator-adapters.service';
import { MobileOperatorAdaptersController } from './mobile-operator-adapters.controller';
import { MpesaAdapter } from './adapters/mpesa.adapter';
import { EMolaAdapter } from './adapters/emola.adapter';
import { MkeshAdapter } from './adapters/mkesh.adapter';

@Module({
  controllers: [MobileOperatorAdaptersController],
  providers: [
    MobileOperatorAdaptersService,
    MpesaAdapter,
    EMolaAdapter,
    MkeshAdapter,
  ],
  exports: [MobileOperatorAdaptersService],
})
export class MobileOperatorAdaptersModule {}
