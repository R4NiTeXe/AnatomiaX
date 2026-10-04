import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsISO8601,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BankAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsInt()
  @Min(0)
  selectedIndex!: number;
}

/**
 * Bank-graded submission. Deliberately carries NO score/total/correct
 * fields: the client can never submit authoritative grading — the backend
 * computes everything from the stored bank. Unanswered questions count as
 * incorrect (documented); at least one answer is required.
 */
export class SubmitBankAttemptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BankAnswerDto)
  answers!: BankAnswerDto[];

  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}
