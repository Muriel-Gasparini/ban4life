import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  GroupMetadata,
  proto,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { BaileysStatus } from '@linkeshield/types';
import { loadEnv } from '../../config/env';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class BaileysService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysService.name);
  private sock: WASocket | null = null;
  private status: BaileysStatus = 'disconnected';
  private currentQrDataUrl: string | null = null;
  private groupMetadataCache = new Map<string, { meta: GroupMetadata; expiresAt: number }>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    private readonly groupsService: GroupsService,
    private readonly eventsService: EventsService,
    @Inject(forwardRef(() => ModerationService))
    private readonly moderationService: ModerationService,
  ) {}

  async onModuleInit() {
    const env = loadEnv();
    if (env.NODE_ENV !== 'test') {
      await this.startSocket();
    }
  }

  async onModuleDestroy() {
    this.isDestroyed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (err) {
        this.logger.error(`Error closing socket: ${err}`);
      }
    }
  }

  getStatus(): BaileysStatus {
    return this.status;
  }

  getQrCode(): string | null {
    return this.currentQrDataUrl;
  }

  private setStatus(status: BaileysStatus) {
    this.status = status;
    this.eventsService.emitStatus(status);
  }

  async startSocket(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      this.setStatus('connecting');
      const env = loadEnv();
      const authDir = path.resolve(env.AUTH_DIR);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 300 });
            this.setStatus('waiting_qr');
            this.logger.log('New WhatsApp QR Code generated for pairing');
          } catch (err: any) {
            this.logger.error(`Error generating QR data URL: ${err?.message}`);
          }
        }

        if (connection === 'close') {
          this.currentQrDataUrl = null;
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `WhatsApp connection closed (statusCode: ${statusCode}). Reconnect: ${shouldReconnect}`,
          );

          this.setStatus('disconnected');

          if (shouldReconnect && !this.isDestroyed) {
            this.reconnectTimeout = setTimeout(() => {
              this.startSocket();
            }, 5000);
          }
        } else if (connection === 'open') {
          this.currentQrDataUrl = null;
          this.setStatus('connected');
          this.logger.log('WhatsApp connection successfully opened!');

          // Sync groups on connect
          await this.syncAllGroups();
        }
      });

      // Listen for incoming messages
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          try {
            await this.moderationService.processIncomingMessage(msg);
          } catch (err: any) {
            this.logger.error(`Error processing message: ${err?.message || err}`);
          }
        }
      });

      // Listen for group events to keep metadata cache updated
      this.sock.ev.on('groups.update', (updates) => {
        for (const update of updates) {
          if (update.id) {
            this.groupMetadataCache.delete(update.id);
          }
        }
      });

      this.sock.ev.on('group-participants.update', (update) => {
        if (update.id) {
          this.groupMetadataCache.delete(update.id);
        }
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize Baileys socket: ${err?.message || err}`);
      this.setStatus('disconnected');
    }
  }

  async syncAllGroups(): Promise<void> {
    if (!this.sock) return;

    try {
      const groupData = await this.sock.groupFetchAllParticipating();
      const groupsList = Object.values(groupData).map((g) => ({
        id: g.id,
        name: g.subject || 'Grupo sem nome',
        participantCount: g.participants?.length || 0,
      }));

      await this.groupsService.syncGroups(groupsList);
      this.logger.log(`Synced ${groupsList.length} WhatsApp groups into database.`);
    } catch (err: any) {
      this.logger.error(`Failed to sync groups: ${err?.message || err}`);
    }
  }

  async getGroupMetadata(groupJid: string): Promise<GroupMetadata | null> {
    const cached = this.groupMetadataCache.get(groupJid);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.meta;
    }

    if (!this.sock) return null;

    try {
      const meta = await this.sock.groupMetadata(groupJid);
      // Cache for 2 minutes
      this.groupMetadataCache.set(groupJid, { meta, expiresAt: now + 120000 });
      return meta;
    } catch (err: any) {
      this.logger.error(`Failed to fetch metadata for group ${groupJid}: ${err?.message}`);
      return null;
    }
  }

  async isParticipantAdmin(groupJid: string, participantJid: string): Promise<boolean> {
    const meta = await this.getGroupMetadata(groupJid);
    if (!meta || !meta.participants) return false;

    // Normalize participant JID (remove device suffix if present)
    const normalizedTarget = participantJid.split(':')[0].split('@')[0];

    const participant = meta.participants.find((p) => {
      const pId = p.id.split(':')[0].split('@')[0];
      return pId === normalizedTarget;
    });

    if (!participant) return false;
    return participant.admin === 'admin' || participant.admin === 'superadmin';
  }

  async deleteMessage(remoteJid: string, key: proto.IMessageKey): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp socket not connected');
    await this.sock.sendMessage(remoteJid, { delete: key });
  }

  async removeParticipant(remoteJid: string, participantJid: string): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp socket not connected');
    await this.sock.groupParticipantsUpdate(remoteJid, [participantJid], 'remove');
  }

  async sendMessage(remoteJid: string, text: string): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp socket not connected');
    await this.sock.sendMessage(remoteJid, { text });
  }

  async restart(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {
        // ignore
      }
    }
    await this.startSocket();
  }
}
