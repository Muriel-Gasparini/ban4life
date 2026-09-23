import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader) {
      // Also check query param token for SSE EventSource which doesn't support headers natively
      const queryToken = request.query?.token as string | undefined;
      if (queryToken && this.authService.verifyToken(queryToken)) {
        return true;
      }
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de autorização inválido');
    }

    const isValid = this.authService.verifyToken(token);
    if (!isValid) {
      throw new UnauthorizedException('Token de autenticação inválido ou expirado');
    }

    return true;
  }
}
