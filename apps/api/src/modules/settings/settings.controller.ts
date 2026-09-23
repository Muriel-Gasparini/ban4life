import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsDto, UpdateSettingsDto } from '@linkeshield/types';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(): Promise<SettingsDto> {
    return this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() body: UpdateSettingsDto): Promise<SettingsDto> {
    return this.settingsService.updateSettings(body);
  }
}
