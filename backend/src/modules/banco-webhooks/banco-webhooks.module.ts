import { Module } from '@nestjs/common';
import { BancoWebhooksController } from './banco-webhooks.controller';
import { BancoWebhooksService } from './banco-webhooks.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [BancoWebhooksController],
  providers: [BancoWebhooksService, PrismaService],
  exports: [BancoWebhooksService],
})
export class BancoWebhooksModule {}
