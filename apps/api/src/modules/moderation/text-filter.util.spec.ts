import {
  extractMessageText,
  normalizeMessageText,
  unwrapMessage,
} from './text-filter.util';

describe('text-filter.util', () => {
  describe('extractMessageText', () => {
    it('should return null for undefined or empty message object', () => {
      expect(extractMessageText(undefined)).toBeNull();
      expect(extractMessageText(null)).toBeNull();
      expect(extractMessageText({})).toBeNull();
    });

    it('should extract plain conversation text', () => {
      const msg = { conversation: 'Olá pessoal, tudo bem?' };
      expect(extractMessageText(msg)).toBe('Olá pessoal, tudo bem?');
    });

    it('should extract extendedTextMessage text', () => {
      const msg = { extendedTextMessage: { text: 'Confira nosso novo site!' } };
      expect(extractMessageText(msg)).toBe('Confira nosso novo site!');
    });

    it('should extract image caption', () => {
      const msg = { imageMessage: { caption: 'Foto do evento' } };
      expect(extractMessageText(msg)).toBe('Foto do evento');
    });

    it('should return null for image without caption', () => {
      const msg = { imageMessage: { url: 'https://example.com/image.jpg' } };
      expect(extractMessageText(msg)).toBeNull();
    });

    it('should extract video caption', () => {
      const msg = { videoMessage: { caption: 'Vídeo da apresentação' } };
      expect(extractMessageText(msg)).toBe('Vídeo da apresentação');
    });

    it('should return null for video without caption', () => {
      const msg = { videoMessage: { seconds: 15 } };
      expect(extractMessageText(msg)).toBeNull();
    });

    it('should extract document caption', () => {
      const msg = { documentMessage: { caption: 'Relatório em PDF' } };
      expect(extractMessageText(msg)).toBe('Relatório em PDF');
    });

    it('should return null for document without caption', () => {
      const msg = { documentMessage: { fileName: 'relatorio.pdf' } };
      expect(extractMessageText(msg)).toBeNull();
    });

    it('should extract text from ephemeral message wrappers', () => {
      const msg = {
        ephemeralMessage: {
          message: {
            conversation: 'Mensagem em grupo com mensagens temporárias ativas',
          },
        },
      };
      expect(extractMessageText(msg)).toBe(
        'Mensagem em grupo com mensagens temporárias ativas',
      );
    });

    it('should extract caption from viewOnceMessage and viewOnceMessageV2 wrappers', () => {
      const msg1 = {
        viewOnceMessage: {
          message: {
            imageMessage: {
              caption: 'Foto de visualização única com link https://promo.com',
            },
          },
        },
      };
      expect(extractMessageText(msg1)).toBe(
        'Foto de visualização única com link https://promo.com',
      );

      const msg2 = {
        viewOnceMessageV2: {
          message: {
            videoMessage: {
              caption: 'Vídeo secreto com oferta',
            },
          },
        },
      };
      expect(extractMessageText(msg2)).toBe('Vídeo secreto com oferta');
    });

    it('should extract text from edited message wrappers', () => {
      const msg = {
        editedMessage: {
          message: {
            conversation: 'Texto editado pelo usuário',
          },
        },
      };
      expect(extractMessageText(msg)).toBe('Texto editado pelo usuário');
    });

    it('should return null when text is only whitespace', () => {
      expect(extractMessageText({ conversation: '   ' })).toBeNull();
      expect(extractMessageText({ extendedTextMessage: { text: '  \n  ' } })).toBeNull();
    });
  });

  describe('normalizeMessageText', () => {
    it('should trim, lowercase, and collapse multiple whitespace', () => {
      expect(normalizeMessageText('  OLÁ   MUNDO \n\n Teste  ')).toBe('olá mundo teste');
    });

    it('should handle empty or null values', () => {
      expect(normalizeMessageText('')).toBe('');
      expect(normalizeMessageText(null as any)).toBe('');
    });
  });

  describe('unwrapMessage', () => {
    it('should handle deeply nested wrappers', () => {
      const deeplyNested = {
        ephemeralMessage: {
          message: {
            viewOnceMessage: {
              message: {
                conversation: 'Deep text',
              },
            },
          },
        },
      };
      expect(unwrapMessage(deeplyNested)).toEqual({ conversation: 'Deep text' });
    });
  });
});
