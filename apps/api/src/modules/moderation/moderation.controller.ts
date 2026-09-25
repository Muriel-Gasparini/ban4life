import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { SpamLogDto, MetricsDto } from '@ban4life/types';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/logs')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get()
  async getRecentLogs(@Query('limit') limit?: string): Promise<SpamLogDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.moderationService.listRecentLogs(isNaN(parsedLimit) ? 50 : parsedLimit);
  }

  @Get('metrics')
  async getMetrics(): Promise<MetricsDto> {
    return this.moderationService.getMetrics();
  }
}
