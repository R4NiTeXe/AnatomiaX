import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SafeUser } from '../users/users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CohortsService } from './cohorts.service';
import { AssignModuleDto } from './dto/assign-module.dto';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { JoinCohortDto } from './dto/join-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';

@Controller('v1/cohorts')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class CohortsController {
  constructor(private readonly cohorts: CohortsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN')
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateCohortDto) {
    return this.cohorts.create(user, dto);
  }

  @Get()
  listMine(@CurrentUser() user: SafeUser) {
    return this.cohorts.listMine(user);
  }

  @Post('join')
  join(@CurrentUser() user: SafeUser, @Body() dto: JoinCohortDto) {
    return this.cohorts.join(user, dto.inviteCode);
  }

  @Get('assignments/mine')
  listMyAssignments(@CurrentUser() user: SafeUser) {
    return this.cohorts.listMyAssignments(user);
  }

  @Get(':id')
  get(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: SafeUser, @Param('id') id: string, @Body() dto: UpdateCohortDto) {
    return this.cohorts.update(user, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.archive(user, id);
  }

  @Post(':id/invite/regenerate')
  regenerateInvite(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.regenerateInvite(user, id);
  }

  @Post(':id/leave')
  leave(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.leave(user, id);
  }

  @Get(':id/members')
  listMembers(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.listMembers(user, id);
  }

  @Get(':id/progress')
  getProgress(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.getProgress(user, id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('userId') userId: string
  ) {
    return this.cohorts.removeMember(user, id, userId);
  }

  @Post(':id/assignments')
  assignModule(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: AssignModuleDto
  ) {
    return this.cohorts.assignModule(user, id, dto.moduleKey);
  }

  @Get(':id/assignments')
  listAssignments(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.cohorts.listAssignments(user, id);
  }

  @Delete(':id/assignments/:moduleKey')
  unassignModule(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('moduleKey') moduleKey: string
  ) {
    return this.cohorts.unassignModule(user, id, moduleKey);
  }
}
