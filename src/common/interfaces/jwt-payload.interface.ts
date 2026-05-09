export interface JwtPayload {
  sub: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}
