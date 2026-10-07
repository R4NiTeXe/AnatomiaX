import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Quiz, QuizQuestion, QuizStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SafeUser } from '../users/users.service';
import type { AddQuestionDto } from './dto/add-question.dto';
import type { CreateQuizDto } from './dto/create-quiz.dto';
import type { SubmitBankAttemptDto } from './dto/submit-bank-attempt.dto';
import type { UpdateQuestionDto } from './dto/update-question.dto';
import type { UpdateQuizDto } from './dto/update-quiz.dto';
import { CohortsService } from '../cohorts/cohorts.service';

export interface BankAttemptResult {
  attemptId: string;
  quizId: string;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  percentage: number;
  completedAt: Date;
  results: Array<{ questionId: string; selected: number | null; correct: boolean }>;
}

interface StoredAnswer {
  questionId: string;
  selected: number | null;
  correct: boolean;
}

export interface QuizQuestionView {
  id: string;
  prompt: string;
  options: string[];
  position: number;
  correctIndex?: number;
}

export interface QuizView {
  id: string;
  title: string;
  description: string | null;
  bodyModel: string | null;
  status: QuizStatus;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  questionCount: number;
  questions?: QuizQuestionView[];
}

type QuizRow = Quiz & { questions?: QuizQuestion[] };

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cohorts: CohortsService
  ) {}

  private canManage(user: SafeUser, quiz: { createdById: string | null }): boolean {
    return user.role === 'ADMIN' || quiz.createdById === user.id;
  }

  private sanitizeQuestion(q: QuizQuestion, includeKey: boolean): QuizQuestionView {
    const view: QuizQuestionView = {
      id: q.id,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      position: q.position,
    };
    if (includeKey) view.correctIndex = q.correctIndex;
    return view;
  }

  private async toView(quiz: QuizRow, includeKey: boolean): Promise<QuizView> {
    const questions = quiz.questions ?? [];
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      bodyModel: quiz.bodyModel,
      status: quiz.status,
      createdById: quiz.createdById,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questionCount: questions.length,
      questions: questions.map(q => this.sanitizeQuestion(q, includeKey)),
    };
  }

  private async questionCount(quizId: string): Promise<number> {
    return this.prisma.quizQuestion.count({ where: { quizId } });
  }

  async createQuiz(author: SafeUser, dto: CreateQuizDto): Promise<QuizView> {
    const quiz = await this.prisma.quiz.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        bodyModel: dto.bodyModel ?? null,
        createdById: author.id,
      },
    });
    await this.audit.record(author, 'quiz.created', 'quiz', quiz.id, { title: quiz.title });
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      bodyModel: quiz.bodyModel,
      status: quiz.status,
      createdById: quiz.createdById,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questionCount: 0,
      questions: [],
    };
  }

  async getQuiz(actor: SafeUser, id: string): Promise<QuizView> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const manager = this.canManage(actor, quiz);
    if (quiz.status !== 'PUBLISHED' && !manager) {
      throw new NotFoundException('Quiz not found');
    }
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return this.toView({ ...quiz, questions }, manager);
  }

  async listQuizzes(actor: SafeUser, mine?: boolean): Promise<QuizView[]> {
    const where =
      actor.role === 'ADMIN'
        ? mine
          ? { createdById: actor.id }
          : {}
        : mine
          ? { createdById: actor.id }
          : actor.role === 'TEACHER'
            ? { OR: [{ status: 'PUBLISHED' as QuizStatus }, { createdById: actor.id }] }
            : { status: 'PUBLISHED' as QuizStatus };
    const quizzes = await this.prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      quizzes.map(async q => {
        const view = await this.toView(q, this.canManage(actor, q));
        view.questionCount = await this.questionCount(q.id);
        view.questions = undefined;
        return view;
      })
    );
  }

  protected async requireManagedQuiz(
    actor: SafeUser,
    id: string
  ): Promise<{ quiz: Quiz; manager: true }> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (!this.canManage(actor, quiz)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return { quiz, manager: true as const };
  }

  protected async failArchived(quiz: { id: string; status: QuizStatus }): Promise<void> {
    if (quiz.status === 'ARCHIVED') {
      throw new ConflictException('Quiz is archived');
    }
  }

  async addQuestion(
    actor: SafeUser,
    quizId: string,
    dto: AddQuestionDto
  ): Promise<QuizQuestionView> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.failArchived(quiz);
    const options = this.validateOptions(dto.options, dto.correctIndex);
    const question = await this.prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        prompt: dto.prompt.trim(),
        options,
        correctIndex: dto.correctIndex,
        position: dto.position ?? 0,
      },
    });
    await this.auditRecord(actor, 'quiz.question.added', quiz.id, { questionId: question.id });
    return this.sanitizeQuestion(question, true);
  }

  async updateQuiz(actor: SafeUser, quizId: string, dto: UpdateQuizDto): Promise<QuizView> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.failArchived(quiz);
    const data: { title?: string; description?: string | null; bodyModel?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.bodyModel !== undefined) data.bodyModel = dto.bodyModel;
    const updated = await this.prisma.quiz.update({ where: { id: quiz.id }, data });
    await this.auditRecord(actor, 'quiz.updated', quiz.id);
    return this.getQuiz(actor, updated.id);
  }

  private validateOptions(options: string[], correctIndex: number): string[] {
    const cleaned = options.map(o => o.trim());
    if (cleaned.some(o => o.length === 0)) {
      throw new BadRequestException('Options must not be blank');
    }
    if (correctIndex >= cleaned.length) {
      throw new BadRequestException('correctIndex is out of range for options');
    }
    return cleaned;
  }

  async updateQuestion(
    actor: SafeUser,
    quizId: string,
    questionId: string,
    dto: UpdateQuestionDto
  ): Promise<QuizQuestionView> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.failArchived(quiz);
    if (quiz.status !== 'DRAFT') {
      throw new ConflictException('Questions of a published quiz are immutable');
    }
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId: quiz.id },
    });
    if (!question) throw new NotFoundException('Question not found');
    const options = dto.options ?? (question.options as string[]);
    const correctIndex = dto.correctIndex ?? question.correctIndex;
    const cleaned = this.validateOptions(options, correctIndex);
    const updated = await this.prisma.quizQuestion.update({
      where: { id: question.id },
      data: {
        ...(dto.prompt !== undefined ? { prompt: dto.prompt.trim() } : {}),
        ...(dto.options !== undefined ? { options: cleaned } : {}),
        ...(dto.correctIndex !== undefined || dto.options !== undefined ? { correctIndex } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
    await this.auditRecord(actor, 'quiz.question.updated', quiz.id, { questionId });
    return this.sanitizeQuestion(updated, true);
  }

  async deleteQuestion(actor: SafeUser, quizId: string, questionId: string): Promise<void> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.failArchived(quiz);
    if (quiz.status !== 'DRAFT') {
      throw new ConflictException('Questions of a published quiz are immutable');
    }
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId: quiz.id },
    });
    if (!question) throw new NotFoundException('Question not found');
    await this.prisma.quizQuestion.delete({ where: { id: question.id } });
    await this.auditRecord(actor, 'quiz.question.deleted', quiz.id, { questionId });
  }

  async archiveQuiz(actor: SafeUser, quizId: string): Promise<QuizView> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    if (quiz.status === 'ARCHIVED') return this.getQuiz(actor, quizId);
    const updated = await this.prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: 'ARCHIVED' },
    });
    await this.auditRecord(actor, 'quiz.archived', quiz.id);
    return this.getQuiz(actor, updated.id);
  }

  async deleteQuiz(actor: SafeUser, quizId: string): Promise<void> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.prisma.quiz.delete({ where: { id: quiz.id } });
    await this.auditRecord(actor, 'quiz.deleted', quiz.id, { title: quiz.title });
  }

  async listAttempts(
    actor: SafeUser,
    quizId: string,
    cohortId?: string,
    limit?: number
  ): Promise<Array<Record<string, unknown>>> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const take = this.saneTake(limit, 100);
    const where: Record<string, unknown> = { quizId: quiz.id };
    if (actor.role !== 'ADMIN' && quiz.createdById !== actor.id) {
      if (actor.role !== 'TEACHER' || !cohortId) {
        if (actor.role === 'STUDENT') {
          where.userId = actor.id;
        } else {
          throw new ForbiddenException('Specify a managed cohort');
        }
      } else {
        where.userId = { in: await this.managedMemberIds(actor, cohortId) };
      }
    }
    const attempts = await this.prisma.quizAttempt.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take,
    });
    return attempts.map(a => ({
      attemptId: a.id,
      userId: a.userId,
      score: a.score,
      total: a.total,
      percentage: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
      completedAt: a.completedAt,
    }));
  }

  async getAttempt(actor: SafeUser, quizId: string, attemptId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (actor.role === 'STUDENT') {
      return this.getOwnAttempt(actor, quizId, attemptId);
    }
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, quizId: quiz.id },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (actor.role !== 'ADMIN' && quiz.createdById !== actor.id) {
      const visible = await this.teacherVisibleUserIds(actor);
      if (!visible.has(attempt.userId)) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return this.toAttemptResult(attempt);
  }

  private async teacherVisibleUserIds(actor: SafeUser): Promise<Set<string>> {
    const ids = new Set<string>();
    if (actor.role !== 'TEACHER') return ids;
    const mine = await this.cohorts.listMine(actor);
    for (const cohort of mine.filter(c => c.myRole === 'OWNER')) {
      const members = await this.cohorts.listMembers(actor, cohort.id);
      for (const member of members) ids.add(member.userId);
    }
    return ids;
  }

  private async managedMemberIds(actor: SafeUser, cohortId: string): Promise<string[]> {
    let view;
    try {
      view = await this.cohorts.get(actor, cohortId);
    } catch {
      throw new NotFoundException('Cohort not found');
    }
    if (view.myRole !== 'OWNER' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }
    const members = await this.cohorts.listMembers(actor, cohortId);
    return members.map(m => m.userId);
  }

  async quizStats(actor: SafeUser, quizId: string, cohortId?: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (actor.role === 'STUDENT') {
      throw new ForbiddenException('Insufficient permissions');
    }
    const rows = (await this.listAttempts(actor, quizId, cohortId, 1000)) as Array<{
      userId: string;
      score: number;
      total: number;
    }>;
    const detailed = await this.prisma.quizAttempt.findMany({
      where:
        rows.length > 0
          ? { quizId: quiz.id, userId: { in: [...new Set(rows.map(r => r.userId as string))] } }
          : { quizId: quiz.id, id: '__none__' },
      take: 1000,
    });
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: quiz.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const storedAnswers = (a: { answers: unknown }): StoredAnswer[] =>
      Array.isArray(a.answers) ? (a.answers as StoredAnswer[]) : [];
    const perQuestion = questions.map(q => {
      const withAnswer = detailed.filter(a => storedAnswers(a).some(r => r.questionId === q.id));
      const correct = withAnswer.filter(a =>
        storedAnswers(a).some(r => r.questionId === q.id && r.correct)
      ).length;
      return {
        questionId: q.id,
        position: q.position,
        attempts: withAnswer.length,
        correct,
        rate: withAnswer.length > 0 ? Math.round((correct / withAnswer.length) * 100) : 0,
      };
    });
    const avgScore =
      rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 10) / 10
        : 0;
    const avgPercentage =
      rows.length > 0
        ? Math.round(
            (rows.reduce((s, r) => s + (r.total > 0 ? r.score / r.total : 0), 0) / rows.length) *
              100
          )
        : 0;
    return {
      quizId: quiz.id,
      attempts: rows.length,
      avgScore,
      avgPercentage,
      totalQuestions: questions.length,
      perQuestion,
    };
  }

  private saneTake(limit: number | undefined, max: number): number {
    const sane = typeof limit === 'number' && Number.isFinite(limit) ? limit : 20;
    return Math.min(Math.max(sane, 1), max);
  }

  async publishQuiz(actor: SafeUser, quizId: string): Promise<QuizView> {
    const { quiz } = await this.requireManagedQuiz(actor, quizId);
    await this.failArchived(quiz);
    if (quiz.status === 'PUBLISHED') return this.getQuiz(actor, quizId);
    const count = await this.questionCount(quiz.id);
    if (count === 0) {
      throw new ConflictException('Cannot publish a quiz with no questions');
    }
    const updated = await this.prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: 'PUBLISHED' },
    });
    await this.auditRecord(actor, 'quiz.published', quiz.id);
    return this.getQuiz(actor, updated.id);
  }

  async submitAttempt(
    actor: SafeUser,
    quizId: string,
    dto: SubmitBankAttemptDto
  ): Promise<BankAttemptResult> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || quiz.status !== 'PUBLISHED') {
      throw new NotFoundException('Quiz not found');
    }
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: quiz.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (questions.length === 0) {
      throw new ConflictException('Quiz has no questions');
    }
    const byId = new Map(questions.map(q => [q.id, q]));
    const seen = new Set<string>();
    for (const answer of dto.answers) {
      const question = byId.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('Unknown question for this quiz');
      }
      if (seen.has(answer.questionId)) {
        throw new BadRequestException('Duplicate answer for question');
      }
      seen.add(answer.questionId);
      const options = Array.isArray(question.options) ? question.options : [];
      if (answer.selectedIndex >= options.length) {
        throw new BadRequestException('Selected option is out of range');
      }
    }
    const results = questions.map(q => {
      const submitted = dto.answers.find(a => a.questionId === q.id);
      const selected = submitted ? submitted.selectedIndex : null;
      return {
        questionId: q.id,
        selected,
        correct: selected !== null && selected === q.correctIndex,
      };
    });
    const correct = results.filter(r => r.correct).length;
    const total = questions.length;
    const snapshot = questions.map(q => ({
      questionId: q.id,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correctIndex,
      position: q.position,
    }));
    let startedAt: Date | null = null;
    if (dto.startedAt !== undefined) {
      startedAt = new Date(dto.startedAt);
      if (Number.isNaN(startedAt.getTime())) {
        throw new BadRequestException('Invalid startedAt timestamp');
      }
    }
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId: actor.id,
        bodyModel: quiz.bodyModel ?? 'general',
        score: correct,
        total,
        answers: results,
        startedAt,
        quizId: quiz.id,
        questionSnapshot: snapshot,
      },
    });
    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      score: correct,
      total,
      correct,
      incorrect: total - correct,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      completedAt: attempt.completedAt,
      results,
    };
  }

  async listOwnAttempts(actor: SafeUser, quizId: string, limit?: number) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, userId: actor.id },
      orderBy: { completedAt: 'desc' },
      take: this.saneTake(limit, 100),
    });
    return attempts.map(a => this.toAttemptResult(a));
  }

  async getOwnAttempt(actor: SafeUser, quizId: string, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, quizId, userId: actor.id },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return this.toAttemptResult(attempt);
  }

  private toAttemptResult(attempt: {
    id: string;
    quizId: string | null;
    score: number;
    total: number;
    completedAt: Date;
    answers: unknown;
  }): BankAttemptResult {
    const results = (Array.isArray(attempt.answers) ? attempt.answers : []) as Array<{
      questionId: string;
      selected: number | null;
      correct: boolean;
    }>;
    const correct = results.filter(r => r.correct).length;
    return {
      attemptId: attempt.id,
      quizId: attempt.quizId ?? '',
      score: attempt.score,
      total: attempt.total,
      correct,
      incorrect: attempt.total - correct,
      percentage: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
      completedAt: attempt.completedAt,
      results,
    };
  }

  protected async auditRecord(
    actor: SafeUser,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.audit.record(actor, action, 'quiz', targetId, metadata);
  }
}
