import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { SafeUser } from '../users/users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CohortsService } from './cohorts.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { JoinCohortDto } from './dto/join-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';

@Controller('v1/cohorts')
@UseGuards(JwtAuthGuard)
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
}
