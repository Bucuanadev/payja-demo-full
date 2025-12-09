import { Module } from '@nestjs/common';
import { CrossValidationService } from './cross-validation.service';
import { CrossValidationController } from './cross-validation.controller';
import { MockApiService } from './mock-api.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [CrossValidationController],
  providers: [CrossValidationService, MockApiService, PrismaService],
  exports: [CrossValidationService, MockApiService],
})
export class CrossValidationModule {}
