import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { SafeUser } from '../users/users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListAttemptsQuery } from './dto/list-attempts.query';
import { MergeStudiedDto } from './dto/merge-studied.dto';
import { ProgressService } from './progress.service';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';

@Controller('v1/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Post('quiz-attempts')
  submitAttempt(@CurrentUser() user: SafeUser, @Body() dto: SubmitQuizAttemptDto) {
    return this.progress.submitAttempt(user, dto);
  }

  @Get('quiz-attempts')
  listAttempts(@CurrentUser() user: SafeUser, @Query() query: ListAttemptsQuery) {
    return this.progress.listAttempts(user, query.limit);
  }

  @Get('snapshot')
  getSnapshot(@CurrentUser() user: SafeUser) {
    return this.progress.getSnapshot(user);
  }

  @Patch('snapshot/studied')
  mergeStudied(@CurrentUser() user: SafeUser, @Body() dto: MergeStudiedDto) {
    return this.progress.mergeStudied(user, dto);
  }
}
