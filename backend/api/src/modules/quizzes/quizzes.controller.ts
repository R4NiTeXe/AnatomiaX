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
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { SafeUser } from '../users/users.service';
import { QuizzesService } from './quizzes.service';
import { AddQuestionDto } from './dto/add-question.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitBankAttemptDto } from './dto/submit-bank-attempt.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Controller('v1/quizzes')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN')
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateQuizDto) {
    return this.quizzes.createQuiz(user, dto);
  }

  @Get()
  list(@CurrentUser() user: SafeUser, @Query('mine') mine?: string) {
    return this.quizzes.listQuizzes(user, mine === 'true');
  }

  @Get(':id')
  get(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.quizzes.getQuiz(user, id);
  }

  @Post(':id/questions')
  @HttpCode(201)
  addQuestion(@CurrentUser() user: SafeUser, @Param('id') id: string, @Body() dto: AddQuestionDto) {
    return this.quizzes.addQuestion(user, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.quizzes.publishQuiz(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: SafeUser, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.quizzes.updateQuiz(user, id, dto);
  }

  @Patch(':id/questions/:questionId')
  updateQuestion(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto
  ) {
    return this.quizzes.updateQuestion(user, id, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  @HttpCode(200)
  deleteQuestion(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string
  ) {
    return this.quizzes
      .deleteQuestion(user, id, questionId)
      .then(() => ({ status: 'ok' as const }));
  }

  @Post(':id/attempts')
  @HttpCode(201)
  submit(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: SubmitBankAttemptDto
  ) {
    return this.quizzes.submitAttempt(user, id, dto);
  }

  @Get(':id/attempts')
  attempts(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cohortId') cohortId?: string
  ) {
    const parsed = limit === undefined ? undefined : Number(limit);
    return this.quizzes.listAttempts(user, id, cohortId, parsed);
  }

  @Get(':id/attempts/:attemptId')
  attempt(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('attemptId') attemptId: string
  ) {
    return this.quizzes.getAttempt(user, id, attemptId);
  }

  @Get(':id/stats')
  stats(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('cohortId') cohortId?: string
  ) {
    return this.quizzes.quizStats(user, id, cohortId);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.quizzes.archiveQuiz(user, id);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.quizzes.deleteQuiz(user, id).then(() => ({ status: 'ok' as const }));
  }
}
