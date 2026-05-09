import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { apiResponse } from '../../common/utils/api-response.util.js';
import { AuthService } from './auth.service.js';
import { TokenRequestDto } from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Exchange admin secret for JWT access token' })
  @ApiResponse({ status: 201, description: 'JWT issued successfully' })
  @ApiResponse({ status: 401, description: 'Invalid admin secret' })
  generateToken(@Body() dto: TokenRequestDto) {
    const result = this.authService.generateToken(dto);
    return apiResponse(result, HttpStatus.CREATED);
  }
}
