import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PublicAdminController } from './public-admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AdminController, PublicAdminController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
