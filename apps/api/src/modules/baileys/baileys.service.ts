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
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  getBinaryNodeChild,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { BaileysStatus } from '@ban4life/types';
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
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        cachedGroupMetadata: async (jid) => {
          const cached = await this.getGroupMetadata(jid);
          return cached || undefined;
        },
        getMessage: async () => undefined,
      });

      // Wrap query to handle prekey 406 gracefully (matching WhatsApp Web's ensureE2ESessions error tolerance)
      const rawQuery = this.sock.query.bind(this.sock);
      this.sock.query = async (node: any, timeoutMs?: number) => {
        if (node?.tag === 'iq' && node?.attrs?.xmlns === 'encrypt' && node?.attrs?.type === 'get') {
          let result: any;
          try {
            result = await rawQuery(node, timeoutMs);
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            const statusCode = err?.output?.statusCode || err?.data;
            if (errMsg.includes('not-acceptable') || statusCode === 406) {
              this.logger.warn(
                `Gracefully handled prekeys 406 (not-acceptable) top-level error. Proceeding with empty session list.`,
              );
              return {
                tag: 'iq',
                attrs: { type: 'result', from: node.attrs?.to, id: node.attrs?.id },
                content: [{ tag: 'list', attrs: {}, content: [] }],
              };
            }
            throw err;
          }

          // WhatsApp Web ignores prekey errors per participant in ensureE2ESessions.
          // Baileys' parseAndInjectE2ESessions calls assertNodeErrorFree on each <user> node.
          // If any participant returns <error code="406" text="not-acceptable"/>, filter it out
          // so valid participant sessions are injected without throwing.
          try {
            const listNode = getBinaryNodeChild(result, 'list');
            if (listNode && Array.isArray(listNode.content)) {
              listNode.content = listNode.content.filter((userNode: any) => {
                const errChild = getBinaryNodeChild(userNode, 'error');
                if (errChild) {
                  this.logger.warn(
                    `Filtering out errored prekey user ${userNode?.attrs?.jid}: ${errChild?.attrs?.code || ''} (${errChild?.attrs?.text || 'error'})`,
                  );
                  return false;
                }
                return true;
              });
            }
          } catch (filterErr) {
            this.logger.warn(`Error filtering prekey query response: ${filterErr}`);
          }

          return result;
        }

        if (node?.tag === 'iq' && node?.attrs?.xmlns === 'usync') {
          try {
            return await rawQuery(node, timeoutMs);
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            const statusCode = err?.output?.statusCode || err?.data;
            if (errMsg.includes('not-acceptable') || statusCode === 406) {
              this.logger.warn(`Gracefully handled USync 406 (not-acceptable)`);
              return {
                tag: 'iq',
                attrs: { type: 'result', from: node.attrs?.to, id: node.attrs?.id },
                content: [],
              };
            }
            throw err;
          }
        }

        return rawQuery(node, timeoutMs);
      };

      // Wrap signalRepository.encryptMessage to tolerate missing sessions during sender-key distribution
      if (this.sock.signalRepository) {
        const origEncryptMessage = this.sock.signalRepository.encryptMessage.bind(
          this.sock.signalRepository,
        );
        this.sock.signalRepository.encryptMessage = async (args: { jid: string; data: Buffer }) => {
          try {
            return await origEncryptMessage(args);
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            if (errMsg.includes('No sessions') || errMsg.includes('SessionError')) {
              this.logger.warn(
                `No Signal session for ${args.jid}; continuing group sender-key distribution without this recipient.`,
              );
              return { type: 'msg', ciphertext: Buffer.alloc(0) };
            }
            throw err;
          }
        };
      }

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
      this.sock.ev.on('groups.update', async (updates) => {
        for (const update of updates) {
          if (update.id) {
            this.groupMetadataCache.delete(update.id);
            if (update.subject) {
              await this.groupsService.updateGroupName(update.id, update.subject);
            }
          }
        }
      });

      this.sock.ev.on('groups.upsert', async (groups) => {
        const groupsList = groups.map((g) => ({
          id: g.id,
          name: g.subject || 'Grupo sem nome',
          participantCount: g.participants?.length || 0,
          isBotAdmin: this.checkIfBotAdmin(g.participants),
        }));
        await this.groupsService.syncGroups(groupsList);
        for (const g of groups) {
          this.groupMetadataCache.set(g.id, { meta: g, expiresAt: Date.now() + 120000 });
        }
      });

      this.sock.ev.on('group-participants.update', async (update) => {
        if (!update.id) return;
        this.groupMetadataCache.delete(update.id);

        const botJid = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : null;
        const botLid = (this.sock?.user as any)?.lid
          ? jidNormalizedUser((this.sock?.user as any).lid)
          : null;

        const isBotAffected = (update.participants || []).some((p) => {
          const norm = jidNormalizedUser(p);
          return norm === botJid || (botLid && norm === botLid);
        });

        // If the bot itself was removed or left the group, avoid querying groupMetadata (which causes 403 forbidden)
        if (isBotAffected && update.action === 'remove') {
          this.logger.log(
            `Bot left or was removed from group ${update.id}. Updating admin status to false.`,
          );
          await this.groupsService.updateGroupAdminStatus(update.id, false);
          return;
        }

        try {
          const isBotAdmin = await this.isBotAdmin(update.id);
          await this.groupsService.updateGroupAdminStatus(update.id, isBotAdmin);
        } catch (err: any) {
          this.logger.debug(`Could not update admin status for group ${update.id}: ${err?.message}`);
        }
      });

      this.sock.ev.on('chats.delete', async (chatIds) => {
        for (const chatId of chatIds) {
          if (chatId.endsWith('@g.us')) {
            this.groupMetadataCache.delete(chatId);
            this.logger.log(`Group chat ${chatId} was deleted. Updating admin status to false.`);
            await this.groupsService.updateGroupAdminStatus(chatId, false);
          }
        }
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize Baileys socket: ${err?.message || err}`);
      this.setStatus('disconnected');
    }
  }

  checkIfBotAdmin(participants?: { id?: string; lid?: string; admin?: string | null }[]): boolean {
    if (!this.sock?.user?.id || !participants) return false;
    const botJid = jidNormalizedUser(this.sock.user.id);
    const botLid = (this.sock.user as any)?.lid ? jidNormalizedUser((this.sock.user as any).lid) : null;

    const participant = participants.find((p) => {
      const pId = p.id ? jidNormalizedUser(p.id) : null;
      const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
      return (
        pId === botJid ||
        (botLid && pId === botLid) ||
        (pLid && pLid === botJid) ||
        (botLid && pLid && pLid === botLid)
      );
    });

    return !!participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  }

  async syncAllGroups(): Promise<void> {
    if (!this.sock) return;

    try {
      const groupData = await this.sock.groupFetchAllParticipating();
      const groupsList = Object.values(groupData).map((g) => ({
        id: g.id,
        name: g.subject || 'Grupo sem nome',
        participantCount: g.participants?.length || 0,
        isBotAdmin: this.checkIfBotAdmin(g.participants),
      }));

      await this.groupsService.syncGroups(groupsList);
      const now = Date.now();
      for (const g of Object.values(groupData)) {
        this.groupMetadataCache.set(g.id, { meta: g, expiresAt: now + 120000 });
      }
      const adminCount = groupsList.filter((g) => g.isBotAdmin).length;
      this.logger.log(
        `Synced ${groupsList.length} WhatsApp groups into database (${adminCount} where bot is admin).`,
      );
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
      const errMsg = err?.message || String(err);
      const statusCode = err?.output?.statusCode;
      const isExpectedNonParticipant =
        errMsg.includes('forbidden') ||
        errMsg.includes('item-not-found') ||
        statusCode === 403 ||
        statusCode === 404;

      if (isExpectedNonParticipant) {
        this.logger.debug(`Bot is not in group ${groupJid} (${errMsg}).`);
        this.groupMetadataCache.set(groupJid, { meta: null as any, expiresAt: now + 300000 });
        this.groupsService.updateGroupAdminStatus(groupJid, false).catch(() => {});
      } else {
        this.logger.error(`Failed to fetch metadata for group ${groupJid}: ${errMsg}`);
      }
      return null;
    }
  }

  async findParticipant(groupJid: string, participantJid: string) {
    const meta = await this.getGroupMetadata(groupJid);
    if (!meta || !meta.participants) return undefined;

    const normalizedTarget = jidNormalizedUser(participantJid);

    return meta.participants.find((p) => {
      const pId = jidNormalizedUser(p.id);
      const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
      return pId === normalizedTarget || pLid === normalizedTarget;
    });
  }

  async resolveSenderInfo(
    groupJid: string,
    senderJid: string,
    pushName?: string,
  ): Promise<{ senderPhone: string | null; senderName: string | null }> {
    let senderPhone: string | null = null;
    const senderName: string | null = pushName?.trim() || null;

    const normalized = jidNormalizedUser(senderJid);
    if (!normalized.endsWith('@lid')) {
      // It's a standard user JID (@s.whatsapp.net) -> real phone number
      senderPhone = normalized.split('@')[0].split(':')[0];
    } else {
      // It's a LID -> check if we can resolve the real phone number from groupMetadata
      try {
        const p = await this.findParticipant(groupJid, normalized);
        if (p && p.id && !p.id.endsWith('@lid')) {
          senderPhone = jidNormalizedUser(p.id).split('@')[0].split(':')[0];
        }
      } catch (err: any) {
        this.logger.debug(`Could not resolve LID to phone for ${senderJid}: ${err?.message || err}`);
      }
    }

    return { senderPhone, senderName };
  }

  async isParticipantAdmin(groupJid: string, participantJid: string): Promise<boolean> {
    const participant = await this.findParticipant(groupJid, participantJid);
    if (!participant) return false;
    return participant.admin === 'admin' || participant.admin === 'superadmin';
  }

  async isBotAdmin(groupJid: string): Promise<boolean> {
    const meta = await this.getGroupMetadata(groupJid);
    return this.checkIfBotAdmin(meta?.participants);
  }

  async deleteMessage(remoteJid: string, key: proto.IMessageKey): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp socket not connected');

    // 1. Fetch group metadata to inspect participants and addressing mode
    const meta = await this.getGroupMetadata(remoteJid);
    const rawParticipant = key.participant ? jidNormalizedUser(key.participant) : undefined;

    // Detect if group uses LID addressing mode
    // In WhatsApp Web: groupMetadata.isLidAddressingMode === true (h1gaUzU8ShV.js / qkMv12l7_Uz.js)
    const isLidGroup =
      (meta as any)?.addressingMode === 'lid' ||
      meta?.participants?.some((p) => p.id?.endsWith('@lid')) ||
      rawParticipant?.endsWith('@lid') === true;

    const addressingMode = isLidGroup ? 'lid' : 'pn';

    // 2. Resolve target participant JID matching group addressing mode
    let targetParticipant = rawParticipant;
    let altParticipant: string | null = null;

    if (rawParticipant && meta?.participants) {
      const pInfo = meta.participants.find((p) => {
        const pId = jidNormalizedUser(p.id);
        const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
        return pId === rawParticipant || pLid === rawParticipant;
      });

      if (pInfo) {
        const phoneJid = !pInfo.id?.endsWith('@lid') ? jidNormalizedUser(pInfo.id) : null;
        const lidJid = pInfo.lid
          ? jidNormalizedUser(pInfo.lid)
          : pInfo.id?.endsWith('@lid')
            ? jidNormalizedUser(pInfo.id)
            : null;

        if (isLidGroup) {
          targetParticipant = lidJid || rawParticipant;
          altParticipant = phoneJid && phoneJid !== targetParticipant ? phoneJid : null;
        } else {
          targetParticipant = phoneJid || rawParticipant;
          altParticipant = lidJid && lidJid !== targetParticipant ? lidJid : null;
        }
      }
    }

    // 3. Construct revocation ProtocolMessage per WhatsApp Web specification:
    // remoteJid is REQUIRED in key per official client (encodeKey in qE4J7Ug1ksE.js:129380 and processRevokeMsgs in qE4J7Ug1ksE.js:138980)
    const revokeMsg: proto.IMessage = {
      protocolMessage: {
        key: {
          remoteJid: key.remoteJid || remoteJid,
          id: key.id,
          fromMe: false,
          participant: targetParticipant,
        },
        type: proto.Message.ProtocolMessage.Type.REVOKE,
      },
    };

    const messageId = (this.sock as any).generateMessageTag
      ? (this.sock as any).generateMessageTag()
      : `${Date.now()}`;

    try {
      // Send directly via relayMessage with official admin revoke stanza attributes
      await this.sock.relayMessage(remoteJid, revokeMsg, {
        messageId,
        useCachedGroupMetadata: true,
        additionalAttributes: {
          edit: '8', // Admin revoke (WAWebAck.EDIT_ATTR.ADMIN_REVOKE)
          addressing_mode: addressingMode,
        },
      });
      this.logger.log(
        `Admin revoke message sent for ${key.id} (participant: ${targetParticipant}, mode: ${addressingMode})`,
      );

      // If participant has dual identity (LID + Phone Number), also dispatch with alternative participant
      // to ensure both newer (LID) and legacy/hybrid (Phone Number) client databases match and revoke the message
      if (altParticipant) {
        const altMode = addressingMode === 'lid' ? 'pn' : 'lid';
        try {
          await this.sock.relayMessage(
            remoteJid,
            {
              protocolMessage: {
                key: {
                  remoteJid: key.remoteJid || remoteJid,
                  id: key.id,
                  fromMe: false,
                  participant: altParticipant,
                },
                type: proto.Message.ProtocolMessage.Type.REVOKE,
              },
            },
            {
              messageId: `${messageId}_alt`,
              useCachedGroupMetadata: true,
              additionalAttributes: {
                edit: '8',
                addressing_mode: altMode,
              },
            },
          );
          this.logger.debug(
            `Dual-mode admin revoke sent for ${key.id} (alt participant: ${altParticipant}, mode: ${altMode})`,
          );
        } catch (altErr: any) {
          this.logger.debug(`Secondary admin revoke skipped/failed: ${altErr?.message || altErr}`);
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.warn(
        `Initial admin revoke relay failed (${errMsg}). Trying alternative participant / mode...`,
      );
      this.logger.error(`Initial admin revoke error stack: ${err?.stack || err}`);

      // If failed and we have an alternative participant format (LID <-> PN), retry with alternative
      if (altParticipant) {
        const altMode = addressingMode === 'lid' ? 'pn' : 'lid';
        try {
          await this.sock.relayMessage(
            remoteJid,
            {
              protocolMessage: {
                key: {
                  remoteJid: key.remoteJid || remoteJid,
                  id: key.id,
                  fromMe: false,
                  participant: altParticipant,
                },
                type: proto.Message.ProtocolMessage.Type.REVOKE,
              },
            },
            {
              messageId: `${messageId}_alt`,
              useCachedGroupMetadata: true,
              additionalAttributes: {
                edit: '8',
                addressing_mode: altMode,
              },
            },
          );
          this.logger.log(
            `Admin revoke succeeded on retry with alternative participant ${altParticipant} (mode: ${altMode})`,
          );
          return;
        } catch (retryErr: any) {
          this.logger.warn(`Alternative admin revoke also failed: ${retryErr?.message || retryErr}`);
        }
      }

      // Fallback: standard Baileys delete with remoteJid included in case server expects it
      try {
        await this.sock.sendMessage(remoteJid, {
          delete: {
            remoteJid: key.remoteJid || remoteJid,
            id: key.id,
            fromMe: false,
            participant: targetParticipant,
          },
        });
        this.logger.log(`Admin revoke succeeded via standard sendMessage fallback for ${key.id}`);
        return;
      } catch (fallbackErr: any) {
        this.logger.error(
          `All admin revoke attempts failed for ${key.id}: ${fallbackErr?.message || fallbackErr}`,
        );
        this.logger.error(`Fallback error stack: ${fallbackErr?.stack || fallbackErr}`);
        throw err;
      }
    }
  }

  async removeParticipant(remoteJid: string, participantJid: string): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp socket not connected');
    this.groupMetadataCache.delete(remoteJid);
    const normalizedJid = jidNormalizedUser(participantJid);
    const results = await this.sock.groupParticipantsUpdate(remoteJid, [normalizedJid], 'remove');
    this.groupMetadataCache.delete(remoteJid);
    const res = results?.[0];
    if (res && res.status && res.status !== '200' && res.status !== '204') {
      throw new Error(`WhatsApp rejected participant removal with status ${res.status}`);
    }
  }

  async kickParticipantFromAllProtected(
    spammerJid: string,
    excludeGroupJid?: string,
  ): Promise<string[]> {
    if (!this.sock) {
      this.logger.warn('Cannot perform cross-group ban: socket not connected');
      return [];
    }

    const protectedGroups = await this.groupsService.listProtectedGroups();
    const kickedFromGroups: string[] = [];
    const normalizedSpammer = jidNormalizedUser(spammerJid);
    const botJid = this.sock.user?.id ? jidNormalizedUser(this.sock.user.id) : null;

    for (const group of protectedGroups) {
      if (excludeGroupJid && group.id === excludeGroupJid) {
        continue;
      }

      try {
        const meta = await this.getGroupMetadata(group.id);
        if (!meta || !meta.participants) continue;

        // Check if bot is admin in this group
        if (botJid) {
          const botParticipant = meta.participants.find(
            (p) => jidNormalizedUser(p.id) === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
          if (!isBotAdmin) {
            this.logger.debug(
              `Skipping cross-group ban in ${group.id}: Bot is not admin in "${group.name}"`,
            );
            continue;
          }
        }

        // Check if spammer is participant in this group
        const isSpammerInGroup = meta.participants.some(
          (p) => jidNormalizedUser(p.id) === normalizedSpammer,
        );

        if (isSpammerInGroup) {
          this.logger.warn(
            `CROSS-GROUP BAN: Removing spammer ${normalizedSpammer} from protected group "${group.name}" (${group.id})`,
          );
          await this.removeParticipant(group.id, normalizedSpammer);
          kickedFromGroups.push(group.id);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to cross-group kick ${spammerJid} from ${group.id}: ${err?.message || err}`,
        );
      }
    }

    return kickedFromGroups;
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
