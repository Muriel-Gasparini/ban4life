import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { desc, eq, sql } from 'drizzle-orm';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { DRIZZLE_DB } from '../../database/database.module';
import { DrizzleDB } from '../../database';
import { spamLogs, metrics } from '../../database/schema';
import { SpamLogDto } from '@ban4life/types';
import { GroupsService } from '../groups/groups.service';
import { SettingsService } from '../settings/settings.service';
import { TypeSafeService } from '../typesafe/typesafe.service';
import { EventsService } from '../events/events.service';
import { BaileysService } from '../baileys/baileys.service';
import { CacheService } from '../cache/cache.service';
import { extractMessageText } from './text-filter.util';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly groupsService: GroupsService,
    private readonly settingsService: SettingsService,
    private readonly typesafeService: TypeSafeService,
    private readonly eventsService: EventsService,
    @Inject(forwardRef(() => BaileysService))
    private readonly baileysService: BaileysService,
    private readonly cacheService: CacheService,
  ) {}

  async listRecentLogs(limit = 50): Promise<SpamLogDto[]> {
    const rows = await this.db
      .select()
      .from(spamLogs)
      .orderBy(desc(spamLogs.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      groupJid: r.groupJid,
      groupName: r.groupName,
      senderJid: r.senderJid,
      senderName: r.senderName,
      senderPhone: r.senderPhone,
      messageText: r.messageText,
      jevScore: r.jevScore,
      jevCategory: r.jevCategory,
      actionTaken: r.actionTaken,
      isCrossGroupBan: Boolean(r.isCrossGroupBan),
      createdAt: r.createdAt,
    }));
  }

  async incrementMetric(opts: {
    evaluated?: boolean;
    banned?: boolean;
    cacheHit?: boolean;
  }): Promise<void> {
    try {
      const ev = opts.evaluated ? 1 : 0;
      const ban = opts.banned ? 1 : 0;
      const hit = opts.cacheHit ? 1 : 0;

      await this.db
        .insert(metrics)
        .values({
          id: 'global',
          totalEvaluated: ev,
          totalSpamsBanned: ban,
          cacheHits: hit,
        })
        .onConflictDoUpdate({
          target: metrics.id,
          set: {
            totalEvaluated: sql`${metrics.totalEvaluated} + ${ev}`,
            totalSpamsBanned: sql`${metrics.totalSpamsBanned} + ${ban}`,
            cacheHits: sql`${metrics.cacheHits} + ${hit}`,
          },
        });
    } catch (err: any) {
      this.logger.error(`Failed to increment metrics: ${err?.message || err}`);
    }
  }

  async getMetrics(): Promise<{ totalEvaluated: number; totalSpamsBanned: number; cacheHits: number }> {
    const rows = await this.db.select().from(metrics).where(eq(metrics.id, 'global'));
    if (rows.length === 0) {
      return { totalEvaluated: 0, totalSpamsBanned: 0, cacheHits: 0 };
    }
    return {
      totalEvaluated: rows[0].totalEvaluated,
      totalSpamsBanned: rows[0].totalSpamsBanned,
      cacheHits: rows[0].cacheHits,
    };
  }

  async processIncomingMessage(msg: any): Promise<boolean> {
    const key = msg.key;
    if (!key || !key.remoteJid) return false;

    const remoteJid = key.remoteJid;

    // 1. Must be a group message (...@g.us)
    if (!remoteJid.endsWith('@g.us')) {
      return false;
    }

    // 2. Ignore messages sent by the bot itself
    if (key.fromMe) {
      return false;
    }

    // Determine sender JID and normalize (strips device ID like :2@s.whatsapp.net)
    const rawSenderJid = key.participant || msg.participant;
    if (!rawSenderJid) {
      return false;
    }
    const senderJid = jidNormalizedUser(rawSenderJid);

    // 3. Check if group is protected
    const isProtected = await this.groupsService.isGroupProtected(remoteJid);
    if (!isProtected) {
      return false;
    }

    // 4. Check if sender is admin in this group (Admins bypass)
    const isAdmin = await this.baileysService.isParticipantAdmin(remoteJid, senderJid);
    if (isAdmin) {
      this.logger.debug(
        `Bypassing moderation: sender ${senderJid} is an admin in group ${remoteJid}`,
      );
      return false;
    }

    // 5. Extract text / captions (text, image captions, video captions, document captions)
    // Pure media without caption passes through directly without intervention
    const text = extractMessageText(msg.message);
    if (!text) {
      return false;
    }

    // 6. 100% Pure Jev Architecture with LRU Cache:
    // First, check LRU Cache for previously evaluated hash
    let judgment = this.cacheService.get(text);
    let fromCache = false;

    if (judgment) {
      fromCache = true;
      await this.incrementMetric({ evaluated: true, cacheHit: true });
      this.logger.log(
        `[0ms Cache Hit] Found verdict for text in group "${remoteJid}": score=${judgment.isPromoSpamScore}`,
      );
    } else {
      const group = await this.groupsService.getGroup(remoteJid);
      const groupName = group?.name || 'Grupo WhatsApp';

      this.logger.log(
        `Pure Jev evaluation for sender ${senderJid} in "${groupName}"...`,
      );

      judgment = await this.typesafeService.judgeSpam(groupName, text);
      // Only cache valid judgments from the API; never cache temporary fail-open errors
      if (!judgment.fromFallback) {
        this.cacheService.set(text, judgment);
      }
      await this.incrementMetric({ evaluated: true });
    }

    const settings = await this.settingsService.getSettings();

    if (fromCache) {
      this.logger.log(
        `[Cache Hit] Using cached verdict: score=${judgment.isPromoSpamScore} vs threshold=${settings.banThreshold}, category=${judgment.category} (Jev API not called, 0ms)`,
      );
    } else {
      this.logger.log(
        `Jev evaluation result: score=${judgment.isPromoSpamScore} vs threshold=${settings.banThreshold}, category=${judgment.category}`,
      );
    }

    // 7. Ban if score meets or exceeds threshold
    if (judgment.isPromoSpamScore >= settings.banThreshold) {
      await this.incrementMetric({ banned: true });

      const group = await this.groupsService.getGroup(remoteJid);
      const groupName = group?.name || 'Grupo WhatsApp';

      this.logger.warn(
        `SPAM DETECTED: Eliminating ${senderJid} from "${groupName}" (Score: ${judgment.isPromoSpamScore})`,
      );

      const isBotAdmin = await this.baileysService.isBotAdmin(remoteJid);
      if (!isBotAdmin) {
        this.logger.error(
          `⚠️ BOT IS NOT AN ADMIN in group "${groupName}" (${remoteJid})! WhatsApp requires the bot to be an Administrator to delete messages and kick members.`,
        );
      }

      const deleteKey = {
        remoteJid: key.remoteJid,
        id: key.id,
        fromMe: false,
        participant: jidNormalizedUser(key.participant || rawSenderJid),
      };

      // 1. Revoke the spam message first if deleteSpamMessage is enabled (default: true)
      if (settings.deleteSpamMessage !== false) {
        try {
          await this.baileysService.deleteMessage(remoteJid, deleteKey);
          this.logger.log(`Successfully deleted spam message in "${groupName}"`);
        } catch (delErr: any) {
          this.logger.error(`Failed to delete message: ${delErr?.message || delErr}`, delErr?.stack);
        }

        // Add a brief delivery grace period (~1000ms) so WhatsApp server delivers the admin revoke stanza
        // to participants before closing the session on removal
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        this.logger.log(
          `Skipping spam message deletion in "${groupName}" (deleteSpamMessage is disabled)`,
        );
      }

      // 2. Remove the spammer from the group
      try {
        await this.baileysService.removeParticipant(remoteJid, senderJid);
        this.logger.log(`Successfully removed spammer ${senderJid} from "${groupName}"`);
      } catch (remErr: any) {
        this.logger.error(`Failed to remove participant: ${remErr?.message || remErr}`);
      }

      // Ban global cross-group: remove spammer from all other protected groups where bot is admin
      let kickedOtherGroups: string[] = [];
      try {
        kickedOtherGroups = await this.baileysService.kickParticipantFromAllProtected(
          senderJid,
          remoteJid,
        );
      } catch (err: any) {
        this.logger.error(`Failed to perform cross-group ban: ${err?.message || err}`);
      }

      // Send ban notice if enabled
      if (settings.sendBanNotice && settings.banNoticeTemplate) {
        try {
          await this.baileysService.sendMessage(remoteJid, settings.banNoticeTemplate);
        } catch (err: any) {
          this.logger.error(`Failed to send ban notice: ${err?.message || err}`);
        }
      }

      const isCrossGroup = kickedOtherGroups.length > 0;
      const shouldDelete = settings.deleteSpamMessage !== false;
      const baseAction = shouldDelete ? 'BAN_AND_DELETE' : 'BAN_ONLY';

      const pushName = msg.pushName || undefined;
      const { senderPhone, senderName } = await this.baileysService.resolveSenderInfo(
        remoteJid,
        senderJid,
        pushName,
      );

      // Record in spam_logs
      const logEntry: SpamLogDto = {
        id: uuidv4(),
        groupJid: remoteJid,
        groupName,
        senderJid,
        senderName,
        senderPhone,
        messageText: text,
        jevScore: judgment.isPromoSpamScore,
        jevCategory: judgment.category,
        actionTaken: isCrossGroup ? `CROSS_GROUP_${baseAction}` : `HARD_${baseAction}`,
        isCrossGroupBan: isCrossGroup,
        createdAt: Date.now(),
      };

      await this.db.insert(spamLogs).values(logEntry);

      // Emit SSE event to update dashboard feed in real time
      this.eventsService.emitSpam(logEntry);

      return true;
    }

    return false;
  }
}
