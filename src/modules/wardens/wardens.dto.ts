import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { WardenStatus } from '../../common/types/constant.js';

export class RegisterWardenDto {
  @ApiProperty({ example: 'Amara Okonkwo' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phoneNumber must be in E.164 format (+country code + number)' })
  phoneNumber!: string;

  @ApiPropertyOptional({ example: '6627f3e2a1b2c3d4e5f60001' })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiPropertyOptional({ example: '66666666q', description: 'Government ID document number for KYC verification' })
  @IsOptional()
  @IsString()
  idDocument?: string;
}

export class ListWardensDto extends PaginationDto {
  @ApiPropertyOptional({ example: '6627f3e2a1b2c3d4e5f60001' })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiPropertyOptional({ enum: WardenStatus })
  @IsOptional()
  @IsEnum(WardenStatus)
  status?: WardenStatus;
}
