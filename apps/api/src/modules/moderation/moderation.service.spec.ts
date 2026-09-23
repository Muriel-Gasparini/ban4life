import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { GroupsService } from '../groups/groups.service';
import { SettingsService } from '../settings/settings.service';
import { TypeSafeService } from '../typesafe/typesafe.service';
import { EventsService } from '../events/events.service';
import { BaileysService } from '../baileys/baileys.service';
import { DRIZZLE_DB, SQLITE_DB } from '../../database/database.module';
import { createDatabaseClient } from '../../database';
import Database from 'better-sqlite3';

describe('ModerationService', () => {
  let moderationService: ModerationService;
  let sqlite: Database.Database;

  const mockGroupsService = {
    isGroupProtected: jest.fn(),
    getGroup: jest.fn(),
  };

  const mockSettingsService = {
    getSettings: jest.fn(),
  };

  const mockTypeSafeService = {
    judgeSpam: jest.fn(),
  };

  const mockEventsService = {
    emitSpam: jest.fn(),
  };

  const mockBaileysService = {
    isParticipantAdmin: jest.fn(),
    deleteMessage: jest.fn(),
    removeParticipant: jest.fn(),
    sendMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const dbClient = createDatabaseClient(':memory:');
    sqlite = dbClient.sqlite;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: DRIZZLE_DB, useValue: dbClient.db },
        { provide: SQLITE_DB, useValue: sqlite },
        { provide: GroupsService, useValue: mockGroupsService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: TypeSafeService, useValue: mockTypeSafeService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: BaileysService, useValue: mockBaileysService },
      ],
    }).compile();

    moderationService = module.get<ModerationService>(ModerationService);

    mockSettingsService.getSettings.mockResolvedValue({
      sendBanNotice: true,
      banNoticeTemplate: 'Spam proibido.',
      banThreshold: 0.85,
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should ignore messages not from a group', async () => {
    const msg = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
      message: { conversation: 'https://spam.com' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockGroupsService.isGroupProtected).not.toHaveBeenCalled();
  });

  it('should ignore messages sent by the bot itself (fromMe)', async () => {
    const msg = {
      key: { remoteJid: '12345@g.us', fromMe: true },
      message: { conversation: 'https://spam.com' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockGroupsService.isGroupProtected).not.toHaveBeenCalled();
  });

  it('should ignore messages if group is not protected', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(false);

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'spammer@s.whatsapp.net', fromMe: false },
      message: { conversation: 'https://spam.com' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockBaileysService.isParticipantAdmin).not.toHaveBeenCalled();
  });

  it('should bypass moderation if sender is group admin', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockBaileysService.isParticipantAdmin.mockResolvedValue(true);

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'admin@s.whatsapp.net', fromMe: false },
      message: { conversation: 'https://link-util.com' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockTypeSafeService.judgeSpam).not.toHaveBeenCalled();
  });

  it('should allow normal conversation without links (zero API cost)', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'user@s.whatsapp.net', fromMe: false },
      message: { conversation: 'Bom dia pessoal! Alguma novidade sobre o projeto?' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockTypeSafeService.judgeSpam).not.toHaveBeenCalled();
  });

  it('should call Jev and NOT ban if score is below threshold', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    // Score is 0.40 (below 0.85)
    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.4,
      category: 'organic_or_legitimate',
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'user@s.whatsapp.net', fromMe: false },
      message: { conversation: 'Dêem uma olhada nessa lib: https://github.com/nestjs/nest' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockTypeSafeService.judgeSpam).toHaveBeenCalledWith(
      'Devs Brasil',
      'Dêem uma olhada nessa lib: https://github.com/nestjs/nest',
    );
    expect(mockBaileysService.deleteMessage).not.toHaveBeenCalled();
    expect(mockBaileysService.removeParticipant).not.toHaveBeenCalled();
  });

  it('should eliminate spammer (delete, kick, notice, log, sse) when score >= threshold', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    // Score is 0.98 (exceeds 0.85)
    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.98,
      category: 'blatant_broadcast_spam',
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'spammer@s.whatsapp.net', id: 'MSG123', fromMe: false },
      message: { conversation: 'Entre no nosso grupo vip de vagas e renda extra: chat.whatsapp.com/SPAM123' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(true);

    // Message deleted
    expect(mockBaileysService.deleteMessage).toHaveBeenCalledWith('12345@g.us', msg.key);

    // Participant removed
    expect(mockBaileysService.removeParticipant).toHaveBeenCalledWith('12345@g.us', 'spammer@s.whatsapp.net');

    // Notice sent
    expect(mockBaileysService.sendMessage).toHaveBeenCalledWith('12345@g.us', 'Spam proibido.');

    // Event emitted
    expect(mockEventsService.emitSpam).toHaveBeenCalledWith(
      expect.objectContaining({
        groupJid: '12345@g.us',
        groupName: 'Devs Brasil',
        senderJid: 'spammer@s.whatsapp.net',
        jevScore: 0.98,
        jevCategory: 'blatant_broadcast_spam',
        actionTaken: 'HARD_BAN_AND_DELETE',
      }),
    );

    // Check DB log
    const logs = await moderationService.listRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].jevScore).toBe(0.98);
    expect(logs[0].senderJid).toBe('spammer@s.whatsapp.net');
  });
});
