import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { GroupsService } from '../groups/groups.service';
import { SettingsService } from '../settings/settings.service';
import { TypeSafeService } from '../typesafe/typesafe.service';
import { EventsService } from '../events/events.service';
import { BaileysService } from '../baileys/baileys.service';
import { CacheService } from '../cache/cache.service';
import { DRIZZLE_DB, SQLITE_DB } from '../../database/database.module';
import { createDatabaseClient } from '../../database';
import Database from 'better-sqlite3';

describe('ModerationService (100% Pure Jev & LRU Cache)', () => {
  let moderationService: ModerationService;
  let cacheService: CacheService;
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
    isBotAdmin: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn(),
    removeParticipant: jest.fn(),
    kickParticipantFromAllProtected: jest.fn(),
    sendMessage: jest.fn(),
    resolveSenderInfo: jest.fn().mockImplementation((_g, senderJid, pushName) => {
      const isLid = senderJid?.endsWith('@lid');
      return Promise.resolve({
        senderPhone: isLid ? null : senderJid?.split('@')[0],
        senderName: pushName || null,
      });
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const dbClient = createDatabaseClient(':memory:');
    sqlite = dbClient.sqlite;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        CacheService,
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
    cacheService = module.get<CacheService>(CacheService);

    mockSettingsService.getSettings.mockResolvedValue({
      deleteSpamMessage: true,
      sendBanNotice: true,
      banNoticeTemplate: 'Spam proibido.',
      banThreshold: 0.85,
    });

    mockBaileysService.kickParticipantFromAllProtected.mockResolvedValue([]);
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

  it('should pass through pure media messages without caption', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'user@s.whatsapp.net', fromMe: false },
      message: { imageMessage: { url: 'https://example.com/photo.jpg' } },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockTypeSafeService.judgeSpam).not.toHaveBeenCalled();
  });

  it('should evaluate 100% of messages via Pure Jev (even without links) and allow legitimate messages', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    // Pure Jev evaluates organic conversation
    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.05,
      category: 'organic_or_legitimate',
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'user@s.whatsapp.net', fromMe: false },
      message: { conversation: 'Bom dia pessoal! Alguma novidade sobre o projeto?' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockTypeSafeService.judgeSpam).toHaveBeenCalledWith(
      'Devs Brasil',
      'Bom dia pessoal! Alguma novidade sobre o projeto?',
    );

    const metrics = await moderationService.getMetrics();
    expect(metrics.totalEvaluated).toBe(1);
    expect(metrics.totalSpamsBanned).toBe(0);
  });

  it('should eliminate spammer and trigger cross-group global ban when score >= threshold', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);
    mockBaileysService.kickParticipantFromAllProtected.mockResolvedValue(['other-group@g.us']);

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

    // Participant removed from origin group
    expect(mockBaileysService.removeParticipant).toHaveBeenCalledWith('12345@g.us', 'spammer@s.whatsapp.net');

    // Global cross-group ban executed
    expect(mockBaileysService.kickParticipantFromAllProtected).toHaveBeenCalledWith(
      'spammer@s.whatsapp.net',
      '12345@g.us',
    );

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
        actionTaken: 'CROSS_GROUP_BAN_AND_DELETE',
        isCrossGroupBan: true,
      }),
    );

    // Check DB log
    const logs = await moderationService.listRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].jevScore).toBe(0.98);
    expect(logs[0].isCrossGroupBan).toBe(true);

    const metrics = await moderationService.getMetrics();
    expect(metrics.totalEvaluated).toBe(1);
    expect(metrics.totalSpamsBanned).toBe(1);
  });

  it('should not delete message when deleteSpamMessage is false in settings', async () => {
    mockSettingsService.getSettings.mockResolvedValue({
      deleteSpamMessage: false,
      sendBanNotice: false,
      banNoticeTemplate: 'Spam proibido.',
      banThreshold: 0.85,
    });

    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);
    mockBaileysService.kickParticipantFromAllProtected.mockResolvedValue([]);

    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.98,
      category: 'blatant_broadcast_spam',
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'spammer@s.whatsapp.net', id: 'MSG_NO_DEL', fromMe: false },
      message: { conversation: 'Entre no grupo de vagas: chat.whatsapp.com/SPAM_NO_DEL' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(true);

    // Message NOT deleted because deleteSpamMessage is false
    expect(mockBaileysService.deleteMessage).not.toHaveBeenCalled();

    // Spammer is still removed
    expect(mockBaileysService.removeParticipant).toHaveBeenCalledWith('12345@g.us', 'spammer@s.whatsapp.net');

    // Event emitted with actionTaken BAN_ONLY
    expect(mockEventsService.emitSpam).toHaveBeenCalledWith(
      expect.objectContaining({
        actionTaken: 'HARD_BAN_ONLY',
      }),
    );
  });

  it('should intercept duplicated spam in 0ms using LRU Cache without calling Jev API', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: 'group1@g.us', name: 'Grupo 1' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.99,
      category: 'blatant_broadcast_spam',
    });

    const spamText = 'Oportunidade única: https://pix.com/renda';
    const msg1 = {
      key: { remoteJid: 'group1@g.us', participant: 'spammer1@s.whatsapp.net', id: 'M1', fromMe: false },
      message: { conversation: spamText },
    };

    // First message: evaluated by Jev API
    await moderationService.processIncomingMessage(msg1);
    expect(mockTypeSafeService.judgeSpam).toHaveBeenCalledTimes(1);

    // Second message in another group with same text: intercepted by LRU cache!
    mockGroupsService.getGroup.mockResolvedValue({ id: 'group2@g.us', name: 'Grupo 2' });
    const msg2 = {
      key: { remoteJid: 'group2@g.us', participant: 'spammer2@s.whatsapp.net', id: 'M2', fromMe: false },
      message: { conversation: spamText },
    };

    const result2 = await moderationService.processIncomingMessage(msg2);
    expect(result2).toBe(true);
    // judgeSpam was NOT called a second time
    expect(mockTypeSafeService.judgeSpam).toHaveBeenCalledTimes(1);

    const metrics = await moderationService.getMetrics();
    expect(metrics.totalEvaluated).toBe(2);
    expect(metrics.totalSpamsBanned).toBe(2);
    expect(metrics.cacheHits).toBe(1);
  });

  it('should unwrap ephemeralMessage and evaluate media captions', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.95,
      category: 'blatant_broadcast_spam',
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'spammer@s.whatsapp.net', id: 'EPHEM_1', fromMe: false },
      message: {
        ephemeralMessage: {
          message: {
            imageMessage: {
              caption: 'Entre no grupo: https://abre.ai/golpe123',
            },
          },
        },
      },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(true);
    expect(mockTypeSafeService.judgeSpam).toHaveBeenCalledWith(
      'Devs Brasil',
      'Entre no grupo: https://abre.ai/golpe123',
    );
  });

  it('should not ban if TypeSafe service fails open returning score 0 on API error', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    // Fail-open response
    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0,
      category: 'organic_or_legitimate',
      fromFallback: true,
    });

    const msg = {
      key: { remoteJid: '12345@g.us', participant: 'user@s.whatsapp.net', id: 'ERR_1', fromMe: false },
      message: { conversation: 'Olha o link: https://meusite.com' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(false);
    expect(mockBaileysService.deleteMessage).not.toHaveBeenCalled();
    expect(mockBaileysService.removeParticipant).not.toHaveBeenCalled();

    // MUST NOT cache fallback judgments into LRU cache!
    expect(cacheService.has('Olha o link: https://meusite.com')).toBe(false);
  });

  it('should normalize sender JID by removing device identifiers and store clean JID', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Devs Brasil' });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);

    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.96,
      category: 'blatant_broadcast_spam',
      fromFallback: false,
    });

    const msg = {
      key: {
        remoteJid: '12345@g.us',
        participant: '551199999999:2@s.whatsapp.net', // Multi-device ID
        id: 'MSG_DEV_1',
        fromMe: false,
      },
      message: { conversation: 'Spam com device id' },
    };

    const result = await moderationService.processIncomingMessage(msg);
    expect(result).toBe(true);

    // Sender should be normalized to 551199999999@s.whatsapp.net
    expect(mockBaileysService.removeParticipant).toHaveBeenCalledWith(
      '12345@g.us',
      '551199999999@s.whatsapp.net',
    );

    const logs = await moderationService.listRecentLogs();
    expect(logs[0].senderJid).toBe('551199999999@s.whatsapp.net');
  });

  it('should handle concurrent metric increments atomically without race conditions', async () => {
    // Fire 10 concurrent evaluations
    await Promise.all([
      moderationService.incrementMetric({ evaluated: true, banned: true, cacheHit: false }),
      moderationService.incrementMetric({ evaluated: true, banned: false, cacheHit: true }),
      moderationService.incrementMetric({ evaluated: true, banned: true, cacheHit: true }),
      moderationService.incrementMetric({ evaluated: true, banned: false, cacheHit: false }),
      moderationService.incrementMetric({ evaluated: true, banned: true, cacheHit: false }),
    ]);

    const metrics = await moderationService.getMetrics();
    expect(metrics.totalEvaluated).toBe(5);
    expect(metrics.totalSpamsBanned).toBe(3);
    expect(metrics.cacheHits).toBe(2);
  });

  it('should capture pushName and resolve sender phone for spam logs', async () => {
    mockGroupsService.isGroupProtected.mockResolvedValue(true);
    mockGroupsService.getGroup.mockResolvedValue({ id: '12345@g.us', name: 'Ban4Life', isProtected: true });
    mockBaileysService.isParticipantAdmin.mockResolvedValue(false);
    mockTypeSafeService.judgeSpam.mockResolvedValue({
      isPromoSpamScore: 0.95,
      category: 'blatant_broadcast_spam',
      fromFallback: false,
    });

    const msgWithLidAndPushName = {
      key: {
        remoteJid: '12345@g.us',
        participant: '6726673789173@lid',
        id: 'MSG_LID_1',
        fromMe: false,
      },
      pushName: 'Spammer User',
      message: { conversation: 'Spam via LID' },
    };

    const result = await moderationService.processIncomingMessage(msgWithLidAndPushName);
    expect(result).toBe(true);

    const logs = await moderationService.listRecentLogs();
    const log = logs.find((l) => l.senderJid === '6726673789173@lid');
    expect(log).toBeDefined();
    expect(log?.senderName).toBe('Spammer User');
    expect(log?.senderPhone).toBeNull();
  });
});
