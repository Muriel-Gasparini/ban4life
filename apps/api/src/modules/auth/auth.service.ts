import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { loadEnv } from '../../config/env';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(password: string): { token: string } {
    const env = loadEnv();
    if (password !== env.ADMIN_PASSWORD) {
      throw new UnauthorizedException('Senha incorreta');
    }

    const payload = { sub: 'admin', role: 'admin' };
    const token = this.jwtService.sign(payload);
    return { token };
  }

  verifyToken(token: string): boolean {
    try {
      this.jwtService.verify(token);
      return true;
    } catch {
      return false;
    }
  }
}
