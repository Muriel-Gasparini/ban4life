import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { desc } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import { DrizzleDB } from '../../database';
import { spamLogs } from '../../database/schema';
import { SpamLogDto } from '@linkeshield/types';
import { GroupsService } from '../groups/groups.service';
import { SettingsService } from '../settings/settings.service';
import { TypeSafeService } from '../typesafe/typesafe.service';
import { EventsService } from '../events/events.service';
import { BaileysService } from '../baileys/baileys.service';
import {
  extractMessageText,
  containsSuspiciousPatternOrLink,
} from './text-filter.util';

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
      messageText: r.messageText,
      jevScore: r.jevScore,
      jevCategory: r.jevCategory,
      actionTaken: r.actionTaken,
      createdAt: r.createdAt,
    }));
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

    // Determine sender JID
    const senderJid = key.participant || msg.participant;
    if (!senderJid) {
      return false;
    }

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

    // 5. Extract text & check for links / suspicious patterns
    const text = extractMessageText(msg.message);
    if (!text) {
      return false;
    }

    const hasSuspicion = containsSuspiciousPatternOrLink(text);
    if (!hasSuspicion) {
      // Allowed without calling AI: Zero API cost!
      return false;
    }

    // 6. Call TypeSafe Jev model
    const group = await this.groupsService.getGroup(remoteJid);
    const groupName = group?.name || 'Grupo WhatsApp';

    this.logger.log(
      `Evaluating message from ${senderJid} in "${groupName}" via TypeSafe Jev...`,
    );

    const judgment = await this.typesafeService.judgeSpam(groupName, text);
    const settings = await this.settingsService.getSettings();

    this.logger.log(
      `Jev evaluation result: score=${judgment.isPromoSpamScore} vs threshold=${settings.banThreshold}, category=${judgment.category}`,
    );

    // 7. Ban if score meets or exceeds threshold
    if (judgment.isPromoSpamScore >= settings.banThreshold) {
      this.logger.warn(
        `SPAM DETECTED: Eliminating ${senderJid} from "${groupName}" (Score: ${judgment.isPromoSpamScore})`,
      );

      // Delete message
      try {
        await this.baileysService.deleteMessage(remoteJid, key);
      } catch (err: any) {
        this.logger.error(`Failed to delete message: ${err?.message || err}`);
      }

      // Ban/remove participant
      try {
        await this.baileysService.removeParticipant(remoteJid, senderJid);
      } catch (err: any) {
        this.logger.error(`Failed to remove participant: ${err?.message || err}`);
      }

      // Send ban notice if enabled
      if (settings.sendBanNotice && settings.banNoticeTemplate) {
        try {
          await this.baileysService.sendMessage(remoteJid, settings.banNoticeTemplate);
        } catch (err: any) {
          this.logger.error(`Failed to send ban notice: ${err?.message || err}`);
        }
      }

      // Record in spam_logs
      const logEntry: SpamLogDto = {
        id: uuidv4(),
        groupJid: remoteJid,
        groupName,
        senderJid,
        messageText: text,
        jevScore: judgment.isPromoSpamScore,
        jevCategory: judgment.category,
        actionTaken: 'HARD_BAN_AND_DELETE',
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
