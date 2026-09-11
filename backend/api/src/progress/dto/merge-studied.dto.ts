import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MergeStudiedDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(256, { each: true })
  keys!: string[];

  @IsOptional()
  @IsIn(['male', 'female'])
  bodyModel?: string;
}
