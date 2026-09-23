import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    process.env.ADMIN_PASSWORD = 'test-secret-password';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should authenticate with valid password and return a JWT token', () => {
    const result = authService.login('test-secret-password');
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
    expect(authService.verifyToken(result.token)).toBe(true);
  });

  it('should throw UnauthorizedException on wrong password', () => {
    expect(() => authService.login('wrong-pass')).toThrow(UnauthorizedException);
  });

  it('should return false for invalid token', () => {
    expect(authService.verifyToken('invalid-jwt-token')).toBe(false);
  });
});
