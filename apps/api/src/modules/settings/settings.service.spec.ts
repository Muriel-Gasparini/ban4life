import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, DEFAULT_SETTINGS } from './settings.service';
import { DRIZZLE_DB, SQLITE_DB } from '../../database/database.module';
import { createDatabaseClient } from '../../database';
import Database from 'better-sqlite3';

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let sqlite: Database.Database;

  beforeEach(async () => {
    const dbClient = createDatabaseClient(':memory:');
    sqlite = dbClient.sqlite;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: DRIZZLE_DB, useValue: dbClient.db },
        { provide: SQLITE_DB, useValue: sqlite },
      ],
    }).compile();

    settingsService = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return default settings when table is empty', async () => {
    const settings = await settingsService.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.deleteSpamMessage).toBe(true);
  });

  it('should update settings and return new values', async () => {
    const updated = await settingsService.updateSettings({
      deleteSpamMessage: false,
      sendBanNotice: true,
      banNoticeTemplate: 'Custom warning message',
      banThreshold: 0.9,
    });

    expect(updated.deleteSpamMessage).toBe(false);
    expect(updated.sendBanNotice).toBe(true);
    expect(updated.banNoticeTemplate).toBe('Custom warning message');
    expect(updated.banThreshold).toBe(0.9);

    const retrieved = await settingsService.getSettings();
    expect(retrieved).toEqual(updated);
  });

  it('should update partial settings', async () => {
    await settingsService.updateSettings({ deleteSpamMessage: false });
    const settings = await settingsService.getSettings();

    expect(settings.deleteSpamMessage).toBe(false);
    expect(settings.sendBanNotice).toBe(DEFAULT_SETTINGS.sendBanNotice);
    expect(settings.banNoticeTemplate).toBe(DEFAULT_SETTINGS.banNoticeTemplate);
    expect(settings.banThreshold).toBe(DEFAULT_SETTINGS.banThreshold);
  });
});
