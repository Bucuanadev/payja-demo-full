import { Controller, Get, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('public-admin')
export class PublicAdminController {
  constructor(private adminService: AdminService) {}

  @Get('customers')
  async getCustomers(@Query() filters: any) {
    return this.adminService.getCustomers(filters);
  }

  @Get('customers/:id')
  async getCustomerById(@Param('id') id: string) {
    return this.adminService.getCustomerById(id);
  }
}
