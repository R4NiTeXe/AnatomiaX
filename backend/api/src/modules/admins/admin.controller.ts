import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { SafeUser } from '../users/users.service';
import { AdminService } from './admin.service';
import { AdminCohortsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { PatchUserRoleDto } from './dto/patch-user-role.dto';

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
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

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id/role')
  setRole(@CurrentUser() actor: SafeUser, @Param('id') id: string, @Body() dto: PatchUserRoleDto) {
    return this.admin.setUserRole(actor, id, dto.role);
  }

  @Post('users/:id/deactivate')
  @HttpCode(200)
  deactivate(@CurrentUser() actor: SafeUser, @Param('id') id: string) {
    return this.admin.deactivateUser(actor, id);
  }

  @Post('users/:id/restore')
  @HttpCode(200)
  restore(@CurrentUser() actor: SafeUser, @Param('id') id: string) {
    return this.admin.restoreUser(actor, id);
  }

  @Delete('users/:id')
  @HttpCode(200)
  remove(@CurrentUser() actor: SafeUser, @Param('id') id: string) {
    return this.admin.deleteUser(actor, id).then(() => ({ status: 'ok' as const }));
  }

  @Get('audit-logs')
  auditLogs(@Query() query: AuditLogsQueryDto) {
    return this.admin.listAuditLogs(query);
  }
}
