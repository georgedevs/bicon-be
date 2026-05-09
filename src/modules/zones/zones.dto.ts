import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ example: 'Lagos Island' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 6.455 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 3.3841 })
  @IsNumber()
  lng!: number;

  @ApiProperty({ example: 1000, description: 'Radius in metres, minimum 100' })
  @IsNumber()
  @Min(100)
  radius!: number;
}

export class UpdateZoneDto {
  @ApiPropertyOptional({ example: 'Lagos Island North' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
