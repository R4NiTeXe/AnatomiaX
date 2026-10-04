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

/**
 * 8.19.24 push-subscription keys.
 *
 * Web Push clients send `{ p256dh, auth }` (from `PushSubscription.toJSON()`).
 * Fields stay optional so future Expo/mobile clients can register an endpoint
 * (e.g. an ExponentPushToken) with a different keys shape without a schema
 * or contract break. Unknown fields are rejected by the global whitelist
 * pipe; extend this DTO deliberately when a new platform needs one.
 */
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
  /**
   * Web: the https push-service URL from `PushSubscription.endpoint`.
   * Future Expo/mobile: the device push token (e.g. `ExponentPushToken[…]`).
   * Kept a plain string (not IsUrl) so both contracts validate.
   */
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
