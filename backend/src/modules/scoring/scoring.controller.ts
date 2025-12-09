import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private scoringService: ScoringService) {}

  @Get('customer/:customerId')
  async getCustomerScore(@Param('customerId') customerId: string) {
    return this.scoringService.getCustomerScore(customerId);
  }
}
