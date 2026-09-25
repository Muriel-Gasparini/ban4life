import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import { DrizzleDB } from '../../database';
import { settings } from '../../database/schema';
import { SettingsDto, UpdateSettingsDto } from '@ban4life/types';

export const DEFAULT_SETTINGS: SettingsDto = {
  deleteSpamMessage: true,
  sendBanNotice: false,
  banNoticeTemplate: '🚫 Mensagem apagada e usuário expulso por divulgação não autorizada.',
  banThreshold: 0.85,
};

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async getSettings(): Promise<SettingsDto> {
    const rows = await this.db.select().from(settings);
    const settingsMap = new Map(rows.map((r) => [r.key, r.value]));

    const deleteSpamMessage = settingsMap.has('deleteSpamMessage')
      ? settingsMap.get('deleteSpamMessage') === 'true'
      : DEFAULT_SETTINGS.deleteSpamMessage;

    const sendBanNotice = settingsMap.has('sendBanNotice')
      ? settingsMap.get('sendBanNotice') === 'true'
      : DEFAULT_SETTINGS.sendBanNotice;

    const banNoticeTemplate =
      settingsMap.get('banNoticeTemplate') || DEFAULT_SETTINGS.banNoticeTemplate;

    const banThresholdRaw = settingsMap.get('banThreshold');
    const banThreshold = banThresholdRaw
      ? parseFloat(banThresholdRaw)
      : DEFAULT_SETTINGS.banThreshold;

    return {
      deleteSpamMessage,
      sendBanNotice,
      banNoticeTemplate,
      banThreshold: isNaN(banThreshold) ? DEFAULT_SETTINGS.banThreshold : banThreshold,
    };
  }

  async updateSettings(update: UpdateSettingsDto): Promise<SettingsDto> {
    if (update.deleteSpamMessage !== undefined) {
      await this.setKey('deleteSpamMessage', String(update.deleteSpamMessage));
    }
    if (update.sendBanNotice !== undefined) {
      await this.setKey('sendBanNotice', String(update.sendBanNotice));
    }
    if (update.banNoticeTemplate !== undefined) {
      await this.setKey('banNoticeTemplate', update.banNoticeTemplate);
    }
    if (update.banThreshold !== undefined) {
      await this.setKey('banThreshold', String(update.banThreshold));
    }

    return this.getSettings();
  }

  private async setKey(key: string, value: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing.length > 0) {
      await this.db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await this.db.insert(settings).values({ key, value });
    }
  }
}
