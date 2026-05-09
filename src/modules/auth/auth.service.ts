import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { TokenRequestDto, TokenResponseDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  generateToken(dto: TokenRequestDto): TokenResponseDto {
    const adminSecret = this.configService.get<string>('admin.secret')!;
    const expiresIn = this.configService.get<string>('jwt.expiresIn')!;

    const expected = Buffer.from(adminSecret);
    const provided = Buffer.from(dto.adminSecret);

    const isValid =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);

    if (!isValid) {
      throw new UnauthorizedException('Invalid admin secret');
    }

    const payload: JwtPayload = { sub: 'admin', role: 'admin' };
    const access_token = this.jwtService.sign(payload);

    return { access_token, expires_in: expiresIn };
  }
}
