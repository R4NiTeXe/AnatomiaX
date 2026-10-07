import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class PushKeysDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  p256dh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  auth?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNumber()
  @Min(0)
  expirationTime?: number;
}

export class RegisterSubscriptionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
