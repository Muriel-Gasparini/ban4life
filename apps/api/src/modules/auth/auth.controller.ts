import { Body, Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, Public } from './auth.guard';
import { AuthLoginResponseDto } from '@ban4life/types';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { password?: string }): AuthLoginResponseDto {
    return this.authService.login(body.password || '');
  }

  @UseGuards(AuthGuard)
  @Get('verify')
  verify() {
    return { valid: true };
  }
}
