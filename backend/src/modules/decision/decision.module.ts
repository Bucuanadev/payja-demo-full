import { Module } from '@nestjs/common';
import { DecisionService } from './decision.service';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [DecisionService, PrismaService],
  exports: [DecisionService],
})
export class DecisionModule {}
