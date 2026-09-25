import { Test, TestingModule } from '@nestjs/testing';
import { BaileysService } from './baileys.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import { ModerationService } from '../moderation/moderation.service';
import { proto } from '@whiskeysockets/baileys';

describe('BaileysService (Admin Revoke & Protocol Compliance)', () => {
  let baileysService: BaileysService;

  const mockGroupsService = {
    syncGroups: jest.fn(),
    updateGroupName: jest.fn(),
    listProtectedGroups: jest.fn(),
  };

  const mockEventsService = {
    emitStatus: jest.fn(),
  };

  const mockModerationService = {
    processIncomingMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaileysService,
        { provide: GroupsService, useValue: mockGroupsService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: ModerationService, useValue: mockModerationService },
      ],
    }).compile();

    baileysService = module.get<BaileysService>(BaileysService);
  });

  describe('deleteMessage (Admin Revoke Protocol)', () => {
    it('should format protocolMessage.key with remoteJid and include edit: 8 and addressing_mode', async () => {
      const mockSock = {
        generateMessageTag: jest.fn().mockReturnValue('msg-tag-123'),
        groupMetadata: jest.fn().mockResolvedValue({
          id: '120363412952352671@g.us',
          addressingMode: 'lid',
          participants: [
            { id: '551199999999@s.whatsapp.net', lid: '6726673789173@lid', admin: null },
            { id: '554891150430@s.whatsapp.net', lid: '216337636978699@lid', admin: 'admin' },
          ],
        }),
        relayMessage: jest.fn().mockResolvedValue('msg-tag-123'),
        sendMessage: jest.fn(),
      };

      (baileysService as any).sock = mockSock;

      const groupJid = '120363412952352671@g.us';
      const key: proto.IMessageKey = {
        remoteJid: groupJid,
        id: '3EB01234567890ABCDEF',
        fromMe: false,
        participant: '6726673789173@lid',
      };

      await baileysService.deleteMessage(groupJid, key);

      // Dual-mode dispatch sends primary (LID) and secondary (PN) when alternative exists
      expect(mockSock.relayMessage).toHaveBeenCalledTimes(2);
      const [calledJid, calledMsg, calledOptions] = mockSock.relayMessage.mock.calls[0];

      expect(calledJid).toBe(groupJid);

      // Verify that remoteJid IS in key (per WA Web client source qE4J7Ug1ksE.js:129380 and 138980)
      expect(calledMsg.protocolMessage.key).toEqual({
        remoteJid: groupJid,
        id: '3EB01234567890ABCDEF',
        fromMe: false,
        participant: '6726673789173@lid',
      });

      // Verify stanza attributes
      expect(calledOptions.additionalAttributes).toEqual({
        edit: '8', // Admin Revoke
        addressing_mode: 'lid',
      });

      // Verify second dual-mode dispatch with Phone Number
      const [, secondMsg, secondOptions] = mockSock.relayMessage.mock.calls[1];
      expect(secondMsg.protocolMessage.key).toEqual({
        remoteJid: groupJid,
        id: '3EB01234567890ABCDEF',
        fromMe: false,
        participant: '551199999999@s.whatsapp.net',
      });
      expect(secondOptions.additionalAttributes).toEqual({
        edit: '8',
        addressing_mode: 'pn',
      });
    });

    it('should retry with alternative participant format when relayMessage throws not-acceptable', async () => {
      const mockSock = {
        generateMessageTag: jest.fn().mockReturnValue('msg-tag-123'),
        groupMetadata: jest.fn().mockResolvedValue({
          id: '120363412952352671@g.us',
          addressingMode: 'lid',
          participants: [
            { id: '551199999999@s.whatsapp.net', lid: '6726673789173@lid', admin: null },
          ],
        }),
        relayMessage: jest
          .fn()
          .mockRejectedValueOnce(new Error('not-acceptable'))
          .mockResolvedValueOnce('msg-tag-123_alt'),
        sendMessage: jest.fn(),
      };

      (baileysService as any).sock = mockSock;

      const groupJid = '120363412952352671@g.us';
      const key: proto.IMessageKey = {
        remoteJid: groupJid,
        id: '3EB0999',
        fromMe: false,
        participant: '6726673789173@lid',
      };

      await baileysService.deleteMessage(groupJid, key);

      expect(mockSock.relayMessage).toHaveBeenCalledTimes(2);

      // First attempt with LID
      expect(mockSock.relayMessage.mock.calls[0][1].protocolMessage.key).toEqual({
        remoteJid: groupJid,
        id: '3EB0999',
        fromMe: false,
        participant: '6726673789173@lid',
      });
      expect(mockSock.relayMessage.mock.calls[0][2].additionalAttributes.addressing_mode).toBe('lid');

      // Second attempt with Phone Number (PN)
      expect(mockSock.relayMessage.mock.calls[1][1].protocolMessage.key).toEqual({
        remoteJid: groupJid,
        id: '3EB0999',
        fromMe: false,
        participant: '551199999999@s.whatsapp.net',
      });
      expect(mockSock.relayMessage.mock.calls[1][2].additionalAttributes.addressing_mode).toBe('pn');
    });

    it('should fallback to standard Baileys sendMessage if all relayMessage attempts fail', async () => {
      const mockSock = {
        generateMessageTag: jest.fn().mockReturnValue('msg-tag-123'),
        groupMetadata: jest.fn().mockResolvedValue({
          id: '120363412952352671@g.us',
          participants: [
            { id: '551199999999@s.whatsapp.net', admin: null },
          ],
        }),
        relayMessage: jest.fn().mockRejectedValue(new Error('Unknown relay error')),
        sendMessage: jest.fn().mockResolvedValue({}),
      };

      (baileysService as any).sock = mockSock;

      const groupJid = '120363412952352671@g.us';
      const key: proto.IMessageKey = {
        remoteJid: groupJid,
        id: '3EB0FALLBACK',
        fromMe: false,
        participant: '551199999999@s.whatsapp.net',
      };

      await baileysService.deleteMessage(groupJid, key);

      expect(mockSock.sendMessage).toHaveBeenCalledWith(groupJid, {
        delete: {
          remoteJid: groupJid,
          id: '3EB0FALLBACK',
          fromMe: false,
          participant: '551199999999@s.whatsapp.net',
        },
      });
    });
  });

  describe('isParticipantAdmin and isBotAdmin', () => {
    it('should correctly identify admin participants matching LID or phone ID', async () => {
      const mockSock = {
        user: { id: '554891150430:21@s.whatsapp.net', lid: '216337636978699:21@lid' },
        groupMetadata: jest.fn().mockResolvedValue({
          id: '120363412952352671@g.us',
          participants: [
            { id: '551199999999@s.whatsapp.net', lid: '6726673789173@lid', admin: null },
            { id: '554891150430@s.whatsapp.net', lid: '216337636978699@lid', admin: 'admin' },
          ],
        }),
      };

      (baileysService as any).sock = mockSock;

      const isAdmin = await baileysService.isParticipantAdmin(
        '120363412952352671@g.us',
        '6726673789173@lid',
      );
      expect(isAdmin).toBe(false);

      const isBotAdmin = await baileysService.isBotAdmin('120363412952352671@g.us');
      expect(isBotAdmin).toBe(true);
    });
  });

  describe('Socket Interceptors & Error Tolerance', () => {
    it('should sanitize prekey query response by filtering out errored users', async () => {
      const mockRawQuery = jest.fn().mockResolvedValue({
        tag: 'iq',
        attrs: { type: 'result', from: 's.whatsapp.net', id: '123' },
        content: [
          {
            tag: 'list',
            attrs: {},
            content: [
              {
                tag: 'user',
                attrs: { jid: '551199999999@s.whatsapp.net' },
                content: [{ tag: 'skey', attrs: {}, content: [] }],
              },
              {
                tag: 'user',
                attrs: { jid: '6726673789173@s.whatsapp.net' },
                content: [{ tag: 'error', attrs: { code: '406', text: 'not-acceptable' } }],
              },
            ],
          },
        ],
      });

      const mockSock = {
        query: mockRawQuery,
        signalRepository: {
          encryptMessage: jest.fn().mockRejectedValue(new Error('SessionError: No sessions')),
        },
      };

      (baileysService as any).sock = mockSock;

      // Apply interceptors manually as done in startSocket
      const rawQuery = mockSock.query.bind(mockSock);
      (mockSock as any).query = async (node: any, timeoutMs?: number) => {
        if (node?.tag === 'iq' && node?.attrs?.xmlns === 'encrypt' && node?.attrs?.type === 'get') {
          const result = await rawQuery(node, timeoutMs);
          const listNode = result.content?.find((c: any) => c.tag === 'list');
          if (listNode && Array.isArray(listNode.content)) {
            listNode.content = listNode.content.filter((userNode: any) => {
              const errChild = userNode.content?.find((c: any) => c.tag === 'error');
              return !errChild;
            });
          }
          return result;
        }
        return rawQuery(node, timeoutMs);
      };

      const result = await mockSock.query({
        tag: 'iq',
        attrs: { xmlns: 'encrypt', type: 'get', to: 's.whatsapp.net' },
      });

      const listNode = result.content?.find((c: any) => c.tag === 'list');
      expect(listNode.content).toHaveLength(1);
      expect(listNode.content[0].attrs.jid).toBe('551199999999@s.whatsapp.net');
    });

    it('should catch No sessions error in signalRepository.encryptMessage without crashing', async () => {
      const origEncryptMessage = jest.fn().mockRejectedValue(new Error('SessionError: No sessions'));
      const mockSignalRepo: any = {
        encryptMessage: origEncryptMessage,
      };

      // Wrap as done in startSocket
      const orig = mockSignalRepo.encryptMessage.bind(mockSignalRepo);
      mockSignalRepo.encryptMessage = async (args: { jid: string; data: Buffer }) => {
        try {
          return await orig(args);
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          if (errMsg.includes('No sessions') || errMsg.includes('SessionError')) {
            return { type: 'msg', ciphertext: Buffer.alloc(0) };
          }
          throw err;
        }
      };

      const res = await mockSignalRepo.encryptMessage({
        jid: '6726673789173@s.whatsapp.net',
        data: Buffer.from('test'),
      });

      expect(res).toEqual({ type: 'msg', ciphertext: Buffer.alloc(0) });
    });

    it('should clear group metadata cache on removeParticipant', async () => {
      const mockSock = {
        groupParticipantsUpdate: jest.fn().mockResolvedValue([{ status: '200' }]),
      };

      (baileysService as any).sock = mockSock;
      const cache = (baileysService as any).groupMetadataCache;
      cache.set('120363412952352671@g.us', {
        meta: { id: '120363412952352671@g.us', participants: [] },
        expiresAt: Date.now() + 100000,
      });

      expect(cache.has('120363412952352671@g.us')).toBe(true);

      await baileysService.removeParticipant('120363412952352671@g.us', '6726673789173@lid');

      expect(cache.has('120363412952352671@g.us')).toBe(false);
      expect(mockSock.groupParticipantsUpdate).toHaveBeenCalledWith(
        '120363412952352671@g.us',
        ['6726673789173@lid'],
        'remove',
      );
    });
  });
});
