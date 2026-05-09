import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TokenRequestDto {
  @ApiProperty({ description: 'Admin secret configured in environment' })
  @IsString()
  @MinLength(1)
  adminSecret!: string;
}

export class TokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ example: '24h' })
  expires_in!: string;
}
