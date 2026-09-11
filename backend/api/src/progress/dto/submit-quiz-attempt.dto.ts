import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuizAnswerDto } from './quiz-answer.dto';

export class SubmitQuizAttemptDto {
  @IsIn(['male', 'female'])
  bodyModel!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  total!: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];

  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}
