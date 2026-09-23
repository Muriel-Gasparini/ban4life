import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { loadEnv } from '../../config/env';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.JWT_SECRET,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
