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
