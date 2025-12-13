import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Post('reset-test-data')
  async resetTestData() {
    return this.adminService.resetTestData();
  }

  @Get('customers')
  async getCustomers(@Query() filters: any) {
    return this.adminService.getCustomers(filters);
  }

  @Get('customers/:id')
  async getCustomerById(@Param('id') id: string) {
    return this.adminService.getCustomerById(id);
  }

  @Patch('customers/:id')
  async updateCustomer(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateCustomer(id, data);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() filters: any) {
    return this.adminService.getAuditLogs(filters);
  }
}
