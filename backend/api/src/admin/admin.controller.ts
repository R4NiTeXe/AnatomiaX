import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { AdminCohortsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.getOverview();
  }

  @Get('users')
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('cohorts')
  cohorts(@Query() query: AdminCohortsQueryDto) {
    return this.admin.listCohorts(query);
  }

  @Get('cohorts/:id')
  async cohort(@Param('id') id: string) {
    const found = await this.admin.getCohort(id);
    if (!found) throw new NotFoundException('Cohort not found');
    return found;
  }
}
