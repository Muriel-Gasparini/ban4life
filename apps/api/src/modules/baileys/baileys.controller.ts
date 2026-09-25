import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BaileysService } from './baileys.service';
import { BaileysQrDto, BaileysStatusDto } from '@ban4life/types';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/baileys')
export class BaileysController {
  constructor(private readonly baileysService: BaileysService) {}

  @Get('status')
  getStatus(): BaileysStatusDto {
    return {
      status: this.baileysService.getStatus(),
    };
  }

  @Get('qr')
  getQrCode(): BaileysQrDto {
    return {
      qr: this.baileysService.getQrCode(),
    };
  }

  @Post('restart')
  async restart() {
    await this.baileysService.restart();
    return { success: true };
  }
}
